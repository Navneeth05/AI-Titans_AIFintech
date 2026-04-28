Problem Statement
Traditional bank statements are hard to understand, so users cannot easily track spending habits or get personalized financial insights from raw PDF data. At the same time, most fraud systems are reactive and detect suspicious activity only after a transaction has already caused damage. This project addresses both issues by building an AI system that analyzes bank statements, classifies transactions, estimates financial health, and detects fraud in real time with explainable alerts.

Project Overview
This system combines NLP, machine learning, and geospatial analysis to convert unstructured bank statements into structured financial insights. It processes PDF statements, categorizes transactions such as food, bills, shopping, travel, and entertainment, and monitors transaction behavior for anomalies. It also detects impossible travel, suspicious spending patterns, and risky cardless ATM usage to flag fraud instantly.

Objectives
Extract and process financial data from PDF bank statements using pdfplumber and regex.

Classify transactions into categories using TF-IDF or BERT.

Analyze spending patterns and estimate a financial health score based on income versus expenditure.

Detect fraud using location-based, behavior-based, and cardless withdrawal validation checks.

Provide real-time alerts with explainable AI reasoning for every flagged transaction.

Core Modules
PDF Parser.

NLP Classifier.

Financial Analysis Engine.

Credit Score Estimation.

Fraud Detection Engine.

Risk Scoring Engine.

Notification System.

Explainable AI Layer.

Frontend Dashboard.

Database Layer.

Fraud Detection Approach
The fraud engine uses a three-layer detection strategy:

Location-based checks: Flags impossible travel between transactions using distance and time analysis.

Behavior-based checks: Uses Isolation Forest and clustering to detect unusual spending patterns.

Cardless ATM checks: Verifies device ID, OTP, and GPS location matching.

Tech Stack
Frontend: React.js, Tailwind CSS, Chart.js.

Backend: FastAPI or Flask, REST APIs.

AI/ML: Scikit-learn, BERT, Isolation Forest.

NLP: pdfplumber, PyMuPDF, TF-IDF, BERT.

Database: firebase 

Expected Outcomes
Accurate transaction classification across five categories.

Clear monthly and category-wise financial insights.

Reduced false positives through behavioral learning.

Key Advantages
Real-time fraud detection.

Explainable AI decisions.

Multi-layer security.

Cloud-ready and scalable architecture.

Limitations
The system depends on data quality, the credit score is an estimation, and labeled training data is needed for best accuracy.

