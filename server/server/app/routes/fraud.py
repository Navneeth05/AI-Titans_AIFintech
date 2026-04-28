"""
app/routes/fraud.py
────────────────────
POST /fraud-check

Runs ML fraud detection across all transactions of a statement,
persists FraudAlert documents in Firestore, and (optionally) fires
an FCM push notification to the user's registered device.
"""

from __future__ import annotations

import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from google.cloud.firestore_v1.client import Client as FirestoreClient
from google.cloud.firestore_v1.base_query import FieldFilter

from app.firestore_db import get_db, BANK_STATEMENTS_COL, TRANSACTIONS_COL, FRAUD_ALERTS_COL
from app.models.user import User
from app.models.transaction import Transaction, FraudAlert
from app.schemas.transaction import FraudCheckRequest, FraudCheckResponse, FraudAlertOut
from app.services.ml_model import predict_fraud_score
from app.services.firebase_service import send_fraud_alert_notification
from app.utils.auth import get_current_user

router = APIRouter(prefix="/fraud-check", tags=["Fraud Detection"])
logger = logging.getLogger(__name__)

_SEVERITY_THRESHOLDS = [
    (0.90, "critical"), (0.75, "high"), (0.55, "medium"), (0.35, "low"),
]
_ALERT_TYPES = {
    "critical": "critical_fraud_risk", "high": "high_fraud_risk",
    "medium": "suspicious_transaction", "low": "low_fraud_risk",
}


def _score_to_severity(score: float) -> str:
    for threshold, label in _SEVERITY_THRESHOLDS:
        if score >= threshold:
            return label
    return "none"


@router.post("", response_model=FraudCheckResponse, summary="Run fraud detection on a bank statement")
async def fraud_check(
    payload: FraudCheckRequest,
    db: FirestoreClient = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FraudCheckResponse:
    stmt_doc = db.collection(BANK_STATEMENTS_COL).document(payload.statement_id).get()
    if not stmt_doc.exists:
        raise HTTPException(status_code=404, detail="Statement not found.")
    stmt_data = stmt_doc.to_dict()
    if stmt_data.get("user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Statement not found.")
    if stmt_data.get("status") != "done":
        raise HTTPException(status_code=409, detail=f"Statement not ready (status={stmt_data.get('status')}).")

    txn_docs = list(db.collection(TRANSACTIONS_COL).where(
        filter=FieldFilter("statement_id", "==", payload.statement_id)).stream())
    if not txn_docs:
        raise HTTPException(status_code=404, detail="No transactions found for this statement.")
    transactions = [Transaction.from_dict(d.id, d.to_dict()) for d in txn_docs]

    # Delete old alerts
    for old_doc in db.collection(FRAUD_ALERTS_COL).where(
            filter=FieldFilter("statement_id", "==", payload.statement_id)).stream():
        old_doc.reference.delete()

    new_alerts: list[FraudAlert] = []
    highest_score = 0.0
    batch = db.batch()

    for txn in transactions:
        score = predict_fraud_score({
            "amount": txn.amount, "balance": txn.balance,
            "description": txn.description, "transaction_type": txn.transaction_type,
        })
        batch.update(db.collection(TRANSACTIONS_COL).document(txn.id), {
            "fraud_score": round(score, 4), "is_suspicious": score >= 0.35,
        })
        if score < 0.35:
            continue
        severity = _score_to_severity(score)
        highest_score = max(highest_score, score)
        alert = FraudAlert(
            statement_id=payload.statement_id, user_id=current_user.id,
            transaction_id=txn.id,
            alert_type=_ALERT_TYPES.get(severity, "suspicious_transaction"),
            severity=severity,
            description=(f"Transaction of ₹{txn.amount} on "
                         f"{txn.date.date() if txn.date else 'N/A'} "
                         f"({txn.description[:60]}) flagged {score:.2%}."),
            fraud_score=Decimal(str(round(score, 4))),
        )
        new_alerts.append(alert)
        batch.set(db.collection(FRAUD_ALERTS_COL).document(alert.id), alert.to_dict())

    batch.commit()

    overall_risk = _score_to_severity(highest_score) if highest_score >= 0.35 else "none"
    is_fraudulent = highest_score >= 0.55

    if payload.notify and is_fraudulent and current_user.fcm_token:
        top = max(new_alerts, key=lambda a: float(a.fraud_score))
        try:
            msg_id = send_fraud_alert_notification(
                fcm_token=current_user.fcm_token, alert_type=top.alert_type,
                severity=top.severity, description=top.description,
                statement_id=payload.statement_id, fraud_score=float(top.fraud_score),
            )
            db.collection(FRAUD_ALERTS_COL).document(top.id).update({"notification_sent": True})
            logger.info("FCM notification sent: %s", msg_id)
        except Exception as exc:
            logger.warning("FCM notification failed: %s", exc)

    return FraudCheckResponse(
        statement_id=payload.statement_id, is_fraudulent=is_fraudulent,
        overall_risk=overall_risk, alerts_count=len(new_alerts),
        alerts=[FraudAlertOut.model_validate(a, from_attributes=True) for a in new_alerts],
        message=(f"Fraud check complete. {len(new_alerts)} alert(s) detected."
                 if new_alerts else "No suspicious transactions found."),
    )


@router.get("/{statement_id}/alerts", response_model=list[FraudAlertOut],
            summary="Retrieve existing fraud alerts for a statement")
async def get_fraud_alerts(
    statement_id: str,
    db: FirestoreClient = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[FraudAlertOut]:
    stmt_doc = db.collection(BANK_STATEMENTS_COL).document(statement_id).get()
    if not stmt_doc.exists or stmt_doc.to_dict().get("user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="Statement not found.")
    alert_docs = list(db.collection(FRAUD_ALERTS_COL).where(
        filter=FieldFilter("statement_id", "==", statement_id)).stream())
    alerts = [FraudAlert.from_dict(d.id, d.to_dict()) for d in alert_docs]
    alerts.sort(key=lambda a: float(a.fraud_score), reverse=True)
    return [FraudAlertOut.model_validate(a, from_attributes=True) for a in alerts]
