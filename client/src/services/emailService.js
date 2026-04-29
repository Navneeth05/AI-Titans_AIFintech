/**
 * Email alert service — sends fraud alerts via FastAPI backend.
 * Falls back to browser Notifications when backend is unreachable or missing SMTP credentials.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Send a fraud alert email. Falls back to browser notification.
 */
export const sendFraudAlertEmail = async (payload) => {
  const { toEmail, toName, merchant, amount, riskScore, location, reason } = payload;
  
  const body =
    `Merchant: ${merchant}\n` +
    `Amount: ₹${amount}\n` +
    `Risk Score: ${riskScore}/100 (HIGH)\n` +
    `Location: ${location || 'Unknown'}\n` +
    `Reason: ${reason || 'Behavioral + Location anomaly detected'}`;

  // ── FastAPI Backend path ────────────────────────────────────────────────
  try {
    const response = await fetch(`${API_URL}/api/v1/email/fraud-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { success: true, method: 'fastapi' };
    } else {
      console.warn('[EmailService] Backend failed to send email. Ensure SMTP_PASSWORD is set in server/.env', await response.text());
    }
  } catch (err) {
    console.error('[EmailService] API unreachable:', err);
  }

  // ── Fallback: browser notification ───────────────────────────────────────
  console.warn('[EmailService] Falling back to browser notification.');
  console.info('[Alert body]', body);

  if (typeof window !== 'undefined') {
    // Request permission if not granted yet
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      new Notification('🚨 AIFintech Fraud Alert', {
        body: `${merchant} — ₹${amount} | Risk: ${riskScore}/100`,
        icon: '/vite.svg',
      });
    }
  }
  return { success: true, method: 'notification-fallback' };
};
