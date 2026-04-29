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
    Uses Gemini 1.5 Flash to analyze a bank statement PDF and return structured JSON.
    Gemini 1.5 Flash is faster and highly accurate for extraction tasks.
    """
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set. Falling back to local parser.")
        return None

    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        logger.info(f"Uploading {pdf_path} to Gemini...")
        uploaded_file = genai.upload_file(pdf_path)
        
        # Wait for file to be processed
        timeout = 60 # 60 seconds max
        start_time = time.time()
        while uploaded_file.state.name == "PROCESSING":
            if time.time() - start_time > timeout:
                logger.error("Gemini file processing timed out.")
                return None
            time.sleep(2)
            uploaded_file = genai.get_file(uploaded_file.name)
            
        logger.info("File processed by Gemini. Running Flash analysis...")

        # Flash is often better for raw extraction tasks
        model = genai.GenerativeModel('gemini-1.5-flash')

        prompt = """
        Analyze this bank statement PDF carefully and extract the following information in strict JSON format:
        1. All individual transactions (date, description, amount, type).
        2. Financial health metrics:
           - creditScore: A value between 300-850 based on balance trends and savings behavior.
           - riskScore: A value between 0-100 based on suspicious activity or overdrafts.
           - categories: Aggregated spending per category (e.g., Food, Travel, Bills, Shopping, Health, Entertainment, Other).
        
        Output MUST be a single valid JSON object exactly following this structure:
        {
          "creditScore": number,
          "riskScore": number,
          "categories": { "CategoryName": amount, ... },
          "transactions": [
            {"date": "YYYY-MM-DD", "description": "string", "amount": number, "transaction_type": "credit/debit", "category": "string"}
          ]
        }
        """

        response = model.generate_content(
            [prompt, uploaded_file],
            generation_config={"response_mime_type": "application/json"}
        )

        # Clean up Gemini storage
        try:
            genai.delete_file(uploaded_file.name)
        except Exception:
            pass

        # Parse and return
        result = json.loads(response.text)
        logger.info(f"Gemini Flash analysis successful: {len(result.get('transactions', []))} txns found.")
        return result

    except Exception as e:
        logger.error(f"Gemini 1.5 Flash analysis failed: {str(e)}")
        return None
