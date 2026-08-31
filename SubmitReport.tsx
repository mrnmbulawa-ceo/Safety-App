import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';

export default function SubmitReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!user) {
    return <Navigate to="/login" />;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Insert report
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          context: formData.context,
          incident_category: formData.incident_category,
          incident_occurred_at: formData.incident_occurred_at || null,
          general_location: formData.general_location,
          narrative: formData.narrative,
          reported_to_police: formData.reported_to_police,
          reported_to_platform: formData.reported_to_platform,
          reported_to_employer: formData.reported_to_employer,
          reported_to_other: formData.reported_to_other,
          reporter_identity_protected: formData.reporter_identity_protected,
          report_status: 'pending',
          evidence_status: 'pending_upload',
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // 2. Open moderation case
      const { error: modError } = await supabase
        .from('moderation_cases')
        .insert({
          report_id: report.id,
          status: 'open'
        });
        
      if (modError) throw modError;

      // Redirect to evidence upload
      navigate(`/report/${report.id}/evidence`);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8">
      <div className="mb-8 border-b border-slate-200 pb-4">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Submit a Report</h1>
        <p className="mt-2 text-sm text-slate-500">Provide details about the incident. You will be able to upload evidence on the next step.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Incident Details</h2>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
            <select
              name="incident_category"
              value={formData.incident_category}
              onChange={handleChange}
              required
              className="w-full p-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
            >
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
              <input
                type="datetime-local"
                name="incident_occurred_at"
                value={formData.incident_occurred_at}
                onChange={handleChange}
                className="w-full p-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">General Location</label>
              <input
                type="text"
                name="general_location"
                value={formData.general_location}
                onChange={handleChange}
                placeholder="e.g., Downtown Transit Station"
                className="w-full p-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Context (Optional)</label>
            <input
              type="text"
              name="context"
              value={formData.context}
              onChange={handleChange}
              placeholder="e.g., During my morning commute"
              className="w-full p-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Narrative</label>
            <textarea
              name="narrative"
              value={formData.narrative}
              onChange={handleChange}
              required
              rows={5}
              placeholder="Please describe what happened..."
              className="w-full p-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 resize-none"
            ></textarea>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Additional Actions Taken</h2>
          <p className="text-xs text-slate-500">Have you reported this incident to any authorities or platforms?</p>
          
          <div className="space-y-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                name="reported_to_police"
                checked={formData.reported_to_police}
                onChange={handleChange}
                className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
              />
              <span className="text-sm font-medium text-slate-700">Police / Law Enforcement</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                name="reported_to_platform"
                checked={formData.reported_to_platform}
                onChange={handleChange}
                className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
              />
              <span className="text-sm font-medium text-slate-700">Platform (e.g., Uber, Tinder, Airbnb)</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                name="reported_to_employer"
                checked={formData.reported_to_employer}
                onChange={handleChange}
                className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
              />
              <span className="text-sm font-medium text-slate-700">Employer / Workplace</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                name="reported_to_other"
                checked={formData.reported_to_other}
                onChange={handleChange}
                className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
              />
              <span className="text-sm font-medium text-slate-700">Other Organization</span>
            </label>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Privacy Preferences</h2>
          
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              name="reporter_identity_protected"
              checked={formData.reporter_identity_protected}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
            />
            <span className="text-sm text-slate-500">
              <strong className="block text-slate-800 font-bold mb-1">Protect my identity</strong>
              I request that my identity be kept confidential and not shared with external parties, even if this limits actions that can be taken.
            </span>
          </label>
        </div>

        <div className="pt-6 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-800 text-white py-3 px-6 rounded text-sm font-bold hover:bg-black focus:outline-none disabled:opacity-50 transition-colors"
          >
            {loading ? 'Submitting...' : 'Continue to Evidence Upload'}
          </button>
        </div>
      </form>
    </div>
  );
}
