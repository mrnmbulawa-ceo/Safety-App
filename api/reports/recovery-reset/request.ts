import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { sendEmail } from "../../_lib/email";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Backend Supabase client not initialized" });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { reportId, email } = req.body;
    if (!reportId || !email) {
      return res.status(400).json({ error: "Report ID and email are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Rate limit check
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();
    
    const { count, error: countError } = await supabase.from('rate_limit_events')
      .select('*', { count: 'exact', head: true })
      .eq('scope', 'recovery_reset_request')
      .eq('ip_hash', ipHash)
      .gte('created_at', fifteenMinsAgo);

    if (countError) throw countError;

    if (count !== null && count >= 5) {
      return res.status(429).json({ error: 'Too many requests recently. Please try again later.' });
    }

    await supabase.from('rate_limit_events').insert({
      scope: 'recovery_reset_request',
      ip_hash: ipHash
    });

    const genericMessage = "If that report ID and email match, we've sent a verification code.";

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, contact_email')
      .eq('id', reportId)
      .eq('submission_channel', 'verified_email')
      .single();

    if (reportError || !report || !report.contact_email || report.contact_email.toLowerCase() !== normalizedEmail) {
      // Still write audit event even if no match
      await supabase.from('audit_events').insert({
        event_type: 'report.recovery_reset_requested',
        subject_table: 'reports',
        subject_id: reportId,
        actor_id: null,
        metadata: { matched: false }
      });
      return res.status(200).json({ message: genericMessage });
    }

    // It's a match
    // 1. Invalidate existing active challenges
    await supabase.from('recovery_reset_challenges')
      .update({ consumed_at: new Date().toISOString() })
      .eq('report_id', reportId)
      .is('consumed_at', null);

    // 2. Generate new 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); // 10 mins

    // 3. Insert challenge
    await supabase.from('recovery_reset_challenges').insert({
      report_id: reportId,
      email: normalizedEmail,
      code_hash: codeHash,
      expires_at: expiresAt
    });

    // 4. Send email
    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: 'Your UBE Safety report recovery code',
      html: `
        <div style="font-family: sans-serif; font-size: 15px; color: #1e293b; line-height: 1.5;">
          <p style="margin: 0 0 16px 0;">Someone requested a recovery code for a report on UBE Safety using this email address.</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 0 0 16px 0;">${code}</p>
          <p style="margin: 0 0 16px 0;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
      text: `Your UBE Safety verification code is ${code}. It expires in 10 minutes.`,
    });

    if (!emailResult.ok) {
      // Log it, but don't leak the failure (or the match/no-match outcome)
      // to the client — the response stays generic either way.
      console.error('[recovery-reset/request] Failed to send code email:', emailResult.error);
    }

    // 5. Audit
    await supabase.from('audit_events').insert({
      event_type: 'report.recovery_reset_requested',
      subject_table: 'reports',
      subject_id: reportId,
      actor_id: null,
      metadata: { matched: true }
    });

    // Optional purge housekeeping
    try {
      await supabase.rpc('purge_expired_recovery_challenges');
    } catch (_) {}

    return res.status(200).json({ message: genericMessage });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
