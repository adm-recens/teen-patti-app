import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [adminSessions, setAdminSessions] = useState([]);
    const [adminUsers, setAdminUsers] = useState([]);

    useEffect(() => {
        fetch(`${API_URL}/api/admin/sessions`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => setAdminSessions(data));

        fetch(`${API_URL}/api/admin/users`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => setAdminUsers(data));
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/')} className="p-2 bg-white rounded-xl shadow-sm border hover:bg-slate-50"><ArrowLeft /></button>
                        <h1 className="text-3xl font-black text-slate-900">Admin Dashboard</h1>
                    </div>
                    <button onClick={() => { logout(); navigate('/'); }} className="text-red-500 font-bold hover:bg-red-50 px-4 py-2 rounded-xl transition-colors">Logout</button>
                </div>

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
                                    <div className="text-right">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${session.isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                            {session.isActive ? 'Active' : 'Ended'}
                                        </span>
                                        <p className="text-xs text-slate-400 mt-1">{session._count?.hands || 0} Hands</p>
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
