import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MapPin, Navigation, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

declare const L: any;

export default function RideViewer() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');

  const [rideData, setRideData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const lineRef = useRef<any>(null);

  const fetchRide = async () => {
    if (!id || !code) {
      setError('Invalid link.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('get_shared_ride_by_token', {
        p_ride_id: id,
        p_token: code
      });

      if (rpcError || !data || data.length === 0) {
        // Obscure whether ID exists
        setError('Ride not found or link has expired.');
      } else {
        setRideData(data[0]);
      }
    } catch (e) {
      setError('Ride not found or link has expired.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRide();
    const interval = setInterval(fetchRide, 15000);
    return () => clearInterval(interval);
  }, [id, code]);

  useEffect(() => {
    if (!rideData || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const { last_lat, last_lng, destination_lat: dest_lat, destination_lng: dest_lng } = rideData;

    // Update Rider Marker
    if (!markerRef.current && last_lat && last_lng) {
      const iconHtml = `<div style="background-color: #4f46e5; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`;
      const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [20, 20], iconAnchor: [10, 10] });
      markerRef.current = L.marker([last_lat, last_lng], { icon }).bindPopup("Rider's last position").addTo(map);
    } else if (markerRef.current && last_lat && last_lng) {
      markerRef.current.setLatLng([last_lat, last_lng]);
    }

    // Update Dest Marker
    if (!destMarkerRef.current && dest_lat && dest_lng) {
      const iconHtml = `<div style="background-color: #f59e0b; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`;
      const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [20, 20], iconAnchor: [10, 10] });
      destMarkerRef.current = L.marker([dest_lat, dest_lng], { icon }).bindPopup("Destination").addTo(map);
    }

    // Update Line
    if (last_lat && last_lng && dest_lat && dest_lng) {
      if (lineRef.current) {
        map.removeLayer(lineRef.current);
      }
      lineRef.current = L.polyline([[last_lat, last_lng], [dest_lat, dest_lng]], {
        color: '#94a3b8',
        weight: 2,
        dashArray: '5, 10'
      }).addTo(map);

      // Fit bounds
      const bounds = L.latLngBounds([last_lat, last_lng], [dest_lat, dest_lng]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [rideData]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading ride data...</div>;
  }

  if (error || !rideData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 mb-2">Not Found</h1>
          <p className="text-slate-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const getStatusDisplay = () => {
    switch(rideData.status) {
      case 'active':
        return <div className="flex items-center gap-2 text-indigo-600 font-bold bg-indigo-50 px-4 py-2 rounded-lg"><Navigation className="w-5 h-5 animate-pulse" /> Ride in Progress</div>;
      case 'arrived':
        return <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-4 py-2 rounded-lg"><CheckCircle className="w-5 h-5" /> Arrived Safely</div>;
      case 'deviated':
      case 'overdue':
        return <div className="flex items-center gap-2 text-red-600 font-bold bg-red-50 px-4 py-2 rounded-lg"><AlertTriangle className="w-5 h-5" /> Safety Alert: {rideData.status}</div>;
      case 'cancelled':
        return <div className="flex items-center gap-2 text-slate-600 font-bold bg-slate-100 px-4 py-2 rounded-lg">Ride Cancelled</div>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10 relative">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">UBE<span className="text-indigo-600">Safety</span></h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Live Shared Ride</p>
        </div>
        {getStatusDisplay()}
      </header>

      <div className="flex-1 relative z-0">
        <div ref={mapContainerRef} className="absolute inset-0" />
        
        {rideData.last_ping_at && (
          <div className="absolute bottom-6 left-6 z-[1000] bg-white rounded-lg shadow-lg border border-slate-200 p-4">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Last Updated</p>
             <p className="text-sm font-bold text-slate-800">
               {new Date(rideData.last_ping_at).toLocaleTimeString()}
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
