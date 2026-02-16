import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Users, Trash2, Play, Settings, AlertCircle, CheckCircle2, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

const SessionSetup = () => {
    const navigate = useNavigate();
    const { socket, logout, user } = useAuth();
    const [sessionName, setSessionName] = useState('');
    const [totalRounds, setTotalRounds] = useState(10);
    const [players, setPlayers] = useState([]);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);

    const addPlayer = () => {
        if (!newPlayerName.trim()) return;
        if (players.length >= 17) {
            setError('Maximum 17 players allowed');
            return;
        }
        
        const newPlayer = {
            id: Date.now(),
            name: newPlayerName.trim(),
            seat: players.length + 1
        };
        setPlayers([...players, newPlayer]);
        setNewPlayerName('');
        setError('');
    };

    const removePlayer = (id) => {
        const updatedPlayers = players.filter(p => p.id !== id);
        // Reassign seats
        const reseatedPlayers = updatedPlayers.map((p, idx) => ({
            ...p,
            seat: idx + 1
        }));
        setPlayers(reseatedPlayers);
    };

    const createSession = async () => {
        setError('');
        
        if (!sessionName.trim()) {
            setError('Please enter a session name');
            return;
        }
        if (players.length < 2) {
            setError('Need at least 2 players to start');
            return;
        }

        setCreating(true);

        try {
            const res = await fetch(`${API_URL}/api/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: sessionName, 
                    totalRounds: parseInt(totalRounds), 
                    players: players.map(p => ({ userId: null, seat: p.seat, name: p.name }))
                }),
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                socket.emit('join_session', { sessionName, role: 'OPERATOR' });
                navigate(`/game/${sessionName}`);
            } else {
                setError(data.error || 'Failed to create session');
                setCreating(false);
            }
        } catch (e) {
            setError('Failed to create session');
            setCreating(false);
        }
    };

    const getPlayerColor = (index) => {
        const colors = [
            'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
            'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500',
            'bg-teal-500', 'bg-cyan-500', 'bg-lime-500', 'bg-emerald-500',
            'bg-violet-500', 'bg-fuchsia-500', 'bg-rose-500', 'bg-amber-500',
            'bg-sky-500'
        ];
        return colors[index % colors.length];
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => user?.role === 'ADMIN' ? navigate('/admin') : navigate('/operator-dashboard')} 
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <ArrowLeft className="text-slate-600" size={24} />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center">
                                    <Crown className="text-white" size={20} />
                                </div>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">Create New Game</h1>
                                    <p className="text-sm text-slate-500">Setup your Teen Patti session</p>
                                </div>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => { logout(); navigate('/'); }}
                            className="flex items-center gap-2 px-4 py-2 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* Left Column - Setup Form */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Game Settings Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Settings size={20} className="text-blue-500" />
                                Game Settings
                            </h2>
                            
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Session Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        value={sessionName}
                                        onChange={(e) => setSessionName(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 focus:border-blue-500 outline-none transition-all"
                                        placeholder="e.g. Friday Night Poker"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Total Rounds
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="number"
                                            value={totalRounds}
                                            onChange={(e) => setTotalRounds(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                                            className="w-32 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 focus:border-blue-500 outline-none transition-all text-center"
                                            min="1"
                                            max="50"
                                        />
                                        <div className="flex gap-2">
                                            {[5, 10, 20].map(num => (
                                                <button
                                                    key={num}
                                                    onClick={() => setTotalRounds(num)}
                                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                                                        totalRounds === num 
                                                            ? 'bg-blue-600 text-white' 
                                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Players Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Users size={20} className="text-blue-500" />
                                    Players
                                </h2>
                                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                                    players.length < 2 
                                        ? 'bg-red-100 text-red-600' 
                                        : players.length >= 17 
                                            ? 'bg-yellow-100 text-yellow-600'
                                            : 'bg-green-100 text-green-600'
                                }`}>
                                    {players.length} / 17
                                </span>
                            </div>

                            {/* Add Player */}
                            <div className="flex gap-3 mb-6">
                                <div className="flex-1 relative">
                                    <input
                                        value={newPlayerName}
                                        onChange={(e) => setNewPlayerName(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 focus:border-blue-500 outline-none transition-all"
                                        placeholder="Enter player name..."
                                        disabled={players.length >= 17}
                                    />
                                </div>
                                <button
                                    onClick={addPlayer}
                                    disabled={!newPlayerName.trim() || players.length >= 8}
                                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <UserPlus size={20} />
                                    Add
                                </button>
                            </div>

                            {/* Players List */}
                            <div className="space-y-2">
                                {players.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                        <Users size={48} className="mx-auto mb-3 text-slate-300" />
                                        <p className="text-slate-500 font-medium">No players added yet</p>
                                        <p className="text-sm text-slate-400">Add at least 2 players to start</p>
                                    </div>
                                ) : (
                                    players.map((player, index) => (
                                        <div 
                                            key={player.id} 
                                            className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors"
                                        >
                                            <div className={`w-10 h-10 ${getPlayerColor(index)} text-white rounded-full flex items-center justify-center font-bold shadow-md`}>
                                                {player.name[0].toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-slate-900">{player.name}</p>
                                                <p className="text-xs text-slate-500">Seat {player.seat}</p>
                                            </div>
                                            <button
                                                onClick={() => removePlayer(player.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Summary */}
                    <div className="lg:col-span-2">
                        <div className="sticky top-24 space-y-6">
                            {/* Summary Card */}
                            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20">
                                <h3 className="font-bold text-lg mb-6">Game Summary</h3>
                                
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-blue-100">Session Name</span>
                                        <span className="font-bold">{sessionName || '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-blue-100">Total Rounds</span>
                                        <span className="font-bold">{totalRounds}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-blue-100">Players</span>
                                        <span className={`font-bold ${players.length < 2 ? 'text-red-300' : 'text-green-300'}`}>
                                            {players.length}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-6 pt-6 border-t border-white/20">
                                    <div className="flex items-center gap-2 text-sm text-blue-100">
                                        <AlertCircle size={16} />
                                        <span>Need at least 2 players</span>
                                    </div>
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                                    <AlertCircle className="text-red-500 shrink-0" size={20} />
                                    <p className="text-red-600 font-medium text-sm">{error}</p>
                                </div>
                            )}

                            {/* Success Message */}
                            {players.length >= 2 && !error && (
                                <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                                    <CheckCircle2 className="text-green-500 shrink-0" size={20} />
                                    <p className="text-green-600 font-medium text-sm">Ready to create game!</p>
                                </div>
                            )}

                            {/* Create Button */}
                            <button
                                onClick={createSession}
                                disabled={players.length < 2 || creating}
                                className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-500/30 transition-all flex items-center justify-center gap-2 disabled:shadow-none"
                            >
                                {creating ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Play size={20} fill="white" />
                                        Create & Start Game
                                    </>
                                )}
                            </button>

                            <button 
                                onClick={() => user?.role === 'ADMIN' ? navigate('/admin') : navigate('/operator-dashboard')} 
                                className="w-full py-3 text-slate-500 font-bold hover:text-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SessionSetup;
