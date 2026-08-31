import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Supabase service client for backend operations
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let supabase: any = null;
  if (supabaseUrl && serviceKey) {
    supabase = createClient(supabaseUrl, serviceKey);
  }

  // API Route: Generate Signed Upload URL
  app.post("/api/evidence/upload-url", async (req, res) => {
    if (!supabase) {
      return res.status(500).json({ error: "Backend Supabase client not initialized" });
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "No authorization header" });
      }

      // Verify the user
      const token = authHeader.replace("Bearer ", "");
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !authData.user) {
        return res.status(401).json({ error: "Invalid token" });
      }
      
      const userId = authData.user.id;
      const { reportId, filename } = req.body;
      
      if (!reportId || !filename) {
        return res.status(400).json({ error: "reportId and filename are required" });
      }

      // Verify user owns the report
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select('reporter_id')
        .eq('id', reportId)
        .single();
        
      if (reportError || !report || report.reporter_id !== userId) {
        return res.status(403).json({ error: "Unauthorized to upload evidence for this report" });
      }

      // Generate signed upload URL
      const storagePath = `${reportId}/${Date.now()}_${filename}`;
      const { data, error } = await supabase
        .storage
        .from('evidence')
        .createSignedUploadUrl(storagePath);
        
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json({ signedUrl: data.signedUrl, storagePath: data.path });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API Route: Generate Signed Download URL
  app.post("/api/evidence/download-url", async (req, res) => {
    if (!supabase) {
      return res.status(500).json({ error: "Backend Supabase client not initialized" });
    }

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

      res.json({ signedUrl: data.signedUrl });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
