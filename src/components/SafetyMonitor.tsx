import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { SafeZone, TrustedContact } from '../types';
import { calculateDistanceMeters, fireAlert } from '../lib/safety';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, X, PhoneForwarded } from 'lucide-react';

export default function SafetyMonitor() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeZones, setActiveZones] = useState<SafeZone[]>([]);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  
  const [alertActive, setAlertActive] = useState(false);
  const [cancelCountdown, setCancelCountdown] = useState(5);
  const [alertFired, setAlertFired] = useState(false);
  const [checkInActive, setCheckInActive] = useState(false);
  const checkInCooldownRef = useRef(false);

  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  // References to keep event listeners up to date
  const alertActiveRef = useRef(alertActive);
  useEffect(() => { alertActiveRef.current = alertActive; }, [alertActive]);

  useEffect(() => {
    if (!user) return;

    // Load zones and contacts
    const loadConfig = async () => {
      const [{ data: zones }, { data: conts }] = await Promise.all([
        supabase.from('safe_zones').select('*').eq('active', true),
        supabase.from('trusted_contacts').select('*')
      ]);
      if (zones) setActiveZones(zones);
      if (conts) setContacts(conts);
    };
    
    loadConfig();
  }, [user]);

  // Foreground Location Monitoring
  useEffect(() => {
    if (!user || activeZones.length === 0) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentLocation({lat, lng});

        if (!alertActiveRef.current && !checkInActive && !checkInCooldownRef.current) {
          let isSafe = false;
          for (const zone of activeZones) {
            const dist = calculateDistanceMeters(lat, lng, zone.latitude, zone.longitude);
            if (dist <= zone.radius_meters) {
              isSafe = true;
              break;
            }
          }

          if (!isSafe) {
            setCheckInActive(true);
          }
        } else if (checkInCooldownRef.current) {
          // If we are currently in a cooldown, let's reset it once they enter a safe zone again.
          // This way it won't prompt again until they arrive at a safe zone and then leave it.
          let isSafe = false;
          for (const zone of activeZones) {
            const dist = calculateDistanceMeters(lat, lng, zone.latitude, zone.longitude);
            if (dist <= zone.radius_meters) {
              isSafe = true;
              break;
            }
          }
          if (isSafe) {
            checkInCooldownRef.current = false;
          }
        }
      },
      (err) => console.error("SafetyMonitor location error:", err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, activeZones, checkInActive]);

  // Shake Detection
  useEffect(() => {
    if (!user) return;

    let lastX = 0, lastY = 0, lastZ = 0;
    let lastUpdate = 0;
    const SHAKE_THRESHOLD = 15;

    const handleMotion = (event: DeviceMotionEvent) => {
      if (alertActiveRef.current) return;

      const current = event.accelerationIncludingGravity;
      if (!current || current.x === null || current.y === null || current.z === null) return;

      const now = Date.now();
      if ((now - lastUpdate) > 100) {
        const diffTime = (now - lastUpdate);
        lastUpdate = now;

        const speed = Math.abs(current.x + current.y + current.z - lastX - lastY - lastZ) / diffTime * 10000;

        if (speed > SHAKE_THRESHOLD) {
          triggerAlert();
        }

        lastX = current.x;
        lastY = current.y;
        lastZ = current.z;
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [user]);

  const triggerAlert = () => {
    setCheckInActive(false);
    setAlertActive(true);
    setAlertFired(false);
    setCancelCountdown(5);
  };

  useEffect(() => {
    let timer: any;
    if (alertActive && !alertFired) {
      if (cancelCountdown > 0) {
        timer = setTimeout(() => setCancelCountdown(c => c - 1), 1000);
      } else {
        // FIRE
        setAlertFired(true);
        executeAlert();
      }
    }
    return () => clearTimeout(timer);
  }, [alertActive, alertFired, cancelCountdown]);

  const executeAlert = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fireAlert(contacts, pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        // Fallback to last known or just send without location
        if (currentLocation) {
          fireAlert(contacts, currentLocation.lat, currentLocation.lng);
        } else {
          fireAlert(contacts, 0, 0); // Not ideal, but what else?
        }
      }
    );
  };

  if (!user) return null;

  return (
    <>
      {/* Persistent SOS Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={() => {
            const t = setTimeout(() => triggerAlert(), 1500);
            (window as any)._sosTimer = t;
          }}
          onPointerUp={() => {
            clearTimeout((window as any)._sosTimer);
          }}
          onPointerLeave={() => {
            clearTimeout((window as any)._sosTimer);
          }}
          className="bg-red-600 text-white p-4 rounded-full shadow-lg hover:bg-red-700 active:scale-95 transition-all select-none"
          title="Press and hold for 1.5s to trigger SOS"
        >
          <AlertOctagon className="w-8 h-8" />
        </button>
      </div>

      {/* Check In Modal */}
      {checkInActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-8 text-center shadow-2xl animate-in fade-in zoom-in duration-300">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">Are you safe?</h2>
            <p className="text-slate-600 mb-8">You appear to have left your safe zones.</p>
            <div className="space-y-4">
              <button 
                onClick={() => {
                  setCheckInActive(false);
                  checkInCooldownRef.current = true;
                }}
                className="w-full bg-slate-100 text-slate-800 py-4 rounded-xl font-bold text-lg hover:bg-slate-200 transition"
              >
                I'm Safe
              </button>
              <button 
                onClick={() => {
                  setCheckInActive(false);
                  navigate('/emergency');
                  triggerAlert();
                }}
                className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition shadow-md"
              >
                Help!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Countdown / Fired Modal */}
      {alertActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-900/90 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-8 text-center shadow-2xl animate-in fade-in zoom-in duration-200">
            {!alertFired ? (
              <>
                <h2 className="text-3xl font-bold text-red-600 mb-2">SOS TRIGGERED</h2>
                <p className="text-slate-600 mb-8 font-medium">Alerting your trusted contacts in...</p>
                <div className="text-7xl font-bold text-slate-800 mb-8">
                  {cancelCountdown}
                </div>
                <button 
                  onClick={() => setAlertActive(false)}
                  className="w-full bg-slate-200 text-slate-800 py-4 rounded-xl font-bold text-lg hover:bg-slate-300 transition flex justify-center items-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Cancel Alert
                </button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertOctagon className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Alert Sent</h2>
                <p className="text-sm text-slate-600 mb-8">
                  Email contacts have been notified. Tap below to send WhatsApp alerts.
                </p>
                
                <div className="space-y-3 mb-8">
                  {contacts.filter(c => c.phone).map(c => {
                    const mapLink = currentLocation ? `https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}` : '';
                    const message = `This is an emergency alert from UBE Safety. My current location: ${mapLink}`;
                    const waUrl = `https://wa.me/${c.phone}?text=${encodeURIComponent(message)}`;
                    return (
                      <a 
                        key={c.id}
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition text-green-900 font-bold"
                      >
                        <span>Send to {c.name}</span>
                        <PhoneForwarded className="w-5 h-5" />
                      </a>
                    );
                  })}
                  {contacts.filter(c => c.phone).length === 0 && (
                    <p className="text-sm text-slate-500 italic">No phone contacts configured.</p>
                  )}
                </div>

                <button 
                  onClick={() => setAlertActive(false)}
                  className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold text-sm hover:bg-slate-900 transition"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
