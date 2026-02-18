import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { API_URL } from './config';

// Pages
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Logout from './pages/Logout';
import SessionSetup from './pages/SessionSetup';
import GameRoom from './pages/GameRoom';
import AdminDashboard from './pages/AdminDashboard';
import OperatorDashboard from './pages/OperatorDashboard';
import Viewer from './pages/Viewer';
import Rummy from './pages/Rummy';
import Setup from './pages/Setup';
import Profile from './pages/Profile';
import TeenPattiHelp from './pages/TeenPattiHelp';

// Setup Check Component
const SetupCheck = ({ children }) => {
  const [needsSetup, setNeedsSetup] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await fetch(`${API_URL}/api/setup/status`);
        const data = await res.json();
        setNeedsSetup(data.needsSetup);
      } catch (e) {
        console.error('Failed to check setup status:', e);
        setNeedsSetup(false);
      } finally {
        setLoading(false);
      }
    };
    checkSetup();
  }, []);

  if (loading) return <div>Loading...</div>;

  if (needsSetup) {
    return <Navigate to="/system-setup" replace />;
  }

  return children;
};

// Protected Route Component
const ProtectedRoute = ({ children, requireOperator = false, requireAdmin = false }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  if (requireOperator && user.role !== 'OPERATOR' && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/system-setup" element={<Setup />} />
      <Route path="/" element={
        <SetupCheck>
          <Welcome />
        </SetupCheck>
      } />
      <Route path="/login" element={
        <SetupCheck>
          <Login />
        </SetupCheck>
      } />
      <Route path="/logout" element={<Logout />} />
      <Route path="/viewer/:sessionName" element={<Viewer />} />
      <Route path="/rummy" element={<Rummy />} />
      <Route path="/help" element={<TeenPattiHelp />} />

      {/* Protected Routes - Any logged in user */}
      <Route
        path="/setup"
        element={
          <ProtectedRoute requireOperator={true}>
            <SessionSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/game/:sessionName"
        element={
          <ProtectedRoute>
            <GameRoom />
          </ProtectedRoute>
        }
      />
      
      {/* Operator Routes */}
      <Route
        path="/operator-dashboard"
        element={
          <ProtectedRoute requireOperator={true}>
            <OperatorDashboard />
          </ProtectedRoute>
        }
      />
      
      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin={true}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      
      {/* Profile Route - Any logged in user */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
