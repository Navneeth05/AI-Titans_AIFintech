"""
app/services/ml_model.py
────────────────────────
ML model integration layer.

Two pluggable models
────────────────────
1. FraudDetector   – returns a fraud probability score (0-1) per transaction
2. CreditScorer    – returns a 300-850 credit score + grade for a statement

How to plug in your real model
───────────────────────────────
• Drop your serialised model file (e.g. fraud_model.pkl) into server/ml_models/
• Update the _load_* functions below to unpickle / load your model
• The rest of the integration code stays the same

Until a real model is provided the heuristic fallback is used automatically.
"""

from __future__ import annotations

import json
import logging
import math
import pickle
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional

import numpy as np

logger = logging.getLogger(__name__)

_ML_DIR = Path(__file__).resolve().parent.parent.parent / "ml_models"

# ── Model singletons ──────────────────────────────────────────────────────────
_fraud_model: Any = None
_credit_model: Any = None


def _load_fraud_model() -> Optional[Any]:
    global _fraud_model
    if _fraud_model is not None:
        return _fraud_model
    model_path = _ML_DIR / "fraud_model.pkl"
    if model_path.exists():
        with open(model_path, "rb") as f:
            _fraud_model = pickle.load(f)
        logger.info("Fraud model loaded from %s", model_path)
        return _fraud_model
    logger.warning("fraud_model.pkl not found — using heuristic fallback")
    return None


def _load_credit_model() -> Optional[Any]:
    global _credit_model
    if _credit_model is not None:
        return _credit_model
    model_path = _ML_DIR / "credit_model.pkl"
    if model_path.exists():
        with open(model_path, "rb") as f:
            _credit_model = pickle.load(f)
        logger.info("Credit model loaded from %s", model_path)
        return _credit_model
    logger.warning("credit_model.pkl not found — using heuristic fallback")
    return None


# ── Feature engineering ───────────────────────────────────────────────────────

def _transaction_to_features(txn: dict) -> list[float]:
    """
    Convert a transaction dict to a numeric feature vector.
    Fields used: amount, balance, transaction_type, description length
    """
    amount  = float(txn.get("amount", 0) or 0)
    balance = float(txn.get("balance", 0) or 0)
    is_debit = 1.0 if txn.get("transaction_type", "debit") == "debit" else 0.0
    desc_len = float(len(str(txn.get("description", ""))))
    hour     = float(txn.get("hour", 12))         # hour of day if available
    return [amount, balance, is_debit, desc_len, hour]


# ── Fraud Detection ───────────────────────────────────────────────────────────

_LARGE_TXN_THRESHOLD = Decimal("50000")
_SUSPICIOUS_KEYWORDS = [
    "unknown", "misc", "unidentified", "suspicious",
    "cash withdrawal", "atm", "wire transfer",
]


def _heuristic_fraud_score(txn: dict) -> float:
    """Rule-based fraud score when no ML model is available."""
    score = 0.0
    amount = Decimal(str(txn.get("amount", 0) or 0))

    # Large transaction
    if amount > _LARGE_TXN_THRESHOLD:
        score += 0.4
    elif amount > Decimal("10000"):
        score += 0.2

    # Suspicious description keywords
    desc = str(txn.get("description", "")).lower()
    if any(kw in desc for kw in _SUSPICIOUS_KEYWORDS):
        score += 0.3

    # Round numbers (e.g. exactly 5000, 10000) are slightly more suspicious
    if amount % Decimal("1000") == 0 and amount > 0:
        score += 0.1

    return min(score, 1.0)


def predict_fraud_score(txn: dict) -> float:
    """
    Returns a fraud probability score in [0, 1].
    Uses the ML model if available, else heuristic fallback.
    """
    model = _load_fraud_model()
    if model is not None:
        try:
            features = np.array([_transaction_to_features(txn)])
            prob = model.predict_proba(features)[0][1]
            return float(prob)
        except Exception as e:
            logger.error("Fraud model inference error: %s — falling back to heuristic", e)

    return _heuristic_fraud_score(txn)


# ── Credit Scoring ────────────────────────────────────────────────────────────

_GRADE_BANDS = [
    (800, "A+"), (750, "A"), (700, "B+"), (650, "B"),
    (600, "C+"), (550, "C"), (500, "D"), (0, "F"),
]


def _score_to_grade(score: int) -> str:
    for threshold, grade in _GRADE_BANDS:
        if score >= threshold:
            return grade
    return "F"


def _score_to_risk(score: int) -> str:
    if score >= 700:
        return "low"
    if score >= 550:
        return "medium"
    return "high"


def _heuristic_credit_score(summary: dict) -> dict:
    """
    Compute a credit score from financial summary stats.

    Inputs expected in `summary`
    ────────────────────────────
      total_income    : float
      total_expenses  : float
      avg_balance     : float
      num_overdrafts  : int
      num_suspicious  : int
      months          : int
    """
    income     = float(summary.get("total_income", 0) or 0)
    expenses   = float(summary.get("total_expenses", 0) or 0)
    avg_bal    = float(summary.get("avg_balance", 0) or 0)
    overdrafts = int(summary.get("num_overdrafts", 0) or 0)
    suspicious = int(summary.get("num_suspicious", 0) or 0)
    months     = max(int(summary.get("months", 1) or 1), 1)

    # Base score
    base = 600

    # Savings ratio component (+/- 100)
    savings = income - expenses
    if income > 0:
        ratio = savings / income
        base += int(ratio * 100)

    # Average balance component (+/- 80)
    monthly_income = income / months
    if monthly_income > 0:
        bal_ratio = min(avg_bal / monthly_income, 2.0)
        base += int(bal_ratio * 40)

    # Penalties
    base -= overdrafts * 20
    base -= suspicious * 15

    # Clamp to 300–850
    score = max(300, min(850, base))
    savings_rate = (savings / income) if income > 0 else 0.0

    return {
        "score": score,
        "grade": _score_to_grade(score),
        "risk_level": _score_to_risk(score),
        "savings_rate": round(savings_rate, 4),
        "details": {
            "income": income,
            "expenses": expenses,
            "savings": savings,
            "avg_balance": avg_bal,
            "overdrafts_detected": overdrafts,
            "suspicious_transactions": suspicious,
        },
    }


def predict_credit_score(summary: dict) -> dict:
    """
    Returns a dict: {score, grade, risk_level, savings_rate, details}
    Uses the ML model if available, else heuristic fallback.
    """
    model = _load_credit_model()
    if model is not None:
        try:
            features = np.array([[
                summary.get("total_income", 0),
                summary.get("total_expenses", 0),
                summary.get("avg_balance", 0),
                summary.get("num_overdrafts", 0),
                summary.get("num_suspicious", 0),
                summary.get("months", 1),
            ]])
            score = int(model.predict(features)[0])
            return {
                "score": max(300, min(850, score)),
                "grade": _score_to_grade(score),
                "risk_level": _score_to_risk(score),
                "savings_rate": 0.0,
                "details": summary,
            }
        except Exception as e:
            logger.error("Credit model inference error: %s — falling back to heuristic", e)

    return _heuristic_credit_score(summary)
