import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const [adminSessions, setAdminSessions] = useState([]);
    const [adminUsers, setAdminUsers] = useState([]);

    const isAdmin = user?.role === 'ADMIN' || user?.username === 'ram54' || user?.username === 'admin';

    useEffect(() => {
        fetch(`${API_URL}/api/admin/sessions`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => setAdminSessions(data));

        if (isAdmin) {
            fetch(`${API_URL}/api/admin/users`, { credentials: 'include' })
                .then(res => res.json())
                .then(data => setAdminUsers(data));
        }
    }, [isAdmin]);

    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'USER' });
    const [showCreateUser, setShowCreateUser] = useState(false);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/api/admin/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser),
                credentials: 'include'
            });
            if (res.ok) {
                alert('User created successfully');
                setShowCreateUser(false);
                setNewUser({ username: '', password: '', role: 'USER' });
                // Refresh list
                fetch(`${API_URL}/api/admin/users`, { credentials: 'include' })
                    .then(res => res.json())
                    .then(data => setAdminUsers(data));
            } else {
                alert('Failed to create user');
            }
        } catch (e) {
            console.error(e);
            alert('Error creating user');
        }
    };

    const handleEndSession = async (sessionName) => {
        if (!confirm(`Are you sure you want to force end session "${sessionName}"?`)) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/sessions/${sessionName}/end`, {
                method: 'POST',
                credentials: 'include'
            });
            if (res.ok) {
                alert('Session ended');
                // Refresh
                fetch(`${API_URL}/api/admin/sessions`, { credentials: 'include' })
                    .then(res => res.json())
                    .then(data => setAdminSessions(data));
            } else {
                alert('Failed to end session');
            }
        } catch (e) {
            console.error(e);
            alert('Error ending session');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/')} className="p-2 bg-white rounded-xl shadow-sm border hover:bg-slate-50"><ArrowLeft /></button>
                        <h1 className="text-3xl font-black text-slate-900">Admin Dashboard</h1>
                    </div>
                    <div className="flex gap-4">
                        {isAdmin && (
                            <button onClick={() => setShowCreateUser(!showCreateUser)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl transition-colors">
                                {showCreateUser ? 'Cancel' : 'Create User'}
                            </button>
                        )}
                        <button onClick={() => { logout(); navigate('/'); }} className="text-red-500 font-bold hover:bg-red-50 px-4 py-2 rounded-xl transition-colors">Logout</button>
                    </div>
                </div>

                {showCreateUser && (
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 mb-8 animate-in fade-in slide-in-from-top-4">
                        <h3 className="font-bold text-lg mb-4">Create New User</h3>
                        <form onSubmit={handleCreateUser} className="flex gap-4 items-end">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Username</label>
                                <input
                                    type="text"
                                    value={newUser.username}
                                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                    className="border rounded-lg px-3 py-2 w-48"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Password</label>
                                <input
                                    type="text"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    className="border rounded-lg px-3 py-2 w-48"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Role</label>
                                <select
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                    className="border rounded-lg px-3 py-2 w-32"
                                >
                                    <option value="USER">User</option>
                                    <option value="OPERATOR">Operator</option>
                                </select>
                            </div>
                            <button type="submit" className="bg-green-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-green-700">Save</button>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-500 uppercase tracking-wider text-sm mb-4">System Status</h3>
                        <div className="flex items-center gap-2 text-green-500 font-bold">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            Online
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-500 uppercase tracking-wider text-sm mb-4">Total Users</h3>
                        <p className="text-3xl font-black text-slate-900">{adminUsers.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-500 uppercase tracking-wider text-sm mb-4">Total Sessions</h3>
                        <p className="text-3xl font-black text-slate-900">{adminSessions.length}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Recent Sessions */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="font-bold text-lg text-slate-900">Recent Sessions</h3>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {adminSessions.map(session => (
                                <div key={session.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-slate-800">{session.name}</p>
                                        <p className="text-xs text-slate-400">{new Date(session.createdAt).toLocaleString()}</p>
                                    </div>
                                    <div className="text-right flex items-center gap-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${session.isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                            {session.isActive ? 'Active' : 'Ended'}
                                        </span>
                                        {session.isActive && (
                                            <button
                                                onClick={() => handleEndSession(session.name)}
                                                className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 font-bold"
                                            >
                                                End Game
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Users List */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="font-bold text-lg text-slate-900">Registered Users</h3>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {adminUsers.map(u => (
                                <div key={u.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">
                                            {u.username[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{u.username}</p>
                                            <p className="text-xs text-slate-400">{u.role}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
