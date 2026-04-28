"""
app/main.py
───────────
FastAPI application factory.

• Registers all routers under /api/v1
• Initialises Firebase Admin SDK + Firestore on startup
• CORS configured for local React dev server
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.firestore_db import get_firestore_client
from app.routes import upload, transactions, fraud, credit, email
from app.services.firebase_service import ensure_firebase_app

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# Suppress noisy third-party logs
logging.getLogger("pdfminer").setLevel(logging.WARNING)
logging.getLogger("googleapiclient").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ────────────────────────────────────────────────────────────
    logger.info("Starting %s …", settings.APP_NAME)

    # Initialise Firebase SDK + Firestore client
    try:
        ensure_firebase_app()
        get_firestore_client()
        logger.info("Firebase + Firestore initialised.")
    except FileNotFoundError as exc:
        logger.warning("Firebase not initialised: %s", exc)

    yield  # ← app is running here

    # ── Shutdown ───────────────────────────────────────────────────────────
    logger.info("%s shut down cleanly.", settings.APP_NAME)


# ── App factory ───────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title="Smart FinTech API",
        description=(
            "Bank statement analysis, fraud detection, and credit scoring. "
            "All endpoints require a valid Firebase ID token in the "
            "`Authorization: Bearer <token>` header."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── CORS ───────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",   # React dev server (CRA / Vite)
            "http://localhost:5173",   # Vite default
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ────────────────────────────────────────────────────────────
    PREFIX = "/api/v1"

    app.include_router(upload.router,       prefix=PREFIX)
    app.include_router(transactions.router, prefix=PREFIX)
    app.include_router(fraud.router,        prefix=PREFIX)
    app.include_router(credit.router,       prefix=PREFIX)
    app.include_router(email.router,        prefix=PREFIX)

    # ── Health check ───────────────────────────────────────────────────────
    @app.get("/health", tags=["Health"], summary="Liveness check")
    async def health() -> dict:
        return {"status": "ok", "service": settings.APP_NAME, "version": "1.0.0"}

    return app


app = create_app()
