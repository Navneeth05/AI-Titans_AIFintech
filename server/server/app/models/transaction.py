"""
app/models/transaction.py
─────────────────────────
Data models for Firestore collections:
  BankStatement  – uploaded PDF metadata + processing status
  Transaction    – individual parsed rows  (date / description / amount / balance)
  FraudAlert     – fraud detection results per statement
  CreditScore    – credit-score snapshot per statement

All models are plain Pydantic classes with to_dict() / from_dict() helpers
for Firestore serialisation. No ORM — Firestore is schemaless.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


# ── BankStatement ─────────────────────────────────────────────────────────────

class BankStatement(BaseModel):
    id: str = Field(default_factory=_uuid)
    user_id: str = ""
    filename: str = ""
    file_path: str = ""
    bank_name: Optional[str] = None
    statement_period_start: Optional[datetime] = None
    statement_period_end: Optional[datetime] = None
    status: str = "pending"              # pending | processing | done | failed
    total_transactions: int = 0
    created_at: datetime = Field(default_factory=_now)

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "filename": self.filename,
            "file_path": self.file_path,
            "bank_name": self.bank_name,
            "statement_period_start": self.statement_period_start,
            "statement_period_end": self.statement_period_end,
            "status": self.status,
            "total_transactions": self.total_transactions,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, doc_id: str, data: dict) -> "BankStatement":
        return cls(
            id=doc_id,
            user_id=data.get("user_id", ""),
            filename=data.get("filename", ""),
            file_path=data.get("file_path", ""),
            bank_name=data.get("bank_name"),
            statement_period_start=data.get("statement_period_start"),
            statement_period_end=data.get("statement_period_end"),
            status=data.get("status", "pending"),
            total_transactions=data.get("total_transactions", 0),
            created_at=data.get("created_at", _now()),
        )

    def __repr__(self) -> str:
        return f"<BankStatement id={self.id} status={self.status}>"


# ── Transaction ───────────────────────────────────────────────────────────────

class Transaction(BaseModel):
    id: str = Field(default_factory=_uuid)
    statement_id: str = ""
    user_id: str = ""
    date: Optional[datetime] = None
    description: str = ""
    amount: Decimal = Decimal(0)
    balance: Optional[Decimal] = None
    transaction_type: str = "debit"      # credit | debit
    category: Optional[str] = None
    is_suspicious: bool = False
    fraud_score: Optional[Decimal] = None
    created_at: datetime = Field(default_factory=_now)

    def to_dict(self) -> dict:
        return {
            "statement_id": self.statement_id,
            "user_id": self.user_id,
            "date": self.date,
            "description": self.description,
            "amount": float(self.amount),
            "balance": float(self.balance) if self.balance is not None else None,
            "transaction_type": self.transaction_type,
            "category": self.category,
            "is_suspicious": self.is_suspicious,
            "fraud_score": float(self.fraud_score) if self.fraud_score is not None else None,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, doc_id: str, data: dict) -> "Transaction":
        return cls(
            id=doc_id,
            statement_id=data.get("statement_id", ""),
            user_id=data.get("user_id", ""),
            date=data.get("date"),
            description=data.get("description", ""),
            amount=Decimal(str(data.get("amount", 0))),
            balance=Decimal(str(data["balance"])) if data.get("balance") is not None else None,
            transaction_type=data.get("transaction_type", "debit"),
            category=data.get("category"),
            is_suspicious=data.get("is_suspicious", False),
            fraud_score=Decimal(str(data["fraud_score"])) if data.get("fraud_score") is not None else None,
            created_at=data.get("created_at", _now()),
        )

    def __repr__(self) -> str:
        return f"<Transaction {self.date} {self.amount} {self.transaction_type}>"


# ── FraudAlert ────────────────────────────────────────────────────────────────

class FraudAlert(BaseModel):
    id: str = Field(default_factory=_uuid)
    statement_id: str = ""
    user_id: str = ""
    transaction_id: Optional[str] = None
    alert_type: str = ""
    severity: str = ""                   # low | medium | high | critical
    description: str = ""
    fraud_score: Decimal = Decimal(0)
    is_resolved: bool = False
    notification_sent: bool = False
    created_at: datetime = Field(default_factory=_now)

    def to_dict(self) -> dict:
        return {
            "statement_id": self.statement_id,
            "user_id": self.user_id,
            "transaction_id": self.transaction_id,
            "alert_type": self.alert_type,
            "severity": self.severity,
            "description": self.description,
            "fraud_score": float(self.fraud_score),
            "is_resolved": self.is_resolved,
            "notification_sent": self.notification_sent,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, doc_id: str, data: dict) -> "FraudAlert":
        return cls(
            id=doc_id,
            statement_id=data.get("statement_id", ""),
            user_id=data.get("user_id", ""),
            transaction_id=data.get("transaction_id"),
            alert_type=data.get("alert_type", ""),
            severity=data.get("severity", ""),
            description=data.get("description", ""),
            fraud_score=Decimal(str(data.get("fraud_score", 0))),
            is_resolved=data.get("is_resolved", False),
            notification_sent=data.get("notification_sent", False),
            created_at=data.get("created_at", _now()),
        )

    def __repr__(self) -> str:
        return f"<FraudAlert {self.alert_type} severity={self.severity}>"


# ── CreditScore ───────────────────────────────────────────────────────────────

class CreditScore(BaseModel):
    id: str = Field(default_factory=_uuid)
    statement_id: str = ""
    user_id: str = ""
    score: int = 0                       # 300 – 850
    grade: str = ""                      # A+ … F
    risk_level: str = ""                 # low | medium | high
    total_income: Decimal = Decimal(0)
    total_expenses: Decimal = Decimal(0)
    savings_rate: Decimal = Decimal(0)
    avg_monthly_balance: Decimal = Decimal(0)
    details: Optional[str] = None        # JSON string
    created_at: datetime = Field(default_factory=_now)

    def to_dict(self) -> dict:
        return {
            "statement_id": self.statement_id,
            "user_id": self.user_id,
            "score": self.score,
            "grade": self.grade,
            "risk_level": self.risk_level,
            "total_income": float(self.total_income),
            "total_expenses": float(self.total_expenses),
            "savings_rate": float(self.savings_rate),
            "avg_monthly_balance": float(self.avg_monthly_balance),
            "details": self.details,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, doc_id: str, data: dict) -> "CreditScore":
        return cls(
            id=doc_id,
            statement_id=data.get("statement_id", ""),
            user_id=data.get("user_id", ""),
            score=data.get("score", 0),
            grade=data.get("grade", ""),
            risk_level=data.get("risk_level", ""),
            total_income=Decimal(str(data.get("total_income", 0))),
            total_expenses=Decimal(str(data.get("total_expenses", 0))),
            savings_rate=Decimal(str(data.get("savings_rate", 0))),
            avg_monthly_balance=Decimal(str(data.get("avg_monthly_balance", 0))),
            details=data.get("details"),
            created_at=data.get("created_at", _now()),
        )

    def __repr__(self) -> str:
        return f"<CreditScore score={self.score} grade={self.grade}>"
