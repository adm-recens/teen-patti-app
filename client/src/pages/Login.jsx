import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, AlertCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const from = location.state?.from || '/';
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else if (user.role === 'OPERATOR') {
        navigate('/dashboard');
      } else {
        navigate(from);
      }
    }
  }, [user, navigate, location]);

  // Check if setup is needed
  useEffect(() => {
    fetch(`${API_URL}/api/setup/status`)
      .then(res => res.json())
      .then(data => {
        if (data.needsSetup) {
          setNeedsSetup(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v2/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        credentials: 'include'
      });

      const data = await res.json();

      if (data.success) {
        // Navigate based on role (returned from API)
        if (data.user?.redirectTo) {
          navigate(data.user.redirectTo);
        } else {
          navigate('/');
        }
      } else {
        if (data.needsSetup) {
          navigate('/setup');
          return;
        }
        
        if (res.status === 423) {
          setError(`${data.message} Try again in ${data.remainingMinutes} minutes.`);
        } else if (data.details) {
          setError(`${data.error}: ${data.details.join(', ')}`);
        } else {
          setError(data.error || 'Login failed. Please check your credentials.');
        }
      }
    } catch (e) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (needsSetup) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900 via-slate-900 to-black opacity-60"></div>
        
        <div className="relative z-10 bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <Sparkles className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">System Setup Required</h1>
          <p className="text-slate-500 mb-6">
            This is a fresh installation. Please create the first admin user to get started.
          </p>
          <button
            onClick={() => navigate('/setup')}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all"
          >
            Start Setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900 via-slate-900 to-black opacity-60"></div>
      
      <div className="relative z-10 w-full max-w-md">
        <button
          onClick={() => navigate('/')}
          className="absolute -top-12 left-0 text-white/70 hover:text-white flex items-center gap-2 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Home
        </button>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
              <Lock className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Welcome Back</h1>
            <p className="text-slate-500 mt-2">
              Sign in to access your games and manage sessions
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-900 focus:border-purple-500 focus:bg-white outline-none transition-all"
                  placeholder="Enter your username"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-900 focus:border-purple-500 focus:bg-white outline-none transition-all"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !credentials.username || !credentials.password}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-500 text-sm">
              Don't have an account? Contact your administrator for access.
            </p>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/', { state: { showViewer: true } })}
              className="text-purple-600 font-bold text-sm hover:text-purple-700 transition-colors"
            >
              Watch as Guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
