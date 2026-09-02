import React, { useEffect, useState, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, LayoutGrid, Plus, Video, User } from 'lucide-react';

export default function FakeCallOverlay() {
  const [status, setStatus] = useState<'idle' | 'countdown' | 'ringing' | 'incall'>('idle');
  const [timer, setTimer] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const vibrationInterval = useRef<any>(null);
  const callInterval = useRef<any>(null);

  const [callerName, setCallerName] = useState('Mom');

  useEffect(() => {
    const handleTrigger = () => {
      const storedName = localStorage.getItem('fakeCallerName') || 'Mom';
      setCallerName(storedName);
      setStatus('countdown');
      
      setTimeout(() => {
        setStatus('ringing');
      }, 3000);
    };

    window.addEventListener('trigger-fake-call', handleTrigger);
    return () => window.removeEventListener('trigger-fake-call', handleTrigger);
  }, []);

  useEffect(() => {
    if (status === 'ringing') {
      if (!audioRef.current) {
        audioRef.current = new Audio('/ringtone.wav');
        audioRef.current.loop = true;
      }
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
      
      if (navigator.vibrate) {
        navigator.vibrate([1000, 1000]);
        vibrationInterval.current = setInterval(() => {
          navigator.vibrate([1000, 1000]);
        }, 2000);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (vibrationInterval.current) {
        clearInterval(vibrationInterval.current);
      }
      if (navigator.vibrate) {
        navigator.vibrate(0);
      }
    }

    if (status === 'incall') {
      setTimer(0);
      callInterval.current = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    } else {
      if (callInterval.current) {
        clearInterval(callInterval.current);
      }
    }
  }, [status]);

  const endCall = () => {
    setStatus('idle');
  };

  const acceptCall = () => {
    setStatus('incall');
  };

  if (status === 'idle') return null;
  if (status === 'countdown') return null; // Invisible during the 3s discreet wait

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 text-white flex flex-col font-sans">
      {status === 'ringing' && (
        <div className="flex-1 flex flex-col items-center justify-between py-16 animate-in fade-in slide-in-from-bottom-8 duration-300">
          <div className="text-center mt-12">
            <h2 className="text-5xl font-light mb-2 tracking-tight">{callerName}</h2>
            <p className="text-slate-400 text-lg">mobile</p>
          </div>
          
          <div className="flex w-full max-w-sm justify-between px-12 mb-12">
            <button 
              onClick={endCall}
              className="flex flex-col items-center gap-3 group"
            >
              <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                <PhoneOff className="w-10 h-10 text-white" />
              </div>
              <span className="text-sm font-medium text-slate-300">Decline</span>
            </button>

            <button 
              onClick={acceptCall}
              className="flex flex-col items-center gap-3 group animate-bounce"
            >
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors">
                <Phone className="w-10 h-10 text-white fill-white" />
              </div>
              <span className="text-sm font-medium text-slate-300">Accept</span>
            </button>
          </div>
        </div>
      )}

      {status === 'incall' && (
        <div className="flex-1 flex flex-col items-center justify-between py-16 animate-in fade-in duration-300">
          <div className="text-center mt-8">
            <h2 className="text-4xl font-light mb-2">{callerName}</h2>
            <p className="text-slate-400 font-mono text-lg">{formatTime(timer)}</p>
          </div>

          <div className="w-full max-w-sm px-8">
            <div className="grid grid-cols-3 gap-y-8 gap-x-6 mb-16">
              {[
                { icon: MicOff, label: 'mute' },
                { icon: LayoutGrid, label: 'keypad' },
                { icon: Volume2, label: 'speaker' },
                { icon: Plus, label: 'add call' },
                { icon: Video, label: 'FaceTime' },
                { icon: User, label: 'contacts' },
              ].map((btn, idx) => (
                <button key={idx} className="flex flex-col items-center gap-2 text-slate-300 hover:text-white transition-colors">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                    <btn.icon className="w-7 h-7" />
                  </div>
                  <span className="text-xs">{btn.label}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-center">
              <button 
                onClick={endCall}
                className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <PhoneOff className="w-10 h-10 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
