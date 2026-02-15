import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Construction, Clock, Heart, Sparkles, Wrench } from 'lucide-react';

const Rummy = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate('/')}
                            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                                <Heart size={20} className="text-white" />
                            </div>
                            <h1 className="text-xl font-black text-white">Funny Friends</h1>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-6 py-20">
                <div className="text-center">
                    {/* Construction Icon */}
                    <div className="relative inline-block mb-8">
                        <div className="w-32 h-32 bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-500/30 mx-auto">
                            <Wrench size={56} className="text-white" />
                        </div>
                        <div className="absolute -top-2 -right-2 w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center animate-pulse">
                            <Construction size={20} className="text-white" />
                        </div>
                    </div>

                    <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
                        Rummy is <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">Coming Soon!</span>
                    </h2>

                    <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12">
                        We're working hard to bring you an amazing Rummy experience. 
                        Stay tuned for updates!
                    </p>

                    {/* Feature Preview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-12">
                        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">♦</span>
                            </div>
                            <h3 className="font-bold text-white mb-2">Classic Rummy</h3>
                            <p className="text-slate-400 text-sm">Form sets and sequences</p>
                        </div>

                        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <Clock size={24} className="text-orange-400" />
                            </div>
                            <h3 className="font-bold text-white mb-2">Fast Games</h3>
                            <p className="text-slate-400 text-sm">20-40 minutes per game</p>
                        </div>

                        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <Sparkles size={24} className="text-orange-400" />
                            </div>
                            <h3 className="font-bold text-white mb-2">Multiplayer</h3>
                            <p className="text-slate-400 text-sm">2-6 players supported</p>
                        </div>
                    </div>

                    {/* Back Button */}
                    <button
                        onClick={() => navigate('/')}
                        className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all"
                    >
                        Back to Games
                    </button>

                    {/* Notification */}
                    <div className="mt-12 text-center">
                        <p className="text-slate-500">
                            Want to be notified when Rummy is ready? 
                            <span className="text-orange-400 font-medium"> Coming in the next update!</span>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Rummy;
