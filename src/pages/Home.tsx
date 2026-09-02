import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { ShieldAlert, FileText, Lock } from 'lucide-react';
import FakeCallButton from '../components/FakeCallButton';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight text-slate-800 sm:text-5xl mb-4">
          Report safety incidents securely.
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          A secure platform to document personal-safety incidents. Your reports remain private unless explicitly shared or reviewed by our moderation team.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <FileText className="w-8 h-8 text-indigo-600 mb-4" />
          <h3 className="font-bold text-slate-800 mb-2">Document Incidents</h3>
          <p className="text-xs text-slate-500 leading-relaxed">Securely record details, context, and locations of safety incidents.</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <ShieldAlert className="w-8 h-8 text-indigo-600 mb-4" />
          <h3 className="font-bold text-slate-800 mb-2">Upload Evidence</h3>
          <p className="text-xs text-slate-500 leading-relaxed">Attach files and evidence safely. Files are kept in private, encrypted storage.</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <Lock className="w-8 h-8 text-indigo-600 mb-4" />
          <h3 className="font-bold text-slate-800 mb-2">Strict Privacy</h3>
          <p className="text-xs text-slate-500 leading-relaxed">Role-based access ensures only you and authorized moderators can view your reports.</p>
        </div>
      </div>

      <div className="text-center space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/report"
            className="w-full sm:w-auto inline-flex items-center justify-center bg-indigo-600 text-white px-8 py-3 text-sm font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"
          >
            Submit a New Report
          </Link>
          <Link
            to="/check"
            className="w-full sm:w-auto inline-flex items-center justify-center bg-white text-slate-700 border border-slate-200 px-8 py-3 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors"
          >
            Check Report Status
          </Link>
        </div>

        <div className="max-w-xs mx-auto pt-6 border-t border-slate-200">
          <FakeCallButton className="w-full" />
        </div>
      </div>
    </div>
  );
}
