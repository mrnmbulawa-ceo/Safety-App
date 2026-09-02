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
    const { reportData, submission_channel, contact_email, termsVersion } = req.body;
    
    if (!termsVersion) {
      return res.status(400).json({ error: "termsVersion is required" });
    }

    // Rate limit check
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();
    
    const { count, error: countError } = await supabase.from('rate_limit_events')
      .select('*', { count: 'exact', head: true })
      .eq('scope', 'anonymous_report_submit')
      .eq('ip_hash', ipHash)
      .gte('created_at', fifteenMinsAgo);

    if (countError) throw countError;

    if (count !== null && count >= 5) {
      return res.status(429).json({ error: 'Too many reports submitted recently. Please try again later.' });
    }

    await supabase.from('rate_limit_events').insert({
      scope: 'anonymous_report_submit',
      ip_hash: ipHash
    });

    let verifiedEmail = null;
    if (submission_channel === 'verified_email') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Missing authorization" });
      
      const token = authHeader.replace("Bearer ", "");
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authData.user) return res.status(401).json({ error: "Invalid token" });
      verifiedEmail = authData.user.email;
    }

    // Generate token
    const rawToken = crypto.randomBytes(4).toString('hex').toUpperCase() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const token = 'SAFE-' + rawToken;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Insert report
    const { data: report, error } = await supabase.from('reports').insert({
      ...reportData,
      submission_channel,
      contact_email: verifiedEmail || null,
      recovery_token_hash: tokenHash,
      reporter_id: null,
      terms_version: termsVersion,
      report_status: 'pending',
      evidence_status: 'pending_upload'
    }).select().single();

    if (error) throw error;

    // Insert moderation case
    await supabase.from('moderation_cases').insert({
      report_id: report.id,
      status: 'open'
    });

    return res.status(200).json({ reportId: report.id, recoveryToken: token });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
