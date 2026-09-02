/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import SubmitReport from './pages/SubmitReport';
import Confirmation from './pages/Confirmation';
import ModeratorDashboard from './pages/ModeratorDashboard';
import Emergency from './pages/Emergency';
import CheckReport from './pages/CheckReport';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import TrustedContacts from './pages/TrustedContacts';
import SafeZones from './pages/SafeZones';
import HotspotMap from './pages/HotspotMap';
import RideSharing from './pages/RideSharing';
import RideViewer from './pages/RideViewer';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="report" element={<SubmitReport />} />
            <Route path="confirmation/:id" element={<Confirmation />} />
            <Route path="moderator" element={<ModeratorDashboard />} />
            <Route path="emergency" element={<Emergency />} />
            <Route path="check" element={<CheckReport />} />
            <Route path="contacts" element={<TrustedContacts />} />
            <Route path="safe-zones" element={<SafeZones />} />
            <Route path="hotspots" element={<HotspotMap />} />
            <Route path="ride" element={<RideSharing />} />
            <Route path="ride/:id" element={<RideViewer />} />
            <Route path="terms" element={<Terms />} />
            <Route path="privacy" element={<Privacy />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
