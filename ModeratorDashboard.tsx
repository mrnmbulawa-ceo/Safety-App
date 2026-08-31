import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { Report, ModerationCase, EvidenceItem } from '../types';
import { FileText, Download, Shield } from 'lucide-react';

export default function ModeratorDashboard() {
  const { user, profile, session } = useAuth();
  
  const [cases, setCases] = useState<(ModerationCase & { reports: Report })[]>([]);
  const [selectedCase, setSelectedCase] = useState<(ModerationCase & { reports: Report }) | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [rationale, setRationale] = useState('');
  const [actioning, setActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role === 'moderator' || profile?.role === 'admin') {
      fetchCases();
    }
  }, [profile]);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('moderation_cases')
        .select(`
          *,
          reports (*)
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setCases(data as any);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCaseDetails = async (c: ModerationCase & { reports: Report }) => {
    setSelectedCase(c);
    setRationale('');
    setError(null);
    try {
      const { data, error } = await supabase
        .from('evidence_items')
        .select('*')
        .eq('report_id', c.report_id);
        
      if (error) throw error;
      setEvidence(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadEvidence = async (item: EvidenceItem) => {
    try {
      if (!session) throw new Error("Not authenticated");
      
      const response = await fetch('/api/evidence/download-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          storagePath: item.storage_path,
          reportId: item.report_id
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }
      
      const { signedUrl } = await response.json();
      window.open(signedUrl, '_blank');
      
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to download evidence');
    }
  };

  const submitAction = async (action: string) => {
    if (!selectedCase || !user) return;
    if (!rationale.trim()) {
      setError('A rationale is required for all actions.');
      return;
    }
    
    setActioning(true);
    setError(null);
    try {
      const newStatus = action === 'approve' ? 'resolved' : 'dismissed';
      
      // 1. Write moderation action
      const { error: actionError } = await supabase
        .from('moderation_actions')
        .insert({
          case_id: selectedCase.id,
          actor_id: user.id,
          action: action,
          from_value: selectedCase.status,
          to_value: newStatus,
          rationale: rationale
        });
        
      if (actionError) throw actionError;
      
      // 2. Update moderation case
      const { error: caseError } = await supabase
        .from('moderation_cases')
        .update({ status: newStatus })
        .eq('id', selectedCase.id);
        
      if (caseError) throw caseError;
      
      // 3. Update report status
      const { error: reportError } = await supabase
        .from('reports')
        .update({ report_status: newStatus })
        .eq('id', selectedCase.report_id);
        
      if (reportError) throw reportError;
      
      setSelectedCase(null);
      fetchCases();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit action.');
    } finally {
      setActioning(false);
    }
  };

  if (!user || (profile && profile.role !== 'moderator' && profile.role !== 'admin')) {
    return <Navigate to="/" />;
  }

  return (
    <div className="flex flex-1 w-full overflow-hidden bg-slate-50">
      {/* Queue Sidebar */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-2">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Open Cases</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-500">Loading queue...</div>
          ) : cases.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">No open cases.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {cases.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => loadCaseDetails(c)}
                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 ${selectedCase?.id === c.id ? 'bg-indigo-50/50 border-l-4 border-indigo-600' : 'cursor-pointer border-l-4 border-transparent'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-[10px] font-bold uppercase ${selectedCase?.id === c.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                        Case #{c.id.slice(0, 6)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(c.reports.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 mb-1 line-clamp-1">
                      {c.reports.incident_category} - {c.reports.general_location || 'No location'}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-1">
                      {c.reports.narrative}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Case Details Workspace */}
      <section className="flex-1 flex flex-col bg-slate-50 p-6 h-[calc(100vh-140px)] overflow-hidden">
        {selectedCase ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
              <div>
                <h1 className="text-lg font-bold text-slate-800">Case Detail: #{selectedCase.id.slice(0, 8)}</h1>
                <p className="text-xs text-slate-500">
                  Ref: {selectedCase.report_id.slice(0, 8)} • Submitted {new Date(selectedCase.reports.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                {selectedCase.reports.reporter_identity_protected && (
                  <span className="px-3 py-1.5 bg-purple-100 border border-purple-200 rounded text-xs font-bold text-purple-800 shadow-sm">
                    Identity Protected
                  </span>
                )}
                <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-700 shadow-sm">
                  {selectedCase.reports.incident_category}
                </span>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Incident Narrative</h3>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-700 leading-relaxed italic whitespace-pre-wrap">
                    {selectedCase.reports.narrative}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Location Detail</h3>
                    <p className="text-sm font-medium text-slate-800">{selectedCase.reports.general_location || 'N/A'}</p>
                    <p className="text-xs text-slate-500 mt-1">Time: <span className="text-slate-800 font-bold">{selectedCase.reports.incident_occurred_at ? new Date(selectedCase.reports.incident_occurred_at).toLocaleString() : 'N/A'}</span></p>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">External Reports</h3>
                    <ul className="text-sm text-slate-800 list-disc list-inside font-medium">
                      {selectedCase.reports.reported_to_police && <li>Police</li>}
                      {selectedCase.reports.reported_to_platform && <li>Platform</li>}
                      {selectedCase.reports.reported_to_employer && <li>Employer</li>}
                      {selectedCase.reports.reported_to_other && <li>Other Organization</li>}
                      {!selectedCase.reports.reported_to_police && !selectedCase.reports.reported_to_platform && !selectedCase.reports.reported_to_employer && !selectedCase.reports.reported_to_other && (
                        <li className="list-none text-slate-500 italic font-normal">None reported</li>
                      )}
                    </ul>
                  </div>
                </div>

                {selectedCase.reports.context && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Context</h3>
                    <p className="text-sm text-slate-800">{selectedCase.reports.context}</p>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Evidence Files ({evidence.length})</span>
                  </h3>
                  {evidence.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No evidence uploaded.</p>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {evidence.map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleDownloadEvidence(item)}
                          className="flex items-center gap-2 p-2 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200 transition-colors"
                        >
                          <FileText className="w-4 h-4 text-slate-500" />
                          <span className="text-xs font-bold text-slate-700">{item.original_filename}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Form */}
              <div className="w-72 border-l border-slate-100 bg-slate-50/50 p-6 flex flex-col">
                <h3 className="text-xs font-bold text-slate-800 mb-4">Moderation Action</h3>
                
                {error && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs">
                    {error}
                  </div>
                )}
                
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Required Rationale</label>
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  className="w-full flex-1 p-2 bg-white border border-slate-200 rounded text-xs mb-4 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  placeholder="Provide justification for this change..."
                />
                
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => submitAction('approve')}
                    disabled={actioning || !rationale.trim()}
                    className="w-full py-3 bg-indigo-600 text-white rounded font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    Mark Resolved
                  </button>
                  <button
                    onClick={() => submitAction('reject')}
                    disabled={actioning || !rationale.trim()}
                    className="w-full py-3 bg-slate-800 text-white rounded font-bold text-sm hover:bg-black disabled:opacity-50 transition-colors"
                  >
                    Dismiss Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm">
            <Shield className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-sm font-bold text-slate-500">Select a case from the queue to review.</p>
          </div>
        )}
      </section>
    </div>
  );
}
