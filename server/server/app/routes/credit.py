"""
app/routes/credit.py
─────────────────────
POST /credit-score

Computes a credit score snapshot for a processed bank statement
using the ML model service and persists the result in Firestore.
"""

from __future__ import annotations

import json
import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore_v1.client import Client as FirestoreClient
from google.cloud.firestore_v1.base_query import FieldFilter

from app.firestore_db import get_db, BANK_STATEMENTS_COL, TRANSACTIONS_COL, CREDIT_SCORES_COL
from app.models.user import User
from app.models.transaction import Transaction, CreditScore
from app.schemas.transaction import CreditScoreRequest, CreditScoreOut
from app.services.ml_model import predict_credit_score
from app.utils.auth import get_current_user

router = APIRouter(prefix="/credit-score", tags=["Credit Score"])
logger = logging.getLogger(__name__)


def _build_summary(transactions: list[Transaction]) -> dict:
    total_income = Decimal(0)
    total_expenses = Decimal(0)
    balances: list[Decimal] = []
    num_overdrafts = 0
    num_suspicious = 0
    dates: set = set()

    for t in transactions:
        if t.transaction_type == "credit":
            total_income += t.amount
        else:
            total_expenses += t.amount
        if t.balance is not None:
            balances.append(t.balance)
            if t.balance < 0:
                num_overdrafts += 1
        if t.is_suspicious:
            num_suspicious += 1
        if t.date:
            dates.add((t.date.year, t.date.month))

    avg_balance = sum(balances) / len(balances) if balances else Decimal(0)
    months = max(len(dates), 1)
    return {
        "total_income": float(total_income), "total_expenses": float(total_expenses),
        "avg_balance": float(avg_balance), "num_overdrafts": num_overdrafts,
        "num_suspicious": num_suspicious, "months": months,
    }


@router.post("", response_model=CreditScoreOut, summary="Compute credit score for a statement")
async def compute_credit_score(
    payload: CreditScoreRequest,
    db: FirestoreClient = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CreditScoreOut:
    stmt_doc = db.collection(BANK_STATEMENTS_COL).document(payload.statement_id).get()
    if not stmt_doc.exists:
        raise HTTPException(status_code=404, detail="Statement not found.")
    stmt_data = stmt_doc.to_dict()
    if stmt_data.get("user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Statement not found.")
    if stmt_data.get("status") != "done":
        raise HTTPException(status_code=409, detail=f"Statement processing incomplete (status={stmt_data.get('status')}).")

    txn_docs = list(db.collection(TRANSACTIONS_COL).where(
        filter=FieldFilter("statement_id", "==", payload.statement_id)).stream())
    if not txn_docs:
        raise HTTPException(status_code=404, detail="No transactions found.")
    transactions = [Transaction.from_dict(d.id, d.to_dict()) for d in txn_docs]

    summary = _build_summary(transactions)
    prediction = predict_credit_score(summary)

    # Check if a credit score already exists for this statement
    existing_docs = list(db.collection(CREDIT_SCORES_COL).where(
        filter=FieldFilter("statement_id", "==", payload.statement_id)).limit(1).stream())

    total_income = Decimal(str(summary["total_income"]))
    total_expenses = Decimal(str(summary["total_expenses"]))
    avg_balance = Decimal(str(summary["avg_balance"]))
    savings_rate = Decimal(str(prediction["savings_rate"]))

    if existing_docs:
        # Update existing
        doc = existing_docs[0]
        credit = CreditScore.from_dict(doc.id, doc.to_dict())
        credit.score = prediction["score"]
        credit.grade = prediction["grade"]
        credit.risk_level = prediction["risk_level"]
        credit.total_income = total_income
        credit.total_expenses = total_expenses
        credit.savings_rate = savings_rate
        credit.avg_monthly_balance = avg_balance
        credit.details = json.dumps(prediction.get("details", {}))
        db.collection(CREDIT_SCORES_COL).document(credit.id).set(credit.to_dict())
    else:
        # Create new
        credit = CreditScore(
            statement_id=payload.statement_id, user_id=current_user.id,
            score=prediction["score"], grade=prediction["grade"],
            risk_level=prediction["risk_level"], total_income=total_income,
            total_expenses=total_expenses, savings_rate=savings_rate,
            avg_monthly_balance=avg_balance,
            details=json.dumps(prediction.get("details", {})),
        )
        db.collection(CREDIT_SCORES_COL).document(credit.id).set(credit.to_dict())

    return CreditScoreOut.model_validate(credit, from_attributes=True)


@router.get("/{statement_id}", response_model=CreditScoreOut,
            summary="Retrieve a previously computed credit score")
async def get_credit_score(
    statement_id: str,
    db: FirestoreClient = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CreditScoreOut:
    docs = list(db.collection(CREDIT_SCORES_COL).where(
        filter=FieldFilter("statement_id", "==", statement_id)
    ).where(filter=FieldFilter("user_id", "==", current_user.id)).limit(1).stream())

    if not docs:
        raise HTTPException(status_code=404, detail="Credit score not found. Run POST /credit-score first.")
    credit = CreditScore.from_dict(docs[0].id, docs[0].to_dict())
    return CreditScoreOut.model_validate(credit, from_attributes=True)
