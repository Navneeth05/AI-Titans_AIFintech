# Smart FinTech System — Backend

FastAPI backend for bank statement analysis, fraud detection, and credit scoring.
Uses **Firebase Firestore** as the database and **Firebase Auth** for authentication.

## Project Structure

```
server/
├── app/
│   ├── main.py                        ← FastAPI app factory + lifespan hooks
│   ├── config.py                      ← Pydantic settings from .env
│   ├── firestore_db.py                ← Firestore client + FastAPI dependency
│   │
│   ├── models/
│   │   ├── user.py                    ← User model (Pydantic + Firestore helpers)
│   │   └── transaction.py            ← BankStatement, Transaction, FraudAlert, CreditScore
│   │
│   ├── schemas/
│   │   └── transaction.py            ← Pydantic request/response schemas
│   │
│   ├── routes/
│   │   ├── upload.py                  ← POST /upload-statement
│   │   ├── transactions.py           ← GET  /transactions
│   │   ├── fraud.py                   ← POST /fraud-check
│   │   └── credit.py                 ← POST /credit-score
│   │
│   ├── services/
│   │   ├── pdf_parser.py             ← PDF extraction (pdfplumber)
│   │   ├── ml_model.py               ← ML fraud + credit scoring
│   │   └── firebase_service.py       ← Firebase Admin SDK + FCM
│   │
│   └── utils/
│       └── auth.py                    ← Firebase token verification dependency
│
├── ml_models/                         ← Drop .pkl model files here
├── requirements.txt
├── run.py                             ← Dev entry point
├── Dockerfile
└── .env                               ← Environment config
```

## Quick Start

```bash
# 1. Clone and enter
cd server

# 2. Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env → set FIREBASE_CREDENTIALS_PATH and FIREBASE_PROJECT_ID

# 5. Run
python run.py
```

→ Swagger UI at **http://localhost:8000/docs**

## API Endpoints

All endpoints (except `/health`) require `Authorization: Bearer <firebase-id-token>`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| POST | `/api/v1/upload-statement` | Upload bank statement PDF |
| PUT | `/api/v1/upload-statement/fcm-token` | Register FCM token |
| GET | `/api/v1/transactions?statement_id=X` | Get parsed transactions |
| GET | `/api/v1/transactions/statements` | List all statements |
| GET | `/api/v1/transactions/statements/{id}` | Get statement status |
| POST | `/api/v1/fraud-check` | Run fraud detection |
| GET | `/api/v1/fraud-check/{id}/alerts` | Get fraud alerts |
| POST | `/api/v1/credit-score` | Compute credit score |
| GET | `/api/v1/credit-score/{id}` | Get credit score |

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. **Authentication** → Enable Email/Password and Google sign-in
3. **Firestore Database** → Create database in test mode
4. **Project Settings → Service Accounts** → Generate private key
5. Save the JSON as `firebase_credentials.json` in this directory

## Firestore Collections

```
users/{firebase_uid}        → email, display_name, fcm_token
bank_statements/{uuid}      → user_id, filename, status, total_transactions
transactions/{uuid}         → statement_id, date, description, amount, balance
fraud_alerts/{uuid}         → statement_id, alert_type, severity, fraud_score
credit_scores/{uuid}        → statement_id, score, grade, risk_level
```

## ML Model Integration

Drop your trained model files into `ml_models/`:

| File | Interface |
|------|-----------|
| `fraud_model.pkl` | `.predict_proba(X)` → `[[p_normal, p_fraud]]` |
| `credit_model.pkl` | `.predict(X)` → `[score]` (300–850) |

Without model files, heuristic fallbacks are used automatically.
