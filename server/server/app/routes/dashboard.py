"""
app/routes/dashboard.py
───────────────────────
Endpoint for pre-aggregated dashboard data.
"""

from __future__ import annotations
from fastapi import APIRouter, Depends
from google.cloud.firestore_v1.client import Client as FirestoreClient

from app.firestore_db import get_db
from app.models.user import User
from app.utils.auth import get_current_user
from app.services.dashboard_service import get_user_dashboard_summary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary")
async def get_dashboard_summary(
    db: FirestoreClient = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Returns pre-aggregated data for the dashboard:
    Scores, category spending, recent transactions, and monthly trend.
    """
    return await get_user_dashboard_summary(db, current_user.id)
