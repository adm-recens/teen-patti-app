import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Users, Eye, Shield, Heart, Gamepad2, Clock, ArrowRight, Construction, HelpCircle, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

const Welcome = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [selectedGame, setSelectedGame] = useState(null);
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch available games
    useEffect(() => {
        fetch(`${API_URL}/api/v2/games`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setGames(data.games);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // Redirect logged-in users to their dashboard
    useEffect(() => {
        if (user) {
            if (user.role === 'ADMIN') {
                navigate('/admin');
            } else if (user.role === 'OPERATOR') {
                navigate('/dashboard');
            } else if (user.role === 'PLAYER') {
                navigate('/player');
            }
        }
    }, [user, navigate]);

    const handleGameSelect = (game) => {
        if (game.status === 'coming-soon') return;
        
        if (user) {
            // User is logged in, check permissions
            if (user.role === 'ADMIN' || user.role === 'OPERATOR') {
                navigate(`/setup?game=${game.code}`);
            } else {
                // For players/viewers, show join dialog
                setSelectedGame(game);
            }
        } else {
            // Guest - show options
            setSelectedGame(game);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-white text-center">
                    <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Loading games...</p>
                </div>
            </div>
        );
    }

    if (selectedGame) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900 via-slate-900 to-black opacity-60"></div>
                
                <div className="relative z-10 max-w-lg w-full">
                    <button 
                        onClick={() => setSelectedGame(null)}
                        className="mb-6 text-white/70 hover:text-white flex items-center gap-2 transition-colors"
                    >
                        <ArrowRight className="rotate-180" size={20} />
                        Back to Games
                    </button>

                    <div className="bg-white rounded-3xl shadow-2xl p-8">
                        <div className="text-center mb-8">
                            <div className={`w-20 h-20 bg-gradient-to-br ${selectedGame.color} rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl`}>
                                <span className="text-4xl">{selectedGame.icon}</span>
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 mb-2">{selectedGame.name}</h1>
                            <p className="text-slate-500">{selectedGame.description}</p>
                        </div>

                        <div className="space-y-4">
                            {user?.role === 'ADMIN' || user?.role === 'OPERATOR' ? (
                                <button
                                    onClick={() => navigate(`/setup?game=${selectedGame.code}`)}
                                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                                >
                                    <Gamepad2 size={20} />
                                    Create New Session
                                </button>
                            ) : null}
                            
                            <button
                                onClick={() => navigate(`/viewer?game=${selectedGame.code}`)}
                                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                                <Eye size={20} />
                                Watch Live Games
                            </button>

                            {!user && (
                                <button
                                    onClick={() => navigate('/login')}
                                    className="w-full py-4 bg-slate-100 text-slate-700 rounded-xl font-bold text-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <Shield size={20} />
                                    Sign In to Play
                                </button>
                            )}
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
                                onClick={() => navigate('/help')}
                                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
                            >
                                <HelpCircle size={18} />
                                Help
                            </button>
                            <button
                                onClick={() => navigate('/login')}
                                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/20"
                            >
                                <Shield size={18} />
                                Sign In
                            </button>
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
                        <span className="text-purple-300 text-sm font-medium">Choose Your Game</span>
                    </div>
                    <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
                        Let's Play!
                    </h2>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        Select a game to start playing with your friends.
                        Sign in to create and manage game sessions.
                    </p>
                </div>

                {/* Games Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {games.map((game) => (
                        <div
                            key={game.code}
                            onClick={() => handleGameSelect(game)}
                            className={`group relative overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-2 cursor-pointer ${
                                game.status === 'coming-soon' ? 'opacity-60 cursor-not-allowed' : ''
                            }`}
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
                            
                            <div className="relative bg-slate-800/50 backdrop-blur border border-white/10 rounded-3xl p-8 h-full flex flex-col">
                                {game.status === 'coming-soon' && (
                                    <div className="absolute top-4 right-4 px-3 py-1 bg-orange-500/20 text-orange-400 text-xs font-bold rounded-full flex items-center gap-1">
                                        <Construction size={12} />
                                        Coming Soon
                                    </div>
                                )}
                                
                                <div className={`w-20 h-20 bg-gradient-to-br ${game.color} rounded-2xl mb-6 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300`}>
                                    <span className="text-4xl text-white">{game.icon}</span>
                                </div>
                                
                                <h3 className="text-2xl font-black text-white mb-3">{game.name}</h3>
                                <p className="text-slate-400 mb-6 flex-grow">{game.description}</p>
                                
                                <div className="flex items-center gap-4 text-sm text-slate-500 mb-6">
                                    <span className="flex items-center gap-1">
                                        <Users size={14} /> {game.minPlayers}-{game.maxPlayers} players
                                    </span>
                                </div>
                                
                                <div className="pt-6 border-t border-white/10">
                                    {game.status === 'active' ? (
                                        <button className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 group-hover:gap-3">
                                            {user ? (
                                                <><Play size={18} /> Play Now</>
                                            ) : (
                                                <><Eye size={18} /> Watch / Join</>
                                            )}
                                            <ArrowRight size={18} />
                                        </button>
                                    ) : (
                                        <button disabled className="w-full py-3 bg-white/5 text-white/50 font-bold rounded-xl cursor-not-allowed flex items-center justify-center gap-2">
                                            <Construction size={18} /> Coming Soon
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA Section */}
                {!user && (
                    <div className="mt-16 text-center">
                        <div className="inline-flex flex-col items-center gap-4 p-8 bg-white/5 rounded-3xl border border-white/10">
                            <p className="text-slate-400">Want to create your own game sessions?</p>
                            <button
                                onClick={() => navigate('/login')}
                                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transition-all flex items-center gap-2"
                            >
                                <Shield size={20} />
                                Sign In as Operator
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Welcome;
