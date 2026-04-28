"""
app/routes/transactions.py
──────────────────────────
GET /transactions

Returns all parsed transactions for a given statement_id,
with optional filtering and pagination.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from google.cloud.firestore_v1.client import Client as FirestoreClient
from google.cloud.firestore_v1.base_query import FieldFilter

from app.firestore_db import get_db, BANK_STATEMENTS_COL, TRANSACTIONS_COL
from app.models.user import User
from app.models.transaction import BankStatement, Transaction
from app.schemas.transaction import TransactionListResponse, TransactionOut, BankStatementOut
from app.utils.auth import get_current_user

router = APIRouter(prefix="/transactions", tags=["Transactions"])
logger = logging.getLogger(__name__)


@router.get(
    "",
    response_model=TransactionListResponse,
    summary="Get processed transactions",
    description=(
        "Returns paginated, filtered transactions for a bank statement. "
        "Only the authenticated user's own statements are accessible."
    ),
)
async def get_transactions(
    statement_id: str = Query(..., description="Bank statement ID from /upload-statement"),
    transaction_type: Optional[str] = Query(None, description="Filter: credit | debit"),
    is_suspicious: Optional[bool] = Query(None, description="Filter suspicious only"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: FirestoreClient = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionListResponse:
    # ── Ownership check ───────────────────────────────────────────────────
    stmt_doc = db.collection(BANK_STATEMENTS_COL).document(statement_id).get()
    if not stmt_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Statement not found or does not belong to this user.",
        )
    stmt_data = stmt_doc.to_dict()
    if stmt_data.get("user_id") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Statement not found or does not belong to this user.",
        )

    if stmt_data.get("status") == "processing":
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED,
            detail="Statement is still being processed. Please retry in a moment.",
        )
    if stmt_data.get("status") == "failed":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Statement processing failed. Please re-upload the PDF.",
        )

    # ── Query with filters ────────────────────────────────────────────────
    query = db.collection(TRANSACTIONS_COL).where(
        filter=FieldFilter("statement_id", "==", statement_id)
    )

    if transaction_type in ("credit", "debit"):
        query = query.where(filter=FieldFilter("transaction_type", "==", transaction_type))
    if is_suspicious is not None:
        query = query.where(filter=FieldFilter("is_suspicious", "==", is_suspicious))

    # Get all matching docs for total count
    all_docs = list(query.stream())
    total = len(all_docs)

    # Sort by date descending (in-memory since Firestore composite indexes may not exist)
    all_docs.sort(key=lambda d: d.to_dict().get("date") or "", reverse=True)

    # Paginate
    start_idx = (page - 1) * page_size
    page_docs = all_docs[start_idx:start_idx + page_size]

    transactions = []
    for doc in page_docs:
        txn = Transaction.from_dict(doc.id, doc.to_dict())
        transactions.append(TransactionOut.model_validate(txn, from_attributes=True))

    return TransactionListResponse(
        statement_id=statement_id,
        total=total,
        transactions=transactions,
    )


@router.get(
    "/statements",
    response_model=list[BankStatementOut],
    summary="List all statements for the current user",
)
async def list_statements(
    db: FirestoreClient = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BankStatementOut]:
    docs = db.collection(BANK_STATEMENTS_COL).where(
        filter=FieldFilter("user_id", "==", current_user.id)
    ).order_by("created_at", direction="DESCENDING").stream()

    result = []
    for doc in docs:
        stmt = BankStatement.from_dict(doc.id, doc.to_dict())
        result.append(BankStatementOut.model_validate(stmt, from_attributes=True))
    return result


@router.get(
    "/statements/{statement_id}",
    response_model=BankStatementOut,
    summary="Get a single statement's metadata and status",
)
async def get_statement(
    statement_id: str,
    db: FirestoreClient = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BankStatementOut:
    doc = db.collection(BANK_STATEMENTS_COL).document(statement_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Statement not found.")

    data = doc.to_dict()
    if data.get("user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Statement not found.")

    stmt = BankStatement.from_dict(doc.id, data)
    return BankStatementOut.model_validate(stmt, from_attributes=True)
