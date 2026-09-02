import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { TERMS_VERSION } from '../lib/constants';

export default function Login() {
  const [searchParams] = useSearchParams();
  const isSignUpParams = searchParams.get('mode') === 'signup';
  
  const [isSignUp, setIsSignUp] = useState(isSignUpParams);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        if (!termsAccepted) {
          setError('You must accept the Terms of Use and Privacy Policy to create an account.');
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              terms_version: TERMS_VERSION
            }
          }
        });
        if (error) throw error;
        // Check if we need email verification
        setError('Check your email for the login link or you are now signed in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800">
          {isSignUp ? 'Create an account' : 'Welcome back'}
        </h2>
        <p className="text-sm text-slate-500 mt-2">
          {isSignUp 
            ? 'Sign up securely to report an incident' 
            : 'Enter your credentials to access your account'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 text-sm"
            placeholder="you@example.com"
          />
        </div>
        
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-600 text-sm"
            placeholder="••••••••"
          />
        </div>

        {isSignUp && (
          <div className="flex items-start gap-3 mt-4 mb-2">
            <input
              id="terms"
              type="checkbox"
              required
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-600 border-slate-300 rounded cursor-pointer"
            />
            <label htmlFor="terms" className="text-xs text-slate-600 leading-tight">
              I have read and agree to the{' '}
              <Link to="/terms" target="_blank" className="text-indigo-600 font-bold hover:underline">
                Terms of Use
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" className="text-indigo-600 font-bold hover:underline">
                Privacy Policy
              </Link>
              .
            </label>
          </div>
        )}

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded border border-red-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (isSignUp && !termsAccepted)}
          className="w-full bg-slate-800 text-white py-3 px-4 rounded text-sm font-bold hover:bg-black focus:outline-none disabled:opacity-50 transition-colors mt-2"
        >
          {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setTermsAccepted(false);
          }}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
        >
          {isSignUp 
            ? 'Already have an account? Log in' 
            : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
