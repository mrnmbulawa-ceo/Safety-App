import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { UploadCloud, File as FileIcon, X, ShieldAlert, ArrowRight } from 'lucide-react';
import { TERMS_VERSION } from '../lib/constants';

export default function SubmitReport() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(0); // 0: Triage, 1: Details, 2: Evidence, 3: Channel, 4: Terms, 5: OTP, 6: Submitting
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [termsAccepted, setTermsAccepted] = useState(false);

  const [formData, setFormData] = useState({
    context: '',
    incident_category: '',
    incident_occurred_at: '',
    general_location: '',
    narrative: '',
    reported_to_police: false,
    reported_to_platform: false,
    reported_to_employer: false,
    reported_to_other: false,
    reporter_identity_protected: false,
  });

  const [files, setFiles] = useState<File[]>([]);
  
  const [channel, setChannel] = useState<'account' | 'verified_email' | 'anonymous'>('anonymous');
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (error) throw error;
      await submitFinalReport(true);
    } catch (err: any) {
      setError(err.message || 'Failed to verify code.');
      setLoading(false);
    }
  };

  const submitFinalReport = async (justVerifiedEmail: boolean = false) => {
    if (!termsAccepted) {
      setError("You must accept the Terms and Privacy Policy to submit.");
      setStep(4);
      return;
    }
    setStep(6);
    setLoading(true);
    setError(null);
    
    try {
      let finalReportId = '';
      let finalRecoveryToken = '';
      
      const isAccountPath = channel === 'account' && user && !justVerifiedEmail;

      if (isAccountPath) {
        // Account Path
        const { data: report, error: reportError } = await supabase
          .from('reports')
          .insert({
            ...formData,
            incident_occurred_at: formData.incident_occurred_at || null,
            reporter_id: user.id,
            submission_channel: 'account',
            terms_version: TERMS_VERSION,
            report_status: 'pending',
            evidence_status: files.length > 0 ? 'pending_upload' : null
          })
          .select()
          .single();

        if (reportError) throw reportError;
        
        await supabase.from('moderation_cases').insert({
          report_id: report.id,
          status: 'open'
        });
        
        finalReportId = report.id;
      } else {
        // Anonymous or Verified Email Path
        const response = await fetch('/api/submit-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(justVerifiedEmail && session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
          },
          body: JSON.stringify({
            reportData: {
              ...formData,
              incident_occurred_at: formData.incident_occurred_at || null,
            },
            submission_channel: channel,
            contact_email: justVerifiedEmail ? email : null,
            termsVersion: TERMS_VERSION
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to submit report');
        
        finalReportId = data.reportId;
        finalRecoveryToken = data.recoveryToken;
        
        if (justVerifiedEmail) {
          // Keep their browser session clean if they just verified to submit
          await supabase.auth.signOut();
        }
      }

      // Upload Evidence
      if (files.length > 0) {
        for (const file of files) {
          const authHeaders: any = { 'Content-Type': 'application/json' };
          const body: any = { reportId: finalReportId, filename: file.name, mimeType: file.type };
          
          if (isAccountPath && session) {
            authHeaders['Authorization'] = `Bearer ${session.access_token}`;
          } else {
            body.recoveryToken = finalRecoveryToken;
          }

          const uploadRes = await fetch('/api/evidence/upload-url', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(body)
          });
          
          if (!uploadRes.ok) throw new Error('Failed to get signed URL for file ' + file.name);
          const { signedUrl } = await uploadRes.json();
          
          const putRes = await fetch(signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file
          });
          
          if (!putRes.ok) throw new Error('Failed to upload file ' + file.name);
        }
      }

      navigate(`/confirmation/${finalReportId}`, { state: { recoveryToken: finalRecoveryToken } });

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to complete submission.');
      setStep(4); // Go back to terms step on error
    } finally {
      setLoading(false);
    }
  };

  // Render Steps
  if (step === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-8 text-center mt-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-6 tracking-tight">Are you safe right now?</h1>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/emergency"
            className="flex-1 bg-red-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:bg-red-700 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <ShieldAlert className="w-6 h-6" />
            I need immediate help
          </Link>
          <button
            onClick={() => setStep(1)}
            className="flex-1 bg-white border-2 border-slate-200 text-slate-800 py-4 px-6 rounded-xl font-bold text-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
          >
            I'm safe, continue
            <ArrowRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8">
      {step < 6 && step > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-4">
          <span className={step === 1 ? "text-indigo-600" : ""}>1. Details</span>
          <span className="text-slate-300">/</span>
          <span className={step === 2 ? "text-indigo-600" : ""}>2. Evidence</span>
          <span className="text-slate-300">/</span>
          <span className={step === 3 ? "text-indigo-600" : ""}>3. Options</span>
          <span className="text-slate-300">/</span>
          <span className={step >= 4 ? "text-indigo-600" : ""}>4. Review</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Details */}
      <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className={`space-y-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm ${step === 1 ? 'block' : 'hidden'}`}>
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Incident Details</h2>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
            <select name="incident_category" value={formData.incident_category} onChange={handleChange} required className="w-full p-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white">
              <option value="">Select a category</option>
              <option value="harassment">Harassment</option>
              <option value="assault">Assault</option>
              <option value="stalking">Stalking</option>
              <option value="theft">Theft</option>
              <option value="scam">Scam / Fraud</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date & Time</label>
              <input type="datetime-local" name="incident_occurred_at" value={formData.incident_occurred_at} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">General Location</label>
              <input type="text" name="general_location" value={formData.general_location} onChange={handleChange} placeholder="e.g., Downtown Transit Station" className="w-full p-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Context (Optional)</label>
            <input type="text" name="context" value={formData.context} onChange={handleChange} placeholder="e.g., During my morning commute" className="w-full p-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Narrative</label>
            <textarea name="narrative" value={formData.narrative} onChange={handleChange} required rows={5} placeholder="Please describe what happened..." className="w-full p-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 resize-none"></textarea>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Additional Actions Taken</h2>
          <div className="space-y-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input type="checkbox" name="reported_to_police" checked={formData.reported_to_police} onChange={handleChange} className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600" />
              <span className="text-sm font-medium text-slate-700">Police / Law Enforcement</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input type="checkbox" name="reported_to_platform" checked={formData.reported_to_platform} onChange={handleChange} className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600" />
              <span className="text-sm font-medium text-slate-700">Platform (e.g., Uber, Tinder, Airbnb)</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input type="checkbox" name="reported_to_employer" checked={formData.reported_to_employer} onChange={handleChange} className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600" />
              <span className="text-sm font-medium text-slate-700">Employer / Workplace</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input type="checkbox" name="reported_to_other" checked={formData.reported_to_other} onChange={handleChange} className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600" />
              <span className="text-sm font-medium text-slate-700">Other Organization</span>
            </label>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Privacy Preferences</h2>
          <label className="flex items-start space-x-3 cursor-pointer">
            <input type="checkbox" name="reporter_identity_protected" checked={formData.reporter_identity_protected} onChange={handleChange} className="mt-1 h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600" />
            <span className="text-sm text-slate-500">
              <strong className="block text-slate-800 font-bold mb-1">Protect my identity</strong>
              I request that my identity be kept confidential and not shared with external parties.
            </span>
          </label>
        </div>

        <div className="pt-6 border-t border-slate-100 flex justify-end">
          <button type="submit" className="bg-slate-800 text-white py-3 px-6 rounded text-sm font-bold hover:bg-black transition-colors">
            Continue to Evidence
          </button>
        </div>
      </form>

      {/* Step 2: Evidence */}
      <div className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm ${step === 2 ? 'block' : 'hidden'}`}>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Upload Evidence (Optional)</h2>
        <p className="text-xs text-slate-500 mb-6">Attach screenshots, photos, or documents related to the incident.</p>

        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:bg-slate-50 transition-colors">
          <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-600 mb-4">Drag and drop files here, or click to select files</p>
          <label className="cursor-pointer bg-white border border-slate-200 text-slate-700 px-6 py-2 rounded text-sm font-bold hover:bg-slate-50 shadow-sm">
            Browse Files
            <input type="file" multiple className="hidden" onChange={handleFileChange} />
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
                <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-between items-center pt-6 border-t border-slate-100">
          <button onClick={() => setStep(1)} className="text-xs font-bold text-slate-500 hover:text-slate-800 uppercase">Back</button>
          <button onClick={() => setStep(3)} className="bg-slate-800 text-white py-3 px-6 rounded text-sm font-bold hover:bg-black transition-colors">
            Continue to Submission Options
          </button>
        </div>
      </div>

      {/* Step 3: Submission Path */}
      <div className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm ${step === 3 ? 'block' : 'hidden'}`}>
        <h2 className="text-lg font-bold text-slate-800 mb-2">How should we keep you in the loop?</h2>
        <p className="text-xs text-slate-500 mb-6">Choose a method to check on this report later.</p>

        <div className="space-y-4 mb-8">
          {user && (
            <label className={`block border p-4 rounded-lg cursor-pointer transition-colors ${channel === 'account' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="flex items-center gap-3">
                <input type="radio" name="channel" checked={channel === 'account'} onChange={() => setChannel('account')} className="h-4 w-4 text-indigo-600 focus:ring-indigo-600 border-slate-300" />
                <div>
                  <p className="text-sm font-bold text-slate-800">I'm logged in</p>
                  <p className="text-xs text-slate-500">Submit securely attached to your account ({user.email}).</p>
                </div>
              </div>
            </label>
          )}

          <label className={`block border p-4 rounded-lg cursor-pointer transition-colors ${channel === 'verified_email' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
            <div className="flex items-center gap-3">
              <input type="radio" name="channel" checked={channel === 'verified_email'} onChange={() => setChannel('verified_email')} className="h-4 w-4 text-indigo-600 focus:ring-indigo-600 border-slate-300" />
              <div>
                <p className="text-sm font-bold text-slate-800">Email me a way to check on this</p>
                <p className="text-xs text-slate-500">We'll verify your email and provide a secure recovery code.</p>
              </div>
            </div>
          </label>

          <label className={`block border p-4 rounded-lg cursor-pointer transition-colors ${channel === 'anonymous' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
            <div className="flex items-center gap-3">
              <input type="radio" name="channel" checked={channel === 'anonymous'} onChange={() => setChannel('anonymous')} className="h-4 w-4 text-indigo-600 focus:ring-indigo-600 border-slate-300" />
              <div>
                <p className="text-sm font-bold text-slate-800">I don't want to give any contact info</p>
                <p className="text-xs text-slate-500 mb-2">Submit anonymously. We'll give you a recovery code to save yourself.</p>
                {channel === 'anonymous' && (
                  <div className="bg-orange-50 border border-orange-200 p-3 rounded text-xs text-orange-800">
                    <p className="font-bold mb-1">Important:</p>
                    <p>If you submit with no contact info at all, we have nothing to verify your identity against and cannot recover your report for you if you lose your code — that's intentional, since we never stored anything that could let anyone else recover it either.</p>
                  </div>
                )}
              </div>
            </div>
          </label>
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-slate-100">
          <button onClick={() => setStep(2)} className="text-xs font-bold text-slate-500 hover:text-slate-800 uppercase">Back</button>
          <button 
            onClick={() => {
              setTermsAccepted(false); // Reset consent when moving to the Terms step
              setStep(4);
            }} 
            className="bg-slate-800 text-white py-3 px-6 rounded text-sm font-bold hover:bg-black transition-colors shadow-sm"
          >
            Continue to Review
          </button>
        </div>
      </div>

      {/* Step 4: Terms Consent */}
      <div className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm ${step === 4 ? 'block' : 'hidden'}`}>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Final Review & Consent</h2>
        <p className="text-xs text-slate-500 mb-6">Please agree to our terms to finalize your submission.</p>

        <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50 mb-8">
          <input
            id="report-terms"
            type="checkbox"
            required
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-600 border-slate-300 rounded cursor-pointer flex-shrink-0"
          />
          <label htmlFor="report-terms" className="text-sm text-slate-700 leading-tight">
            I have read and agree to the{' '}
            <Link to="/terms" target="_blank" className="text-indigo-600 font-bold hover:underline">
              Terms of Use
            </Link>{' '}
            and{' '}
            <Link to="/privacy" target="_blank" className="text-indigo-600 font-bold hover:underline">
              Privacy Policy
            </Link>
            . I understand that submitting false information maliciously may be subject to review.
          </label>
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-slate-100">
          <button onClick={() => setStep(3)} className="text-xs font-bold text-slate-500 hover:text-slate-800 uppercase">Back</button>
          <button 
            disabled={!termsAccepted}
            onClick={() => {
              if (channel === 'verified_email') {
                setStep(5);
              } else {
                submitFinalReport();
              }
            }} 
            className="bg-indigo-600 text-white py-3 px-6 rounded text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {channel === 'verified_email' ? 'Continue to Email Verification' : 'Submit Report Final'}
          </button>
        </div>
      </div>

      {/* Step 5: OTP Verification */}
      <div className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm ${step === 5 ? 'block' : 'hidden'}`}>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Verify your email</h2>
        <p className="text-xs text-slate-500 mb-6">We'll send a code to confirm you own this address.</p>

        {!otpSent ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-3 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600" placeholder="you@example.com" />
            </div>
            <button onClick={handleSendOtp} disabled={loading || !email} className="w-full bg-slate-800 text-white py-3 rounded text-sm font-bold hover:bg-black disabled:opacity-50 transition-colors">
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Enter Code</label>
              <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} required className="w-full p-3 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono tracking-widest text-center" placeholder="000000" />
            </div>
            <button onClick={handleVerifyOtp} disabled={loading || !otp} className="w-full bg-indigo-600 text-white py-3 rounded text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
              {loading ? 'Verifying & Submitting...' : 'Verify & Submit Report'}
            </button>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100">
          <button onClick={() => setStep(4)} disabled={loading} className="text-xs font-bold text-slate-500 hover:text-slate-800 uppercase">Back</button>
        </div>
      </div>

      {/* Step 6: Submitting Loading State */}
      {step === 6 && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-indigo-600 mb-4"></div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Submitting Report...</h2>
          <p className="text-xs text-slate-500">Securely uploading files and finalizing your report.</p>
        </div>
      )}
    </div>
  );
}
