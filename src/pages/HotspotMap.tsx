import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { CrimeHotspot } from '../types';
import { AlertCircle, MapPin, Plus, X } from 'lucide-react';

declare const L: any;

const CATEGORIES = [
  { value: 'theft', label: 'Theft / Robbery', color: '#f59e0b' },
  { value: 'assault', label: 'Assault', color: '#ef4444' },
  { value: 'harassment', label: 'Harassment', color: '#8b5cf6' },
  { value: 'poor_lighting', label: 'Poor Lighting', color: '#64748b' },
  { value: 'other', label: 'Other Safety Concern', color: '#3b82f6' }
];

export default function HotspotMap() {
  const { user } = useAuth();
  const [hotspots, setHotspots] = useState<CrimeHotspot[]>([]);
  const [loading, setLoading] = useState(true);

  // Map state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  
  // Submission state
  const [isAdding, setIsAdding] = useState(false);
  const [addPos, setAddPos] = useState<{lat: number, lng: number} | null>(null);
  const addMarkerRef = useRef<any>(null);
  
  // Form state
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    loadHotspots();
  }, [user]);

  const loadHotspots = async () => {
    const { data, error } = await supabase.from('crime_hotspots').select('*');
    if (data) setHotspots(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize map
      const map = L.map(mapContainerRef.current).setView([-26.2041, 28.0473], 13); // Default to JHB
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      map.on('click', (e: any) => {
        if (mapContainerRef.current?.dataset.adding === 'true') {
          setAddPos({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });

      mapInstanceRef.current = map;

      // Try to get user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            map.setView([pos.coords.latitude, pos.coords.longitude], 14);
          },
          () => {} // Ignored
        );
      }
    }

    const map = mapInstanceRef.current;

    // Clear old markers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    // Add new markers
    hotspots.forEach(spot => {
      const catColor = CATEGORIES.find(c => c.value === spot.category)?.color || '#3b82f6';
      const catLabel = CATEGORIES.find(c => c.value === spot.category)?.label || 'Incident';
      
      const iconHtml = `<div style="background-color: ${catColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`;
      const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [16, 16], iconAnchor: [8, 8] });
      
      let popupContent = `<strong>${catLabel}</strong>`;
      if (spot.description) popupContent += `<br/>${spot.description}`;
      if (spot.status === 'pending') popupContent += `<br/><span style="color: #64748b; font-size: 0.8em;">(Pending Review)</span>`;

      const marker = L.marker([spot.latitude, spot.longitude], { icon })
        .bindPopup(popupContent)
        .addTo(map);
      
      markersRef.current[spot.id] = marker;
    });

  }, [hotspots]);

  // Update add pin
  useEffect(() => {
    if (mapContainerRef.current) {
      mapContainerRef.current.dataset.adding = isAdding.toString();
    }
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isAdding && addPos) {
      if (!addMarkerRef.current) {
        const iconHtml = `<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`;
        const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [20, 20], iconAnchor: [10, 10] });
        addMarkerRef.current = L.marker([addPos.lat, addPos.lng], { icon, zIndexOffset: 1000 }).addTo(map);
      } else {
        addMarkerRef.current.setLatLng([addPos.lat, addPos.lng]);
      }
    } else {
      if (addMarkerRef.current) {
        map.removeLayer(addMarkerRef.current);
        addMarkerRef.current = null;
      }
    }
  }, [isAdding, addPos]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addPos) return;

    setSubmitting(true);
    setMessage(null);

    const payload = {
      latitude: addPos.lat,
      longitude: addPos.lng,
      category,
      description,
      status: 'pending'
    };

    if (user) {
      const { error } = await supabase.from('crime_hotspots').insert(payload);
      if (error) {
        setMessage({ text: error.message, type: 'error' });
      } else {
        setMessage({ text: 'Thanks — this will appear on the map once a moderator reviews it.', type: 'success' });
        resetForm();
        loadHotspots(); // Re-load to see own pending
      }
    } else {
      try {
        const res = await fetch('/api/hotspots/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Submission failed');
        setMessage({ text: 'Thanks — this will appear on the map once a moderator reviews it.', type: 'success' });
        resetForm();
      } catch (e: any) {
        setMessage({ text: e.message, type: 'error' });
      }
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setIsAdding(false);
    setAddPos(null);
    setCategory(CATEGORIES[0].value);
    setDescription('');
  };

  return (
    <div className="max-w-6xl mx-auto w-full p-4 h-[calc(100vh-64px)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Community Safety Map</h1>
          <p className="text-sm text-slate-600">Reported safety concerns and crime hotspots.</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Report a Hotspot
          </button>
        )}
      </div>

      {message && (
        <div className={`p-4 mb-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 relative">
        <div 
          ref={mapContainerRef} 
          className={`flex-1 rounded-xl border border-slate-200 shadow-sm z-0 relative ${isAdding ? 'cursor-crosshair' : ''}`}
        >
          {isAdding && !addPos && (
             <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg pointer-events-none whitespace-nowrap">
               Tap on the map to place a pin
             </div>
          )}
        </div>

        {isAdding && (
          <div className="w-full md:w-80 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col overflow-y-auto z-10 md:static absolute inset-x-4 bottom-4 top-auto max-h-[50vh] md:max-h-none">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-slate-800">New Hotspot</h2>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                <select 
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Description (Optional)</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief details about the concern..."
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-24"
                  maxLength={500}
                />
              </div>

              <div className="mt-auto pt-4">
                <button 
                  type="submit"
                  disabled={!addPos || submitting}
                  className="w-full bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg transition"
                >
                  {submitting ? 'Submitting...' : 'Submit Hotspot'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
