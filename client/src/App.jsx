import React, { useState, useEffect, useRef } from 'react';
import {
  Eye,
  EyeOff,
  Trophy,
  Play,
  Plus,
  Trash2,
  ShieldAlert,
  ArrowRight,
  X,
  Edit3,
  BarChart3,
  History,
  Download,
  Gavel,
  ArrowLeft,
  User,
  Lock,
  Wifi,
  HelpCircle,
  Info,
  Check
} from 'lucide-react';
import { io } from 'socket.io-client';

// --- MOCK AUTH SYSTEM ---
const MOCK_USERS = [
  { username: 'admin', role: 'OPERATOR', label: 'Table Operator' },
  { username: 'viewer', role: 'VIEWER', label: 'Live Audience' }
];

// Initialize Socket
const socket = io('http://localhost:3000');

const TeenPattiApp = () => {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState(null); // { username, role }
  const [view, setView] = useState('SETUP');

  const [players, setPlayers] = useState([
    { id: 1, name: '', sessionBalance: 0 },
    { id: 2, name: '', sessionBalance: 0 }
  ]);

  // Game State
  const [gameCount, setGameCount] = useState(1);
  const [gameHistory, setGameHistory] = useState([]);
  const [gamePlayers, setGamePlayers] = useState([]);
  const [pot, setPot] = useState(0);
  const [currentStake, setCurrentStake] = useState(20);
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);

  // Modal & Temp States
  const [sideShowData, setSideShowData] = useState({ requester: null, target: null });
  const [forceShowData, setForceShowData] = useState({ activePlayer: null, opponents: [] });
  const [customBidAmount, setCustomBidAmount] = useState(0);
  const [currentLogs, setCurrentLogs] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedLogGameId, setSelectedLogGameId] = useState('current');
  const [lastHandResults, setLastHandResults] = useState({});

  // Viewer Access State
  const [viewerName, setViewerName] = useState('');
  const [accessStatus, setAccessStatus] = useState('IDLE'); // IDLE, PENDING, GRANTED, DENIED
  const [viewerRequests, setViewerRequests] = useState([]); // Array of { name, socketId }

  // --- LOGGING HELPER ---
  const createLogMsg = (msg) => `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${msg}`;

  const addLog = (message) => {
    setCurrentLogs(prev => [createLogMsg(message), ...prev]);
  };

  // --- SOCKET & SYNC ---
  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('game_update', (serverState) => {
      // If we are viewer, or if we are operator reconnecting
      if (serverState) {
        restoreState(serverState);
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
      setView('GAME');
    });

    socket.on('access_denied', () => {
      setAccessStatus('DENIED');
    });

    return () => {
      socket.off('connect');
      socket.off('game_update');
      socket.off('viewer_requested');
      socket.off('access_granted');
      socket.off('access_denied');
    };
  }, [user]);

  // Sync state to server whenever critical game state changes (Only Operator)
  useEffect(() => {
    if (user?.role === 'OPERATOR' && view === 'GAME') {
      const currentState = {
        players,
        gameCount,
        gameHistory,
        gamePlayers,
        pot,
        currentStake,
        activePlayerIndex,
        currentLogs,
        lastHandResults
      };
      socket.emit('sync_state', currentState);
    }
  }, [players, gameCount, gameHistory, gamePlayers, pot, currentStake, activePlayerIndex, currentLogs, lastHandResults, user, view]);

  const restoreState = (state) => {
    setPlayers(state.players || []);
    setGameCount(state.gameCount || 1);
    setGameHistory(state.gameHistory || []);
    setGamePlayers(state.gamePlayers || []);
    setPot(state.pot || 0);
    setCurrentStake(state.currentStake || 20);
    setActivePlayerIndex(state.activePlayerIndex !== undefined ? state.activePlayerIndex : 0);
    setCurrentLogs(state.currentLogs || []);
    setLastHandResults(state.lastHandResults || {});

    // If we have active players, assume game is running
    if (state.gamePlayers && state.gamePlayers.length > 0) {
      setView('GAME');
    }
  };

  // --- AUTH HANDLERS ---
  const handleLogin = (username) => {
    const foundUser = MOCK_USERS.find(u => u.username === username);
    if (foundUser) {
      setUser(foundUser);
      socket.emit('join_game', { role: foundUser.role });

      if (foundUser.role === 'VIEWER') {
        setView('ACCESS_REQUEST');
      } else {
        // Operator goes to setup, or game if state restored
        // (State restoration happens via socket event)
        if (view !== 'GAME') setView('SETUP');
      }
    } else {
      alert("Invalid user. Use 'admin' or 'viewer'");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView('SETUP');
    setAccessStatus('IDLE');
    setViewerName('');
  };

  // --- VIEWER ACCESS ---
  const requestAccess = () => {
    if (!viewerName.trim()) return;
    setAccessStatus('PENDING');
    socket.emit('request_access', { name: viewerName });
  };

  const resolveViewerRequest = (socketId, approved) => {
    socket.emit('resolve_access', { viewerId: socketId, approved });
    setViewerRequests(prev => prev.filter(r => r.socketId !== socketId));
  };

  // --- CORE GAME LOGIC ---

  const getNextActiveIndex = (startIndex, playerList = gamePlayers) => {
    let nextIndex = (startIndex + 1) % playerList.length;
    let loopCount = 0;
    while (playerList[nextIndex].folded && loopCount < playerList.length) {
      nextIndex = (nextIndex + 1) % playerList.length;
      loopCount++;
    }
    return nextIndex;
  };

  const startGame = () => {
    const validPlayers = players.filter(p => p.name.trim() !== '');
    if (validPlayers.length < 2) {
      alert("Need at least 2 players with names to start.");
      return;
    }

    const initialGamePlayers = validPlayers.map(p => ({
      ...p,
      status: 'BLIND',
      folded: false,
      invested: 5, // Boot amount
    }));

    setGamePlayers(initialGamePlayers);
    setPot(initialGamePlayers.length * 5);
    setCurrentStake(20);
    setActivePlayerIndex(0);
    setCurrentLogs([]);
    setSelectedLogGameId('current');

    const startMsg = createLogMsg(`--- GAME #${gameCount} STARTED --- Boot: ${initialGamePlayers.length * 5}`);
    setCurrentLogs([startMsg]);

    setView('GAME');
  };

  const handleSeeCards = () => {
    const newPlayers = [...gamePlayers];
    newPlayers[activePlayerIndex].status = 'SEEN';
    setGamePlayers(newPlayers);
    addLog(`${newPlayers[activePlayerIndex].name} saw their cards.`);
  };

  const handleFold = () => {
    const player = gamePlayers[activePlayerIndex];
    if (player.status === 'BLIND') {
      alert("Blind players cannot Pack. You must See Cards first.");
      return;
    }

    const newPlayers = [...gamePlayers];
    newPlayers[activePlayerIndex].folded = true;
    addLog(`${player.name} FOLDED.`);

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

    if (amountOverride) addLog(`${player.name} RAISED stake to ${newStakeValue}.`);
    else if (isDouble) addLog(`${player.name} DOUBLED stake to ${newStakeValue}.`);
    else addLog(`${player.name} played CHAAL (${costToPay}).`);

    const newPlayers = [...gamePlayers];
    newPlayers[activePlayerIndex].invested += costToPay;

    setGamePlayers(newPlayers);
    setPot(prev => prev + costToPay);
    setCurrentStake(newStakeValue);

    setActivePlayerIndex(getNextActiveIndex(activePlayerIndex));
    setView('GAME');
  };

  // --- SIDE/FORCE SHOW ---

  const openSideShowSelection = () => {
    const cost = currentStake;
    const newPlayers = [...gamePlayers];
    newPlayers[activePlayerIndex].invested += cost;

    setGamePlayers(newPlayers);
    setPot(prev => prev + cost);
    addLog(`${gamePlayers[activePlayerIndex].name} pays ${cost} to ask for Side Show.`);
    setView('SIDESHOW_SELECT');
  };

  const confirmSideShowTarget = (targetPlayer) => {
    const requester = gamePlayers[activePlayerIndex];
    setSideShowData({ requester, target: targetPlayer });
    setView('SIDESHOW_RESOLVE');
  };

  const resolveSideShow = (winnerId) => {
    const isRequesterWinner = winnerId === sideShowData.requester.id;
    const winnerName = isRequesterWinner ? sideShowData.requester.name : sideShowData.target.name;
    const loserName = isRequesterWinner ? sideShowData.target.name : sideShowData.requester.name;
    const loserId = isRequesterWinner ? sideShowData.target.id : sideShowData.requester.id;

    addLog(`Side Show: ${winnerName} won. ${loserName} folded.`);

    const newPlayers = [...gamePlayers];
    const loserIndex = newPlayers.findIndex(p => p.id === loserId);
    if (loserIndex !== -1) newPlayers[loserIndex].folded = true;

    const remaining = newPlayers.filter(p => !p.folded);

    if (remaining.length === 1) {
      setGamePlayers(newPlayers);
      endGame(remaining[0], newPlayers);
      return;
    }

    setGamePlayers(newPlayers);
    setActivePlayerIndex(getNextActiveIndex(activePlayerIndex, newPlayers));
    setView('GAME');
  };

  const openForceShow = () => {
    const active = gamePlayers[activePlayerIndex];
    const opponents = gamePlayers.filter(p => !p.folded && p.id !== active.id);
    const cost = currentStake * 2;

    const newPlayers = [...gamePlayers];
    newPlayers[activePlayerIndex].invested += cost;

    setGamePlayers(newPlayers);
    setPot(prev => prev + cost);
    addLog(`${active.name} pays ${cost} (Double) to FORCE SHOW against Blinds.`);

    setForceShowData({ activePlayer: active, opponents: opponents });
    setView('FORCE_SHOW_RESOLVE');
  };

  const resolveForceShow = (winnerId) => {
    const winner = gamePlayers.find(p => p.id === winnerId);
    endGame(winner, gamePlayers);
  };

  // --- GAME END ---

  const endGame = (winner, finalGamePlayersState) => {
    const winMsg = createLogMsg(`*** WINNER: ${winner.name} (Pot: ${pot}) ***`);
    const finalLogs = [winMsg, ...currentLogs];

    const netChanges = {};
    const updatedMasterList = players.map(p => {
      const gameP = finalGamePlayersState.find(gp => gp.id === p.id);
      if (!gameP) {
        netChanges[p.id] = 0;
        return p;
      }

      let balanceChange = 0;
      if (gameP.id === winner.id) {
        balanceChange = pot - gameP.invested;
      } else {
        balanceChange = -gameP.invested;
      }

      netChanges[p.id] = balanceChange;
      return { ...p, sessionBalance: p.sessionBalance + balanceChange };
    });

    const gameRecord = {
      id: gameCount,
      timestamp: new Date().toLocaleString(),
      winner: winner.name,
      pot: pot,
      logs: finalLogs,
      netChanges: netChanges
    };

    setGameHistory(prev => [gameRecord, ...prev]);
    setPlayers(updatedMasterList);
    setLastHandResults(netChanges);
    setGameCount(prev => prev + 1);

    setView('SUMMARY');
  };

  const exportToCSV = () => {
    const headers = ["Game ID", "Time", "Winner", "Pot Size"];
    players.forEach(p => {
      if (p.name) headers.push(`${p.name} (Net)`);
    });

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(",") + "\n";

    const chronologicalHistory = [...gameHistory].reverse();

    chronologicalHistory.forEach(game => {
      const row = [
        game.id,
        `"${game.timestamp}"`,
        game.winner,
        game.pot
      ];
      players.forEach(p => {
        if (p.name) {
          const change = game.netChanges[p.id] || 0;
          row.push(change);
        }
      });
      csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TeenPatti_Session_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- HELPERS ---
  const canSideShow = () => {
    if (activePlayerIndex === null) return false;
    const active = gamePlayers[activePlayerIndex];
    if (active.status !== 'SEEN') return false;
    const targets = gamePlayers.filter(p => p.id !== active.id && !p.folded && p.status === 'SEEN');
    return targets.length > 0;
  };

  const canForceShow = () => {
    if (activePlayerIndex === null) return false;
    const active = gamePlayers[activePlayerIndex];
    if (active.status !== 'SEEN') return false;
    const opponents = gamePlayers.filter(p => p.id !== active.id && !p.folded);
    if (opponents.length < 1 || opponents.length > 2) return false;
    return opponents.every(p => p.status === 'BLIND');
  };

  // --- VIEW COMPONENTS ---

  const renderLogin = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-gold-400 to-gold-600"></div>

        {/* Help Icon in Login */}
        <button onClick={() => setView('HELP')} className="absolute top-4 right-4 text-slate-400 hover:text-gold-400 transition-colors">
          <HelpCircle size={24} />
        </button>

        <div className="text-center mb-10 mt-4">
          <div className="w-20 h-20 bg-gradient-to-br from-gold-400 to-gold-600 rounded-2xl rotate-3 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-gold-500/20">
            <Lock size={36} className="text-white -rotate-3" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">Teen Patti</h1>
          <p className="text-slate-400 font-medium">Secure Ledger System</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => handleLogin('admin')}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 group"
          >
            <div className="p-1 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors"><User size={20} /></div>
            <span>Operator Login</span>
          </button>
          <button
            onClick={() => handleLogin('viewer')}
            className="w-full py-4 bg-white/5 border border-white/10 text-slate-300 rounded-xl font-bold hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-3 group"
          >
            <div className="p-1 bg-white/5 rounded-lg group-hover:bg-white/20 transition-colors"><Eye size={20} /></div>
            <span>Audience View</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderAccessRequest = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl relative">
        <div className="text-center mb-8">
          <Eye size={48} className="text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white">Request Access</h2>
          <p className="text-slate-400 text-sm mt-2">Enter your name to request viewing access from the operator.</p>
        </div>

        {accessStatus === 'IDLE' && (
          <div className="space-y-4">
            <input
              type="text"
              value={viewerName}
              onChange={(e) => setViewName(e.target.value)}
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
            <button onClick={handleLogout} className="w-full py-3 text-slate-400 hover:text-white text-sm font-bold">Cancel</button>
          </div>
        )}

        {accessStatus === 'PENDING' && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-white font-bold animate-pulse">Waiting for approval...</p>
            <button onClick={handleLogout} className="text-slate-400 hover:text-white text-sm font-bold">Cancel Request</button>
          </div>
        )}

        {accessStatus === 'DENIED' && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <X size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Access Denied</h3>
              <p className="text-slate-400 text-sm">The operator has denied your request.</p>
            </div>
            <button onClick={() => setAccessStatus('IDLE')} className="w-full py-3 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-600 transition-all">Try Again</button>
          </div>
        )}
      </div>
    </div>
  );

  const renderSetup = () => {
    if (user.role !== 'OPERATOR') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4 text-center relative">
          <button onClick={() => setView('HELP')} className="absolute top-4 right-4 text-slate-500 hover:text-gold-400 transition-colors">
            <HelpCircle size={28} />
          </button>
          <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <Wifi size={48} className="text-slate-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Waiting for Operator</h2>
          <p className="text-slate-400 max-w-xs mx-auto">The game session has not started yet. Please wait for the operator to initialize the table.</p>
          <button onClick={handleLogout} className="mt-12 px-6 py-2 rounded-full border border-red-500/30 text-red-400 font-bold hover:bg-red-500/10 transition-colors">Logout</button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
        <div className="max-w-xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Game Setup</h1>
              <p className="text-slate-500 font-medium">Configure players and seats</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setView('HELP')} className="p-3 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all">
                <HelpCircle size={24} />
              </button>
              <button onClick={() => setShowLeaderboard(true)} className="p-3 bg-white rounded-xl shadow-sm border border-slate-200 text-blue-600 hover:border-blue-200 transition-all">
                <BarChart3 size={24} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <User size={20} className="text-blue-500" />
                Active Players
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{players.filter(p => p.name).length}</span>
              </h2>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Max 17</span>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {players.map((p, idx) => (
                <div key={p.id} className="group flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    {idx + 1}
                  </div>
                  <input
                    value={p.name}
                    onChange={(e) => {
                      const newP = [...players];
                      newP[idx].name = e.target.value;
                      setPlayers(newP);
                    }}
                    className="flex-1 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all placeholder:font-normal"
                    placeholder={`Player ${idx + 1} Name`}
                  />
                  <button onClick={() => setPlayers(players.filter((_, i) => i !== idx))} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => { if (players.length < 17) setPlayers([...players, { id: Date.now(), name: '', sessionBalance: 0 }]) }}
              className="w-full mt-4 py-3 border-2 border-dashed border-slate-200 text-slate-400 rounded-xl flex justify-center items-center gap-2 font-bold text-sm hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
            >
              <Plus size={18} /> Add New Seat
            </button>
          </div>

          <button onClick={startGame} className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
            <Play size={24} fill="currentColor" /> Start Game #{gameCount}
          </button>

          <div className="text-center mt-8">
            <button onClick={handleLogout} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">Logout Operator</button>
          </div>
        </div>
      </div>
    );
  };

  const renderGame = () => {
    const activePlayer = gamePlayers[activePlayerIndex];
    if (!activePlayer) return null;

    const isBlind = activePlayer.status === 'BLIND';
    const cost = isBlind ? currentStake / 2 : currentStake;
    const nextDoubleStake = currentStake * 2;
    const isViewer = user.role === 'VIEWER';

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
                Game #{gameCount}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-slate-400 text-sm font-bold uppercase">Pot</span>
                <p className="text-4xl font-black text-white tracking-tight">{pot}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setView('HELP')} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all text-slate-300 hover:text-white"><HelpCircle size={20} /></button>
              <button onClick={() => setShowLeaderboard(true)} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all text-slate-300 hover:text-white"><BarChart3 size={20} /></button>
              <button onClick={() => setView('LOGS')} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all text-slate-300 hover:text-white"><History size={20} /></button>
              {isViewer && <button onClick={handleLogout} className="p-3 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/30 transition-all"><X size={20} /></button>}
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
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-inner ${isActive ? 'bg-gold-500 text-slate-900' : 'bg-slate-700 text-slate-400'}`}>
                        {idx + 1}
                      </div>
                      {!p.folded && (
                        <div className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${p.status === 'BLIND' ? 'bg-slate-700 text-slate-400' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                          {p.status}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="font-bold text-white text-lg truncate flex items-center gap-2">
                        {p.name}
                        {p.folded && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">FOLD</span>}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-1">
                        <div className="w-4 h-4 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center text-[8px] text-yellow-500">$</div>
                        {p.invested}
                      </div>
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
            <p className="font-bold text-slate-500 animate-pulse flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
              Live Audience View
            </p>
          </div>
        ) : (
          <div className="bg-slate-900/95 border-t border-white/10 p-4 pb-8 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] z-20 backdrop-blur-xl">
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between items-center mb-4 px-2">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75"></span>
                    <span className="relative w-3 h-3 bg-green-500 rounded-full block"></span>
                  </div>
                  <span className="font-bold text-white text-lg">{activePlayer.name}'s Turn</span>
                </div>
                {isBlind && (
                  <button onClick={handleSeeCards} className="text-xs font-bold text-blue-400 border border-blue-500/30 bg-blue-500/10 px-4 py-2 rounded-full hover:bg-blue-500/20 transition-all flex items-center gap-2">
                    <Eye size={14} /> See Cards
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3 h-28">
                <button
                  onClick={handleFold}
                  disabled={isBlind}
                  className={`flex flex-col items-center justify-center rounded-2xl border transition-all active:scale-95 ${isBlind ? 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed' : 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50'}`}
                >
                  <Trash2 size={24} className="mb-2" />
                  <span className="text-xs font-black uppercase tracking-wider">Pack</span>
                </button>

                {canForceShow() ? (
                  <button
                    onClick={openForceShow}
                    className="flex flex-col items-center justify-center rounded-2xl border bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50 transition-all active:scale-95"
                  >
                    <Gavel size={24} className="mb-2" />
                    <span className="text-xs font-black uppercase tracking-wider text-center leading-tight">Force<br />Show</span>
                  </button>
                ) : (
                  <button
                    onClick={openSideShowSelection}
                    disabled={!canSideShow()}
                    className={`flex flex-col items-center justify-center rounded-2xl border transition-all active:scale-95 ${canSideShow() ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20 hover:border-purple-500/50' : 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed'}`}
                  >
                    <ShieldAlert size={24} className="mb-2" />
                    <span className="text-xs font-black uppercase tracking-wider">Side Show</span>
                  </button>
                )}

                <button onClick={() => handleBet(null, false)} className="col-span-2 bg-gradient-to-b from-blue-500 to-blue-700 text-white rounded-2xl flex flex-col items-center justify-center active:scale-95 transition-all shadow-lg shadow-blue-900/50 border-t border-blue-400 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                  <span className="text-3xl font-black tracking-tight relative z-10">{cost}</span>
                  <span className="text-[10px] font-bold opacity-80 tracking-[0.2em] uppercase relative z-10">Chaal</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <button onClick={() => handleBet(null, true)} className="py-4 bg-slate-800 text-green-400 border border-green-500/30 rounded-xl text-xs font-bold hover:bg-green-500/10 active:scale-95 transition-all uppercase tracking-wider">
                  x2 Raise ({nextDoubleStake})
                </button>
                <button
                  onClick={() => { setCustomBidAmount(currentStake); setView('CUSTOM_BID'); }}
                  disabled={isBlind}
                  className={`py-4 border rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${isBlind ? 'bg-slate-800 text-slate-600 border-slate-800' : 'bg-slate-800 text-orange-400 border-orange-500/30 hover:bg-orange-500/10'}`}
                >
                  <Edit3 size={14} className="inline mr-2 mb-0.5" /> Custom Bid
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHelp = () => (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[70] flex flex-col animate-in fade-in duration-200">
      <div className="bg-slate-900 p-4 shadow-lg border-b border-white/10 flex items-center gap-3">
        <button onClick={() => setView(user ? (user.role === 'VIEWER' && view === 'SETUP' ? 'SETUP' : 'GAME') : 'SETUP')} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="font-bold text-lg text-white">Hand Strength Rules</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-slate-800 p-5 rounded-2xl border-l-4 border-blue-500 shadow-lg">
          <h3 className="font-bold text-lg mb-1 text-blue-400">1. Trail (Set / Trio)</h3>
          <p className="text-sm text-slate-400">Three cards of the same rank. <br /><strong className="text-white">Highest: A-A-A</strong> | Lowest: 2-2-2</p>
        </div>
        <div className="bg-slate-800 p-5 rounded-2xl border-l-4 border-green-500 shadow-lg">
          <h3 className="font-bold text-lg mb-1 text-green-400">2. Pure Sequence (Straight Flush)</h3>
          <p className="text-sm text-slate-400">Three consecutive cards of same suit. <br /><strong className="text-white">Highest: A-K-Q</strong> | Lowest: 4-3-2</p>
        </div>
        <div className="bg-slate-800 p-5 rounded-2xl border-l-4 border-yellow-500 shadow-lg">
          <h3 className="font-bold text-lg mb-1 text-yellow-400">3. Sequence (Straight)</h3>
          <p className="text-sm text-slate-400">Three consecutive cards, different suits. <br /><strong className="text-white">Highest: A-K-Q</strong> | Lowest: 4-3-2</p>
        </div>
        <div className="bg-slate-800 p-5 rounded-2xl border-l-4 border-purple-500 shadow-lg">
          <h3 className="font-bold text-lg mb-1 text-purple-400">4. Color (Flush)</h3>
          <p className="text-sm text-slate-400">Three cards of same suit, not consecutive. <br /><strong className="text-white">Highest: A-K-J</strong></p>
        </div>
        <div className="bg-slate-800 p-5 rounded-2xl border-l-4 border-orange-500 shadow-lg">
          <h3 className="font-bold text-lg mb-1 text-orange-400">5. Pair (Double)</h3>
          <p className="text-sm text-slate-400">Two cards of same rank. <br /><strong className="text-white">Highest: A-A-K</strong></p>
        </div>
        <div className="bg-slate-800 p-5 rounded-2xl border-l-4 border-slate-400 shadow-lg">
          <h3 className="font-bold text-lg mb-1 text-slate-300">6. High Card</h3>
          <p className="text-sm text-slate-400">Highest card wins if no other combo. <br /><strong className="text-white">Highest: A</strong></p>
        </div>
      </div>
    </div>
  );

  const renderCustomBid = () => (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-slate-900 w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl">
        <div className="flex justify-between mb-8">
          <h2 className="text-xl font-bold text-white">Custom Bet</h2>
          <button onClick={() => setView('GAME')} className="text-slate-400 hover:text-white"><X size={24} /></button>
        </div>
        <div className="text-center mb-8">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-2">Minimum Stake</p>
          <p className="text-4xl font-black text-gold-400">{currentStake}</p>
        </div>
        <input
          type="number"
          value={customBidAmount}
          onChange={(e) => setCustomBidAmount(e.target.value)}
          className="w-full text-center text-4xl font-bold bg-slate-800 border-2 border-slate-700 rounded-2xl p-4 mb-6 focus:border-gold-500 focus:bg-slate-800/50 outline-none text-white transition-all"
        />
        <button
          onClick={() => handleBet(parseInt(customBidAmount))}
          disabled={parseInt(customBidAmount) < currentStake}
          className="w-full py-4 bg-gold-500 text-slate-900 rounded-xl font-black uppercase tracking-wider shadow-lg hover:bg-gold-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none transition-all"
        >
          Confirm Bet
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {showLeaderboard && <LeaderboardModal sortedPlayers={[...players].filter(p => p.name).sort((a, b) => b.sessionBalance - a.sessionBalance)} onClose={() => setShowLeaderboard(false)} onExport={exportToCSV} />}

      {!user && view !== 'HELP' && renderLogin()}

      {view === 'HELP' && renderHelp()}
      {user && view === 'SETUP' && renderSetup()}
      {user && view === 'GAME' && renderGame()}
      {user && view === 'CUSTOM_BID' && renderCustomBid()}
      {user && view === 'ACCESS_REQUEST' && renderAccessRequest()}

      {/* Viewer Request Notifications for Operator */}
      {user?.role === 'OPERATOR' && viewerRequests.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] space-y-2">
          {viewerRequests.map(req => (
            <div key={req.socketId} className="bg-slate-800 border border-slate-600 p-4 rounded-xl shadow-2xl animate-in slide-in-from-right duration-300 w-80">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-white">Viewer Request</h4>
                  <p className="text-sm text-slate-400"><strong>{req.name}</strong> wants to watch.</p>
                </div>
                <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-1 rounded uppercase">New</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => resolveViewerRequest(req.socketId, true)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg font-bold text-xs transition-colors">Allow</button>
                <button onClick={() => resolveViewerRequest(req.socketId, false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg font-bold text-xs transition-colors">Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {user && view === 'SIDESHOW_SELECT' && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex flex-col animate-in fade-in duration-200">
          <div className="bg-slate-900 p-4 flex gap-4 items-center shadow-lg border-b border-white/10">
            <button onClick={() => setView('GAME')} className="text-white hover:text-gold-400 transition-colors"><ArrowLeft size={24} /></button>
            <h2 className="font-bold text-lg text-white">Select Player to Show</h2>
          </div>
          <div className="p-4 space-y-3">
            {gamePlayers.filter(p => p.id !== gamePlayers[activePlayerIndex].id && !p.folded && p.status === 'SEEN').map(p => (
              <button key={p.id} onClick={() => confirmSideShowTarget(p)} className="w-full bg-slate-800 p-4 rounded-2xl border border-slate-700 flex justify-between items-center shadow-lg hover:border-gold-500 hover:bg-slate-700 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center font-black text-white group-hover:bg-gold-500 group-hover:text-slate-900 transition-colors">{p.name[0]}</div>
                  <div className="text-left font-bold text-white text-lg">{p.name}</div>
                </div>
                <ArrowRight size={24} className="text-slate-500 group-hover:text-gold-400 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </div>
      )}

      {user && view === 'SIDESHOW_RESOLVE' && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-slate-900 w-full max-w-sm rounded-3xl p-6 text-center border border-white/10 shadow-2xl">
            <ShieldAlert size={64} className="mx-auto text-purple-500 mb-6" />
            <h2 className="text-3xl font-black text-white mb-2">Who Won?</h2>
            <div className="flex items-center justify-center gap-4 mb-8 p-4 bg-slate-800 rounded-2xl border border-slate-700">
              <div className="font-bold text-white text-lg">{sideShowData.requester?.name}</div>
              <div className="text-xs text-slate-500 font-black uppercase tracking-widest">VS</div>
              <div className="font-bold text-white text-lg">{sideShowData.target?.name}</div>
            </div>
            <div className="space-y-3">
              <button onClick={() => resolveSideShow(sideShowData.requester.id)} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-500 transition-all">{sideShowData.requester?.name} Won</button>
              <button onClick={() => resolveSideShow(sideShowData.target.id)} className="w-full py-4 bg-slate-800 border-2 border-slate-700 text-white rounded-xl font-bold hover:bg-slate-700 hover:border-slate-600 transition-all">{sideShowData.target?.name} Won</button>
            </div>
          </div>
        </div>
      )}

      {user && view === 'FORCE_SHOW_RESOLVE' && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-slate-900 w-full max-w-sm rounded-3xl p-6 text-center border border-white/10 shadow-2xl">
            <Gavel size={64} className="mx-auto text-amber-500 mb-6" />
            <h2 className="text-3xl font-black text-white mb-2">Force Show</h2>
            <p className="text-slate-400 mb-8">Select the absolute winner</p>
            <div className="space-y-3">
              <button onClick={() => resolveForceShow(forceShowData.activePlayer.id)} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-500 transition-all">
                {forceShowData.activePlayer?.name} (Seen) Won
              </button>
              {forceShowData.opponents.map(opp => (
                <button key={opp.id} onClick={() => resolveForceShow(opp.id)} className="w-full py-4 bg-slate-800 border-2 border-slate-700 text-white rounded-xl font-bold hover:bg-slate-700 hover:border-slate-600 transition-all">
                  {opp.name} (Blind) Won
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {user && view === 'SUMMARY' && (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center p-6 animate-in fade-in duration-500">
          <div className="w-full max-w-md text-center mb-8 mt-4">
            <Trophy size={80} className="text-gold-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
            <h2 className="text-4xl font-black text-white mb-2 tracking-tight">Game {gameCount - 1} Complete</h2>
            <p className="text-slate-400">Results for this hand</p>
          </div>

          <div className="bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex-1 mb-6 flex flex-col">
            <div className="p-4 bg-slate-900/50 border-b border-slate-700 font-bold text-xs text-slate-500 uppercase flex justify-between tracking-widest">
              <span>Player</span>
              <span>Profit/Loss</span>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              {players.filter(p => p.name).map(p => ({
                ...p,
                handChange: lastHandResults[p.id] || 0
              })).sort((a, b) => b.handChange - a.handChange).map((p, i) => (
                <div key={p.id} className="flex justify-between p-5 border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 transition-colors">
                  <div className="flex gap-4 font-bold text-white items-center">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${i === 0 ? 'bg-gold-500 text-slate-900' : 'bg-slate-700 text-slate-400'}`}>{i + 1}</span>
                    {p.name}
                  </div>
                  <div className={`font-mono font-bold text-lg ${p.handChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {p.handChange > 0 ? '+' : ''}{p.handChange}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full max-w-md space-y-3">
            {user.role === 'OPERATOR' && (
              <button onClick={startGame} className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-blue-900/50 hover:scale-[1.02] transition-all">
                <Play size={24} fill="currentColor" /> Deal Game #{gameCount}
              </button>
            )}
            {user.role === 'VIEWER' && (
              <p className="text-center text-slate-500 animate-pulse mt-4 uppercase tracking-widest text-xs font-bold">Waiting for Operator...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const LeaderboardModal = ({ sortedPlayers, onClose, onExport }) => (
  <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
    <div className="bg-slate-900 w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl flex flex-col max-h-[80vh]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-white flex items-center gap-2">
          <BarChart3 className="text-gold-500" /> Leaderboard
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
        {sortedPlayers.map((p, i) => (
          <div key={p.id} className="bg-slate-800 p-4 rounded-xl flex justify-between items-center border border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-yellow-500 text-yellow-950' : i === 1 ? 'bg-slate-400 text-slate-900' : i === 2 ? 'bg-orange-700 text-orange-100' : 'bg-slate-700 text-slate-400'}`}>
                {i + 1}
              </div>
              <span className="font-bold text-white">{p.name}</span>
            </div>
            <span className={`font-mono font-bold ${p.sessionBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {p.sessionBalance > 0 ? '+' : ''}{p.sessionBalance}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-white/10">
        <button onClick={onExport} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
          <Download size={18} /> Export CSV
        </button>
      </div>
    </div>
  </div>
);

export default TeenPattiApp;