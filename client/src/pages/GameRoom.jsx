import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, Trophy, Play, Plus, Trash2, ShieldAlert, X, Edit3, BarChart3, History, LogOut, HelpCircle, Check, User, Gavel } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const GameRoom = () => {
    const { sessionName } = useParams();
    const navigate = useNavigate();
    const { user, socket, logout } = useAuth();

    // Local State
    const [viewerName, setViewerName] = useState('');
    const [accessStatus, setAccessStatus] = useState('IDLE'); // IDLE, PENDING, GRANTED, DENIED

    // Game State
    const [players, setPlayers] = useState([
        { id: 1, name: '', sessionBalance: 0 },
        { id: 2, name: '', sessionBalance: 0 }
    ]);
    const [gamePlayers, setGamePlayers] = useState([]);
    const [currentRound, setCurrentRound] = useState(1);
    const [totalRounds, setTotalRounds] = useState(10);
    const [pot, setPot] = useState(0);
    const [currentStake, setCurrentStake] = useState(20);
    const [activePlayerIndex, setActivePlayerIndex] = useState(0);
    const [currentLogs, setCurrentLogs] = useState([]);
    const [viewerRequests, setViewerRequests] = useState([]);

    // Modals
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [sideShowData, setSideShowData] = useState({ requester: null, target: null });
    const [forceShowData, setForceShowData] = useState({ activePlayer: null, opponents: [] });
    const [view, setView] = useState('GAME'); // Sub-views: GAME, SIDESHOW_SELECT, etc.

    // --- SOCKET & SYNC ---
    useEffect(() => {
        if (!socket.connected) socket.connect();

        if (user?.role === 'OPERATOR') {
            socket.emit('join_session', { sessionName, role: 'OPERATOR' });
        } else {
            // Viewer logic handled in Request Access UI
        }

        socket.on('game_update', (serverState) => {
            if (serverState) {
                if (serverState.type === 'HAND_COMPLETE') {
                    // Handled separately
                } else {
                    restoreState(serverState);
                }
            }
        });

        socket.on('viewer_requested', (request) => {
            if (user?.role === 'OPERATOR') {
                setViewerRequests(prev => {
                    if (prev.find(r => r.socketId === request.socketId)) return prev;
                    return [...prev, request];
                });
            }
        });

        socket.on('access_granted', (initialState) => {
            setAccessStatus('GRANTED');
            if (initialState) restoreState(initialState);
        });

        socket.on('access_denied', () => {
            setAccessStatus('DENIED');
        });

        socket.on('session_ended', ({ reason }) => {
            alert(`Session Ended: ${reason}`);
            navigate('/');
        });

        return () => {
            socket.off('game_update');
            socket.off('viewer_requested');
            socket.off('access_granted');
            socket.off('access_denied');
            socket.off('session_ended');
        };
    }, [user, sessionName, socket, navigate]);

    // Sync state (Operator only)
    useEffect(() => {
        if (user?.role === 'OPERATOR' && gamePlayers.length > 0) {
            const currentState = {
                players,
                currentRound,
                totalRounds,
                gamePlayers,
                pot,
                currentStake,
                activePlayerIndex,
                currentLogs,
                sessionName
            };
            socket.emit('sync_state', { sessionName, state: currentState });
        }
    }, [players, currentRound, totalRounds, gamePlayers, pot, currentStake, activePlayerIndex, currentLogs, user, sessionName, socket]);

    const restoreState = (state) => {
        setPlayers(state.players || []);
        setCurrentRound(state.currentRound || 1);
        setTotalRounds(state.totalRounds || 10);
        setGamePlayers(state.gamePlayers || []);
        setPot(state.pot || 0);
        setCurrentStake(state.currentStake || 20);
        setActivePlayerIndex(state.activePlayerIndex !== undefined ? state.activePlayerIndex : 0);
        setCurrentLogs(state.currentLogs || []);
    };

    // --- ACTIONS ---
    const requestAccess = () => {
        if (!viewerName.trim()) return;
        setAccessStatus('PENDING');
        socket.emit('request_access', { sessionName, name: viewerName });
    };

    const resolveViewerRequest = (socketId, approved) => {
        socket.emit('resolve_access', { sessionName, viewerId: socketId, approved });
        setViewerRequests(prev => prev.filter(r => r.socketId !== socketId));
    };

    const closeSession = () => {
        if (confirm("Are you sure you want to close this session?")) {
            socket.emit('end_session', { sessionName });
            navigate('/');
        }
    };

    const startGame = () => {
        const validPlayers = players.filter(p => p.name.trim() !== '');
        if (validPlayers.length < 2) return alert("Need at least 2 players.");

        const initialGamePlayers = validPlayers.map(p => ({
            ...p,
            status: 'BLIND',
            folded: false,
            invested: 5,
        }));

        setGamePlayers(initialGamePlayers);
        setPot(initialGamePlayers.length * 5);
        setCurrentStake(20);
        setActivePlayerIndex(0);
        setCurrentLogs([]);
    };

    // --- GAME LOGIC HELPERS (Simplified for brevity, copy full logic from App.jsx) ---
    const getNextActiveIndex = (startIndex, playerList = gamePlayers) => {
        let nextIndex = (startIndex + 1) % playerList.length;
        let loopCount = 0;
        while (playerList[nextIndex].folded && loopCount < playerList.length) {
            nextIndex = (nextIndex + 1) % playerList.length;
            loopCount++;
        }
        return nextIndex;
    };

    const handleSeeCards = () => {
        const newPlayers = [...gamePlayers];
        newPlayers[activePlayerIndex].status = 'SEEN';
        setGamePlayers(newPlayers);
    };

    const handleFold = () => {
        const newPlayers = [...gamePlayers];
        newPlayers[activePlayerIndex].folded = true;
        const remaining = newPlayers.filter(p => !p.folded);
        if (remaining.length === 1) {
            setGamePlayers(newPlayers);
            endGame(remaining[0], newPlayers);
        } else {
            setGamePlayers(newPlayers);
            setActivePlayerIndex(getNextActiveIndex(activePlayerIndex, newPlayers));
        }
    };

    const handleBet = (amountOverride = null, isDouble = false) => {
        const player = gamePlayers[activePlayerIndex];
        let newStakeValue = currentStake;
        if (amountOverride) {
            if (amountOverride > currentStake) newStakeValue = parseInt(amountOverride);
        } else if (isDouble) {
            newStakeValue = currentStake * 2;
        }
        let costToPay = (player.status === 'BLIND') ? newStakeValue / 2 : newStakeValue;

        const newPlayers = [...gamePlayers];
        newPlayers[activePlayerIndex].invested += costToPay;
        setGamePlayers(newPlayers);
        setPot(prev => prev + costToPay);
        setCurrentStake(newStakeValue);
        setActivePlayerIndex(getNextActiveIndex(activePlayerIndex));
    };

    const endGame = async (winner, finalGamePlayersState) => {
        // Logic to save hand to server
        const netChanges = {};
        const updatedMasterList = players.map(p => {
            const gameP = finalGamePlayersState.find(gp => gp.id === p.id);
            if (!gameP) { netChanges[p.id] = 0; return p; }
            let balanceChange = (gameP.id === winner.id) ? pot - gameP.invested : -gameP.invested;
            netChanges[p.id] = balanceChange;
            return { ...p, sessionBalance: p.sessionBalance + balanceChange };
        });

        try {
            await fetch(`${API_URL}/api/games/hand`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    winner,
                    pot,
                    logs: currentLogs,
                    netChanges,
                    sessionName
                })
            });
            // Increment round locally for immediate feedback, server sync will confirm
            setCurrentRound(prev => prev + 1);
        } catch (e) { console.error(e); }

        setPlayers(updatedMasterList);
        setGamePlayers([]); // Reset for next round
    };

    // --- RENDER ---

    // 1. Viewer Request View
    if (user?.role === 'VIEWER' && accessStatus !== 'GRANTED') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl relative">
                    <div className="text-center mb-8">
                        <Eye size={48} className="text-blue-400 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white">Request Access</h2>
                        <p className="text-slate-400 text-sm mt-2">Join {sessionName}</p>
                    </div>

                    {accessStatus === 'IDLE' && (
                        <div className="space-y-4">
                            <input
                                type="text"
                                value={viewerName}
                                onChange={(e) => setViewerName(e.target.value)}
                                placeholder="Your Name"
                                className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-500 focus:bg-slate-800 outline-none transition-all"
                            />
                            <button
                                onClick={requestAccess}
                                disabled={!viewerName.trim()}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Request Access
                            </button>
                            <button onClick={() => navigate('/')} className="w-full py-3 text-slate-400 hover:text-white text-sm font-bold">Cancel</button>
                        </div>
                    )}

                    {accessStatus === 'PENDING' && (
                        <div className="text-center space-y-6">
                            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                            <p className="text-white font-bold animate-pulse">Waiting for approval...</p>
                            <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white text-sm font-bold">Cancel Request</button>
                        </div>
                    )}

                    {accessStatus === 'DENIED' && (
                        <div className="text-center space-y-6">
                            <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto"><X size={32} /></div>
                            <div><h3 className="text-xl font-bold text-white mb-2">Access Denied</h3></div>
                            <button onClick={() => setAccessStatus('IDLE')} className="w-full py-3 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-600 transition-all">Try Again</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 2. Game Setup (Operator Only, No Active Game)
    if (gamePlayers.length === 0 && user?.role === 'OPERATOR') {
        return (
            <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
                <div className="max-w-xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Game Setup</h1>
                            <p className="text-slate-500 font-medium">Session: {sessionName} (Round {currentRound}/{totalRounds})</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={closeSession} className="p-3 bg-red-50 text-red-500 rounded-xl shadow-sm border border-red-100 hover:bg-red-100 transition-all"><LogOut size={24} /></button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 mb-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2"><User size={20} className="text-blue-500" /> Active Players</h2>
                        </div>
                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {players.map((p, idx) => (
                                <div key={p.id} className="group flex gap-3 items-center">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">{idx + 1}</div>
                                    <input
                                        value={p.name}
                                        onChange={(e) => { const newP = [...players]; newP[idx].name = e.target.value; setPlayers(newP); }}
                                        className="flex-1 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all placeholder:font-normal"
                                        placeholder={`Player ${idx + 1} Name`}
                                    />
                                    <button onClick={() => setPlayers(players.filter((_, i) => i !== idx))} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => { if (players.length < 17) setPlayers([...players, { id: Date.now(), name: '', sessionBalance: 0 }]) }} className="w-full mt-4 py-3 border-2 border-dashed border-slate-200 text-slate-400 rounded-xl flex justify-center items-center gap-2 font-bold text-sm hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all"><Plus size={18} /> Add New Seat</button>
                    </div>

                    <button onClick={startGame} className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 active:scale-[0.98] transition-all flex items-center justify-center gap-3"><Play size={24} fill="currentColor" /> Start Round {currentRound}</button>

                    {viewerRequests.length > 0 && (
                        <div className="mt-8 bg-white p-4 rounded-2xl border border-slate-100 shadow-lg">
                            <h3 className="font-bold text-slate-800 mb-3">Viewer Requests ({viewerRequests.length})</h3>
                            <div className="space-y-2">
                                {viewerRequests.map(req => (
                                    <div key={req.socketId} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                                        <span className="font-bold text-slate-700">{req.name}</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => resolveViewerRequest(req.socketId, true)} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"><Check size={16} /></button>
                                            <button onClick={() => resolveViewerRequest(req.socketId, false)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"><X size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 3. Active Game View
    const activePlayer = gamePlayers[activePlayerIndex];
    if (!activePlayer) return null;

    const isBlind = activePlayer.status === 'BLIND';
    const cost = isBlind ? currentStake / 2 : currentStake;
    const isViewer = user?.role === 'VIEWER';

    return (
        <div className="flex flex-col h-screen bg-slate-900 relative overflow-hidden">
            {/* Table Felt Background */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-poker-felt via-poker-green to-poker-green-dark opacity-100 z-0"></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-20 z-0 mix-blend-overlay"></div>

            {/* Header */}
            <div className="bg-slate-900/80 backdrop-blur-md text-white p-4 shadow-lg z-10 border-b border-white/5">
                <div className="flex justify-between items-start max-w-7xl mx-auto w-full">
                    <div>
                        <p className="text-gold-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                            {isViewer ? <span className="flex items-center gap-1 text-red-400 animate-pulse"><span className="w-2 h-2 bg-red-500 rounded-full"></span> LIVE VIEW </span> : ''}
                            {sessionName} • Round {currentRound}/{totalRounds}
                        </p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-slate-400 text-sm font-bold uppercase">Pot</span>
                            <p className="text-4xl font-black text-white tracking-tight">{pot}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => navigate('/')} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all text-slate-300 hover:text-white"><LogOut size={20} /></button>
                    </div>
                </div>
                <div className="mt-4 flex justify-between items-center bg-black/30 p-3 rounded-xl border border-white/5 max-w-7xl mx-auto">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Stake (Seen)</span>
                    <span className="font-mono text-xl font-bold text-gold-400">{currentStake}</span>
                </div>
            </div>

            {/* Game Area */}
            <div className="flex-1 overflow-y-auto p-4 z-10 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
                    {gamePlayers.map((p, idx) => {
                        const isActive = idx === activePlayerIndex;
                        return (
                            <div key={p.id} className={`relative group transition-all duration-300 ${isActive ? 'scale-105 z-20' : 'scale-100 z-10'} ${p.folded ? 'opacity-60 grayscale' : ''}`}>
                                <div className={`absolute inset-0 bg-gradient-to-br ${isActive ? 'from-gold-400 to-gold-600' : 'from-slate-700 to-slate-800'} rounded-2xl blur-sm opacity-50 transition-opacity`}></div>
                                <div className={`relative bg-slate-800 border-2 ${isActive ? 'border-gold-500 shadow-[0_0_30px_-5px_rgba(234,179,8,0.3)]' : 'border-slate-700'} rounded-2xl p-4 flex flex-col gap-3 transition-all`}>
                                    <div className="flex justify-between items-start">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-inner ${isActive ? 'bg-gold-500 text-slate-900' : 'bg-slate-700 text-slate-400'}`}>{idx + 1}</div>
                                        {!p.folded && <div className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${p.status === 'BLIND' ? 'bg-slate-700 text-slate-400' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>{p.status}</div>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-lg truncate flex items-center gap-2">{p.name} {p.folded && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">FOLD</span>}</div>
                                        <div className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-1"><div className="w-4 h-4 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center text-[8px] text-yellow-500">$</div>{p.invested}</div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Controls */}
            {isViewer ? (
                <div className="bg-slate-900 border-t border-white/10 p-6 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] z-20 text-center backdrop-blur-md">
                    <p className="font-bold text-slate-500 animate-pulse flex items-center justify-center gap-2"><span className="w-2 h-2 bg-slate-500 rounded-full"></span> Live Audience View</p>
                </div>
            ) : (
                <div className="bg-slate-900/95 border-t border-white/10 p-4 pb-8 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] z-20 backdrop-blur-xl">
                    <div className="max-w-3xl mx-auto">
                        <div className="flex justify-between items-center mb-4 px-2">
                            <div className="flex items-center gap-3">
                                <div className="relative"><span className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75"></span><span className="relative w-3 h-3 bg-green-500 rounded-full block"></span></div>
                                <span className="font-bold text-white text-lg">{activePlayer.name}'s Turn</span>
                            </div>
                            {isBlind && <button onClick={handleSeeCards} className="text-xs font-bold text-blue-400 border border-blue-500/30 bg-blue-500/10 px-4 py-2 rounded-full hover:bg-blue-500/20 transition-all flex items-center gap-2"><Eye size={14} /> See Cards</button>}
                        </div>

                        <div className="grid grid-cols-4 gap-3 h-28">
                            <button onClick={handleFold} disabled={isBlind} className={`flex flex-col items-center justify-center rounded-2xl border transition-all active:scale-95 ${isBlind ? 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed' : 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50'}`}><Trash2 size={24} className="mb-2" /><span className="text-xs font-black uppercase tracking-wider">Pack</span></button>
                            <button className="flex flex-col items-center justify-center rounded-2xl border bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed"><ShieldAlert size={24} className="mb-2" /><span className="text-xs font-black uppercase tracking-wider">Side Show</span></button>
                            <button onClick={() => handleBet(null, false)} className="col-span-2 bg-gradient-to-b from-blue-500 to-blue-700 text-white rounded-2xl flex flex-col items-center justify-center active:scale-95 transition-all shadow-lg shadow-blue-900/50 border-t border-blue-400 relative overflow-hidden group"><div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div><span className="text-3xl font-black tracking-tight relative z-10">{cost}</span><span className="text-[10px] font-bold opacity-80 tracking-[0.2em] uppercase relative z-10">Chaal</span></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <button onClick={() => handleBet(null, true)} className="py-4 bg-slate-800 text-green-400 border border-green-500/30 rounded-xl text-xs font-bold hover:bg-green-500/10 active:scale-95 transition-all uppercase tracking-wider">x2 Raise ({currentStake * 2})</button>
                            <button className="py-4 border rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed"><Edit3 size={14} className="inline mr-2 mb-0.5" /> Custom Bid</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameRoom;
