import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Users, Trophy, Activity, ChevronLeft, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

const Viewer = () => {
    const { sessionName } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { socket } = useAuth();
    
    const [viewerName] = useState(location.state?.viewerName || 'Guest');
    const [gameState, setGameState] = useState(null);
    const [logs, setLogs] = useState([]);
    const [players, setPlayers] = useState([]);
    const [pot, setPot] = useState(0);
    const [currentRound, setCurrentRound] = useState(1);
    const [totalRounds, setTotalRounds] = useState(10);
    const [phase, setPhase] = useState('SETUP');
    const [activePlayerIndex, setActivePlayerIndex] = useState(0);
    const [gamePlayers, setGamePlayers] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    
    const logsEndRef = useRef(null);

    useEffect(() => {
        if (!sessionName) {
            navigate('/');
            return;
        }

        // Connect socket
        if (!socket.connected) socket.connect();

        // Join as viewer
        socket.emit('join_session', { sessionName, role: 'VIEWER' });
        setConnectionStatus('Connected');

        socket.on('connect_error', () => {
            setConnectionStatus('Connection Lost');
        });

        socket.on('game_update', (state) => {
            if (!state) return;
            
            setGameState(state);
            
            // Update all state
            if (state.players) setPlayers(state.players);
            if (state.gamePlayers) setGamePlayers(state.gamePlayers);
            if (state.pot !== undefined) setPot(state.pot);
            if (state.currentRound) setCurrentRound(state.currentRound);
            if (state.totalRounds) setTotalRounds(state.totalRounds);
            if (state.phase) setPhase(state.phase);
            if (state.activePlayerIndex !== undefined) setActivePlayerIndex(state.activePlayerIndex);
            
            // Add logs
            if (state.currentLogs && state.currentLogs.length > 0) {
                setLogs(prev => {
                    const newLogs = state.currentLogs.filter(log => !prev.includes(log));
                    if (newLogs.length > 0) {
                        return [...prev, ...newLogs];
                    }
                    return prev;
                });
            }
        });

        socket.on('session_ended', ({ reason }) => {
            setConnectionStatus('Session Ended');
            setLogs(prev => [...prev, `--- Session Ended: ${reason} ---`]);
        });

        // V2 FIX: Handle access denied
        socket.on('access_denied', () => {
            setConnectionStatus('Access Denied');
            setLogs(prev => [...prev, '--- Access Denied by Operator ---']);
            setTimeout(() => navigate('/'), 3000);
        });

        // Handle access granted
        socket.on('access_granted', () => {
            setConnectionStatus('Connected');
            setLogs(prev => [...prev, '--- Access Granted ---']);
        });

        return () => {
            socket.off('connect_error');
            socket.off('game_update');
            socket.off('session_ended');
            socket.off('access_denied');
            // V1 FIX: Disconnect socket when component unmounts
            socket.disconnect();
        };
    }, [sessionName, socket, navigate]);

    // Auto-scroll to bottom of logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleLogout = () => {
        navigate('/');
    };

    const getActivePlayerName = () => {
        if (!gamePlayers.length || activePlayerIndex >= gamePlayers.length) return '-';
        return gamePlayers[activePlayerIndex]?.name || '-';
    };

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate('/')}
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-white">{sessionName}</h1>
                            <p className="text-sm text-slate-500">Watching as {viewerName}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/help')}
                            className="flex items-center gap-2 px-4 py-2 text-slate-400 font-bold hover:bg-white/10 rounded-xl transition-colors"
                        >
                            <HelpCircle size={18} /> Help
                        </button>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                            connectionStatus === 'Connected' ? 'bg-green-500/20 text-green-400' : 
                            connectionStatus === 'Session Ended' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                        }`}>
                            <div className={`w-2 h-2 rounded-full ${
                                connectionStatus === 'Connected' ? 'bg-green-500 animate-pulse' : 
                                connectionStatus === 'Session Ended' ? 'bg-red-500' :
                                'bg-yellow-500'
                            }`}></div>
                            {connectionStatus}
                        </div>
                        <button 
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 text-red-400 font-bold hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                            <LogOut size={18} /> Leave
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="bg-slate-900/50 border-b border-slate-800 px-6 py-3">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Trophy size={18} className="text-yellow-500" />
                            <span className="text-sm">Round {currentRound}/{totalRounds}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <Activity size={18} className="text-green-500" />
                            <span className="text-sm">Phase: <span className="text-white font-bold">{phase}</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <Users size={18} className="text-blue-500" />
                            <span className="text-sm">{gamePlayers.filter(p => !p.folded).length} Active Players</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-sm text-slate-500">Current Turn</span>
                        <p className="font-bold text-white">{getActivePlayerName()}</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-6 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Players List */}
                    <div className="lg:col-span-1">
                        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                            <div className="p-4 border-b border-slate-800">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <Users size={18} className="text-blue-500" />
                                    Players
                                </h3>
                            </div>
                            <div className="divide-y divide-slate-800">
                                {gamePlayers.map((player, index) => (
                                    <div 
                                        key={player.id} 
                                        className={`p-4 ${index === activePlayerIndex ? 'bg-blue-500/10' : ''}`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                                    index === activePlayerIndex ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'
                                                }`}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <p className={`font-bold ${player.folded ? 'text-slate-500 line-through' : 'text-white'}`}>
                                                        {player.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {player.status} • Invested: {player.invested}
                                                    </p>
                                                </div>
                                            </div>
                                            {player.folded && (
                                                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">FOLDED</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Pot Display */}
                        <div className="mt-6 bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-2xl p-6 text-center">
                            <p className="text-yellow-200 text-sm font-bold uppercase tracking-wider mb-1">Current Pot</p>
                            <p className="text-4xl font-black text-white">{pot}</p>
                        </div>
                    </div>

                    {/* Game Log */}
                    <div className="lg:col-span-2">
                        <div className="bg-slate-900 rounded-2xl border border-slate-800 h-[calc(100vh-280px)] flex flex-col">
                            <div className="p-4 border-b border-slate-800">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <Activity size={18} className="text-green-500" />
                                    Game Log
                                </h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {logs.length === 0 ? (
                                    <p className="text-slate-500 text-center py-8">Waiting for game to start...</p>
                                ) : (
                                    logs.map((log, index) => (
                                        <div key={index} className="flex gap-3 text-sm">
                                            <span className="text-slate-500 font-mono text-xs shrink-0">
                                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                            <p className={`${
                                                log.includes('Winner') ? 'text-yellow-400 font-bold' :
                                                log.includes('packed') ? 'text-red-400' :
                                                log.includes('won') ? 'text-green-400' :
                                                log.includes('bets') ? 'text-blue-400' :
                                                'text-slate-300'
                                            }`}>
                                                {log}
                                            </p>
                                        </div>
                                    ))
                                )}
                                <div ref={logsEndRef} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Viewer;
