import React, { useState, useEffect } from 'react';
import { 
  Eye, Trophy, Play, Plus, Trash2, ShieldAlert, ArrowRight, X, 
  Edit3, BarChart3, History, Download, Gavel, ArrowLeft, User, Lock, Wifi
} from 'lucide-react';

// --- MOCK AUTH SYSTEM FOR DEMONSTRATION ---
const MOCK_USERS = [
  { username: 'admin', role: 'OPERATOR', label: 'Table Operator' },
  { username: 'viewer', role: 'VIEWER', label: 'Live Audience' }
];

const TeenPattiApp = () => {
  // --- AUTH STATE ---
  const [user, setUser] = useState(null); // { username, role }

  // --- APP STATE ---
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

  // --- LOGGING HELPER ---
  const createLogMsg = (msg) => `[${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}] ${msg}`;

  const addLog = (message) => {
    setCurrentLogs(prev => [createLogMsg(message), ...prev]);
  };

  // --- AUTH HANDLERS ---
  const handleLogin = (username) => {
    const foundUser = MOCK_USERS.find(u => u.username === username);
    if (foundUser) {
      setUser(foundUser);
      // If viewer, go straight to game if active, or summary
      if (foundUser.role === 'VIEWER') {
         setView('GAME'); // In real app, this would fetch current live state
      }
    } else {
      alert("Invalid user. Use 'admin' or 'viewer'");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView('SETUP');
  };

  // --- CORE GAME LOGIC (Only executable by OPERATOR) ---

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
       if(p.name) headers.push(`${p.name} (Net)`);
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
        if(p.name) {
            const change = game.netChanges[p.id] || 0;
            row.push(change);
        }
      });
      csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TeenPatti_Session_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- RENDER HELPERS ---
  
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

  // --- VIEWS ---

  const renderLogin = () => (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
           <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
             <Lock size={32} className="text-blue-600"/>
           </div>
           <h1 className="text-2xl font-black text-slate-800">Teen Patti Access</h1>
           <p className="text-slate-500">Secure Ledger System</p>
        </div>
        
        <div className="space-y-3">
          <button 
            onClick={() => handleLogin('admin')}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <User size={20} /> Login as Operator
          </button>
          <button 
            onClick={() => handleLogin('viewer')}
            className="w-full py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 flex items-center justify-center gap-2"
          >
            <Eye size={20} /> Login as Viewer
          </button>
        </div>
      </div>
    </div>
  );

  const renderSetup = () => {
    if (user.role !== 'OPERATOR') {
       return (
         <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
            <Wifi size={48} className="text-slate-300 mb-4 animate-pulse"/>
            <h2 className="text-xl font-bold text-slate-700">Waiting for Operator</h2>
            <p className="text-slate-500">The game has not started yet.</p>
            <button onClick={handleLogout} className="mt-8 text-red-500 font-bold">Logout</button>
         </div>
       );
    }

    return (
      <div className="min-h-screen bg-slate-50 p-4 max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-black text-slate-800">Teen Patti Ledger</h1>
          <button onClick={() => setShowLeaderboard(true)} className="p-2 bg-white rounded-lg shadow-sm border text-blue-600">
            <BarChart3 size={24} />
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-slate-700">Players ({players.filter(p=>p.name).length})</h2>
            <span className="text-xs text-slate-400">Max 17</span>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {players.map((p, idx) => (
              <div key={p.id} className="flex gap-2">
                <input 
                  value={p.name}
                  onChange={(e) => {
                    const newP = [...players];
                    newP[idx].name = e.target.value;
                    setPlayers(newP);
                  }}
                  className="flex-1 border rounded px-3 py-2 text-sm"
                  placeholder={`Player ${idx+1} Name`}
                />
                <button onClick={() => setPlayers(players.filter((_, i) => i !== idx))} className="p-2 text-red-400 hover:bg-red-50 rounded">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          <button 
            onClick={() => { if(players.length < 17) setPlayers([...players, { id: Date.now(), name: '', sessionBalance: 0 }]) }}
            className="w-full mt-3 py-2 border-2 border-dashed border-slate-200 text-slate-400 rounded-lg flex justify-center items-center gap-2 font-bold text-sm hover:bg-slate-50"
          >
            <Plus size={16} /> Add Seat
          </button>
        </div>

        <button onClick={startGame} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform">
          Start Game #{gameCount}
        </button>
        
        <div className="text-center mt-6">
           <button onClick={handleLogout} className="text-sm text-slate-400 underline">Logout Operator</button>
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
      <div className="flex flex-col h-screen bg-slate-100">
        <div className="bg-slate-900 text-white p-4 pb-6 shadow-lg z-10">
          <div className="flex justify-between items-start">
             <div>
               <p className="text-slate-400 text-[10px] font-bold uppercase">
                 {isViewer ? <span className="text-red-400 animate-pulse">● LIVE VIEW </span> : ''}
                 Game #{gameCount} • Pot
               </p>
               <p className="text-4xl font-bold">{pot}</p>
             </div>
             <div className="flex gap-2">
               <button onClick={() => setShowLeaderboard(true)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700"><BarChart3 size={20}/></button>
               <button onClick={() => setView('LOGS')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700"><History size={20}/></button>
               {isViewer && <button onClick={handleLogout} className="p-2 bg-red-900 rounded-full hover:bg-red-800"><X size={20}/></button>}
             </div>
          </div>
          <div className="mt-4 flex justify-between items-center bg-slate-800 p-2 rounded-lg">
            <span className="text-xs font-bold text-slate-400 uppercase">Current Stake (Seen)</span>
            <span className="font-mono text-xl font-bold text-yellow-400">{currentStake}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {gamePlayers.map((p, idx) => {
            const isActive = idx === activePlayerIndex;
            return (
              <div key={p.id} className={`flex justify-between items-center p-3 rounded-xl border-2 transition-all ${isActive ? 'bg-white border-blue-500 shadow-md scale-[1.02]' : 'bg-slate-50 border-transparent'} ${p.folded ? 'opacity-50 grayscale' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      {p.name}
                      {p.folded && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">FOLD</span>}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">Inv: {p.invested}</div>
                  </div>
                </div>
                {!p.folded && (
                  <div className={`text-[10px] font-bold px-2 py-1 rounded ${p.status === 'BLIND' ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-600'}`}>
                    {p.status}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* CONTROLS AREA - HIDDEN FOR VIEWERS */}
        {isViewer ? (
           <div className="bg-white border-t p-6 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] z-20 text-center">
             <p className="font-bold text-slate-500 animate-pulse">Waiting for Operator...</p>
           </div>
        ) : (
          <div className="bg-white border-t p-3 pb-6 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] z-20">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>
                <span className="font-bold text-slate-800">{activePlayer.name}'s Turn</span>
              </div>
              {isBlind && (
                <button onClick={handleSeeCards} className="text-xs font-bold text-blue-600 border border-blue-200 px-3 py-1 rounded-full hover:bg-blue-50">
                  <Eye size={14} className="inline mr-1"/> See Cards
                </button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 h-24">
              <button 
                onClick={handleFold} 
                disabled={isBlind}
                className={`flex flex-col items-center justify-center rounded-lg border ${isBlind ? 'bg-slate-50 text-slate-300 border-slate-100' : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'}`}
              >
                <Trash2 size={20} />
                <span className="text-[10px] font-bold mt-1">PACK</span>
              </button>

              {canForceShow() ? (
                 <button 
                   onClick={openForceShow}
                   className="flex flex-col items-center justify-center rounded-lg border bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100"
                 >
                   <Gavel size={20} />
                   <span className="text-[10px] font-bold mt-1 leading-tight text-center">FORCE<br/>SHOW</span>
                 </button>
              ) : (
                 <button 
                   onClick={openSideShowSelection} 
                   disabled={!canSideShow()}
                   className={`flex flex-col items-center justify-center rounded-lg border ${canSideShow() ? 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`}
                 >
                   <ShieldAlert size={20} />
                   <span className="text-[10px] font-bold mt-1">SHOW</span>
                 </button>
              )}

              <button onClick={() => handleBet(null, false)} className="col-span-2 bg-blue-600 text-white rounded-lg flex flex-col items-center justify-center active:scale-95 transition-transform shadow-lg shadow-blue-200">
                <span className="text-2xl font-black">{cost}</span>
                <span className="text-[10px] font-bold opacity-80 tracking-widest">CHAAL</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={() => handleBet(null, true)} className="py-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold hover:bg-green-100 active:bg-green-200">
                x2 Raise (Stake {nextDoubleStake})
              </button>
              <button 
                onClick={() => { setCustomBidAmount(currentStake); setView('CUSTOM_BID'); }} 
                disabled={isBlind}
                className={`py-3 border rounded-lg text-xs font-bold ${isBlind ? 'bg-slate-50 text-slate-300' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}
              >
                <Edit3 size={14} className="inline mr-1"/> Custom Bid
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCustomBid = () => (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-sm rounded-2xl p-6">
        <div className="flex justify-between mb-6">
          <h2 className="text-xl font-bold">Custom Bet</h2>
          <button onClick={() => setView('GAME')}><X size={24}/></button>
        </div>
        <div className="text-center mb-6">
          <p className="text-xs text-slate-500 uppercase font-bold">Minimum Stake</p>
          <p className="text-3xl font-black text-blue-900">{currentStake}</p>
        </div>
        <input 
          type="number"
          value={customBidAmount}
          onChange={(e) => setCustomBidAmount(e.target.value)}
          className="w-full text-center text-3xl font-bold border-2 rounded-xl p-4 mb-4 focus:border-blue-500 outline-none"
        />
        <button 
          onClick={() => handleBet(parseInt(customBidAmount))}
          disabled={parseInt(customBidAmount) < currentStake}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold disabled:bg-slate-300"
        >
          Confirm
        </button>
      </div>
    </div>
  );

  return (
    <div>
       {showLeaderboard && <LeaderboardModal sortedPlayers={[...players].filter(p=>p.name).sort((a,b) => b.sessionBalance - a.sessionBalance)} onClose={() => setShowLeaderboard(false)} onExport={exportToCSV} />}
       
       {!user && renderLogin()}
       {user && view === 'SETUP' && renderSetup()}
       {user && view === 'GAME' && renderGame()}
       {user && view === 'CUSTOM_BID' && renderCustomBid()}
       
       {user && view === 'SIDESHOW_SELECT' && (
        <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col">
          <div className="bg-white p-4 flex gap-4 items-center shadow-sm">
            <button onClick={() => setView('GAME')}><ArrowLeft/></button>
            <h2 className="font-bold text-lg">Select Player to Show</h2>
          </div>
          <div className="p-4 space-y-3">
            {gamePlayers.filter(p => p.id !== gamePlayers[activePlayerIndex].id && !p.folded && p.status === 'SEEN').map(p => (
              <button key={p.id} onClick={() => confirmSideShowTarget(p)} className="w-full bg-white p-4 rounded-xl border flex justify-between items-center shadow-sm hover:border-blue-500">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700">{p.name[0]}</div>
                  <div className="text-left font-bold text-slate-700">{p.name}</div>
                </div>
                <ArrowRight size={20} className="text-slate-300"/>
              </button>
            ))}
          </div>
        </div>
       )}

       {user && view === 'SIDESHOW_RESOLVE' && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 text-center">
            <ShieldAlert size={48} className="mx-auto text-purple-600 mb-4"/>
            <h2 className="text-2xl font-black mb-1">Who Won?</h2>
            <div className="flex items-center justify-center gap-4 mb-8 p-4 bg-slate-50 rounded-xl">
              <div className="font-bold text-blue-900">{sideShowData.requester?.name}</div>
              <div className="text-xs text-slate-400">VS</div>
              <div className="font-bold text-blue-900">{sideShowData.target?.name}</div>
            </div>
            <div className="space-y-3">
              <button onClick={() => resolveSideShow(sideShowData.requester.id)} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg">{sideShowData.requester?.name} Won</button>
              <button onClick={() => resolveSideShow(sideShowData.target.id)} className="w-full py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold">{sideShowData.target?.name} Won</button>
            </div>
          </div>
        </div>
       )}

       {user && view === 'FORCE_SHOW_RESOLVE' && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 text-center">
            <Gavel size={48} className="mx-auto text-amber-600 mb-4"/>
            <h2 className="text-2xl font-black mb-1">Force Show</h2>
            <p className="text-slate-500 mb-6">Select the absolute winner</p>
            <div className="space-y-3">
              <button onClick={() => resolveForceShow(forceShowData.activePlayer.id)} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg">
                {forceShowData.activePlayer?.name} (Seen) Won
              </button>
              {forceShowData.opponents.map(opp => (
                 <button key={opp.id} onClick={() => resolveForceShow(opp.id)} className="w-full py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold">
                   {opp.name} (Blind) Won
                 </button>
              ))}
            </div>
          </div>
        </div>
       )}

       {user && view === 'SUMMARY' && (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6">
          <div className="w-full max-w-md text-center mb-6 mt-4">
            <Trophy size={64} className="text-yellow-500 mx-auto mb-4"/>
            <h2 className="text-3xl font-black text-slate-800 mb-2">Game {gameCount - 1} Complete</h2>
            <p className="text-slate-500">Results for this hand</p>
          </div>
          
          <div className="bg-white w-full max-w-md rounded-2xl shadow-sm border overflow-hidden flex-1 mb-6 flex flex-col">
            <div className="p-3 bg-slate-100 border-b font-bold text-xs text-slate-500 uppercase flex justify-between">
              <span>Player</span>
              <span>Profit/Loss</span>
            </div>
            <div className="overflow-y-auto flex-1">
              {players.filter(p=>p.name).map(p => ({
                 ...p,
                 handChange: lastHandResults[p.id] || 0
              })).sort((a,b) => b.handChange - a.handChange).map((p,i) => (
                 <div key={p.id} className="flex justify-between p-4 border-b last:border-0">
                   <div className="flex gap-3 font-bold text-slate-700">
                     <span className="text-slate-300 w-5">{i+1}.</span> {p.name}
                   </div>
                   <div className={`font-mono font-bold ${p.handChange >=0 ? 'text-green-600' : 'text-red-500'}`}>
                     {p.handChange > 0 ? '+' : ''}{p.handChange}
                   </div>
                 </div>
              ))}
            </div>
          </div>
          
          <div className="w-full max-w-md space-y-3">
            {/* Viewers don't see Deal Next Game button */}
            {user.role === 'OPERATOR' && (
              <button onClick={startGame} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
                <Play size={20} fill="currentColor"/> Deal Game #{gameCount}
              </button>
            )}
            {user.role === 'VIEWER' && (
               <p className="text-center text-slate-400 animate-pulse mt-4">Waiting for Operator to deal next hand...</p>
            )}
          </div>
        </div>
       )}

       {user && view === 'LOGS' && (
        <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col">
           <div className="bg-white p-4 shadow-sm flex flex-col gap-2">
             <div className="flex justify-between items-center">
               <button onClick={() => setView('GAME')}><ArrowLeft/></button>
               <h2 className="font-bold text-lg">Game Logs</h2>
               <div className="w-6"></div> 
             </div>
             <div className="mt-2">
               <select 
                 value={selectedLogGameId} 
                 onChange={(e) => setSelectedLogGameId(e.target.value)}
                 className="w-full p-2 border rounded-lg bg-slate-50 font-bold text-slate-700"
               >
                 <option value="current">Current Hand (Active)</option>
                 {gameHistory.map(g => (
                   <option key={g.id} value={g.id}>Game #{g.id} - Winner: {g.winner}</option>
                 ))}
               </select>
             </div>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
             {(selectedLogGameId === 'current' ? currentLogs : (gameHistory.find(g => g.id === parseInt(selectedLogGameId))?.logs || [])).map((l,i) => (
               <div key={i} className="bg-white p-2 border rounded shadow-sm text-slate-600">{l}</div>
             ))}
           </div>
        </div>
       )}
    </div>
  );
};

// Extracted Component
const LeaderboardModal = ({ sortedPlayers, onClose, onExport }) => (
  <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-md rounded-2xl max-h-[80vh] flex flex-col shadow-2xl">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="font-bold text-lg">Session Leaderboard</h2>
        <button onClick={onClose}><X/></button>
      </div>
      <div className="overflow-y-auto p-4 flex-1">
        {sortedPlayers.map((p,i) => (
           <div key={p.id} className="flex justify-between p-3 border-b last:border-0">
             <div className="font-bold text-slate-700">
               <span className="text-slate-300 mr-2 w-4 inline-block">{i+1}.</span> {p.name}
             </div>
             <div className={`font-bold ${p.sessionBalance >=0 ? 'text-green-600' : 'text-red-500'}`}>
               {p.sessionBalance > 0 ? '+' : ''}{p.sessionBalance}
             </div>
           </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <button onClick={onExport} className="w-full py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50">
          <Download size={20}/> Export Session CSV
        </button>
      </div>
    </div>
  </div>
);

export default TeenPattiApp;
