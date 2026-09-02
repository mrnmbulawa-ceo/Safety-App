import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Shield, AlertCircle, Key, Inbox } from 'lucide-react';

export default function CheckReport() {
  const [activeTab, setActiveTab] = useState<'check' | 'recover'>('check');

  // Check Status State
  const [reportId, setReportId] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  // Recovery State
  const [recoverReportId, setRecoverReportId] = useState('');
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverCode, setRecoverCode] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'verify'>('request');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [newRecoveryToken, setNewRecoveryToken] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportId.trim() || !token.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_report_by_recovery_token', {
        p_report_id: reportId.trim(),
        p_token: token.trim()
      });

      if (rpcError) throw rpcError;

      if (!data || data.length === 0) {
        setError('Report not found or recovery code is incorrect.');
      } else {
        setResult(data[0]);
      }
    } catch (err: any) {
      console.error(err);
      setError('An error occurred while checking the report.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverReportId.trim() || !recoverEmail.trim()) return;

    setRecoveryLoading(true);
    setRecoveryError(null);
    setRecoveryMessage(null);

    try {
      const response = await fetch('/api/reports/recovery-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: recoverReportId, email: recoverEmail })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to request reset.');

      setRecoveryMessage(data.message);
      setRecoveryStep('verify');
    } catch (err: any) {
      setRecoveryError(err.message);
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleVerifyRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverReportId.trim() || !recoverCode.trim()) return;

    setRecoveryLoading(true);
    setRecoveryError(null);

    try {
      const response = await fetch('/api/reports/recovery-reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: recoverReportId, code: recoverCode })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to verify code.');

      setNewRecoveryToken(data.newRecoveryToken);
    } catch (err: any) {
      setRecoveryError(err.message);
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="mb-8 border-b border-slate-200 pb-4 text-center">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Check Report Status</h1>
        <p className="mt-2 text-sm text-slate-500">Securely view updates on your submission.</p>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-lg mb-8">
        <button
          onClick={() => setActiveTab('check')}
          className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'check' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
        >
          I have my Report ID and code
        </button>
        <button
          onClick={() => setActiveTab('recover')}
          className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'recover' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
        >
          I lost my code
        </button>
      </div>

      {activeTab === 'check' ? (
        <>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Report ID</label>
                <input
                  type="text"
                  required
                  value={reportId}
                  onChange={(e) => setReportId(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                  placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Recovery Code</label>
                <input
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono tracking-wider"
                  placeholder="SAFE-XXXX-XXXX"
                />
              </div>
              
              {error && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !reportId || !token}
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded text-sm font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
              >
                <Search className="w-4 h-4" />
                {loading ? 'Searching...' : 'Check Status'}
              </button>
            </form>
          </div>

          {result && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-800">Status Update</h2>
                </div>
                <span className="px-3 py-1 bg-slate-800 text-white text-xs font-bold rounded uppercase tracking-wider">
                  {result.report_status}
                </span>
              </div>
              <div className="p-6 grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Category</p>
                  <p className="text-sm font-medium text-slate-900 capitalize">{result.incident_category}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Submitted</p>
                  <p className="text-sm font-medium text-slate-900">{new Date(result.created_at).toLocaleDateString()}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Location</p>
                  <p className="text-sm font-medium text-slate-900">{result.general_location || 'Not specified'}</p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
          {!newRecoveryToken ? (
            <>
              <div className="bg-orange-50 border border-orange-200 text-orange-800 text-sm p-4 rounded-lg mb-6">
                <p>
                  This only works if you originally chose "Email me a way to check on this." 
                  If you submitted with no contact info at all, we have nothing to verify your identity against and cannot recover your report for you — that's intentional, since we never stored anything that could let anyone else recover it either.
                </p>
              </div>

              {recoveryStep === 'request' ? (
                <form onSubmit={handleRequestRecovery} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Report ID</label>
                    <input
                      type="text"
                      required
                      value={recoverReportId}
                      onChange={(e) => setRecoverReportId(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Used At Submission</label>
                    <input
                      type="email"
                      required
                      value={recoverEmail}
                      onChange={(e) => setRecoverEmail(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>

                  {recoveryError && (
                    <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">
                      {recoveryError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={recoveryLoading || !recoverReportId || !recoverEmail}
                    className="w-full bg-slate-800 text-white py-3 px-4 rounded text-sm font-bold shadow-sm hover:bg-black disabled:opacity-50 transition-colors"
                  >
                    {recoveryLoading ? 'Requesting...' : 'Request Verification Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyRecovery} className="space-y-4">
                  {recoveryMessage && (
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex gap-3 text-indigo-800 text-sm mb-4">
                      <Inbox className="w-5 h-5 flex-shrink-0" />
                      <p>{recoveryMessage}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">6-Digit Verification Code</label>
                    <input
                      type="text"
                      required
                      value={recoverCode}
                      onChange={(e) => setRecoverCode(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono tracking-widest text-center"
                      placeholder="000000"
                    />
                  </div>

                  {recoveryError && (
                    <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">
                      {recoveryError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={recoveryLoading || !recoverCode}
                    className="w-full bg-indigo-600 text-white py-3 px-4 rounded text-sm font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {recoveryLoading ? 'Verifying...' : 'Verify Code & Reset Token'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecoveryStep('request')}
                    className="w-full text-xs font-bold text-slate-500 hover:text-slate-800 mt-2 uppercase"
                  >
                    Back to Request
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Recovery Code Reset Successful</h2>
              <p className="text-sm text-slate-600 mb-6">Your old code has been invalidated. Please save this new code immediately.</p>
              
              <div className="bg-orange-50 border border-orange-200 rounded-md p-4 mb-4 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-orange-500" />
                  <p className="text-[10px] text-orange-600 uppercase tracking-widest font-bold">New Secret Recovery Code</p>
                </div>
                <div className="flex justify-between items-center bg-white p-3 border border-orange-100 rounded">
                  <code className="text-lg font-mono text-orange-900 font-bold">{newRecoveryToken}</code>
                  <button 
                    onClick={() => navigator.clipboard.writeText(newRecoveryToken)}
                    className="text-xs font-bold text-orange-700 hover:text-orange-900 uppercase tracking-wide bg-orange-100 px-3 py-1.5 rounded"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-orange-700 font-medium leading-relaxed mt-3">
                  Save this code somewhere safe — it's the only way to check this report's status later. We cannot recover it for you if lost.
                </p>
              </div>

              <button
                onClick={() => {
                  setToken(newRecoveryToken);
                  setReportId(recoverReportId);
                  setNewRecoveryToken(null);
                  setActiveTab('check');
                  setRecoveryStep('request');
                }}
                className="w-full bg-slate-800 text-white py-3 px-4 rounded text-sm font-bold shadow-sm hover:bg-black transition-colors"
              >
                Go to Check Status
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
