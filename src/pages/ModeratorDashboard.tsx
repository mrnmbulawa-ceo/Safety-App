import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { Report, ModerationCase, EvidenceItem, CrimeHotspot } from '../types';
import { FileText, Shield, MapPin, Check, X, AlertTriangle } from 'lucide-react';

const CHANNEL_LABELS: Record<string, string> = {
  account: 'Account',
  verified_email: 'Email-verified',
  anonymous: 'Anonymous',
};

const CHANNEL_STYLES: Record<string, string> = {
  account: 'bg-green-100 text-green-700',
  verified_email: 'bg-blue-100 text-blue-700',
  anonymous: 'bg-slate-200 text-slate-600',
};

function ChannelBadge({ channel }: { channel: string }) {
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${CHANNEL_STYLES[channel] || CHANNEL_STYLES.anonymous}`}>
      {CHANNEL_LABELS[channel] || channel}
    </span>
  );
}

export default function ModeratorDashboard() {
  const { user, profile, session } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'reports' | 'hotspots'>('reports');
  
  // Reports State
  const [cases, setCases] = useState<(ModerationCase & { reports: Report })[]>([]);
  const [selectedCase, setSelectedCase] = useState<(ModerationCase & { reports: Report }) | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  
  // Hotspots State
  const [hotspots, setHotspots] = useState<CrimeHotspot[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<CrimeHotspot | null>(null);

  const [loading, setLoading] = useState(true);
  const [rationale, setRationale] = useState('');
  const [actioning, setActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [independentEvidenceConfirmed, setIndependentEvidenceConfirmed] = useState(false);

  useEffect(() => {
    if (profile?.role === 'moderator' || profile?.role === 'admin') {
      if (activeTab === 'reports') {
        fetchCases();
      } else {
        fetchHotspots();
      }
    }
  }, [profile, activeTab]);

  const fetchCases = async () => {
    setLoading(true);
    setSelectedCase(null);
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

  const fetchHotspots = async () => {
    setLoading(true);
    setSelectedHotspot(null);
    try {
      const { data, error } = await supabase
        .from('crime_hotspots')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setHotspots(data);
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
    setIndependentEvidenceConfirmed(false);
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

  const submitHotspotAction = async (action: 'approved' | 'rejected') => {
    if (!selectedHotspot || !user) return;
    
    setActioning(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('crime_hotspots')
        .update({
          status: action,
          moderated_by: user.id,
          moderated_at: new Date().toISOString()
        })
        .eq('id', selectedHotspot.id);
        
      if (error) throw error;
      
      setSelectedHotspot(null);
      fetchHotspots();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update hotspot.');
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
        <div className="flex border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'reports' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            Reports
          </button>
          <button 
            onClick={() => setActiveTab('hotspots')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'hotspots' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            Hotspots
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-500">Loading queue...</div>
          ) : activeTab === 'reports' ? (
            cases.length === 0 ? (
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
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase ${selectedCase?.id === c.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                            Case #{c.id.slice(0, 6)}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.reports.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-slate-800 line-clamp-1">
                          {c.reports.incident_category}
                        </p>
                        <ChannelBadge channel={c.reports.submission_channel} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            hotspots.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">No pending hotspots.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {hotspots.map((h) => (
                  <li key={h.id}>
                    <button
                      onClick={() => setSelectedHotspot(h)}
                      className={`w-full text-left p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 ${selectedHotspot?.id === h.id ? 'bg-indigo-50/50 border-l-4 border-indigo-600' : 'cursor-pointer border-l-4 border-transparent'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase ${selectedHotspot?.id === h.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                            Hotspot #{h.id.slice(0, 6)}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(h.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 mb-1 line-clamp-1 capitalize">
                        {h.category.replace('_', ' ')}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </aside>

      {/* Workspace */}
      <section className="flex-1 flex flex-col bg-slate-50 p-6 h-[calc(100vh-140px)] overflow-hidden">
        {activeTab === 'reports' ? (
          selectedCase ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-lg font-bold text-slate-800">Case Detail: #{selectedCase.id.slice(0, 8)}</h1>
                    <ChannelBadge channel={selectedCase.reports.submission_channel} />
                  </div>
                  <p className="text-xs text-slate-500">
                    Ref: {selectedCase.report_id.slice(0, 8)} • Submitted {new Date(selectedCase.reports.created_at).toLocaleString()}
                  </p>
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
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Evidence Files ({evidence.length})</span>
                    </h3>
                    {evidence.length > 0 && (
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
                <div className="w-72 border-l border-slate-100 bg-slate-50/50 p-6 flex flex-col">
                  <h3 className="text-xs font-bold text-slate-800 mb-4">Moderation Action</h3>
                  {error && <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs">{error}</div>}
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Required Rationale</label>
                  <textarea
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="w-full flex-1 p-2 bg-white border border-slate-200 rounded text-xs mb-4 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    placeholder="Provide justification for this change..."
                  />

                  {selectedCase.reports.submission_channel !== 'account' && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-800 leading-relaxed">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <p>
                          This report came in through the <strong>{CHANNEL_LABELS[selectedCase.reports.submission_channel]}</strong> channel.
                          It cannot be upheld on its own — an anonymous or email-only submission is not independently
                          verifiable. Only tick this if you've added independent corroborating evidence (a police case
                          number, a matching account-channel report, or another verifiable source) and described it in
                          the rationale above.
                        </p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer font-bold">
                        <input
                          type="checkbox"
                          checked={independentEvidenceConfirmed}
                          onChange={(e) => setIndependentEvidenceConfirmed(e.target.checked)}
                          className="h-3.5 w-3.5"
                        />
                        I have added independent corroborating evidence
                      </label>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => submitAction('approve')}
                      disabled={
                        actioning ||
                        !rationale.trim() ||
                        (selectedCase.reports.submission_channel !== 'account' && !independentEvidenceConfirmed)
                      }
                      className="w-full py-3 bg-indigo-600 text-white rounded font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Resolve (Upheld)
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
          )
        ) : (
          selectedHotspot ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                <div>
                  <h1 className="text-lg font-bold text-slate-800">Hotspot: #{selectedHotspot.id.slice(0, 8)}</h1>
                  <p className="text-xs text-slate-500">
                    Submitted {new Date(selectedHotspot.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-700 shadow-sm capitalize">
                  {selectedHotspot.category.replace('_', ' ')}
                </span>
              </div>
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 p-6 overflow-y-auto space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</h3>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-700 leading-relaxed italic whitespace-pre-wrap">
                      {selectedHotspot.description || 'No description provided.'}
                    </div>
                  </div>
                  <div>
                     <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Location</h3>
                     <div className="flex items-center gap-2 text-sm text-slate-700 font-mono bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        {selectedHotspot.latitude.toFixed(6)}, {selectedHotspot.longitude.toFixed(6)}
                     </div>
                  </div>
                </div>
                <div className="w-72 border-l border-slate-100 bg-slate-50/50 p-6 flex flex-col">
                  <h3 className="text-xs font-bold text-slate-800 mb-4">Moderation Action</h3>
                  {error && <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs">{error}</div>}
                  <div className="flex flex-col gap-2 mt-auto">
                    <button
                      onClick={() => submitHotspotAction('approved')}
                      disabled={actioning}
                      className="w-full py-3 bg-green-600 text-white rounded font-bold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Approve Pin
                    </button>
                    <button
                      onClick={() => submitHotspotAction('rejected')}
                      disabled={actioning}
                      className="w-full py-3 bg-red-600 text-white rounded font-bold text-sm hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" /> Reject Pin
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm">
              <MapPin className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-sm font-bold text-slate-500">Select a pending hotspot to review.</p>
            </div>
          )
        )}
      </section>
    </div>
  );
}
