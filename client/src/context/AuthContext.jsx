import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// Initialize Socket (Lazy connect)
const socket = io(API_URL, {
    autoConnect: false,
    withCredentials: true
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for existing session on mount
        const checkSession = async () => {
            try {
                const res = await fetch(`${API_URL}/api/auth/me`, { credentials: 'include' });
                const data = await res.json();
                if (data.user) {
                    setUser(data.user);
                    socket.connect();
                }
            } catch (e) {
                console.error("Session check failed", e);
            } finally {
                setLoading(false);
            }
        };
        checkSession();
    }, []);

    const login = async (username, password) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = await res.json();

            if (data.success) {
                setUser(data.user);
                socket.connect();
                return { success: true };
            } else {
                return { success: false, error: data.error };
            }
        } catch (e) {
            return { success: false, error: e.message };
        }
    };

    const loginAsGuest = () => {
        setUser({ username: 'Guest', role: 'VIEWER' });
        socket.connect();
    };

    const logout = async () => {
        try {
            await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
        } catch (e) { console.error(e); }

        setUser(null);
        socket.disconnect();
    };

    return (
        <AuthContext.Provider value={{ user, login, loginAsGuest, logout, socket, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
