import { Link } from 'react-router-dom';
import { ShieldAlert, Navigation, MapPin, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import FakeCallButton from '../components/FakeCallButton';

export default function Emergency() {
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [places, setPlaces] = useState<any[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

  const mapKey = (import.meta as any).env.VITE_GOOGLE_MAPS_JS_API_KEY;

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Enable location to see nearby help centres");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      (err) => {
        setLocationError("Enable location to see nearby help centres");
      },
      { timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    if (location) {
      setLoadingPlaces(true);
      fetch(`/api/nearby-help?lat=${location.lat}&lng=${location.lng}`)
        .then(res => {
          if (!res.ok) throw new Error('Network error');
          return res.json();
        })
        .then(data => {
          if (data.places) setPlaces(data.places);
          setLoadingPlaces(false);
        })
        .catch(() => {
          setLoadingPlaces(false);
        });
    }
  }, [location]);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 sm:p-8 shadow-sm mb-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center border border-red-200">
            <ShieldAlert className="h-8 w-8 text-red-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Immediate Help Needed</h1>
        <p className="text-slate-700 max-w-lg mx-auto text-sm">
          If you are in danger, please contact authorities directly.
        </p>
      </div>

      {/* STATIC CONTENT LAYER 1: Zero network dependency */}
      <div className="space-y-4 mb-8">
        <a href="tel:10111" className="block bg-red-600 text-white p-6 rounded-xl text-center hover:bg-red-700 transition shadow-sm">
          <div className="text-4xl font-bold mb-1">10111</div>
          <div className="text-sm font-medium uppercase tracking-widest text-red-100">SAPS Emergency</div>
        </a>
        <a href="tel:112" className="block bg-slate-800 text-white p-6 rounded-xl text-center hover:bg-slate-900 transition shadow-sm">
          <div className="text-4xl font-bold mb-1">112</div>
          <div className="text-sm font-medium uppercase tracking-widest text-slate-300">Cell Emergency (Free)</div>
        </a>
        <a href="tel:0800428428" className="block bg-indigo-600 text-white p-6 rounded-xl text-center hover:bg-indigo-700 transition shadow-sm">
          <div className="text-4xl font-bold mb-1">0800 428 428</div>
          <div className="text-sm font-medium uppercase tracking-widest text-indigo-200">GBV Command Centre</div>
        </a>
      </div>

      <div className="bg-white rounded-xl border border-red-100 p-6 sm:p-8 shadow-sm mb-8">
        <h2 className="text-sm font-bold text-red-600 uppercase tracking-widest mb-6">Immediate Guidance</h2>
        {/* 
          TODO: This copy is a reasonable non-clinical starting point but 
          hasn't had a crisis-response specialist review it. 
        */}
        <ul className="space-y-5 text-slate-800 font-medium text-sm leading-relaxed">
          <li className="flex gap-4">
            <span className="text-red-500 font-bold shrink-0">•</span> 
            <span>Breathe: in for 4 counts, hold for 4, out for 6. Repeat until your hands feel steadier.</span>
          </li>
          <li className="flex gap-4">
            <span className="text-red-500 font-bold shrink-0">•</span> 
            <span>If you can safely move, get to a public, well-lit place or somewhere with other people around.</span>
          </li>
          <li className="flex gap-4">
            <span className="text-red-500 font-bold shrink-0">•</span> 
            <span>If you call 10111 or 112, say clearly: your name, exactly where you are (street name, landmark, or what you can see), and what is happening right now.</span>
          </li>
          <li className="flex gap-4">
            <span className="text-red-500 font-bold shrink-0">•</span> 
            <span>You don't have to explain everything at once. Give the most urgent facts first — your location, and whether anyone is hurt.</span>
          </li>
        </ul>
      </div>

      {/* LAYER 2: LOCATION + MAP */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600" />
            Nearby Help Centres
          </h2>
        </div>
        
        {!locationError && !location && (
          <div className="p-8 text-center text-slate-500 text-sm">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-indigo-600 mb-3"></div>
            <p>Locating you...</p>
          </div>
        )}

        {locationError && (
          <div className="p-6 bg-slate-50 text-center">
            <p className="text-sm font-medium text-slate-600">{locationError}</p>
          </div>
        )}

        {location && mapKey && (
          <div className="h-64 sm:h-80 w-full relative">
             <APIProvider apiKey={mapKey}>
                <Map
                  defaultCenter={location}
                  defaultZoom={13}
                  mapId="DEMO_MAP_ID"
                  disableDefaultUI={true}
                  gestureHandling={'cooperative'}
                >
                  <AdvancedMarker position={location}>
                     <Pin background={'#4f46e5'} borderColor={'#312e81'} glyphColor={'#ffffff'} />
                  </AdvancedMarker>
                  
                  {places.map((place: any) => {
                    const lat = place.location.latitude;
                    const lng = place.location.longitude;
                    const isFirst = place === places[0];
                    return (
                      <AdvancedMarker key={place.id} position={{ lat, lng }}>
                        <Pin background={isFirst ? '#ef4444' : '#f87171'} borderColor={'#991b1b'} glyphColor={'#ffffff'} />
                      </AdvancedMarker>
                    );
                  })}
                </Map>
             </APIProvider>
          </div>
        )}

        {location && !mapKey && (
           <div className="p-6 bg-orange-50 border-y border-orange-100 text-sm text-orange-800 text-center">
             <p className="font-bold">Missing Map API Key</p>
             <p>Configure VITE_GOOGLE_MAPS_JS_API_KEY in your environment.</p>
           </div>
        )}

        {location && (
          <div className="p-6">
            <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 text-xs text-slate-600">
              <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p>Locations shown are from Google Maps and may be out of date or incomplete, especially outside major cities — call 10111 or 112 if you're unsure.</p>
            </div>

            {loadingPlaces ? (
              <p className="text-center text-sm text-slate-500 py-4">Finding nearby stations...</p>
            ) : places.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Nearest Options</h3>
                {places.slice(0, 3).map((place: any, idx: number) => {
                  const lat = place.location.latitude;
                  const lng = place.location.longitude;
                  const directionUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                  
                  return (
                    <div key={place.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-100 rounded-lg bg-slate-50/50 gap-4">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{place.displayName?.text || 'Station'}</p>
                        <p className="text-xs text-slate-500 mt-1">{place.formattedAddress}</p>
                      </div>
                      <a 
                        href={directionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded text-xs font-bold hover:bg-slate-50 hover:text-indigo-600 transition-colors shrink-0 whitespace-nowrap"
                      >
                        <Navigation className="w-3 h-3" />
                        Get Directions
                      </a>
                    </div>
                  );
                })}
              </div>
            ) : (
               <p className="text-center text-sm text-slate-500 py-4">No stations found nearby.</p>
            )}
          </div>
        )}
      </div>
      
      <div className="text-center space-y-8">
        <div className="max-w-xs mx-auto border-t border-slate-200 pt-8">
          <FakeCallButton className="w-full" />
        </div>
        
        <Link
          to="/"
          className="inline-flex items-center justify-center text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest"
        >
          Return to Home Page
        </Link>
      </div>
    </div>
  );
}
