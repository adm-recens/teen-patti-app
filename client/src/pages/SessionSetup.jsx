import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const SessionSetup = () => {
    const navigate = useNavigate();
    const { socket, logout } = useAuth();
    const [sessionName, setSessionName] = useState('');
    const [totalRounds, setTotalRounds] = useState(10);
    const [availablePlayers, setAvailablePlayers] = useState([]);
    const [seats, setSeats] = useState(Array(6).fill(null)); // 6 Seats

    useEffect(() => {
        // Fetch available players (using admin users endpoint for now, filtering for PLAYER)
        fetch(`${API_URL}/api/admin/users`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                const players = data.filter(u => u.role === 'PLAYER');
                setAvailablePlayers(players);
            })
            .catch(err => console.error("Failed to fetch players", err));
    }, []);

    const handleSeatAssignment = (index, playerId) => {
        const newSeats = [...seats];
        if (playerId === "") {
            newSeats[index] = null;
        } else {
            const player = availablePlayers.find(p => p.id === parseInt(playerId));
            newSeats[index] = player;
        }
        setSeats(newSeats);
    };

    const createSession = async () => {
        if (!sessionName.trim()) return alert("Enter Session Name");

        // Format players for backend
        const assignedPlayers = seats
            .map((player, index) => player ? { userId: player.id, name: player.username, seat: index + 1 } : null)
            .filter(p => p !== null);

        try {
            const res = await fetch(`${API_URL}/api/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: sessionName, totalRounds, players: assignedPlayers }),
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                socket.emit('join_session', { sessionName, role: 'OPERATOR' });
                navigate(`/game/${sessionName}`);
            } else {
                alert(data.error);
            }
        } catch (e) {
            alert("Failed to create session");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 border border-slate-100">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-black text-slate-900">Setup Session</h2>
                    <button onClick={() => navigate('/admin')} className="p-2 text-slate-400 hover:text-blue-600"><Settings /></button>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Session Name</label>
                            <input
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-4 text-lg font-bold text-slate-900 focus:border-blue-500 outline-none transition-all"
                                placeholder="e.g. Friday Night Poker"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Rounds</label>
                            <input
                                type="number"
                                value={totalRounds}
                                onChange={(e) => setTotalRounds(parseInt(e.target.value))}
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-4 text-lg font-bold text-slate-900 focus:border-blue-500 outline-none transition-all"
                                min="1"
                                max="50"
                            />
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-6">
                        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><Users className="text-blue-500" /> Seat Assignment</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {seats.map((seat, index) => (
                                <div key={index} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Seat {index + 1}</label>
                                    <select
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                                        value={seat ? seat.id : ""}
                                        onChange={(e) => handleSeatAssignment(index, e.target.value)}
                                    >
                                        <option value="">Empty</option>
                                        {availablePlayers.map(p => (
                                            <option key={p.id} value={p.id} disabled={seats.some(s => s && s.id === p.id && s.id !== (seat ? seat.id : -1))}>
                                                {p.username}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={createSession}
                            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-xl shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] transition-all"
                        >
                            Create & Start Session
                        </button>
                    </div>
                    <button onClick={() => { logout(); navigate('/'); }} className="w-full py-3 text-slate-400 font-bold hover:text-slate-600">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default SessionSetup;
