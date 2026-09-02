// Shared email-sending helper, backed by Resend (https://resend.com).
//
// Until a custom domain is verified in the Resend dashboard, Resend's own
// sandbox restriction means an email can only be delivered to the address
// the Resend account was created with — not to real end users. That's a
// Resend-side restriction, not something this code can work around. Once a
// domain is verified, set RESEND_FROM_EMAIL to an address on that domain
// (e.g. "UBE Safety <alerts@ubesafety.co.za>") and delivery opens up to any
// recipient.

const RESEND_API_URL = 'https://api.resend.com/emails';

interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

interface SendEmailResult {
  ok: boolean;
  error?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'UBE Safety <onboarding@resend.dev>';

  if (!apiKey) {
    console.error('[email] RESEND_API_KEY is not configured — email was not sent.');
    return { ok: false, error: 'Email is not configured on this server yet.' };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[email] Resend API error:', response.status, body);
      return { ok: false, error: 'Failed to send email.' };
    }

    return { ok: true };
  } catch (e: any) {
    console.error('[email] Send failed:', e.message);
    return { ok: false, error: e.message || 'Failed to send email.' };
  }
}
