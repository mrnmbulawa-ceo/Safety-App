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
    const { reportId, filename, mimeType, recoveryToken } = req.body;
    
    if (!reportId || !filename) {
      return res.status(400).json({ error: "reportId and filename are required" });
    }

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('reporter_id, recovery_token_hash')
      .eq('id', reportId)
      .single();
      
    if (reportError || !report) {
      return res.status(404).json({ error: "Report not found" });
    }

    let uploaderId = null;

    if (recoveryToken) {
      // Anonymous/Email path
      const tokenHash = crypto.createHash('sha256').update(recoveryToken).digest('hex');
      if (tokenHash !== report.recovery_token_hash) {
        return res.status(403).json({ error: "Invalid recovery token" });
      }
    } else {
      // Account path
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "No authorization header or recovery token" });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !authData.user) {
        return res.status(401).json({ error: "Invalid token" });
      }
      
      const userId = authData.user.id;
      
      if (report.reporter_id !== userId) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        if (profile && ['moderator', 'admin'].includes(profile.role)) {
          uploaderId = userId;
        } else {
          return res.status(403).json({ error: "Unauthorized to upload evidence for this report" });
        }
      } else {
        uploaderId = userId;
      }
    }

    // Generate signed upload URL
    const storagePath = `${reportId}/${Date.now()}_${filename}`;
    const { data, error } = await supabase
      .storage
      .from('evidence')
      .createSignedUploadUrl(storagePath);
      
    if (error) throw error;

    // Insert metadata using service role to bypass RLS for anonymous
    const { error: metaError } = await supabase.from('evidence_items').insert({
      report_id: reportId,
      uploaded_by: uploaderId,
      storage_path: storagePath,
      original_filename: filename,
      mime_type: mimeType || 'application/octet-stream',
      status: 'uploaded'
    });

    if (metaError) throw metaError;

    // Update report status
    await supabase.from('reports').update({ evidence_status: 'uploaded' }).eq('id', reportId);

    res.status(200).json({ signedUrl: data.signedUrl, storagePath: data.path });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
