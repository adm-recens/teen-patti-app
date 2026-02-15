import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, LogOut, Play, Trash2, User, Check, X, ShieldAlert, Edit3, Plus, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

const GameRoom = () => {
    const { sessionName } = useParams();
    const navigate = useNavigate();
    const { user, socket, logout } = useAuth();
    const [connectionError, setConnectionError] = useState(null);

    // Local Presentation State
    const [viewerName, setViewerName] = useState('');
    const [accessStatus, setAccessStatus] = useState('IDLE'); // IDLE, PENDING, GRANTED, DENIED

    // Server Synced State
    const [players, setPlayers] = useState([]);
    const [gamePlayers, setGamePlayers] = useState([]);
    const [currentRound, setCurrentRound] = useState(1);
    const [totalRounds, setTotalRounds] = useState(10);
    const [pot, setPot] = useState(0);
    const [currentStake, setCurrentStake] = useState(20);
    const [activePlayerIndex, setActivePlayerIndex] = useState(0);
    const [currentLogs, setCurrentLogs] = useState([]);
    const [phase, setPhase] = useState('SETUP'); // SETUP, ACTIVE, SHOWDOWN
    const [sideShowRequest, setSideShowRequest] = useState(null); // From Server
    const [showRequest, setShowRequest] = useState(null); // For Force Show
    const [showShowSelection, setShowShowSelection] = useState(false);
    const [showShowResult, setShowShowResult] = useState(null); // For operator to select winner

    // Modals & summaries
    const [roundSummaryData, setRoundSummaryData] = useState(null);
    const [sessionSummaryData, setSessionSummaryData] = useState(null);
    const [showRoundSummary, setShowRoundSummary] = useState(false);
    const [showSessionSummary, setShowSessionSummary] = useState(false);
    const [showSideShowSelection, setShowSideShowSelection] = useState(false);

    // Viewer Requests (Operator Only - kept local or sourced from server?)
    const [viewerRequests, setViewerRequests] = useState([]);

    // --- SOCKET LISTENERS ---
    useEffect(() => {
        if (!socket.connected) socket.connect();

        // Join
        const isOperatorOrAdmin = user?.role === 'OPERATOR' || user?.role === 'ADMIN';
        if (isOperatorOrAdmin) {
            console.log('[CLIENT] Emitting join_session as OPERATOR');
            socket.emit('join_session', { sessionName, role: 'OPERATOR' });
        } else {
            // Viewer/Player join logic would go here
            console.log('[CLIENT] User is viewer/player, not joining as operator');
        }

        socket.on('connect_error', (err) => {
            console.error("Socket Connection Error:", err);
            setConnectionError("Connection Lost. Reconnecting...");
        });

        socket.on('game_update', (state) => {
            setConnectionError(null);
            if (!state) {
                console.log('[CLIENT] Received empty game_update');
                return;
            }
            console.log('[CLIENT] Game Update received:', state);
            console.log('[CLIENT] Players count:', state.players?.length, 'GamePlayers count:', state.gamePlayers?.length);

            if (state.type === 'HAND_COMPLETE') {
                setRoundSummaryData({
                    winner: state.winner,
                    pot: state.pot,
                    netChanges: state.netChanges,
                    currentRound: state.currentRound,
                    isSessionOver: state.isSessionOver
                });
                setShowRoundSummary(true);
                // Also sync state background
                if (state.players) setPlayers(state.players);
            } else {
                // Update Local State from Server
                setPlayers(state.players || []);
                setGamePlayers(state.gamePlayers || []);
                setPot(state.pot || 0);
                setCurrentStake(state.currentStake || 20);
                setActivePlayerIndex(state.activePlayerIndex !== undefined ? state.activePlayerIndex : 0);
                setCurrentLogs(state.currentLogs || []);
                setCurrentRound(state.currentRound || 1);
                setTotalRounds(state.totalRounds || 10);
                setPhase(state.phase || 'SETUP');
                setSideShowRequest(state.sideShowRequest || null);
                setShowRequest(state.showRequest || null);
            }
        });

        socket.on('viewer_requested', (req) => {
            if (user?.role === 'OPERATOR') {
                setViewerRequests(prev => {
                    if (prev.find(r => r.socketId === req.socketId)) return prev;
                    return [...prev, req];
                });
            }
        });

        socket.on('access_granted', (state) => {
            setAccessStatus('GRANTED');
        });

        socket.on('access_denied', () => setAccessStatus('DENIED'));

        socket.on('session_ended', ({ reason }) => {
            setSessionSummaryData({ reason });
            setShowSessionSummary(true);
        });

        socket.on('error_message', (msg) => alert(`Error: ${msg}`));

        return () => {
            socket.off('connect_error');
            socket.off('game_update');
            socket.off('viewer_requested');
            socket.off('access_granted');
            socket.off('access_denied');
            socket.off('session_ended');
            socket.off('error_message');
        };
    }, [user, sessionName, socket]);

    // --- ACTIONS ---
    const sendGameAction = (type, payload = {}) => {
        const activePlayer = gamePlayers[activePlayerIndex]; // Local ref (might be slightly stale but acceptable for ID)
        socket.emit('game_action', {
            sessionName,
            type,
            playerId: activePlayer?.id, // Context for server verification
            ...payload
        });
    };

    const startGame = () => sendGameAction('START_GAME');

    const handleBet = (amount = null, isDouble = false) => {
        // Validation handled on server, but basic client check is good UX
        const min = isDouble ? currentStake * 2 : currentStake;
        if (amount && parseInt(amount) < min) return alert(`Minimum bid is ${min}`);
        sendGameAction('BET', { amount: amount ? parseInt(amount) : null, isDouble });
    };

    const handleCustomBid = () => {
        const amount = prompt(`Enter custom bid (Min ${currentStake}):`, currentStake);
        if (amount) handleBet(amount, false);
    };

    const handleFold = () => sendGameAction('FOLD');
    const handleSeeCards = () => sendGameAction('SEEN');
    const handleSideShow = () => {
        // Show selection modal instead of direct action
        setShowSideShowSelection(true);
    };
    const handleSideShowSelect = (targetId) => {
        sendGameAction('SIDE_SHOW_REQUEST', { targetId });
        setShowSideShowSelection(false);
    };
    const handleShow = () => {
        const remainingPlayers = gamePlayers.filter(p => !p.folded);
        const blindPlayers = remainingPlayers.filter(p => p.status === 'BLIND');
        
        // Check if this is a Force Show scenario (seen player vs 1-2 blind players)
        if (activePlayer?.status === 'SEEN' && blindPlayers.length > 0 && blindPlayers.length <= 2) {
            // Show selection modal
            setShowRequest({ requester: activePlayer, blindPlayers });
            setShowShowSelection(true);
        } else if (remainingPlayers.length === 2) {
            // Regular show with 2 players
            sendGameAction('SHOW');
        } else {
            alert('Force Show only allowed when 1 or 2 blind players remain');
        }
    };
    const handleShowSelect = (targetId) => {
        sendGameAction('SHOW', { targetId });
        setShowShowSelection(false);
        setShowRequest(null);
    };

    const closeSession = () => {
        if (confirm("End Session?")) {
            socket.emit('end_session', { sessionName });
            navigate('/');
        }
    };
    const handleLogout = () => { logout(); navigate('/'); };
    const nextRound = () => {
        setShowRoundSummary(false);
        setRoundSummaryData(null);
        
        // Check if session is complete
        if (roundSummaryData?.isSessionOver) {
            // Navigate back to admin dashboard
            navigate('/admin');
        } else {
            // Start the next round automatically
            sendGameAction('START_GAME');
        }
    };

    // Viewer Logic
    const requestAccess = () => {
        if (!viewerName) return;
        setAccessStatus('PENDING');
        socket.emit('request_access', { sessionName, name: viewerName });
    };
    const resolveViewerRequest = (sid, approved) => {
        socket.emit('resolve_access', { sessionName, viewerId: sid, approved });
        setViewerRequests(prev => prev.filter(r => r.socketId !== sid));
    };


    // --- RENDER ---

    // 0. Connection Error
    if (connectionError) return <div className="h-screen bg-black text-white flex flex-col gap-4 items-center justify-center p-8 text-center"><ShieldAlert className="text-red-500" size={48} /><h2 className="text-2xl font-bold">{connectionError}</h2><button onClick={() => window.location.reload()} className="bg-blue-600 px-4 py-2 rounded">Retry</button></div>;

    // 1. Viewer Request
    if (user?.role === 'VIEWER' && accessStatus !== 'GRANTED') {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-xl max-w-sm w-full text-center">
                    <h2 className="text-2xl font-bold mb-4 text-slate-800">Request Access</h2>
                    <p className="mb-4 text-slate-500">To: {sessionName}</p>
                    {accessStatus === 'IDLE' && (
                        <>
                            <input value={viewerName} onChange={e => setViewerName(e.target.value)} className="w-full border p-2 mb-4 rounded bg-slate-50" placeholder="Your Name" />
                            <button onClick={requestAccess} className="bg-blue-600 text-white w-full py-2 rounded font-bold hover:bg-blue-700">Join</button>
                        </>
                    )}
                    {accessStatus === 'PENDING' && <div className="animate-pulse font-bold text-blue-600">Waiting for approval...</div>}
                    {accessStatus === 'DENIED' && <div className="text-red-500 font-bold">Access Denied</div>}
                </div>
            </div>
        );
    }

    if (!user) return <div className="h-screen bg-black text-white flex items-center justify-center">Loading User...</div>;

    // DEBUG: Show current state
    console.log('[CLIENT DEBUG] phase:', phase, 'user.role:', user?.role, 'players:', players.length, 'gamePlayers:', gamePlayers.length);

    // 3. Setup Phase (Operator/Admin Only)
    const activePlayer = gamePlayers[activePlayerIndex];
    const isOperatorOrAdmin = user?.role === 'OPERATOR' || user?.role === 'ADMIN';
    if (phase === 'SETUP' && isOperatorOrAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
                <div className="max-w-2xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-black text-slate-900">Session Setup</h1>
                        <div className="flex gap-2">
                            <button onClick={closeSession} className="bg-red-50 text-red-500 px-3 py-2 rounded-lg font-bold text-sm">Close</button>
                            <button onClick={handleLogout} className="bg-white border px-3 py-2 rounded-lg font-bold text-sm">Logout</button>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 mb-6">
                        <div className="flex justify-between mb-4">
                            <h2 className="font-bold text-lg flex items-center gap-2"><User size={20} /> Players ({players.length})</h2>
                            <span className="text-sm font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded">Round {currentRound}/{totalRounds}</span>
                        </div>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {players.map((p, i) => (
                                <div key={i} className="flex gap-3 items-center bg-slate-50 p-3 rounded-xl">
                                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-500">{i + 1}</div>
                                    <div className="flex-1 font-bold text-slate-700">{p.name}</div>
                                    <div className="text-sm font-mono text-slate-400">Seat {p.seat || i + 1}</div>
                                </div>
                            ))}
                        </div>
                        {players.length < 2 && <div className="mt-4 text-center text-red-500 font-medium bg-red-50 p-2 rounded">Need at least 2 players to start.</div>}
                    </div>

                    <button onClick={startGame} disabled={players.length < 2} className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                        <Play size={20} fill="white" /> Start Round {currentRound}
                    </button>

                    {viewerRequests.length > 0 && (
                        <div className="mt-6 p-4 bg-white rounded-xl border border-slate-200">
                            <h3 className="font-bold mb-3 flex items-center gap-2"><Eye size={18} /> Access Requests</h3>
                            {viewerRequests.map(r => (
                                <div key={r.socketId} className="flex justify-between items-center mb-2 bg-slate-50 p-2 rounded-lg">
                                    <span className="font-medium">{r.name}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => resolveViewerRequest(r.socketId, true)} className="p-1 px-3 bg-green-100 text-green-700 rounded-md text-sm font-bold">Accept</button>
                                        <button onClick={() => resolveViewerRequest(r.socketId, false)} className="p-1 px-3 bg-red-100 text-red-700 rounded-md text-sm font-bold">Deny</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 4. Active Game (or Showdown or Waiting for Active)
    if (!activePlayer && phase === 'ACTIVE') {
        // Fallback if state not synced yet
        return <div className="h-screen bg-slate-900 text-white flex items-center justify-center animate-pulse">Syncing Game State...</div>;
    }

    const isBlind = activePlayer?.status === 'BLIND';
    const cost = isBlind ? currentStake / 2 : currentStake;
    const isViewer = user?.role === 'VIEWER';
    
    // Force Show logic
    const remainingPlayers = gamePlayers.filter(p => !p.folded);
    const blindPlayers = remainingPlayers.filter(p => p.status === 'BLIND');
    const canForceShow = activePlayer?.status === 'SEEN' && blindPlayers.length > 0 && blindPlayers.length <= 2;
    const canShow = remainingPlayers.length === 2;
    const showButtonText = canForceShow ? 'FORCE SHOW' : 'SHOW';

    return (
        <div className="flex flex-col h-screen bg-slate-900 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900 via-slate-900 to-black opacity-60"></div>

            {/* Header */}
            <div className="relative z-10 bg-slate-900/80 backdrop-blur-md text-white p-4 flex justify-between items-center border-b border-white/5 shadow-2xl">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="font-bold text-slate-300 tracking-wide text-sm uppercase">{sessionName}</h1>
                        <span className="bg-slate-800 text-xs px-2 py-1 rounded text-slate-400">R{currentRound}/{totalRounds}</span>
                    </div>
                    <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mt-1">Pot: {pot}</div>
                </div>
                <div className="flex gap-2">
                    {!isViewer && <button onClick={closeSession} className="bg-red-500/10 text-red-500 border border-red-500/30 px-3 py-2 rounded-lg font-bold text-xs hover:bg-red-500/20 transition-all">END SESSION</button>}
                    <button onClick={handleLogout} className="bg-white/5 text-slate-400 hover:text-white px-3 py-2 rounded-lg font-bold text-xs transition-all">LOGOUT</button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-4 z-10 custom-scrollbar">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                    {gamePlayers.map((p, idx) => {
                        const isActive = idx === activePlayerIndex;
                        const isTarget = sideShowRequest?.target?.id === p.id;
                        const isRequester = sideShowRequest?.requester?.id === p.id;

                        return (
                            <div key={p.id || idx} className={`relative p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col justify-between min-h-[140px]
                                ${isActive ? 'border-yellow-500 bg-slate-800 shadow-[0_0_30px_rgba(234,179,8,0.15)] scale-[1.02]' : 'border-slate-800 bg-slate-800/50 opacity-90'}
                                ${p.folded ? 'opacity-40 grayscale border-slate-800' : ''}
                                ${(isTarget || isRequester) ? 'ring-2 ring-blue-500 z-20' : ''}
                             `}>
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <span className={`font-bold text-lg ${isActive ? 'text-white' : 'text-slate-400'}`}>{p.name}</span>
                                        <span className="text-xs font-mono text-slate-500">Seat {p.seat}</span>
                                    </div>
                                    {!p.folded && <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${p.status === 'BLIND' ? 'bg-slate-700 text-slate-400' : 'bg-blue-900 text-blue-300'}`}>{p.status}</span>}
                                </div>

                                <div className="mt-4">
                                    <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Invested</div>
                                    <div className="font-mono text-xl text-yellow-500/80">{p.invested}</div>
                                </div>

                                {isActive && !p.folded && <div className="absolute -top-3 -right-3 w-6 h-6 bg-yellow-500 rounded-full animate-bounce"></div>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Controls (Operator Only) */}
            {!isViewer && activePlayer && !sideShowRequest && !showRequest && (
                <div className="relative z-20 bg-slate-900 border-t border-slate-800 p-4 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Active Turn</div>
                                <div className="text-2xl font-bold text-white flex items-center gap-2">
                                    {activePlayer.name} <span className="text-sm bg-slate-800 px-2 py-1 rounded text-yellow-500 border border-yellow-500/20">{activePlayer.status}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Current Chaal</div>
                                <div className="text-2xl font-mono text-yellow-500">{currentStake}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3 h-20">
                            {/* Pack */}
                            <button onClick={handleFold} className="col-span-1 bg-gradient-to-br from-red-500/10 to-red-900/20 border border-red-500/30 text-red-500 rounded-xl font-bold text-sm hover:bg-red-500/20 hover:border-red-500/50 transition-all flex flex-col items-center justify-center gap-1">
                                <Trash2 size={20} /> PACK
                            </button>

                            {/* Side Show / Show */}
                            <button 
                                onClick={handleSideShow} 
                                disabled={isBlind || gamePlayers.filter(p => p.status === 'SEEN' && !p.folded && p.id !== activePlayer?.id).length === 0}
                                className={`col-span-1 bg-gradient-to-br from-blue-500/10 to-blue-900/20 border border-blue-500/30 text-blue-400 rounded-xl font-bold text-sm transition-all flex flex-col items-center justify-center gap-1 ${(isBlind || gamePlayers.filter(p => p.status === 'SEEN' && !p.folded && p.id !== activePlayer?.id).length === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-500/20'}`}
                            >
                                <ShieldAlert size={20} /> 
                                <span>SIDE SHOW</span>
                                <span className="text-[10px] opacity-70">+{cost}</span>
                            </button>

                            {/* Chaal */}
                            <button onClick={() => handleBet(null, false)} className="col-span-1 bg-gradient-to-b from-yellow-500 to-yellow-600 text-black border-t border-white/20 rounded-xl font-black text-xl hover:translate-y-[-2px] hover:shadow-lg hover:shadow-yellow-500/20 transition-all active:translate-y-[1px] relative overflow-hidden group">
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                                <span className="relative z-10 block text-xs font-bold opacity-60 uppercase tracking-widest mb-[-2px]">Chaal</span>
                                <span className="relative z-10">{cost}</span>
                            </button>

                            {/* Actions Group */}
                            <div className="col-span-1 grid grid-rows-2 gap-2">
                                <button onClick={() => handleBet(null, true)} className="bg-slate-800 text-green-400 border border-green-500/30 rounded-lg text-xs font-bold hover:bg-green-500/10 transition-all uppercase">x2 Raise</button>
                                <button onClick={handleCustomBid} className="bg-slate-800 text-yellow-400 border border-yellow-500/30 rounded-lg text-xs font-bold hover:bg-yellow-500/10 transition-all uppercase"><Edit3 size={12} className="inline mr-1" /> Custom</button>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-3">
                            <button onClick={handleSeeCards} disabled={!isBlind} className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border ${isBlind ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10 cursor-pointer' : 'border-slate-800 text-slate-600 cursor-not-allowed opacity-50'}`}>
                                <Eye size={16} /> SEE CARDS
                            </button>
                            <button 
                                onClick={handleShow} 
                                disabled={!canShow && !canForceShow}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                                    canShow || canForceShow 
                                        ? 'bg-slate-800 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10' 
                                        : 'border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                                }`}
                            >
                                <Trophy size={16} /> {showButtonText}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Viewer Only View */}
            {isViewer && (
                <div className="relative z-20 bg-slate-900 border-t border-slate-800 p-6 text-center">
                    <p className="text-slate-500 font-bold animate-pulse">Spectator Mode • Live Updates</p>
                </div>
            )}

            {/* Modals */}
            
            {/* Side Show Selection Modal */}
            {showSideShowSelection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in duration-200">
                        <h3 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                            <ShieldAlert className="text-blue-600" /> 
                            Select Player for Side Show
                        </h3>
                        <div className="bg-blue-50 p-3 rounded-xl mb-4">
                            <p className="text-blue-800 text-sm font-medium">
                                💰 Bid of {currentStake} placed. Now select a player:
                            </p>
                        </div>
                        <p className="text-slate-500 mb-4 text-sm">
                            Choose a player who has seen their cards:
                        </p>
                        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                            {gamePlayers
                                .filter(p => p.status === 'SEEN' && !p.folded && p.id !== activePlayer?.id)
                                .map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleSideShowSelect(p.id)}
                                        className="w-full p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-all flex justify-between items-center"
                                    >
                                        <span className="font-bold text-slate-900">{p.name}</span>
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">SEEN</span>
                                    </button>
                                ))}
                        </div>
                        {gamePlayers.filter(p => p.status === 'SEEN' && !p.folded && p.id !== activePlayer?.id).length === 0 && (
                            <div className="text-center text-slate-400 py-4 mb-4">
                                No eligible players found
                            </div>
                        )}
                        <button 
                            onClick={() => setShowSideShowSelection(false)} 
                            className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            
            {/* Side Show Request - Operator Selects Winner */}
            {sideShowRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                    <div className="bg-white p-8 rounded-3xl max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
                        <div className="text-center mb-6">
                            <ShieldAlert className="mx-auto text-blue-600 mb-2" size={48} />
                            <h3 className="text-2xl font-black text-slate-900">Side Show Request</h3>
                            <p className="text-slate-500 mt-2">Select who won the comparison</p>
                        </div>
                        
                        <div className="space-y-4 mb-6">
                            {/* Requester */}
                            <button 
                                onClick={() => sendGameAction('SIDE_SHOW_RESOLVE', { winnerId: sideShowRequest.requester.id })}
                                className="w-full p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-all"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-900">{sideShowRequest.requester.name}</span>
                                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">Requester</span>
                                </div>
                            </button>
                            
                            <div className="text-center text-slate-400 font-bold">VS</div>
                            
                            {/* Target */}
                            <button 
                                onClick={() => sendGameAction('SIDE_SHOW_RESOLVE', { winnerId: sideShowRequest.target.id })}
                                className="w-full p-4 rounded-xl border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 transition-all"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-900">{sideShowRequest.target.name}</span>
                                    <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded">Target</span>
                                </div>
                            </button>
                        </div>
                        
                        <div className="bg-yellow-50 p-4 rounded-xl text-center">
                            <p className="text-yellow-700 text-sm">
                                💡 Click on the player with the better hand
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Show/Force Show Request - Operator Selects Winner */}
            {showRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                    <div className="bg-white p-8 rounded-3xl max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
                        <div className="text-center mb-6">
                            <Trophy className="mx-auto text-yellow-500 mb-2" size={48} />
                            <h3 className="text-2xl font-black text-slate-900">
                                {showRequest.isForceShow ? 'Force Show' : 'Show'}
                            </h3>
                            <p className="text-slate-500 mt-2">Select who won</p>
                        </div>
                        
                        {showRequest.isForceShow && (
                            <div className="bg-yellow-50 p-3 rounded-xl mb-4">
                                <p className="text-yellow-800 text-sm text-center">
                                    ⚠️ If {showRequest.requester.name} loses, they pay 2x stake ({currentStake * 2})
                                </p>
                            </div>
                        )}
                        
                        <div className="space-y-4 mb-6">
                            {/* Requester */}
                            <button 
                                onClick={() => sendGameAction('SHOW_RESOLVE', { winnerId: showRequest.requester.id })}
                                className="w-full p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-all"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-900">{showRequest.requester.name}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${showRequest.requester.status === 'SEEN' ? 'bg-blue-200 text-blue-800' : 'bg-slate-600 text-slate-300'}`}>
                                        {showRequest.requester.status}
                                    </span>
                                </div>
                            </button>
                            
                            <div className="text-center text-slate-400 font-bold">VS</div>
                            
                            {/* Target */}
                            <button 
                                onClick={() => sendGameAction('SHOW_RESOLVE', { winnerId: showRequest.target.id })}
                                className="w-full p-4 rounded-xl border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 transition-all"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-900">{showRequest.target.name}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${showRequest.target.status === 'SEEN' ? 'bg-blue-200 text-blue-800' : 'bg-slate-600 text-slate-300'}`}>
                                        {showRequest.target.status}
                                    </span>
                                </div>
                            </button>
                        </div>
                        
                        <div className="bg-yellow-50 p-4 rounded-xl text-center">
                            <p className="text-yellow-700 text-sm">
                                💡 Click on the player with the better hand
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Force Show Selection Modal */}
            {showShowSelection && showRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                    <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in duration-200">
                        <h3 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                            <Trophy className="text-yellow-500" /> 
                            Force Show
                        </h3>
                        <div className="bg-yellow-50 p-3 rounded-xl mb-4">
                            <p className="text-yellow-800 text-sm">
                                ⚠️ If {showRequest.requester.name} loses, they'll pay 2x the current stake ({currentStake * 2})
                            </p>
                        </div>
                        <p className="text-slate-500 mb-4 text-sm">
                            Select a blind player to challenge:
                        </p>
                        <div className="space-y-2 mb-6">
                            {showRequest.blindPlayers.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleShowSelect(p.id)}
                                    className="w-full p-3 bg-slate-50 hover:bg-yellow-50 border border-slate-200 hover:border-yellow-300 rounded-xl text-left transition-all flex justify-between items-center"
                                >
                                    <span className="font-bold text-slate-900">{p.name}</span>
                                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">BLIND</span>
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={() => { setShowShowSelection(false); setShowRequest(null); }} 
                            className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {showRoundSummary && roundSummaryData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                    <div className="bg-white p-8 rounded-3xl max-w-md w-full text-center shadow-2xl animate-in zoom-in duration-300 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 to-yellow-600"></div>
                        <Trophy className="mx-auto text-yellow-500 mb-4 drop-shadow-lg" size={64} />
                        <h2 className="text-3xl font-black text-slate-900 mb-1 uppercase tracking-tight">Winner!</h2>
                        <p className="text-2xl font-bold text-blue-600 mb-6">{roundSummaryData.winner.name}</p>

                        <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
                            <p className="text-slate-400 uppercase text-xs font-bold tracking-widest mb-1">Total Pot</p>
                            <p className="text-4xl font-black text-slate-900 tracking-tighter">{roundSummaryData.pot}</p>
                        </div>

                        <button onClick={nextRound} className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-lg shadow-xl shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all">
                            {roundSummaryData.isSessionOver ? "View Final Results" : "Next Round"}
                        </button>
                    </div>
                </div>
            )}

            {showSessionSummary && sessionSummaryData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur p-4">
                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-lg w-full text-center">
                        <h2 className="text-4xl font-black text-white mb-4">Session Ended</h2>
                        <p className="text-slate-400 mb-4">{sessionSummaryData.reason}</p>
                        {sessionSummaryData.finalRound && (
                            <p className="text-yellow-500 mb-8 font-bold">
                                Completed {sessionSummaryData.finalRound} of {sessionSummaryData.totalRounds} rounds
                            </p>
                        )}
                        <div className="flex gap-4 justify-center">
                            <button onClick={() => navigate('/admin')} className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 transition-all">View Results</button>
                            <button onClick={() => navigate('/')} className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-slate-200 transition-all">Back to Home</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameRoom;
