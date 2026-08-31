import { Link, useParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export default function Confirmation() {
  const { id } = useParams();

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
        <p className="text-xl font-mono text-slate-900 break-all">{id}</p>
      </div>
      
      <div className="space-y-4 text-slate-600 max-w-lg mx-auto mb-10 text-sm leading-relaxed">
        <p>
          Thank you for submitting your report. It has been securely logged in our system.
        </p>
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded text-xs text-left leading-relaxed">
          <strong>Please note:</strong> This reference is not a public record and is not proof of any incident. It is an unverified account until reviewed by our moderation team.
        </div>
      </div>
      
      <Link
        to="/"
        className="inline-flex items-center justify-center bg-slate-800 text-white px-8 py-3 text-sm font-bold rounded hover:bg-black transition-colors"
      >
        Return to Home
      </Link>
    </div>
  );
}
