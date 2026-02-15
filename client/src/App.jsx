import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

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
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/logout" element={<Logout />} />
      <Route path="/viewer/:sessionName" element={<Viewer />} />
      <Route path="/rummy" element={<Rummy />} />

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

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
