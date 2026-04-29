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
import joblib
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional

import numpy as np

logger = logging.getLogger(__name__)

_ML_DIR = Path(__file__).resolve().parent.parent.parent / "ml_models"

# ── Model singletons ──────────────────────────────────────────────────────────
_fraud_model: Any = None
_credit_model: Any = None
_nlp_model: Any = None
_tfidf_vectorizer: Any = None
_nlp_encoder: Any = None


def _load_fraud_model() -> Optional[Any]:
    global _fraud_model
    if _fraud_model is not None:
        return _fraud_model
    model_path = _ML_DIR / "fraud_model.pkl"
    if model_path.exists():
        try:
            _fraud_model = joblib.load(model_path)
            logger.info("Fraud model loaded from %s", model_path)
            return _fraud_model
        except Exception as e:
            logger.error("Failed to load fraud model: %s", e)
    logger.warning("fraud_model.pkl not found — using heuristic fallback")
    return None


def _load_credit_model() -> Optional[Any]:
    global _credit_model
    if _credit_model is not None:
        return _credit_model
    model_path = _ML_DIR / "credit_model.pkl"
    if model_path.exists():
        try:
            _credit_model = joblib.load(model_path)
            logger.info("Credit model loaded from %s", model_path)
            return _credit_model
        except Exception as e:
            logger.error("Failed to load credit model: %s", e)
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


def _load_nlp_model() -> tuple[Optional[Any], Optional[Any], Optional[Any]]:
    global _nlp_model, _tfidf_vectorizer, _nlp_encoder
    if _nlp_model is not None and _tfidf_vectorizer is not None and _nlp_encoder is not None:
        return _nlp_model, _tfidf_vectorizer, _nlp_encoder

    model_path = _ML_DIR / "nlp_categorizer.pkl"
    vec_path = _ML_DIR / "tfidf_vectorizer.pkl"
    enc_path = _ML_DIR / "nlp_label_encoder.pkl"
    
    if model_path.exists() and vec_path.exists() and enc_path.exists():
        try:
            _nlp_model = joblib.load(model_path)
            _tfidf_vectorizer = joblib.load(vec_path)
            _nlp_encoder = joblib.load(enc_path)
            logger.info("NLP models loaded from %s", _ML_DIR)
            return _nlp_model, _tfidf_vectorizer, _nlp_encoder
        except Exception as e:
            logger.error("Failed to load NLP models: %s", e)
    else:
        logger.warning("nlp_categorizer.pkl or tfidf_vectorizer.pkl or nlp_label_encoder.pkl not found")
    return None, None, None

# ── Rule-based NLP fallback (from frontend logic) ─────────────────────────────
NLP_RULES = [
    { 'category':'Food',          'keywords':['swiggy','zomato','food','restaurant','cafe','pizza','burger','hotel','eat','lunch','dinner','breakfast','grocer','bigbasket','blinkit','dominos','kfc'] },
    { 'category':'Travel',        'keywords':['uber','ola','rapido','irctc','train','flight','airport','taxi','metro','bus','petrol','fuel','indigo','spicejet','redbus','makemytrip','cab'] },
    { 'category':'Bills',         'keywords':['airtel','jio','bsnl','electricity','bill','recharge','postpaid','broadband','water','gas','cylinder','lic','insurance','maintenance','society','rent'] },
    { 'category':'Shopping',      'keywords':['amazon','flipkart','myntra','ajio','meesho','nykaa','shopping','purchase','store','mall','reliance','dmart','retail','croma','decathlon'] },
    { 'category':'Health',        'keywords':['pharmacy','hospital','clinic','doctor','medical','apollo','medplus','netmeds','1mg','diagnostic','lab','health','medicine','pathlab'] },
    { 'category':'Entertainment', 'keywords':['netflix','spotify','prime','hotstar','youtube','disney','zee5','ott','cinema','movie','pvr','inox','concert','gaming','xbox','steam'] },
]

def _rule_based_classify(description: str) -> Optional[str]:
    lower = description.lower()
    for rule in NLP_RULES:
        if any(kw in lower for kw in rule['keywords']):
            return rule['category']
    return None

def predict_nlp_category(description: str, fallback_category: str = "Other") -> str:
    """Predict category using the ML NLP model with a rule-based fallback."""
    # 1. Try ML Model
    model, vectorizer, encoder = _load_nlp_model()
    if model is not None and vectorizer is not None and encoder is not None:
        try:
            features = vectorizer.transform([description])
            cat_idx = model.predict(features)[0]
            category = str(encoder.inverse_transform([cat_idx])[0])
            if category != "Other":
                return category
        except Exception as e:
            logger.error("NLP inference error: %s", e)

    # 2. Try Rule-based fallback
    rule_cat = _rule_based_classify(description)
    if rule_cat:
        return rule_cat

    return fallback_category


# ── Fraud Detection ───────────────────────────────────────────────────────────

_LARGE_TXN_THRESHOLD = Decimal("50000")
_SUSPICIOUS_KEYWORDS = [
    "unknown", "misc", "unidentified", "suspicious",
    "cash withdrawal", "atm", "wire transfer",
]

_CITY_COORDS = {
    "MUMBAI": (19.0760, 72.8777), "BOM": (19.0760, 72.8777),
    "DELHI": (28.7041, 77.1025), "DEL": (28.7041, 77.1025),
    "BANGALORE": (12.9716, 77.5946), "BLR": (12.9716, 77.5946),
    "HYDERABAD": (17.3850, 78.4867), "HYD": (17.3850, 78.4867),
    "CHENNAI": (13.0827, 80.2707), "MAA": (13.0827, 80.2707),
    "KOLKATA": (22.5726, 88.3639), "CCU": (22.5726, 88.3639),
    "PUNE": (18.5204, 73.8567), "PNQ": (18.5204, 73.8567),
    "AHMEDABAD": (23.0225, 72.5714), "AMD": (23.0225, 72.5714),
}

def _get_location_from_desc(desc: str) -> Optional[tuple[str, float, float]]:
    desc_upper = str(desc).upper()
    for city, coords in _CITY_COORDS.items():
        # Match city names as word boundaries to avoid partial matches
        import re
        if re.search(rf"\b{city}\b", desc_upper):
            return city, coords[0], coords[1]
    return None

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _heuristic_fraud_score(txn: dict, prev_txn: dict = None) -> float:
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


def predict_fraud_score(txn: dict, prev_txn: dict = None) -> float:
    """
    Returns a fraud probability score in [0, 1].
    Uses the ML model if available, else heuristic fallback.
    Also incorporates geo-velocity location checking.
    Mutates txn to add 'geo_flagged' and 'geo_alert' if flagged.
    """
    base_score = 0.0
    txn["geo_flagged"] = False
    
    # 1. Geo-velocity check (impossible travel)
    if prev_txn:
        loc1 = _get_location_from_desc(prev_txn.get("description", ""))
        loc2 = _get_location_from_desc(txn.get("description", ""))
        
        if loc1 and loc2 and loc1[0] != loc2[0]:
            dist_km = _haversine(loc1[1], loc1[2], loc2[1], loc2[2])
            
            t1 = txn.get("date")
            t2 = prev_txn.get("date")
            
            # If dates are the same, assume 2 hours difference at worst. 
            # If dates differ, assume 24+ hours.
            time_diff_hours = 24.0
            if t1 and t2 and t1 == t2:
                time_diff_hours = 2.0
            
            velocity = dist_km / time_diff_hours
            if velocity > 500:  # Suspiciously fast travel (flight speed or impossible)
                alert_msg = f"Impossible travel detected! {loc1[0]} to {loc2[0]} ({dist_km:.0f} km)"
                logger.warning(alert_msg)
                base_score += 0.85
                txn["geo_flagged"] = True
                txn["geo_alert"] = alert_msg

    # 2. ML Model evaluation
    model = _load_fraud_model()
    if model is not None:
        try:
            features = np.array([_transaction_to_features(txn)])
            
            if hasattr(model, "decision_function"):
                score = -model.decision_function(features)[0]
                prob = 1.0 / (1.0 + math.exp(-score * 10))
                return min(1.0, float(prob) + base_score)
            elif hasattr(model, "predict_proba"):
                prob = model.predict_proba(features)[0][1]
                return min(1.0, float(prob) + base_score)
        except Exception as e:
            logger.error("Fraud model inference error: %s — falling back to heuristic", e)

    heuristic_score = _heuristic_fraud_score(txn, prev_txn)
    return min(1.0, heuristic_score + base_score)


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
