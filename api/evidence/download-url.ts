import { createClient } from "@supabase/supabase-js";

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
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authData.user) {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    const userId = authData.user.id;
    const { storagePath, reportId } = req.body;
    
    if (!storagePath || !reportId) {
      return res.status(400).json({ error: "storagePath and reportId are required" });
    }

    // Check if user is a moderator/admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
      
    const isModerator = profile && ['moderator', 'admin'].includes(profile.role);
    
    if (!isModerator) {
      // If not moderator, verify user owns the report
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select('reporter_id')
        .eq('id', reportId)
        .single();
        
      if (reportError || !report || report.reporter_id !== userId) {
        return res.status(403).json({ error: "Unauthorized to access this evidence" });
      }
    }

    // Create signed download URL (valid for 60 seconds)
    const { data, error } = await supabase
      .storage
      .from('evidence')
      .createSignedUrl(storagePath, 60);
      
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json({ signedUrl: data.signedUrl });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
