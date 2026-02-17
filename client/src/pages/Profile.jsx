import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Lock, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout, updatePassword, authenticatedFetch } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    username: ''
  });
  
  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Password validation state
  const [passwordErrors, setPasswordErrors] = useState([]);
  
  // Password requirements
  const passwordRequirements = [
    { label: 'At least 8 characters', regex: /.{8,}/ },
    { label: 'One uppercase letter (A-Z)', regex: /[A-Z]/ },
    { label: 'One lowercase letter (a-z)', regex: /[a-z]/ },
    { label: 'One number (0-9)', regex: /[0-9]/ },
    { label: 'One special character (!@#$%^&*)', regex: /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/ },
    { label: 'No 3+ repeated characters', regex: /^(?!.*(.)\1{2,}).*$/ },
    { label: 'No sequential characters (abc, 123)', regex: /^(?!.*(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)).*$/i },
  ];

  useEffect(() => {
    if (user) {
      setProfileData({ username: user.username });
    }
  }, [user]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);

    try {
      const res = await authenticatedFetch(`${API_URL}/api/user/profile`, {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        // Update the user context with new username
        window.location.reload(); // Refresh to get updated user data
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setPasswordErrors([]);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    // Check password requirements
    const failedRequirements = passwordRequirements.filter(
      req => !req.regex.test(passwordData.newPassword)
    );
    
    if (failedRequirements.length > 0) {
      setPasswordErrors(failedRequirements.map(r => r.label));
      return;
    }

    setLoading(true);

    try {
      const result = await updatePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );

      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Password changed successfully!' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordErrors([]);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to change password' });
        if (result.details) {
          setPasswordErrors(result.details);
        }
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <p>Please login to view your profile</p>
          <button 
            onClick={() => navigate('/login')}
            className="mt-4 px-6 py-2 bg-purple-600 rounded-lg font-bold"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <ArrowLeft className="text-white" size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-white">My Profile</h1>
              <p className="text-sm text-slate-400">Manage your account settings</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* User Info Card */}
        <div className="bg-white/5 rounded-2xl p-6 mb-8 border border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
              <span className="text-3xl font-bold text-white">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{user.username}</h2>
              <p className="text-slate-400">{user.role}</p>
              <p className="text-sm text-slate-500 mt-1">Member since {new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setActiveTab('profile'); setMessage({ type: '', text: '' }); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'profile' 
                ? 'bg-purple-600 text-white' 
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            <User size={18} />
            Profile
          </button>
          <button
            onClick={() => { setActiveTab('password'); setMessage({ type: '', text: '' }); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'password' 
                ? 'bg-purple-600 text-white' 
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            <Lock size={18} />
            Password
          </button>
        </div>

        {/* Alert Messages */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-green-500/20 border border-green-500/50 text-green-300' 
              : 'bg-red-500/20 border border-red-500/50 text-red-300'
          }`}>
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            {message.text}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-6">Update Profile</h3>
            
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={profileData.username}
                  onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  placeholder="Enter username"
                  minLength={3}
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  This will be your display name throughout the application
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex-1 py-3 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading || profileData.username === user.username}
                  className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : <><Save size={18} /> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-6">Change Password</h3>
            
            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, newPassword: e.target.value });
                    // Clear errors when user types
                    if (passwordErrors.length > 0) {
                      setPasswordErrors([]);
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  placeholder="Enter new password"
                  minLength={8}
                  required
                />
                
                {/* Password Requirements */}
                <div className="mt-3 p-3 bg-slate-800/50 rounded-xl">
                  <p className="text-xs font-medium text-slate-400 mb-2">Password Requirements:</p>
                  <div className="space-y-1">
                    {passwordRequirements.map((req, idx) => {
                      const isMet = req.regex.test(passwordData.newPassword);
                      return (
                        <div 
                          key={idx} 
                          className={`flex items-center gap-2 text-xs transition-colors ${
                            isMet ? 'text-green-400' : 'text-slate-500'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            isMet ? 'bg-green-500/20' : 'bg-slate-700'
                          }`}>
                            {isMet ? (
                              <CheckCircle size={10} className="text-green-400" />
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            )}
                          </div>
                          {req.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Validation Errors */}
                {passwordErrors.length > 0 && (
                  <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
                    <p className="text-xs font-medium text-red-400 mb-1">Please fix the following:</p>
                    <ul className="text-xs text-red-300 space-y-1">
                      {passwordErrors.map((error, idx) => (
                        <li key={idx} className="flex items-center gap-1">
                          <AlertCircle size={10} />
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex-1 py-3 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Changing...' : <><Lock size={18} /> Change Password</>}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

export default Profile;
