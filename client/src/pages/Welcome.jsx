import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowRight, Play, User, History, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import DebugFooter from '../components/DebugFooter';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const Welcome = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeGames, setActiveGames] = useState([]);

    useEffect(() => {
        fetch(`${API_URL}/api/sessions/active`)
            .then(res => res.json())
            .then(data => setActiveGames(data))
            .catch(err => console.error("Failed to fetch active games", err));
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8 pb-12">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-12">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-gold-400 to-gold-600 rounded-xl rotate-3 flex items-center justify-center shadow-lg shadow-gold-500/20">
                            <Trophy size={24} className="text-white -rotate-3" />
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight">
                            Teen <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-200">Patti</span> <span className="text-xs text-slate-500 ml-2">v2.0</span>
                        </h1>
                    </div>
                    {/* Admin Entry Point */}
                    {user?.username === 'ram54' && (
                        <button onClick={() => navigate('/admin')} className="text-slate-500 hover:text-white transition-colors">
                            <Settings />
                        </button>
                    )}
                    {/* Login Button if not logged in */}
                    {!user && (
                        <button
                            onClick={() => navigate('/login')}
                            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
                        >
                            Login / Start Game
                        </button>
                    )}
                </div>

                {/* Hero Section */}
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
                        Live Games
                    </h2>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        Join an active table or start your own session.
                    </p>
                </div>

                {/* Grid View */}
                {activeGames.length === 0 ? (
                    <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Play size={32} className="text-slate-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">No Active Games</h3>
                        <p className="text-slate-400 mb-8">There are no games running right now.</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold text-lg shadow-xl shadow-blue-500/20 hover:scale-105 transition-all"
                        >
                            Start a New Game
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeGames.map((game) => (
                            <div
                                key={game.name}
                                onClick={() => navigate(`/game/${game.name}`)}
                                className="group bg-slate-800/50 hover:bg-slate-800 border border-white/10 hover:border-blue-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                        <Trophy size={24} />
                                    </div>
                                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full flex items-center gap-1">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        LIVE
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">{game.name}</h3>
                                <div className="flex items-center gap-4 text-slate-400 text-sm">
                                    <span className="flex items-center gap-1"><User size={14} /> {game.playerCount} Players</span>
                                    <span className="flex items-center gap-1"><History size={14} /> Round {game.currentRound}/{game.totalRounds}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <DebugFooter />
        </div>
    );
};

export default Welcome;
