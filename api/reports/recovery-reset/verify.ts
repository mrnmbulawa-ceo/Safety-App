import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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
    const { reportId, code } = req.body;
    if (!reportId || !code) {
      return res.status(400).json({ error: "Report ID and code are required" });
    }

    // Rate limit check
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();
    
    const { count, error: countError } = await supabase.from('rate_limit_events')
      .select('*', { count: 'exact', head: true })
      .eq('scope', 'recovery_reset_verify')
      .eq('ip_hash', ipHash)
      .gte('created_at', fifteenMinsAgo);

    if (countError) throw countError;

    if (count !== null && count >= 5) {
      return res.status(429).json({ error: 'Too many requests recently. Please try again later.' });
    }

    await supabase.from('rate_limit_events').insert({
      scope: 'recovery_reset_verify',
      ip_hash: ipHash
    });

    const codeHash = crypto.createHash('sha256').update(String(code).trim()).digest('hex');
    const now = new Date().toISOString();

    const { data: challenge, error: challengeError } = await supabase
      .from('recovery_reset_challenges')
      .select('id, expires_at, consumed_at')
      .eq('report_id', reportId)
      .eq('code_hash', codeHash)
      .is('consumed_at', null)
      .gte('expires_at', now)
      .single();

    const genericErrorMsg = 'Invalid or expired verification code.';

    if (challengeError || !challenge) {
      return res.status(400).json({ error: genericErrorMsg });
    }

    // Match found. Mark as consumed.
    await supabase.from('recovery_reset_challenges')
      .update({ consumed_at: now })
      .eq('id', challenge.id);

    // Generate new recovery token
    const rawToken = crypto.randomBytes(4).toString('hex').toUpperCase() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const token = 'SAFE-' + rawToken;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Update report
    await supabase.from('reports')
      .update({ recovery_token_hash: tokenHash })
      .eq('id', reportId);

    // Audit event
    await supabase.from('audit_events').insert({
      event_type: 'report.recovery_reset_completed',
      subject_table: 'reports',
      subject_id: reportId,
      actor_id: null
    });

    return res.status(200).json({ newRecoveryToken: token });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
