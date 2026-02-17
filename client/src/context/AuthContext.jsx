import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_URL, SOCKET_CONFIG } from '../config';

const AuthContext = createContext(null);

// Initialize Socket (Lazy connect)
const socket = io(API_URL, SOCKET_CONFIG);

// Helper to get CSRF token for authenticated requests
const getCSRFToken = async () => {
    try {
        const res = await fetch(`${API_URL}/api/csrf-token`, {
            credentials: 'include'
        });
        if (res.ok) {
            const data = await res.json();
            return data.csrfToken;
        }
    } catch (e) {
        console.error('Failed to get CSRF token:', e);
    }
    return null;
};

// Helper for authenticated fetch with CSRF protection
const authenticatedFetch = async (url, options = {}) => {
    const csrfToken = await getCSRFToken();
    
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
    };
    
    if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
    }
    
    return fetch(url, {
        ...options,
        headers,
        credentials: 'include'
    });
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for existing session on mount using httpOnly cookie
        const checkSession = async () => {
            try {
                // Use the new v2 API for better role-based data
                const res = await fetch(`${API_URL}/api/v2/auth/me`, {
                    credentials: 'include'
                });

                const data = await res.json();

                if (data.success && data.user) {
                    setUser(data.user);
                    // Connect socket (auth handled by cookie)
                    socket.connect();
                }
            } catch (e) {
                // Silent fail - user not logged in
            } finally {
                setLoading(false);
            }
        };
        checkSession();
    }, []);

    const login = async (username, password) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            // Use the new v2 API
            const res = await fetch(`${API_URL}/api/v2/auth/login`, {
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
                return { success: true, user: data.user };
            } else {
                return { success: false, error: data.error, details: data.details };
            }
        } catch (e) {
            return { success: false, error: 'Network error. Please try again.' };
        }
    };

    const loginAsGuest = () => {
        setUser({ username: 'Guest', role: 'VIEWER' });
        socket.connect();
    };

    const logout = async () => {
        try {
            await fetch(`${API_URL}/api/v2/auth/logout`, { 
                method: 'POST', 
                credentials: 'include' 
            });
        } catch (e) {
            // Silent fail
        }
        setUser(null);
        socket.disconnect();
    };
    
    const logoutAll = async () => {
        try {
            const res = await authenticatedFetch(`${API_URL}/api/auth/logout-all`, {
                method: 'POST'
            });
            
            if (res.ok) {
                setUser(null);
                socket.disconnect();
                return { success: true };
            }
        } catch (e) {
            console.error('Logout all failed:', e);
        }
        return { success: false };
    };
    
    const updatePassword = async (currentPassword, newPassword) => {
        try {
            const res = await authenticatedFetch(`${API_URL}/api/user/password`, {
                method: 'PUT',
                body: JSON.stringify({ currentPassword, newPassword })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                return { success: true, message: data.message };
            } else {
                return { 
                    success: false, 
                    error: data.error,
                    details: data.details 
                };
            }
        } catch (e) {
            return { success: false, error: 'Network error. Please try again.' };
        }
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            login, 
            loginAsGuest, 
            logout, 
            logoutAll,
            updatePassword,
            authenticatedFetch,
            socket, 
            loading 
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
