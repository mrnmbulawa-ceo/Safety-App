import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { UploadCloud, File as FileIcon, X, CheckCircle } from 'lucide-react';

export default function EvidenceUpload() {
  const { id: reportId } = useParams<{ id: string }>();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportExists, setReportExists] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkReport() {
      if (!reportId || !user) return;
      const { data, error } = await supabase
        .from('reports')
        .select('id')
        .eq('id', reportId)
        .eq('reporter_id', user.id)
        .single();
        
      if (error || !data) {
        setReportExists(false);
      } else {
        setReportExists(true);
      }
    }
    checkReport();
  }, [reportId, user]);

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (reportExists === false) {
    return <div className="text-center py-12">Report not found or unauthorized.</div>;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: File) => {
    if (!session || !reportId) throw new Error("Missing session or report ID");
    
    // Get signed URL from backend
    const response = await fetch('/api/evidence/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        reportId,
        filename: file.name
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to get upload URL');
    }

    const { signedUrl, storagePath } = await response.json();

    // Upload using signed URL
    const uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file
    });

    if (!uploadRes.ok) {
      throw new Error(`Failed to upload ${file.name}`);
    }

    // Record metadata in evidence_items table
    const { error: metaError } = await supabase
      .from('evidence_items')
      .insert({
        report_id: reportId,
        uploaded_by: user.id,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        status: 'uploaded'
      });

    if (metaError) throw metaError;
  };

  const handleSubmit = async () => {
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        await uploadFile(file);
      }
      
      if (files.length > 0) {
        // Update report status
        await supabase
          .from('reports')
          .update({ evidence_status: 'uploaded' })
          .eq('id', reportId);
      }

      navigate(`/confirmation/${reportId}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to upload files.');
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8">
      <div className="mb-8 text-center border-b border-slate-200 pb-4">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">Upload Evidence</h1>
        <p className="text-sm text-slate-500">Attach screenshots, photos, or documents related to the incident. This step is optional.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded text-sm">
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:bg-slate-50 transition-colors">
          <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-600 mb-4">Drag and drop files here, or click to select files</p>
          <label className="cursor-pointer bg-white border border-slate-200 text-slate-700 px-6 py-2 rounded text-sm font-bold hover:bg-slate-50 shadow-sm">
            Browse Files
            <input 
              type="file" 
              multiple 
              className="hidden" 
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        </div>

        {files.length > 0 && (
          <div className="mt-8 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase">Selected Files</h3>
            {files.map((file, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded bg-slate-50">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <FileIcon className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                  <span className="text-sm font-bold text-slate-700 truncate">{file.name}</span>
                  <span className="text-xs text-slate-500 font-medium">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <button 
                  onClick={() => removeFile(i)}
                  disabled={uploading}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-between items-center pt-6 border-t border-slate-100">
          <button
            onClick={() => navigate(`/confirmation/${reportId}`)}
            disabled={uploading}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wide"
          >
            Skip Upload
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={uploading || files.length === 0}
            className="bg-slate-800 text-white py-3 px-6 rounded text-sm font-bold hover:bg-black disabled:opacity-50 transition-colors shadow-sm"
          >
            {uploading ? 'Uploading...' : 'Submit Evidence'}
          </button>
        </div>
      </div>
    </div>
  );
}
