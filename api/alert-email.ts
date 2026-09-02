import { sendEmail } from './_lib/email';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { emails, message, mapLink } = req.body;
    if (!emails || !message) {
      return res.status(400).json({ error: 'Missing emails or message' });
    }

    const html = `
      <div style="font-family: sans-serif; font-size: 15px; color: #1e293b; line-height: 1.5;">
        <p style="font-weight: bold; color: #dc2626; font-size: 18px; margin: 0 0 12px 0;">EMERGENCY ALERT — UBE Safety</p>
        <p style="margin: 0 0 16px 0;">${message}</p>
        ${mapLink ? `<p style="margin: 0 0 16px 0;"><a href="${mapLink}" style="color:#4f46e5; font-weight:bold;">View live location on Google Maps</a></p>` : ''}
        <p style="color: #64748b; font-size: 12px; margin: 24px 0 0 0;">This alert was sent because someone listed you as a trusted contact on UBE Safety.</p>
      </div>
    `;

    const result = await sendEmail({
      to: emails,
      subject: 'EMERGENCY ALERT — someone listed you as a trusted contact',
      html,
      text: `${message}${mapLink ? `\n\n${mapLink}` : ''}`,
    });

    if (!result.ok) {
      return res.status(502).json({ error: result.error || 'Failed to send alert email.' });
    }

    return res.status(200).json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
