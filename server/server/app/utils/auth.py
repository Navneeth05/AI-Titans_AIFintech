"""
app/utils/auth.py
─────────────────
FastAPI dependency that validates a Firebase ID token from the
Authorization: Bearer <token> header.

Flow
────
1. Extract JWT from header
2. Verify with firebase_admin.auth.verify_id_token()
3. Upsert a user document in Firestore (first login auto-creates)
4. Return the User model to the route handler

The dependency is injected as:
    current_user: User = Depends(get_current_user)
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.cloud.firestore_v1.client import Client as FirestoreClient

import firebase_admin.auth as fb_auth

from app.firestore_db import get_db, USERS_COL
from app.models.user import User
from app.services.firebase_service import ensure_firebase_app

bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: FirestoreClient = Depends(get_db),
) -> User:
    """
    Verify Firebase ID token and return (or auto-create) the Firestore user.
    Raises HTTP 401 on any failure.
    """
    ensure_firebase_app()

    token = credentials.credentials
    try:
        decoded = fb_auth.verify_id_token(token)
    except fb_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase token has expired. Please re-authenticate.",
        )
    except fb_auth.InvalidIdTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Firebase token: {exc}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {exc}",
        )

    firebase_uid: str = decoded["uid"]
    email: str = decoded.get("email", "")
    display_name: str | None = decoded.get("name")

    # ── Upsert user in Firestore ────────────────────────────────────────────
    user_ref = db.collection(USERS_COL).document(firebase_uid)
    doc = user_ref.get()

    if doc.exists:
        user = User.from_dict(firebase_uid, doc.to_dict())
        # Keep profile fields fresh
        updates = {"email": email, "updated_at": User.model_fields["updated_at"].default_factory()}
        if display_name:
            updates["display_name"] = display_name
        user_ref.update(updates)
        user.email = email
        if display_name:
            user.display_name = display_name
    else:
        user = User(
            id=firebase_uid,
            firebase_uid=firebase_uid,
            email=email,
            display_name=display_name,
        )
        user_ref.set(user.to_dict())

    return user
