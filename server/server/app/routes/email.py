from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
import smtplib
from email.message import EmailMessage
import os

router = APIRouter(tags=["Email"])

class FraudAlertRequest(BaseModel):
    toEmail: str
    toName: str
    merchant: str
    amount: str
    riskScore: int
    location: str
    reason: str

@router.post("/email/fraud-alert")
async def send_fraud_alert(req: FraudAlertRequest):
    # Retrieve credentials from environment variables
    # The user should add these to their .env file
    sender_email = os.environ.get("SMTP_EMAIL", "navneethks05@gmail.com")
    sender_password = os.environ.get("SMTP_PASSWORD")

    body = f"""Hello {req.toName},

We have detected a highly suspicious transaction on your account.

Merchant: {req.merchant}
Amount: ₹{req.amount}
Risk Score: {req.riskScore}/100 (HIGH RISK)
Location: {req.location}
Reason: {req.reason}

If this was not you, please log in immediately to block your card.

Stay safe,
FinSmart AI Security Team
"""

    if not sender_password:
        # If password is not set, simulate sending for hackathon demo purposes
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"✉️  MOCK EMAIL SENT (Add SMTP_PASSWORD to .env for real emails)")
        print(f"To: {req.toEmail}")
        print(f"From: {sender_email}")
        print(f"Subject: 🚨 FinSmart Fraud Alert: Suspicious transaction detected")
        print("────────────────────────────────────────────────────")
        print(body)
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        return {"success": True, "message": "Email simulated successfully (SMTP password not configured)"}

    # Build the email
    msg = EmailMessage()
    msg["Subject"] = f"🚨 FinSmart Fraud Alert: Suspicious transaction detected"
    msg["From"] = sender_email
    msg["To"] = req.toEmail

    msg.set_content(body)

    try:
        # Connect to Gmail SMTP server
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
            
        return {"success": True, "message": "Email sent successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
