import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_URL, SOCKET_CONFIG } from '../config';

const AuthContext = createContext(null);

// Initialize Socket (Lazy connect)
const socket = io(API_URL, SOCKET_CONFIG);

// Debug listeners (will be attached once socket is used)
socket.on('connect', () => {
    try { console.log('[Socket] connected', { id: socket.id, auth: socket.auth }); } catch(e){console.log('[Socket] connect log failed', e)}
});
socket.on('connect_error', (err) => {
    console.error('[Socket] connect_error', err && err.message ? err.message : err);
});
socket.on('disconnect', (reason) => {
    console.warn('[Socket] disconnected', reason);
});
socket.on('reconnect_attempt', (num) => console.log('[Socket] reconnect attempt', num));

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for existing session on mount
        const checkSession = async () => {
            try {
                const token = localStorage.getItem('token');
                console.log("[Auth] Checking session. Token present:", !!token);

                const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

                const res = await fetch(`${API_URL}/api/auth/me`, {
                    credentials: 'include',
                    headers
                });

                console.log("[Auth] /api/auth/me status:", res.status);

                const data = await res.json();
                console.log("[Auth] /api/auth/me data:", data);

                if (data.user) {
                    setUser(data.user);
                    // Update socket auth
                    socket.auth = { token };
                    socket.connect();
                } else {
                    console.warn("[Auth] No user returned from /me");
                }
            } catch (e) {
                console.error("[Auth] Session check failed", e);
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
                if (data.token) {
                    localStorage.setItem('token', data.token);
                    socket.auth = { token: data.token };
                }
                socket.connect();
                return { success: true, user: data.user };
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

        localStorage.removeItem('token');
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
