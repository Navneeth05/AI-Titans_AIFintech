"""
app/schemas/transaction.py
──────────────────────────
Pydantic v2 schemas used for request validation and response serialisation.
"""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ── Shared config ─────────────────────────────────────────────────────────────

class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Upload ────────────────────────────────────────────────────────────────────

class UploadResponse(_Base):
    statement_id: str
    filename: str
    status: str
    message: str
    total_transactions: int = 0


# ── Transaction ───────────────────────────────────────────────────────────────

class TransactionOut(_Base):
    id: str
    statement_id: str
    date: Optional[datetime] = None
    description: str
    amount: Decimal
    balance: Optional[Decimal] = None
    transaction_type: str
    category: Optional[str] = None
    is_suspicious: bool
    fraud_score: Optional[Decimal] = None
    created_at: datetime

    @field_validator("amount", "balance", "fraud_score", mode="before")
    @classmethod
    def coerce_decimal(cls, v: Any) -> Any:
        if v is None:
            return v
        return Decimal(str(v))


class TransactionListResponse(_Base):
    statement_id: str
    total: int
    transactions: list[TransactionOut]


# ── Bank Statement ────────────────────────────────────────────────────────────

class BankStatementOut(_Base):
    id: str
    user_id: str
    filename: str
    bank_name: Optional[str] = None
    statement_period_start: Optional[datetime] = None
    statement_period_end: Optional[datetime] = None
    status: str
    total_transactions: int
    created_at: datetime


# ── Fraud ─────────────────────────────────────────────────────────────────────

class FraudCheckRequest(BaseModel):
    statement_id: str
    notify: bool = Field(True, description="Send FCM push notification if fraud found")


class FraudAlertOut(_Base):
    id: str
    statement_id: str
    transaction_id: Optional[str] = None
    alert_type: str
    severity: str
    description: str
    fraud_score: Decimal
    is_resolved: bool
    notification_sent: bool
    created_at: datetime


class FraudCheckResponse(_Base):
    statement_id: str
    is_fraudulent: bool
    overall_risk: str           # low | medium | high | critical
    alerts_count: int
    alerts: list[FraudAlertOut]
    message: str


# ── Credit Score ──────────────────────────────────────────────────────────────

class CreditScoreRequest(BaseModel):
    statement_id: str


class CreditScoreOut(_Base):
    id: str
    statement_id: str
    score: int
    grade: str
    risk_level: str
    total_income: Decimal
    total_expenses: Decimal
    savings_rate: Decimal
    avg_monthly_balance: Decimal
    details: Optional[dict[str, Any]] = None
    created_at: datetime

    @field_validator("details", mode="before")
    @classmethod
    def parse_details_json(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {}
        return v


# ── FCM Token update ──────────────────────────────────────────────────────────

class FCMTokenUpdate(BaseModel):
    fcm_token: str = Field(..., min_length=10)
