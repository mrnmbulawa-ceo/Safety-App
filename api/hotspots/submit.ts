import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex');
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();

  // Check rate limit
  const { count, error: rlError } = await supabase
    .from('rate_limit_events')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('scope', 'hotspot_submit')
    .gte('created_at', fifteenMinsAgo);

  if (rlError) {
    return res.status(500).json({ error: 'Rate limit check failed' });
  }

  if (count !== null && count >= 5) {
    return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
  }

  // Record event
  await supabase.from('rate_limit_events').insert({
    ip_hash: ipHash,
    scope: 'hotspot_submit'
  });

  const { latitude, longitude, category, description } = req.body;

  if (!latitude || !longitude || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { error: insertError } = await supabase.from('crime_hotspots').insert({
    latitude,
    longitude,
    category,
    description: description || null,
    status: 'pending'
  });

  if (insertError) {
    return res.status(500).json({ error: insertError.message });
  }

  return res.status(200).json({ success: true });
}
