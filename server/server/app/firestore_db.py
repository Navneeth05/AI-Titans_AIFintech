"""
app/firestore_db.py
───────────────────
Firebase Firestore client initialisation and FastAPI dependency.

Provides:
  • get_firestore_client() – returns the Firestore client (singleton)
  • get_db()               – FastAPI dependency that yields the client
  • Collection name constants

Firestore is schemaless — no migrations or table creation needed.
"""

from __future__ import annotations

import logging
from typing import Optional

from google.cloud.firestore_v1.client import Client as FirestoreClient
from firebase_admin import firestore

from app.services.firebase_service import ensure_firebase_app

logger = logging.getLogger(__name__)

# ── Collection names ──────────────────────────────────────────────────────────
USERS_COL = "users"
BANK_STATEMENTS_COL = "bank_statements"
TRANSACTIONS_COL = "transactions"
FRAUD_ALERTS_COL = "fraud_alerts"
CREDIT_SCORES_COL = "credit_scores"

# ── Singleton ─────────────────────────────────────────────────────────────────
_firestore_client: Optional[FirestoreClient] = None


def get_firestore_client() -> FirestoreClient:
    """Return the Firestore client, initialising on first call."""
    global _firestore_client
    if _firestore_client is None:
        ensure_firebase_app()
        _firestore_client = firestore.client()
        logger.info("Firestore client initialised.")
    return _firestore_client


def get_db() -> FirestoreClient:
    """FastAPI dependency — injects the Firestore client."""
    return get_firestore_client()
