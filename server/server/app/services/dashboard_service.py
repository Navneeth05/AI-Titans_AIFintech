"""
app/services/dashboard_service.py
──────────────────────────────────
Aggregates user financial data for the dashboard.
Moves complex data reduction from the React frontend to the FastAPI backend.
"""

from __future__ import annotations
import logging
from datetime import datetime
from typing import Any
from google.cloud.firestore_v1.client import Client as FirestoreClient
from google.cloud.firestore_v1.base_query import FieldFilter

from app.firestore_db import BANK_STATEMENTS_COL, TRANSACTIONS_COL

logger = logging.getLogger(__name__)

async def get_user_dashboard_summary(db: FirestoreClient, user_id: str) -> dict[str, Any]:
    """
    Fetch all relevant data for a user and compute aggregates.
    Returns: { creditScore, riskScore, spendingCategories, recentTransactions, trend }
    """
    # 1. Get latest statement for scores and categories summary
    stmt_query = db.collection(BANK_STATEMENTS_COL).where(
        filter=FieldFilter("user_id", "==", user_id)
    ).order_by("created_at", direction="DESCENDING").limit(1)
    
    latest_stmt = list(stmt_query.stream())
    
    credit_score = 680
    risk_score = 24
    categories_dict = {}
    
    if latest_stmt:
        data = latest_stmt[0].to_dict()
        credit_score = data.get("creditScore") or data.get("credit_score") or 680
        risk_score = data.get("riskScore") or data.get("risk_score") or 24
        categories_dict = data.get("categories") or {}

    # 2. Get all transactions for trend and recent list
    tx_query = db.collection(TRANSACTIONS_COL).where(
        filter=FieldFilter("user_id", "==", user_id)
    ).order_by("date", direction="DESCENDING").limit(50)
    
    tx_docs = list(tx_query.stream())
    
    transactions = []
    months_map = {}
    
    for doc in tx_docs:
        tx = doc.to_dict()
        tx["id"] = doc.id
        transactions.append(tx)
        
        # Trend calculation
        dt_str = tx.get("date")
        if not dt_str: continue
        
        try:
            # Handle ISO string or YYYY-MM-DD
            dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
            month_key = dt.strftime("%b %Y")
            
            if month_key not in months_map:
                months_map[month_key] = {"month": month_key, "spend": 0.0, "income": 0.0, "timestamp": dt.timestamp()}
            
            amt = abs(float(tx.get("amount", 0)))
            if tx.get("transaction_type") == "credit":
                months_map[month_key]["income"] += amt
            else:
                months_map[month_key]["spend"] += amt
        except Exception:
            continue

    # Format spending categories for Recharts
    spending_categories = []
    if categories_dict:
        spending_categories = [{"name": k, "value": v} for k, v in categories_dict.items()]
    else:
        # Fallback: aggregate from transactions if categories_dict is empty
        agg_cats = {}
        for tx in transactions:
            if tx.get("transaction_type") != "credit":
                cat = tx.get("category") or "Other"
                agg_cats[cat] = agg_cats.get(cat, 0) + abs(float(tx.get("amount", 0)))
        spending_categories = [{"name": k, "value": v} for k, v in agg_cats.items()]

    # Sort trend by time
    trend_data = sorted(months_map.values(), key=lambda x: x["timestamp"])
    trend = [{"month": x["month"], "spend": x["spend"], "income": x["income"]} for x in trend_data]

    return {
        "creditScore": credit_score,
        "riskScore": risk_score,
        "spendingCategories": spending_categories,
        "recentTransactions": transactions[:10], # Top 10 for dashboard
        "trend": trend
    }
