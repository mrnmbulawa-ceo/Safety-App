import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { SafeZone } from '../types';
import { Plus, Trash2, MapPin, Navigation, Info } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

export default function SafeZones() {
  const { user } = useAuth();
  const [zones, setZones] = useState<SafeZone[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [radius, setRadius] = useState<number>(1000);
  const [active, setActive] = useState(true);
  const [markerPos, setMarkerPos] = useState<{lat: number, lng: number} | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapKey = (import.meta as any).env.VITE_GOOGLE_MAPS_JS_API_KEY;

  useEffect(() => {
    if (!user) return;
    loadZones();
    
    // Get initial location for map
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setMarkerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setMarkerPos({ lat: -26.2041, lng: 28.0473 }) // Default to Joburg
      );
    }
  }, [user]);

  const loadZones = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('safe_zones').select('*').order('name');
    if (data) setZones(data);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) return;

    if (!markerPos) {
      setError('Please select a location on the map.');
      return;
    }
    
    if (radius < 50 || radius > 20000) {
      setError('Radius must be between 50 and 20,000 meters.');
      return;
    }

    setIsSubmitting(true);
    const { error: insertError } = await supabase.from('safe_zones').insert({
      user_id: user.id,
      name,
      latitude: markerPos.lat,
      longitude: markerPos.lng,
      radius_meters: radius,
      active
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setName('');
      setRadius(1000);
      setActive(true);
      loadZones();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this zone?')) return;
    await supabase.from('safe_zones').delete().eq('id', id);
    loadZones();
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await supabase.from('safe_zones').update({ active: !currentActive }).eq('id', id);
    loadZones();
  };

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="max-w-5xl mx-auto w-full p-4 sm:p-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">Safe Zones</h1>
      <p className="text-slate-600 mb-4 max-w-3xl">
        Define areas where you feel safe (e.g. Home, Campus). 
      </p>
      
      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-8 flex items-start gap-3 text-indigo-900 text-sm max-w-3xl shadow-sm">
        <Info className="w-5 h-5 shrink-0 text-indigo-600" />
        <p>
          <strong>Checked while the app is open.</strong> Because this is a web application, it cannot track your location in the background when the app is closed. For Safe Zone monitoring to work, keep this app open in your browser or active as a web app.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* ADD ZONE FORM */}
        <div className="order-2 lg:order-1">
          <form onSubmit={handleAdd} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-800">Add New Zone</h2>
            
            {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg font-medium">{error}</div>}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Zone Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm"
                placeholder="e.g. Campus Res"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Radius (meters) <span className="text-red-500">*</span></label>
              <input
                type="number"
                required
                min={50}
                max={20000}
                value={radius}
                onChange={e => setRadius(parseInt(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">Allowed range: 50m to 20,000m</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Location <span className="text-red-500">*</span></label>
              <p className="text-xs text-slate-500 mb-2">Click or drag the map to set the center of your safe zone.</p>
              
              {mapKey ? (
                <div className="h-64 w-full rounded-lg overflow-hidden border border-slate-200">
                  <APIProvider apiKey={mapKey}>
                    <Map
                      defaultCenter={markerPos || { lat: -26.2041, lng: 28.0473 }}
                      defaultZoom={14}
                      mapId="SAFE_ZONE_MAP"
                      disableDefaultUI={true}
                      gestureHandling={'cooperative'}
                      onClick={(e) => {
                        if (e.detail.latLng) {
                          setMarkerPos({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
                        }
                      }}
                    >
                      {markerPos && (
                        <AdvancedMarker position={markerPos}>
                          <Pin background={'#4f46e5'} borderColor={'#312e81'} glyphColor={'#ffffff'} />
                        </AdvancedMarker>
                      )}
                    </Map>
                  </APIProvider>
                </div>
              ) : (
                <div className="h-64 w-full bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 text-sm border border-slate-200 p-6 text-center">
                  Map requires VITE_GOOGLE_MAPS_JS_API_KEY environment variable.
                </div>
              )}
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={active}
                onChange={e => setActive(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-bold text-slate-700">Set as Active</span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Save Safe Zone
            </button>
          </form>
        </div>

        {/* EXISTING ZONES */}
        <div className="order-1 lg:order-2 space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Your Zones</h2>
          {loading ? (
             <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">Loading zones...</div>
          ) : zones.length === 0 ? (
             <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
               No safe zones defined yet.
             </div>
          ) : (
            zones.map(z => (
              <div key={z.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{z.name}</h3>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Navigation className="w-4 h-4 text-slate-400" />
                      Radius: {z.radius_meters}m
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      {z.latitude.toFixed(4)}, {z.longitude.toFixed(4)}
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <button 
                      onClick={() => handleToggleActive(z.id, z.active)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full transition ${
                        z.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {z.active ? 'Active (Monitoring)' : 'Inactive'}
                    </button>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleDelete(z.id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
