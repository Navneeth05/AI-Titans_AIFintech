# 💳 FinSmart AI: Next-Gen Financial Intelligence

![FinSmart AI Banner](https://img.shields.io/badge/Status-AI--Powered-blueviolet?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react)
![Gemini](https://img.shields.io/badge/AI-Gemini%201.5%20Pro-blue?style=for-the-badge)

**FinSmart AI** is a cutting-edge financial platform designed to bridge the gap between complex bank data and actionable insights. Leveraging the power of **Google Gemini 1.5 Pro**, it automatically analyzes bank statements, classifies spending, and protects users with a high-fidelity, real-time fraud detection engine.

---

## 🌟 Key Features

### 🧠 1. AI-Powered Statement Analysis
*   **Gemini 1.5 Pro Integration**: Automatically "reads" PDF bank statements with professional financial reasoning.
*   **Automated Categorization**: Recognizes spending patterns (Food, Health, Travel, etc.) without manual input.
*   **Credit & Risk Profiling**: Generates dynamic scores based on savings ratios and transaction consistency.

### 🛡️ 2. Real-Time Fraud Engine
*   **Impossible Travel Detection**: Flags transactions that occur across impossible geographical distances in short timeframes.
*   **Urgent Notification Stream**: Dispatches continuous email alerts every 10 seconds during a security event.
*   **Interactive Security Window**: Provides a 120-second window for users to confirm or block suspicious activity before the card is suspended.

### 📊 3. Modern Financial Dashboard
*   **Data-Driven Insights**: Visualize income vs. spending trends using high-performance Recharts.
*   **Instant Sync**: UI updates in real-time as analysis completes in the background.
*   **History Ledger**: A persistent, searchable record of all past uploads and security alerts.

---

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | React, Vite, Vanilla CSS (Glassmorphism), Recharts |
| **Backend** | FastAPI (Python 3.13), Uvicorn |
| **AI / ML** | Google Gemini 1.5 Pro API, Scikit-Learn (NLP) |
| **Database** | Firebase Firestore (Real-time NoSQL) |
| **Security** | JWT Authentication, SMTP Alert System |

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/Navneeth05/AI-Titans_AIFintech.git
cd AI-Titans_AIFintech
```

### 2. Backend Setup
```bash
cd server/server
pip install -r requirements.txt
# Add your GEMINI_API_KEY and SMTP_PASSWORD to .env
python run.py
```

### 3. Frontend Setup
```bash
cd client
npm install
npm run dev
```

---

## 📂 Project Structure
```text
├── client/                # React Frontend (Vite)
│   ├── src/pages          # Dashboard, Risk Engine, Upload
│   └── src/services       # Firebase, Firestore, API logic
├── server/                # FastAPI Backend
│   ├── app/routes         # Analysis & Email endpoints
│   ├── app/services       # Gemini & ML model logic
│   └── app/utils          # PDF Parsing & Auth
└── PROGRESS.md            # Live task tracking & roadmap
```

---

## 🛡️ Security
FinSmart AI prioritizes data privacy. Bank statements are processed using the **Gemini File API**, which ensures that sensitive PDF data is analyzed securely and deleted immediately after the session concludes.

---
*Developed by the AI Titans for the future of FinTech.*
