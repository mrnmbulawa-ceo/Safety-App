import { Link, useParams, useLocation } from 'react-router-dom';
import { CheckCircle, Key } from 'lucide-react';

export default function Confirmation() {
  const { id } = useParams();
  const location = useLocation();
  const recoveryToken = location.state?.recoveryToken;

  return (
    <div className="max-w-2xl mx-auto text-center py-16 px-4">
      <div className="flex justify-center mb-6">
        <div className="h-16 w-16 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-indigo-600" />
        </div>
      </div>
      
      <h1 className="text-3xl font-bold text-slate-800 mb-4 tracking-tight">Report Submitted</h1>
      
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-8 text-left max-w-lg mx-auto">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Reference Number</p>
        <p className="text-xl font-mono text-slate-900 break-all mb-4">{id}</p>

        {recoveryToken && (
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-orange-500" />
              <p className="text-[10px] text-orange-600 uppercase tracking-widest font-bold">Secret Recovery Code</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mb-2 flex items-center justify-between">
              <code className="text-lg font-mono text-orange-900 font-bold">{recoveryToken}</code>
              <button 
                onClick={() => navigator.clipboard.writeText(recoveryToken)}
                className="text-xs font-bold text-orange-700 hover:text-orange-900 uppercase tracking-wide bg-orange-100 px-2 py-1 rounded"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-orange-700 font-medium leading-relaxed">
              Save this code somewhere safe — it's the only way to check this report's status later. We cannot recover it for you if lost.
            </p>
          </div>
        )}
      </div>
      
      <div className="space-y-4 text-slate-600 max-w-lg mx-auto mb-10 text-sm leading-relaxed">
        <p>
          Thank you for submitting your report. It has been securely logged in our system.
        </p>
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded text-xs text-left leading-relaxed">
          <strong>Please note:</strong> This reference is not a public record and is not proof of any incident. It is an unverified account until reviewed by our moderation team.
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-4">
        <Link
          to="/check"
          className="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-700 px-8 py-3 text-sm font-bold rounded hover:bg-slate-50 transition-colors"
        >
          Check Status Tool
        </Link>
        <Link
          to="/"
          className="inline-flex items-center justify-center bg-slate-800 text-white px-8 py-3 text-sm font-bold rounded hover:bg-black transition-colors"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}
