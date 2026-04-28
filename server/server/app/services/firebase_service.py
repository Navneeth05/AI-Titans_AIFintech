"""
app/services/firebase_service.py
─────────────────────────────────
Initialises the Firebase Admin SDK (once) and exposes:

  ensure_firebase_app()          – idempotent SDK init
  verify_firebase_token(token)   – verify an ID token, return decoded payload
  send_fraud_alert_notification()– send FCM push to a specific device token
  send_multicast_notification()  – send FCM push to multiple device tokens
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import firebase_admin
from firebase_admin import credentials, messaging
import firebase_admin.auth as fb_auth

from app.config import settings

logger = logging.getLogger(__name__)

# ── SDK initialisation ────────────────────────────────────────────────────────

_firebase_app: Optional[firebase_admin.App] = None


def ensure_firebase_app() -> firebase_admin.App:
    """
    Initialise the Firebase Admin SDK exactly once per process.
    Reads credentials from FIREBASE_CREDENTIALS_PATH (.env).
    """
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    cred_path = Path(settings.FIREBASE_CREDENTIALS_PATH)
    if not cred_path.exists():
        raise FileNotFoundError(
            f"Firebase credentials file not found: {cred_path}. "
            "Download it from Firebase Console → Project Settings → Service Accounts."
        )

    cred = credentials.Certificate(str(cred_path))
    _firebase_app = firebase_admin.initialize_app(
        cred,
        {"projectId": settings.FIREBASE_PROJECT_ID} if settings.FIREBASE_PROJECT_ID else {},
    )
    logger.info("Firebase Admin SDK initialised (project=%s)", settings.FIREBASE_PROJECT_ID)
    return _firebase_app


# ── Token verification ────────────────────────────────────────────────────────

def verify_firebase_token(id_token: str) -> dict:
    """
    Verify a Firebase ID token.
    Returns the decoded token payload on success.
    Raises firebase_admin.auth.* exceptions on failure.
    """
    ensure_firebase_app()
    return fb_auth.verify_id_token(id_token)


# ── FCM Notifications ─────────────────────────────────────────────────────────

def send_fraud_alert_notification(
    fcm_token: str,
    alert_type: str,
    severity: str,
    description: str,
    statement_id: str,
    fraud_score: float,
) -> str:
    """
    Send a single FCM push notification to one device.
    Returns the FCM message ID on success.
    """
    ensure_firebase_app()

    # Emoji badge by severity
    _badge = {"low": "🟡", "medium": "🟠", "high": "🔴", "critical": "🚨"}.get(
        severity.lower(), "⚠️"
    )

    message = messaging.Message(
        token=fcm_token,
        notification=messaging.Notification(
            title=f"{_badge} Fraud Alert Detected — {severity.upper()}",
            body=description,
        ),
        data={
            "alert_type": alert_type,
            "severity": severity,
            "statement_id": statement_id,
            "fraud_score": str(round(fraud_score, 4)),
            "click_action": "FLUTTER_NOTIFICATION_CLICK",
        },
        android=messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(
                channel_id="fraud_alerts",
                sound="default",
            ),
        ),
        apns=messaging.APNSConfig(
            payload=messaging.APNSPayload(
                aps=messaging.Aps(sound="default", badge=1),
            )
        ),
    )

    try:
        response = messaging.send(message)
        logger.info("FCM message sent: %s", response)
        return response
    except messaging.UnregisteredError:
        logger.warning("FCM token is no longer registered: %s", fcm_token[:20])
        raise
    except Exception as exc:
        logger.error("FCM send error: %s", exc)
        raise


def send_multicast_notification(
    fcm_tokens: list[str],
    title: str,
    body: str,
    data: Optional[dict[str, str]] = None,
) -> messaging.BatchResponse:
    """
    Send the same notification to multiple devices.
    Returns a BatchResponse with success/failure counts.
    """
    ensure_firebase_app()

    multicast = messaging.MulticastMessage(
        tokens=fcm_tokens,
        notification=messaging.Notification(title=title, body=body),
        data=data or {},
        android=messaging.AndroidConfig(priority="high"),
    )

    response: messaging.BatchResponse = messaging.send_each_for_multicast(multicast)
    logger.info(
        "Multicast sent: %d success / %d failure",
        response.success_count,
        response.failure_count,
    )
    return response
