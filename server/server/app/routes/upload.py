"""
app/routes/upload.py
────────────────────
Two upload endpoints:

1. POST /upload-statement  — async background processing (original)
2. POST /upload           — synchronous ML analysis returning credit & risk score

Both accept PDF and CSV files.
"""

from __future__ import annotations

import csv
import io
import logging
import re
import tempfile
from decimal import Decimal
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from google.cloud.firestore_v1.client import Client as FirestoreClient

from app.config import settings
from app.firestore_db import get_db, get_firestore_client, USERS_COL, BANK_STATEMENTS_COL, TRANSACTIONS_COL
from app.models.user import User
from app.models.transaction import BankStatement, Transaction
from app.schemas.transaction import UploadResponse, FCMTokenUpdate
from app.services.pdf_parser import extract_transactions
from app.services.ml_model import predict_fraud_score, predict_credit_score, predict_nlp_category
from app.services.gemini_service import analyze_statement_with_gemini
from app.utils.auth import get_current_user

router = APIRouter(tags=["Upload"])
logger = logging.getLogger(__name__)

_ALLOWED_CONTENT_TYPES = {
    "application/pdf", "application/x-pdf",
    "text/csv", "application/vnd.ms-excel",
}

def _classify_transaction(description: str) -> str:
    """Classify transaction using ML NLP model (Keyword extraction + TF-IDF)."""
    return predict_nlp_category(description)


def _parse_csv_transactions(content: bytes) -> list[dict]:
    """Parse CSV bank statement into transaction-like dicts."""
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    transactions = []
    for row in reader:
        # Try common column names
        desc = (
            row.get("description") or row.get("Description")
            or row.get("narration") or row.get("Narration")
            or row.get("particulars") or row.get("Particulars") or ""
        )
        amt_str = (
            row.get("amount") or row.get("Amount")
            or row.get("debit") or row.get("Debit")
            or row.get("withdrawal") or row.get("Withdrawal") or "0"
        )
        bal_str = (
            row.get("balance") or row.get("Balance")
            or row.get("closing") or row.get("Closing") or "0"
        )
        date_str = (
            row.get("date") or row.get("Date")
            or row.get("transaction_date") or row.get("Transaction Date") or ""
        )

        # Clean amount
        amt_clean = re.sub(r"[₹$€£,\s]", "", str(amt_str).strip())
        bal_clean = re.sub(r"[₹$€£,\s]", "", str(bal_str).strip())
        try:
            amount = float(amt_clean) if amt_clean else 0.0
        except ValueError:
            amount = 0.0
        try:
            balance = float(bal_clean) if bal_clean else 0.0
        except ValueError:
            balance = 0.0

        if amount == 0 and not desc:
            continue

        # Infer transaction type
        credit_kw = re.compile(
            r"\b(credit|salary|refund|interest|reversal|cashback|deposit)\b",
            re.IGNORECASE,
        )
        tx_type = "credit" if credit_kw.search(str(desc)) else "debit"

        transactions.append({
            "date": date_str,
            "description": str(desc),
            "amount": abs(amount),
            "balance": balance,
            "transaction_type": tx_type,
        })
    return transactions


# ── Background task (for the async upload-statement endpoint) ────────────────

def _process_statement(statement_id: str, file_path: str, user_id: str) -> None:
    """
    Runs in the background after upload:
      1. Parse PDF → ParsedTransaction list
      2. ML fraud score each transaction
      3. Bulk-insert into Firestore
      4. Update BankStatement status
    """
    db = get_firestore_client()
    stmt_ref = db.collection(BANK_STATEMENTS_COL).document(statement_id)

    try:
        stmt_ref.update({"status": "processing"})

        parsed = extract_transactions(file_path)

        batch = db.batch()
        prev_tx = None
        for p in parsed:
            tx_dict = {
                "amount": p.amount,
                "balance": p.balance,
                "description": p.description,
                "transaction_type": p.transaction_type,
                "date": p.date.isoformat() if p.date else None,
            }
            fraud_score = predict_fraud_score(tx_dict, prev_txn=prev_tx)
            txn = Transaction(
                statement_id=statement_id,
                user_id=user_id,
                date=p.date,
                description=p.description,
                amount=p.amount,
                balance=p.balance,
                transaction_type=p.transaction_type,
                is_suspicious=fraud_score >= 0.6 or tx_dict.get("geo_flagged", False),
                fraud_score=round(fraud_score, 4),
            )
            txn_ref = db.collection(TRANSACTIONS_COL).document(txn.id)
            batch.set(txn_ref, txn.to_dict())
            prev_tx = tx_dict

        batch.update(stmt_ref, {
            "status": "done",
            "total_transactions": len(parsed),
        })
        batch.commit()

        logger.info("Statement %s processed: %d transactions", statement_id, len(parsed))

    except Exception as exc:
        logger.error("Failed to process statement %s: %s", statement_id, exc)
        try:
            stmt_ref.update({"status": "failed"})
        except Exception:
            pass


# ──────────────────────────────────────────────────────────────────────────────
# ROUTE 1: POST /upload — synchronous analysis returning scores immediately
# ──────────────────────────────────────────────────────────────────────────────

@router.post(
    "/upload",
    summary="Upload & analyse a bank statement (synchronous)",
    description=(
        "Upload a PDF or CSV bank statement. The file is parsed inline, "
        "transactions are scored by the ML fraud model, and a credit score "
        "is computed. Returns all results immediately."
    ),
)
async def upload_and_analyse(
    file: UploadFile = File(..., description="Bank statement PDF or CSV"),
) -> dict[str, Any]:
    """
    Synchronous upload endpoint used by the React frontend.
    Returns: { creditScore, riskScore, transactions, categories, message }
    """
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )

    # ── Parse transactions ──────────────────────────────────────────────
    tx_dicts: list[dict] = []
    is_csv = file.content_type in ("text/csv", "application/vnd.ms-excel") or (
        file.filename and file.filename.lower().endswith(".csv")
    )

    if is_csv:
        tx_dicts = _parse_csv_transactions(content)
    else:
        # PDF — write to temp file and use pdfplumber / PyMuPDF
        suffix = ".pdf"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            parsed = extract_transactions(tmp_path)
            tx_dicts = [
                {
                    "date": p.date.isoformat() if p.date else None,
                    "description": p.description,
                    "amount": float(p.amount),
                    "balance": float(p.balance) if p.balance is not None else 0.0,
                    "transaction_type": p.transaction_type,
                }
                for p in parsed
            ]
        except Exception as e:
            logger.warning("PDF parse failed: %s", e)
            tx_dicts = []
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    # ── Try Gemini Analysis first if configured ─────────────────────────
    if is_csv == False and file.filename and settings.GEMINI_API_KEY:
        # Write to temp file for Gemini upload
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        gemini_result = analyze_statement_with_gemini(tmp_path)
        Path(tmp_path).unlink(missing_ok=True)
        
        if gemini_result:
            return {
                **gemini_result,
                "message": "Analysis complete — Processed by Gemini 1.5 Pro AI model."
            }

    if not tx_dicts:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract any transactions from the uploaded file. "
                   "Ensure the file is a valid bank statement in PDF or CSV format.",
        )

    # ── ML fraud scoring per transaction ────────────────────────────────
    total_income = 0.0
    total_expenses = 0.0
    balances: list[float] = []
    num_suspicious = 0
    num_overdrafts = 0
    category_totals: dict[str, float] = {}
    scored_txns: list[dict] = []

    # Sort transactions by date (oldest first or newest first) so consecutive checks make sense.
    # Usually bank statements are sorted by date. We will just pass the previous one in the list.
    prev_tx = None

    for tx in tx_dicts:
        fraud_score = predict_fraud_score(tx, prev_txn=prev_tx)
        geo_flagged = tx.get("geo_flagged", False)
        geo_alert = tx.get("geo_alert", "")
        
        is_suspicious = fraud_score >= 0.6 or geo_flagged
        if is_suspicious:
            num_suspicious += 1

        category = _classify_transaction(tx.get("description", ""))

        amount = float(tx.get("amount", 0))
        balance = float(tx.get("balance", 0))
        tx_type = tx.get("transaction_type", "debit")

        if tx_type == "credit":
            total_income += amount
        else:
            total_expenses += amount
            category_totals[category] = category_totals.get(category, 0) + amount

        if balance < 0:
            num_overdrafts += 1
        balances.append(balance)

        scored_txns.append({
            **tx,
            "fraud_score": round(fraud_score, 4),
            "is_suspicious": is_suspicious,
            "geo_flagged": geo_flagged,
            "geo_alert": geo_alert,
            "category": category,
        })
        
        prev_tx = tx

    # ── Compute credit score via ML model ───────────────────────────────
    avg_balance = sum(balances) / len(balances) if balances else 0.0
    summary = {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "avg_balance": avg_balance,
        "num_overdrafts": num_overdrafts,
        "num_suspicious": num_suspicious,
        "months": max(1, len(set(
            tx.get("date", "")[:7] for tx in tx_dicts if tx.get("date")
        )) or 1),
    }
    credit_result = predict_credit_score(summary)
    credit_score = credit_result["score"]

    # ── Compute overall risk score (0-100) ──────────────────────────────
    # Weighted composite: expenses ratio + fraud density + overdraft penalty
    if total_income > 0:
        expense_ratio = min(total_expenses / total_income, 1.5)
    else:
        expense_ratio = 0.5

    fraud_density = (num_suspicious / len(tx_dicts)) if tx_dicts else 0
    overdraft_rate = (num_overdrafts / len(tx_dicts)) if tx_dicts else 0

    risk_score = int(min(100, max(0,
        expense_ratio * 30 +
        fraud_density * 40 +
        overdraft_rate * 20 +
        (100 - credit_score / 8.5) * 0.1  # inverse of credit health
    )))

    logger.info(
        "Synchronous analysis: %d transactions, credit=%d, risk=%d",
        len(scored_txns), credit_score, risk_score,
    )

    return {
        "creditScore": credit_score,
        "riskScore": risk_score,
        "transactions": scored_txns,
        "categories": category_totals,
        "message": f"Analysis complete — {len(scored_txns)} transactions processed by ML model.",
    }


# ──────────────────────────────────────────────────────────────────────────────
# ROUTE 2: POST /upload-statement — async background processing (original)
# ──────────────────────────────────────────────────────────────────────────────

@router.post(
    "/upload-statement",
    response_model=UploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload a bank statement PDF (async)",
    description=(
        "Upload a PDF bank statement. The file is saved and parsed asynchronously. "
        "Poll GET /transactions?statement_id=<id> to retrieve results."
    ),
)
async def upload_statement(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Bank statement PDF"),
    db: FirestoreClient = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UploadResponse:
    # ── Validate ──────────────────────────────────────────────────────────
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Only PDF/CSV files are accepted. Got: {file.content_type}",
        )

    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )

    # ── Save to disk ──────────────────────────────────────────────────────
    safe_name = Path(file.filename).name.replace(" ", "_")
    save_path = settings.upload_path / current_user.id / safe_name
    save_path.parent.mkdir(parents=True, exist_ok=True)
    save_path.write_bytes(content)

    # ── Create Firestore document ─────────────────────────────────────────
    bank_stmt = BankStatement(
        user_id=current_user.id,
        filename=safe_name,
        file_path=str(save_path),
        status="pending",
    )
    db.collection(BANK_STATEMENTS_COL).document(bank_stmt.id).set(bank_stmt.to_dict())

    # ── Queue background parsing ──────────────────────────────────────────
    background_tasks.add_task(
        _process_statement, bank_stmt.id, str(save_path), current_user.id
    )

    return UploadResponse(
        statement_id=bank_stmt.id,
        filename=safe_name,
        status="pending",
        message="File uploaded successfully. Parsing started in background.",
        total_transactions=0,
    )


# ──────────────────────────────────────────────────────────────────────────────
# ROUTE 3: PUT /upload-statement/fcm-token
# ──────────────────────────────────────────────────────────────────────────────

@router.put(
    "/upload-statement/fcm-token",
    summary="Register or update FCM device token",
    status_code=status.HTTP_200_OK,
)
async def update_fcm_token(
    payload: FCMTokenUpdate,
    db: FirestoreClient = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    db.collection(USERS_COL).document(current_user.id).update({
        "fcm_token": payload.fcm_token
    })
    return {"message": "FCM token updated successfully."}
