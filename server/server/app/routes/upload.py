"""
app/routes/upload.py
────────────────────
POST /upload-statement

Accepts a PDF file, saves it to disk, launches async background
parsing (PDF → transactions → Firestore), and returns immediately with
a statement_id for polling.
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from google.cloud.firestore_v1.client import Client as FirestoreClient

from app.config import settings
from app.firestore_db import get_db, get_firestore_client, USERS_COL, BANK_STATEMENTS_COL, TRANSACTIONS_COL
from app.models.user import User
from app.models.transaction import BankStatement, Transaction
from app.schemas.transaction import UploadResponse, FCMTokenUpdate
from app.services.pdf_parser import extract_transactions
from app.services.ml_model import predict_fraud_score
from app.utils.auth import get_current_user

router = APIRouter(prefix="/upload-statement", tags=["Upload"])
logger = logging.getLogger(__name__)

_ALLOWED_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}


# ── Background task ───────────────────────────────────────────────────────────

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
        # Mark as processing
        stmt_ref.update({"status": "processing"})

        # Parse PDF
        parsed = extract_transactions(file_path)

        # Build transaction documents and write to Firestore
        batch = db.batch()
        for p in parsed:
            fraud_score = predict_fraud_score(
                {
                    "amount": p.amount,
                    "balance": p.balance,
                    "description": p.description,
                    "transaction_type": p.transaction_type,
                }
            )
            txn = Transaction(
                statement_id=statement_id,
                user_id=user_id,
                date=p.date,
                description=p.description,
                amount=p.amount,
                balance=p.balance,
                transaction_type=p.transaction_type,
                is_suspicious=fraud_score >= 0.6,
                fraud_score=round(fraud_score, 4),
            )
            txn_ref = db.collection(TRANSACTIONS_COL).document(txn.id)
            batch.set(txn_ref, txn.to_dict())

        # Update statement status
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


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=UploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload a bank statement PDF",
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
            detail=f"Only PDF files are accepted. Got: {file.content_type}",
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


@router.put(
    "/fcm-token",
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
