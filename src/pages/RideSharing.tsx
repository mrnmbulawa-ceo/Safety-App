import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../components/AuthProvider';
import { supabase } from '../lib/supabase';
import { Navigate } from 'react-router-dom';
import { MapPin, Navigation, CheckCircle, Search, AlertTriangle, X, BellRing } from 'lucide-react';
import { SharedRide, TrustedContact } from '../types';
import { fireAlert } from '../lib/safety';

declare const L: any;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function RideSharing() {
  const { user } = useAuth();
  const [activeRide, setActiveRide] = useState<SharedRide | null>(null);
  const [loading, setLoading] = useState(true);

  // Setup state
  const [destLat, setDestLat] = useState<number | null>(null);
  const [destLng, setDestLng] = useState<number | null>(null);
  const [duration, setDuration] = useState('30');
  const [searchQuery, setSearchQuery] = useState('');
  const [mapSetup, setMapSetup] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [currentPos, setCurrentPos] = useState<{lat: number, lng: number} | null>(null);

  // Active ride state
  const watchIdRef = useRef<number | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [alertCountdown, setAlertCountdown] = useState<number | null>(null);
  const [alertReason, setAlertReason] = useState('');
  const lastDistances = useRef<number[]>([]);
  const lastKnownPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [notifiedBanner, setNotifiedBanner] = useState<'notified' | 'no-contacts' | null>(null);

  useEffect(() => {
    if (!user) return;
    loadActiveRide();
    loadContacts();
  }, [user]);

  const loadActiveRide = async () => {
    const { data, error } = await supabase
      .from('shared_rides')
      .select('*')
      .eq('user_id', user!.id)
      .in('status', ['active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setActiveRide(data);
      lastKnownPosRef.current = { lat: data.last_lat, lng: data.last_lng };
    }
    setLoading(false);
  };

  const loadContacts = async () => {
    const { data } = await supabase
      .from('trusted_contacts')
      .select('*')
      .eq('user_id', user!.id);
    setContacts(data || []);
  };

  useEffect(() => {
    if (activeRide || loading) return;
    if (!mapSetup && mapContainerRef.current) {
      const map = L.map(mapContainerRef.current).setView([-26.2041, 28.0473], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      map.on('click', (e: any) => {
        setDestLat(e.latlng.lat);
        setDestLng(e.latlng.lng);
      });

      mapInstanceRef.current = map;
      setMapSetup(true);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 14);
          setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        });
      }
    }

    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      if (destLat && destLng) {
        if (!markerRef.current) {
          const iconHtml = `<div style="background-color: #f59e0b; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`;
          const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [20, 20], iconAnchor: [10, 10] });
          markerRef.current = L.marker([destLat, destLng], { icon }).addTo(map);
        } else {
          markerRef.current.setLatLng([destLat, destLng]);
        }
      }
    }
  }, [activeRide, loading, destLat, destLng, mapSetup]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`, {
        headers: { 'User-Agent': 'UBESafety/1.0' }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setDestLat(lat);
        setDestLng(lon);
        mapInstanceRef.current?.setView([lat, lon], 15);
      }
    } catch (e) {
      console.error('Geocoding error', e);
    }
  };

  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = 'SAFE-';
    for (let i = 0; i < 4; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    token += '-';
    for (let i = 0; i < 4; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    return token;
  };

  const handleStart = async () => {
    if (!user || !currentPos || !destLat || !destLng) return;

    const token = generateToken();
    const { data: hashed, error: hashError } = await supabase.rpc('hash_recovery_token', { p_token: token });

    if (hashError || !hashed) {
      alert('Error generating share code.');
      return;
    }

    const payload = {
      user_id: user.id,
      origin_lat: currentPos.lat,
      origin_lng: currentPos.lng,
      destination_lat: destLat,
      destination_lng: destLng,
      expected_duration_minutes: parseInt(duration, 10) || 30,
      share_token_hash: hashed,
      status: 'active',
      started_at: new Date().toISOString(),
      last_lat: currentPos.lat,
      last_lng: currentPos.lng,
      last_ping_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('shared_rides').insert(payload).select().single();
    if (error) {
      alert(error.message);
      return;
    }

    setShareCode(token);
    setActiveRide(data as SharedRide);
    lastKnownPosRef.current = { lat: currentPos.lat, lng: currentPos.lng };
    lastDistances.current = [];
  };

  // Ride monitoring
  useEffect(() => {
    if (activeRide && activeRide.status === 'active') {
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(async (pos) => {
          const newLat = pos.coords.latitude;
          const newLng = pos.coords.longitude;
          lastKnownPosRef.current = { lat: newLat, lng: newLng };

          await supabase.from('shared_rides').update({
            last_lat: newLat,
            last_lng: newLng,
            last_ping_at: new Date().toISOString()
          }).eq('id', activeRide.id);

          const dist = haversine(newLat, newLng, activeRide.destination_lat, activeRide.destination_lng);
          lastDistances.current.push(dist);
          if (lastDistances.current.length > 5) lastDistances.current.shift();

          // Check deviation
          let deviated = false;
          if (lastDistances.current.length >= 4) {
            let increasing = true;
            for (let i = 1; i < lastDistances.current.length; i++) {
              if (lastDistances.current[i] <= lastDistances.current[i-1] + 5) { // 5m noise margin
                increasing = false;
                break;
              }
            }
            if (increasing && lastDistances.current[0] > 100) {
               deviated = true;
            }
          }

          // Check overdue
          const elapsedMin = (Date.now() - new Date(activeRide.started_at).getTime()) / 60000;
          const overdue = elapsedMin > activeRide.expected_duration_minutes * 1.5;

          if ((deviated || overdue) && alertCountdown === null) {
            setAlertReason(deviated ? 'You seem to be moving away from your destination.' : 'Your ride is overdue.');
            setAlertCountdown(10);
          }

        }, (err) => {
          console.error(err);
        }, { enableHighAccuracy: true });
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [activeRide, alertCountdown]);

  // Countdown timer
  useEffect(() => {
    if (alertCountdown !== null && alertCountdown > 0) {
      const timer = setTimeout(() => setAlertCountdown(alertCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (alertCountdown === 0) {
      triggerAlert();
      setAlertCountdown(null);
    }
  }, [alertCountdown]);

  const triggerAlert = async () => {
    if (!activeRide) return;
    const newStatus = alertReason.includes('moving away') ? 'deviated' : 'overdue';

    await supabase.from('shared_rides').update({ status: newStatus }).eq('id', activeRide.id);
    setActiveRide({ ...activeRide, status: newStatus as any });

    const pos = lastKnownPosRef.current || { lat: activeRide.last_lat ?? activeRide.origin_lat, lng: activeRide.last_lng ?? activeRide.origin_lng };

    if (contacts.length > 0) {
      await fireAlert(contacts, pos.lat, pos.lng);
      setNotifiedBanner('notified');
    } else {
      // No trusted contacts saved — nobody can be notified. Say so honestly
      // rather than implying an alert went out.
      setNotifiedBanner('no-contacts');
    }
    setTimeout(() => setNotifiedBanner(null), 10000);
  };

  const cancelAlert = () => {
    setAlertCountdown(null);
    lastDistances.current = []; // reset deviation tracking to prevent immediate re-trigger
  };

  const markArrived = async () => {
    if (!activeRide) return;
    await supabase.from('shared_rides').update({ status: 'arrived' }).eq('id', activeRide.id);
    setActiveRide(null);
    setDestLat(null);
    setDestLng(null);
    setShareCode(null);
    setMapSetup(false); // will re-setup map for new ride
  };

  if (!user) return <Navigate to="/login" />;

  const waLink = activeRide && shareCode ? `https://wa.me/?text=${encodeURIComponent("I'm sharing my ride with you. Track my progress here: " + window.location.origin + "/ride/" + activeRide.id + "?code=" + shareCode)}` : '';

  return (
    <div className="max-w-4xl mx-auto w-full p-4 h-[calc(100vh-64px)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Share Your Ride</h1>
        <p className="text-sm text-slate-600">Track your journey and automatically alert contacts if you deviate or take too long. <span className="font-bold text-indigo-600">App must remain open in the foreground to track position.</span></p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">Loading...</div>
      ) : activeRide ? (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-center text-center">
          {notifiedBanner === 'notified' && (
            <div className="w-full max-w-md mb-6 flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-sm text-left">
              <BellRing className="w-5 h-5 shrink-0" />
              <p>Your trusted contacts have been sent your last known location.</p>
            </div>
          )}
          {notifiedBanner === 'no-contacts' && (
            <div className="w-full max-w-md mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm text-left">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>No trusted contacts are saved, so no one could be notified. Add a contact before your next ride.</p>
            </div>
          )}
          <Navigation className="w-16 h-16 text-indigo-600 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Ride Active</h2>
          <p className="text-slate-600 max-w-md mb-8">
             Your position is being monitored. Keep this page open in the foreground.
          </p>

          {shareCode && (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8 w-full max-w-md">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Share Code</p>
              <p className="text-3xl font-mono font-bold text-slate-800 tracking-wider mb-4">{shareCode}</p>
              <a 
                href={waLink} 
                target="_blank" 
                rel="noreferrer"
                className="block w-full bg-green-500 text-white font-bold py-3 rounded-lg hover:bg-green-600 transition"
              >
                Share via WhatsApp
              </a>
            </div>
          )}

          <button
            onClick={markArrived}
            className="w-full max-w-md bg-indigo-600 text-white font-bold py-4 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-lg shadow-sm"
          >
            <CheckCircle className="w-6 h-6" /> I've Arrived Safely
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 relative">
          <div className="w-full md:w-80 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col overflow-y-auto">
            <h2 className="font-bold text-slate-800 mb-4">Setup Route</h2>
            
            <form onSubmit={handleSearch} className="mb-4">
              <label className="block text-sm font-bold text-slate-700 mb-1">Search Destination</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. 123 Main St"
                  className="flex-1 p-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button type="submit" className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-200">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </form>

            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-1">Expected Duration (mins)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                min="1"
              />
            </div>

            <div className="mt-auto">
              <button
                onClick={handleStart}
                disabled={!destLat || !destLng || !currentPos}
                className="w-full bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
              >
                <MapPin className="w-5 h-5" /> Start Ride
              </button>
            </div>
          </div>

          <div 
            ref={mapContainerRef} 
            className="flex-1 rounded-xl border border-slate-200 shadow-sm z-0 relative cursor-crosshair"
          >
            {!destLat && (
               <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg pointer-events-none whitespace-nowrap">
                 Tap on the map to set destination
               </div>
            )}
          </div>
        </div>
      )}

      {/* Alert Countdown Modal */}
      {alertCountdown !== null && (
        <div className="fixed inset-0 z-[9999] bg-red-900/90 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
          <AlertTriangle className="w-24 h-24 text-red-500 mb-6 animate-bounce" />
          <h2 className="text-4xl font-bold text-white mb-2 text-center">Safety Alert</h2>
          <p className="text-red-200 text-lg mb-8 text-center max-w-md">{alertReason}</p>
          
          <div className="text-8xl font-black text-white mb-12 tabular-nums tracking-tighter">
            {alertCountdown}
          </div>
          
          <button 
            onClick={cancelAlert}
            className="bg-white text-red-900 font-bold text-xl px-12 py-4 rounded-full shadow-2xl hover:bg-red-50 transition-colors flex items-center gap-2"
          >
            <X className="w-6 h-6" /> I'm Safe (Cancel)
          </button>
        </div>
      )}
    </div>
  );
}
