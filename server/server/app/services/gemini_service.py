import google.generativeai as genai
import json
import time
import os
import logging
from pathlib import Path
from app.config import settings

logger = logging.getLogger(__name__)

def analyze_statement_with_gemini(pdf_path: str):
    """
    Uses Gemini 1.5 Pro to analyze a bank statement PDF and return structured JSON.
    """
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set. Falling back to local parser.")
        return None

    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        logger.info(f"Uploading {pdf_path} to Gemini...")
        uploaded_file = genai.upload_file(pdf_path)
        
        while uploaded_file.state.name == "PROCESSING":
            time.sleep(2)
            uploaded_file = genai.get_file(uploaded_file.name)
            
        logger.info("File processed by Gemini. Analyzing...")

        model = genai.GenerativeModel('gemini-1.5-pro')

        prompt = """
        You are a financial analyst. Review the attached bank statement.
        1. Extract all transactions.
        2. Identify credited amounts (deposits) and debited amounts (withdrawals).
        3. Group the debited transactions into logical spending categories (e.g., 'Food & Dining', 'Transportation', 'Utilities', 'Transfers', 'Shopping', 'Health', 'Entertainment', 'Miscellaneous').
        4. Calculate a credit score (300-850) based on financial health indicators seen in the statement (savings ratio, consistency, balance maintenance).
        5. Calculate a risk score (0-100) based on suspicious patterns or high expense ratios.
        
        Output the analysis strictly as a JSON object using the following schema:
        {
          "creditScore": 720,
          "riskScore": 15,
          "categories": {
            "Food & Dining": 0.00,
            "Transportation": 0.00
          },
          "transactions": [
            {"date": "YYYY-MM-DD", "description": "...", "amount": 0.00, "transaction_type": "debit/credit", "category": "..."}
          ]
        }
        """

        response = model.generate_content(
            [prompt, uploaded_file],
            generation_config={"response_mime_type": "application/json"}
        )

        # Clean up
        genai.delete_file(uploaded_file.name)

        return json.loads(response.text)

    except Exception as e:
        logger.error(f"Gemini analysis failed: {str(e)}")
        return None
