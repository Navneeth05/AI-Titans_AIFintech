"""
app/models/user.py
──────────────────
User data model for Firestore.
Uses Firebase UID as the document ID in the 'users' collection.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(BaseModel):
    """Represents a user document in Firestore."""
    id: str = ""                               # Firebase UID (also the doc ID)
    firebase_uid: str = ""
    email: str = ""
    display_name: Optional[str] = None
    fcm_token: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    def to_dict(self) -> dict:
        """Serialise to a Firestore-compatible dict."""
        return {
            "firebase_uid": self.firebase_uid,
            "email": self.email,
            "display_name": self.display_name,
            "fcm_token": self.fcm_token,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, doc_id: str, data: dict) -> "User":
        """Deserialise a Firestore document snapshot."""
        return cls(
            id=doc_id,
            firebase_uid=data.get("firebase_uid", doc_id),
            email=data.get("email", ""),
            display_name=data.get("display_name"),
            fcm_token=data.get("fcm_token"),
            is_active=data.get("is_active", True),
            created_at=data.get("created_at", _now()),
            updated_at=data.get("updated_at", _now()),
        )

    def __repr__(self) -> str:
        return f"<User uid={self.firebase_uid} email={self.email}>"
