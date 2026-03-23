import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Survey from './pages/Survey';
import Match from './pages/Match';
import Admin from './pages/Admin';
import Navbar from './components/Navbar';
import { getAccessToken, getIsAdmin, migrateLegacyStorageKeys } from './lib/storage';
import { useEffect } from 'react';

function ProtectedRoute({ children }) {
  const token = getAccessToken();
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const token = getAccessToken();
  const isAdmin = getIsAdmin();
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/survey" replace />;
  }
  return children;
}

function AppLayout() {
  const location = useLocation();
  const isNoPadding = location.pathname === '/' || location.pathname === '/auth';

  return (
    <div className={`min-h-screen bg-gray-50 text-gray-800 flex flex-col ${isNoPadding ? '' : 'pt-[72px] sm:pt-[88px]'}`}>
      <Navbar />
      <main className="flex-1 w-full relative">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/survey" element={
            <ProtectedRoute>
              <Survey />
            </ProtectedRoute>
          } />
          <Route path="/match" element={
            <ProtectedRoute>
              <Match />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  useEffect(() => {
    migrateLegacyStorageKeys();
  }, []);

  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;
