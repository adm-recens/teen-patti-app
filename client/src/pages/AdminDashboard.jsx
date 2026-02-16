import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Gamepad2, Plus, Trash2, Eye, X, Heart, Activity, BarChart3, UserPlus, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const [adminSessions, setAdminSessions] = useState([]);
    const [adminUsers, setAdminUsers] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [sessionDetails, setSessionDetails] = useState(null);
    const [showSessionModal, setShowSessionModal] = useState(false);
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: '' });
    const [createError, setCreateError] = useState('');
    const [createSuccess, setCreateSuccess] = useState('');
    const [loading, setLoading] = useState(true);

    const isAdmin = user?.role === 'ADMIN';

    useEffect(() => {
        if (!isAdmin) return;
        fetchData();
    }, [isAdmin]);

    const fetchData = async () => {
        setLoading(true);

        try {
            const [sessionsRes, usersRes] = await Promise.all([
                fetch(`${API_URL}/api/admin/sessions`, { credentials: 'include' }),
                fetch(`${API_URL}/api/admin/users`, { credentials: 'include' })
            ]);

            if (sessionsRes.ok) {
                const sessions = await sessionsRes.json();
                setAdminSessions(sessions);
            }

            if (usersRes.ok) {
                const users = await usersRes.json();
                setAdminUsers(users);
            }
        } catch (e) {
            console.error('Error fetching data:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreateError('');
        setCreateSuccess('');

        if (!newUser.role) {
            setCreateError('Please select a role');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/admin/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser),
                credentials: 'include'
            });

            if (res.ok) {
                setCreateSuccess('User created successfully!');
                setNewUser({ username: '', password: '', role: '' });
                fetchData();
                setTimeout(() => {
                    setShowCreateUserModal(false);
                    setCreateSuccess('');
                }, 1500);
            } else {
                const data = await res.json();
                setCreateError(data.error || 'Failed to create user');
            }
        } catch (e) {
            setCreateError('Error creating user');
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                setAdminUsers(adminUsers.filter(u => u.id !== userId));
            } else {
                alert('Failed to delete user');
            }
        } catch (e) {
            alert('Error deleting user');
        }
    };

    const handleEndSession = async (sessionName) => {
        if (!confirm(`End session "${sessionName}"?`)) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/sessions/${sessionName}/end`, {
                method: 'POST',
                credentials: 'include'
            });

            if (res.ok) {
                fetchData();
            } else {
                alert('Failed to end session');
            }
        } catch (e) {
            alert('Error ending session');
        }
    };

    const handleDeleteSession = async (sessionName) => {
        if (!confirm(`Permanently delete "${sessionName}"? This cannot be undone.`)) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/sessions/${sessionName}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                fetchData();
            } else {
                alert('Failed to delete session');
            }
        } catch (e) {
            alert('Error deleting session');
        }
    };

    const handleViewSession = async (sessionName) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/sessions/${sessionName}`, {
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                setSessionDetails(data);
                setSelectedSession(sessionName);
                setShowSessionModal(true);
            }
        } catch (e) {
            alert('Error fetching session details');
        }
    };

    const activeSessions = adminSessions.filter(s => s.isActive);
    const endedSessions = adminSessions.filter(s => !s.isActive);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => navigate('/')} 
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <ArrowLeft className="text-slate-600" size={24} />
                            </button>
                            <div>
                                <h1 className="text-2xl font-black text-slate-900">Admin Dashboard</h1>
                                <p className="text-sm text-slate-500">System Administration Panel</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setShowCreateUserModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
                            >
                                <UserPlus size={18} /> Add User
                            </button>
                            <button 
                                onClick={() => navigate('/setup')}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all"
                            >
                                <Gamepad2 size={18} /> New Game
                            </button>
                            <button 
                                onClick={() => { logout(); navigate('/'); }}
                                className="flex items-center gap-2 px-4 py-2 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-colors"
                            >
                                <Trash2 size={18} /> Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg shadow-green-500/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-green-100 font-medium mb-1">System Status</p>
                                <p className="text-2xl font-black">Online</p>
                            </div>
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <Activity size={24} className="text-white" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            <span className="text-sm text-green-100">All systems operational</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-500 font-medium mb-1">Active Games</p>
                                <p className="text-3xl font-black text-slate-900">{activeSessions.length}</p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <Gamepad2 size={24} className="text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-500 font-medium mb-1">Total Games</p>
                                <p className="text-3xl font-black text-slate-900">{adminSessions.length}</p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <BarChart3 size={24} className="text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-500 font-medium mb-1">Total Users</p>
                                <p className="text-3xl font-black text-slate-900">{adminUsers.length}</p>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                <Users size={24} className="text-purple-600" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Sessions Section */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Active Games */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                                        <Gamepad2 size={20} className="text-green-600" />
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-900">Active Games</h2>
                                </div>
                                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full">
                                    {activeSessions.length}
                                </span>
                            </div>
                            
                            {activeSessions.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    No active games running
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {activeSessions.map(session => (
                                        <div key={session.id} className="p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-bold text-slate-900">{session.name}</h3>
                                                    <p className="text-sm text-slate-500">
                                                        Created {new Date(session.createdAt).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-3 py-1 bg-green-100 text-green-600 text-xs font-bold rounded-full">
                                                        LIVE
                                                    </span>
                                                    <button 
                                                        onClick={() => handleViewSession(session.name)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="View"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleEndSession(session.name)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="End"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Game History */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                        <Clock size={20} className="text-slate-600" />
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-900">Game History</h2>
                                </div>
                                <span className="px-3 py-1 bg-slate-100 text-slate-700 text-sm font-bold rounded-full">
                                    {endedSessions.length}
                                </span>
                            </div>
                            
                            {endedSessions.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    No completed games
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                                    {endedSessions.map(session => (
                                        <div key={session.id} className="p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-bold text-slate-900">{session.name}</h3>
                                                    <p className="text-sm text-slate-500">
                                                        Ended {new Date(session.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full">
                                                        ENDED
                                                    </span>
                                                    <button 
                                                        onClick={() => handleViewSession(session.name)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="View Results"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteSession(session.name)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Users Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                    <Users size={20} className="text-purple-600" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-900">Registered Users</h2>
                            </div>
                        </div>
                        
                        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                            {adminUsers.map(u => (
                                <div key={u.id} className="p-4 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center font-bold text-slate-600">
                                                {u.username[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{u.username}</p>
                                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                                    u.role === 'ADMIN' ? 'bg-red-100 text-red-600' :
                                                    u.role === 'OPERATOR' ? 'bg-blue-100 text-blue-600' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {u.role}
                                                </span>
                                            </div>
                                        </div>
                                        {u.id !== user.id && u.id !== 1 && (
                                            <button 
                                                onClick={() => handleDeleteUser(u.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* Create User Modal */}
            {showCreateUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <UserPlus size={24} className="text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">Add New User</h2>
                                    <p className="text-sm text-slate-500">Create operator or admin account</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowCreateUserModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X size={24} className="text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Username</label>
                                <input
                                    type="text"
                                    value={newUser.username}
                                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-900 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Enter username"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-900 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Enter password"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Role</label>
                                <select
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-900 focus:border-blue-500 outline-none transition-all"
                                    required
                                >
                                    <option value="">Select Role</option>
                                    <option value="OPERATOR">Operator</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>

                            {createError && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                                    <AlertCircle size={16} />
                                    {createError}
                                </div>
                            )}

                            {createSuccess && (
                                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-600 rounded-xl text-sm">
                                    <CheckCircle size={16} />
                                    {createSuccess}
                                </div>
                            )}
                            
                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="button"
                                    onClick={() => setShowCreateUserModal(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                                >
                                    Create User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Session Details Modal */}
            {showSessionModal && sessionDetails && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">{sessionDetails.name}</h2>
                                <p className="text-sm text-slate-500">
                                    {new Date(sessionDetails.createdAt).toLocaleString()} • {sessionDetails.totalRounds} Rounds
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowSessionModal(false)}
                                className="p-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X size={24} className="text-slate-600" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            {/* Players */}
                            <div className="mb-6">
                                <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <Users size={18} className="text-blue-500" />
                                    Players ({sessionDetails.players?.length || 0})
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {sessionDetails.players?.map(player => (
                                        <div key={player.id} className="bg-slate-50 p-3 rounded-xl flex justify-between items-center border border-slate-100">
                                            <span className="font-medium text-slate-800">{player.name}</span>
                                            <span className={`text-xs px-2 py-1 rounded font-bold ${
                                                player.sessionBalance >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                            }`}>
                                                {player.sessionBalance >= 0 ? '+' : ''}{player.sessionBalance}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Game Hands */}
                            <div>
                                <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <Gamepad2 size={18} className="text-yellow-500" /> 
                                    Game Results ({sessionDetails.hands?.length || 0} hands)
                                </h3>
                                
                                {sessionDetails.hands?.length === 0 ? (
                                    <p className="text-slate-500 text-center py-8">No hands recorded for this session</p>
                                ) : (
                                    <div className="space-y-3">
                                        {sessionDetails.hands?.map((hand, index) => (
                                            <div key={hand.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">
                                                            #{sessionDetails.hands.length - index}
                                                        </span>
                                                        <span className="text-xs text-slate-400">
                                                            {new Date(hand.createdAt).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs text-slate-500 block">Pot</span>
                                                        <p className="font-bold text-green-600">{hand.potSize}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                                                    <Trophy size={16} className="text-yellow-500" />
                                                    <span className="font-bold text-slate-800">Winner: {hand.winner}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-center">
                            <button 
                                onClick={() => setShowSessionModal(false)}
                                className="px-8 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-2"
                            >
                                <X size={18} /> Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
