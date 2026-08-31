import { Outlet, Link } from 'react-router-dom';
import Footer from './Footer';
import { useAuth } from './AuthProvider';
import { Shield, LogOut } from 'lucide-react';

export default function Layout() {
  const { user, profile, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-8 py-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 transition-colors">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-800 tracking-tight">SafeReport<span className="text-indigo-600">ZA</span></span>
          </Link>
          <nav className="flex items-center gap-6">
            {user ? (
              <>
                <Link to="/report" className="text-sm font-medium text-slate-500 hover:text-slate-800">
                  Submit a Report
                </Link>
                {(profile?.role === 'moderator' || profile?.role === 'admin') && (
                  <Link to="/moderator" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    Moderator Dashboard
                  </Link>
                )}
                <button 
                  onClick={signOut}
                  className="flex items-center space-x-1 text-sm font-medium text-slate-500 hover:text-slate-900 pl-6 border-l border-slate-200"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </>
            ) : (
              <Link to="/login" className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded text-xs font-bold shadow-sm hover:bg-indigo-700 transition-colors">
                Log In
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full px-0 py-0">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
