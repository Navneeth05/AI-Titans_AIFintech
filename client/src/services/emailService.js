/**
 * Email alert service — sends fraud alerts via EmailJS.
 * Falls back to browser Notifications when EmailJS is not configured.
 * Setup: https://www.emailjs.com → create account → get Service ID, Template ID, Public Key
 */
import emailjs from '@emailjs/browser';

const SERVICE  = import.meta.env.VITE_EMAILJS_SERVICE_ID  || '';
const TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const KEY      = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  || '';

export const EMAILJS_CONFIGURED = Boolean(SERVICE && TEMPLATE && KEY);

/**
 * Send a fraud alert email.  Falls back to browser notification.
 */
export const sendFraudAlertEmail = async ({
  toEmail, toName, merchant, amount, riskScore, location, reason,
}) => {
  const body =
    `Merchant: ${merchant}\n` +
    `Amount: ₹${amount}\n` +
    `Risk Score: ${riskScore}/100 (HIGH)\n` +
    `Location: ${location || 'Unknown'}\n` +
    `Reason: ${reason || 'Behavioral + Location anomaly detected'}`;

  // ── EmailJS path ────────────────────────────────────────────────────────
  if (EMAILJS_CONFIGURED) {
    try {
      const result = await emailjs.send(SERVICE, TEMPLATE, {
        to_email:   toEmail,
        to_name:    toName || 'User',
        subject:    '🚨 FinSmart Fraud Alert',
        merchant,
        amount:     `₹${amount}`,
        risk_score: `${riskScore}/100`,
        location:   location || 'Unknown',
        reason:     reason || 'Behavioral + Location anomaly',
        message:    body,
      }, KEY);
      return { success: true, method: 'emailjs', result };
    } catch (err) {
      console.error('[EmailJS] Send failed:', err);
    }
  }

  // ── Fallback: browser notification ───────────────────────────────────────
  console.warn('[Email] EmailJS not configured — using notification fallback.');
  console.info('[Alert body]', body);

  if (typeof window !== 'undefined') {
    // Request permission if not granted yet
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      new Notification('🚨 FinSmart Fraud Alert', {
        body: `${merchant} — ₹${amount} | Risk: ${riskScore}/100`,
        icon: '/vite.svg',
      });
    }
  }
  return { success: true, method: 'notification-fallback' };
};
