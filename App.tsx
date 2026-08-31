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
import EvidenceUpload from './pages/EvidenceUpload';
import Confirmation from './pages/Confirmation';
import ModeratorDashboard from './pages/ModeratorDashboard';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="report" element={<SubmitReport />} />
            <Route path="report/:id/evidence" element={<EvidenceUpload />} />
            <Route path="confirmation/:id" element={<Confirmation />} />
            <Route path="moderator" element={<ModeratorDashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
