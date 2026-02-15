import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Users, Eye, Shield, LogOut, Heart, Gamepad2, Clock, ArrowRight, Wrench, Construction } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

const Welcome = () => {
    const navigate = useNavigate();
    const { user, logout, login } = useAuth();
    const [selectedGame, setSelectedGame] = useState(null);
    const [viewMode, setViewMode] = useState(null);
    
    // Login states
    const [operatorCredentials, setOperatorCredentials] = useState({ username: '', password: '' });
    const [operatorError, setOperatorError] = useState('');
    const [operatorLoading, setOperatorLoading] = useState(false);
    
    const [viewerCredentials, setViewerCredentials] = useState({ name: '', sessionName: '' });
    const [viewerError, setViewerError] = useState('');
    const [viewerLoading, setViewerLoading] = useState(false);

    // Available games configuration
    const games = [
        {
            id: 'teen-patti',
            name: 'Teen Patti',
            description: 'The classic Indian card game. Bet, bluff, and win!',
            icon: '♠',
            color: 'from-purple-600 to-pink-600',
            status: 'available',
            players: '2-17 players',
            duration: '15-30 min'
        },
        {
            id: 'rummy',
            name: 'Rummy',
            description: 'Form sets and sequences. Coming soon!',
            icon: '♦',
            color: 'from-orange-500 to-red-500',
            status: 'coming-soon',
            players: '2-6 players',
            duration: '20-40 min'
        }
    ];

    const handleOperatorLogin = async (e) => {
        e.preventDefault();
        setOperatorError('');
        setOperatorLoading(true);
        
        try {
            const result = await login(operatorCredentials.username, operatorCredentials.password);
            if (result.success) {
                if (result.user.role === 'OPERATOR' || result.user.role === 'ADMIN') {
                    navigate('/setup');
                } else {
                    setOperatorError('You do not have operator access');
                }
            } else {
                setOperatorError(result.error || 'Login failed');
            }
        } catch (e) {
            setOperatorError('Error logging in');
        } finally {
            setOperatorLoading(false);
        }
    };

    const handleViewerJoin = async (e) => {
        e.preventDefault();
        setViewerError('');
        setViewerLoading(true);
        
        try {
            const res = await fetch(`${API_URL}/api/sessions/active`);
            const activeSessions = await res.json();
            
            const session = activeSessions.find(s => s.name.toLowerCase() === viewerCredentials.sessionName.toLowerCase());
            
            if (!session) {
                setViewerError('Game session not found or has ended');
                setViewerLoading(false);
                return;
            }
            
            navigate(`/viewer/${viewerCredentials.sessionName}`, {
                state: { viewerName: viewerCredentials.name }
            });
        } catch (e) {
            setViewerError('Error connecting to server');
        } finally {
            setViewerLoading(false);
        }
    };

    const handleGameSelect = (gameId) => {
        if (gameId === 'rummy') {
            navigate('/rummy');
        } else {
            setSelectedGame(gameId);
        }
    };

    if (selectedGame === 'teen-patti') {
        if (viewMode === 'operator') {
            return (
                <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900 via-slate-900 to-black opacity-60"></div>
                    
                    <div className="relative z-10 bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
                                <Users className="text-white" size={32} />
                            </div>
                            <h1 className="text-2xl font-black text-slate-900">Operator Login</h1>
                            <p className="text-slate-500 mt-2">Login to create and manage Teen Patti games</p>
                        </div>
                        
                        <form onSubmit={handleOperatorLogin} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Username</label>
                                <input
                                    type="text"
                                    value={operatorCredentials.username}
                                    onChange={(e) => setOperatorCredentials({ ...operatorCredentials, username: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-900 focus:border-purple-500 outline-none transition-all"
                                    placeholder="Enter username"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
                                <input
                                    type="password"
                                    value={operatorCredentials.password}
                                    onChange={(e) => setOperatorCredentials({ ...operatorCredentials, password: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-900 focus:border-purple-500 outline-none transition-all"
                                    placeholder="Enter password"
                                    required
                                />
                            </div>
                            
                            {operatorError && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                                    {operatorError}
                                </div>
                            )}
                            
                            <button
                                type="submit"
                                disabled={operatorLoading}
                                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50"
                            >
                                {operatorLoading ? 'Logging in...' : 'Login as Operator'}
                            </button>
                            
                            <button
                                type="button"
                                onClick={() => setViewMode(null)}
                                className="w-full py-3 text-slate-400 font-bold hover:text-slate-600"
                            >
                                Back
                            </button>
                        </form>
                    </div>
                </div>
            );
        }

        if (viewMode === 'viewer') {
            return (
                <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900 via-slate-900 to-black opacity-60"></div>
                    
                    <div className="relative z-10 bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
                                <Eye className="text-white" size={32} />
                            </div>
                            <h1 className="text-2xl font-black text-slate-900">Watch Teen Patti</h1>
                            <p className="text-slate-500 mt-2">Enter your details to watch a live game</p>
                        </div>
                        
                        <form onSubmit={handleViewerJoin} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Your Name</label>
                                <input
                                    type="text"
                                    value={viewerCredentials.name}
                                    onChange={(e) => setViewerCredentials({ ...viewerCredentials, name: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="Enter your name"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Game Name</label>
                                <input
                                    type="text"
                                    value={viewerCredentials.sessionName}
                                    onChange={(e) => setViewerCredentials({ ...viewerCredentials, sessionName: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="Enter game name"
                                    required
                                />
                            </div>
                            
                            {viewerError && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                                    {viewerError}
                                </div>
                            )}
                            
                            <button
                                type="submit"
                                disabled={viewerLoading}
                                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-50"
                            >
                                {viewerLoading ? 'Connecting...' : 'Watch Game'}
                            </button>
                            
                            <button
                                type="button"
                                onClick={() => setViewMode(null)}
                                className="w-full py-3 text-slate-400 font-bold hover:text-slate-600"
                            >
                                Back
                            </button>
                        </form>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900 via-slate-900 to-black opacity-60"></div>
                
                <div className="relative z-10 max-w-2xl w-full">
                    <button 
                        onClick={() => setSelectedGame(null)}
                        className="mb-6 text-white/70 hover:text-white flex items-center gap-2 transition-colors"
                    >
                        ← Back to Games
                    </button>
                    
                    <div className="bg-white rounded-3xl shadow-2xl p-8">
                        <div className="text-center mb-8">
                            <div className="text-6xl mb-4">♠</div>
                            <h1 className="text-3xl font-black text-slate-900 mb-2">Teen Patti</h1>
                            <p className="text-slate-500">Choose how you want to join the game</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button 
                                onClick={() => setViewMode('operator')}
                                className="group p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl hover:border-purple-400 transition-all text-left"
                            >
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl mb-4 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <Users className="text-white" size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Operator</h3>
                                <p className="text-slate-500 text-sm">Create and manage game sessions</p>
                            </button>
                            
                            <button 
                                onClick={() => setViewMode('viewer')}
                                className="group p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl hover:border-emerald-400 transition-all text-left"
                            >
                                <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl mb-4 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <Eye className="text-white" size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Viewer</h3>
                                <p className="text-slate-500 text-sm">Watch live games in real-time</p>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                                <Heart size={28} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight">
                                    Funny <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Friends</span>
                                </h1>
                                <p className="text-sm text-slate-400">Play games with friends, securely and for fun!</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/login')}
                                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
                            >
                                <Shield size={18} />
                                Admin Login
                            </button>
                            
                            {user && (
                                <button
                                    onClick={() => navigate('/logout')}
                                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold rounded-xl transition-all text-sm"
                                >
                                    Logout
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-12">
                {/* Hero Section */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-full mb-6">
                        <Sparkles size={16} className="text-purple-400" />
                        <span className="text-purple-300 text-sm font-medium">Play Games with Friends</span>
                    </div>
                    <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
                        Choose Your Game
                    </h2>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        Select a game to start playing with your friends. 
                        More games coming soon!
                    </p>
                </div>

                {/* Games Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {games.map((game) => (
                        <div
                            key={game.id}
                            onClick={() => handleGameSelect(game.id)}
                            className={`group relative overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-2 cursor-pointer ${
                                game.status === 'coming-soon' ? 'opacity-75' : ''
                            }`}
                        >
                            {/* Background Gradient */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
                            
                            {/* Card Content */}
                            <div className="relative bg-slate-800/50 backdrop-blur border border-white/10 rounded-3xl p-8 h-full">
                                {/* Status Badge */}
                                {game.status === 'coming-soon' && (
                                    <div className="absolute top-4 right-4 px-3 py-1 bg-orange-500/20 text-orange-400 text-xs font-bold rounded-full flex items-center gap-1">
                                        <Construction size={12} />
                                        Coming Soon
                                    </div>
                                )}
                                
                                {/* Game Icon */}
                                <div className={`w-20 h-20 bg-gradient-to-br ${game.color} rounded-2xl mb-6 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300`}>
                                    <span className="text-4xl text-white">{game.icon}</span>
                                </div>
                                
                                {/* Game Info */}
                                <h3 className="text-3xl font-black text-white mb-3">{game.name}</h3>
                                <p className="text-slate-400 mb-6">{game.description}</p>
                                
                                {/* Game Stats */}
                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <Users size={14} /> {game.players}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock size={14} /> {game.duration}
                                    </span>
                                </div>
                                
                                {/* Action Button */}
                                <div className="mt-6 pt-6 border-t border-white/10">
                                    {game.status === 'available' ? (
                                        <button className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 group-hover:gap-3">
                                            Play Now <ArrowRight size={18} />
                                        </button>
                                    ) : (
                                        <button disabled className="w-full py-3 bg-white/5 text-white/50 font-bold rounded-xl cursor-not-allowed flex items-center justify-center gap-2">
                                            <Wrench size={18} /> Under Development
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* More Games Coming */}
                <div className="mt-16 text-center">
                    <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/5 rounded-2xl border border-white/10">
                        <Construction size={20} className="text-purple-400" />
                        <span className="text-slate-400">More games coming soon!</span>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Welcome;
