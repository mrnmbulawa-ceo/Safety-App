import React, { useState, useEffect } from 'react';
import { PhoneCall, Settings } from 'lucide-react';

export default function FakeCallButton({ className = '' }: { className?: string }) {
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [callerName, setCallerName] = useState('Mom');

  useEffect(() => {
    const stored = localStorage.getItem('fakeCallerName');
    if (stored) {
      setCallerName(stored);
    }
  }, []);

  const triggerCall = () => {
    window.dispatchEvent(new CustomEvent('trigger-fake-call'));
  };

  const saveSetup = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('fakeCallerName', callerName);
    setIsSettingUp(false);
  };

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={triggerCall}
          className="flex-1 bg-slate-800 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-900 transition flex items-center justify-center gap-3 shadow-sm"
        >
          <PhoneCall className="w-5 h-5" />
          Fake Call
        </button>
        <button
          onClick={() => setIsSettingUp(true)}
          className="p-3 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition border border-slate-200"
          title="Configure Fake Call"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {isSettingUp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Fake Call Setup</h3>
            <p className="text-slate-600 text-sm mb-4">
              Set the name that will appear on screen when you trigger a fake call.
            </p>
            <form onSubmit={saveSetup}>
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-1">Caller Name</label>
                <input
                  type="text"
                  required
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 bg-slate-50 text-sm"
                  placeholder="e.g. Mom, Boss, Uber"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSettingUp(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold bg-slate-800 text-white hover:bg-slate-900 rounded-lg transition text-sm shadow-sm"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
