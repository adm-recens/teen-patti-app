// Centralized configuration for the application
// In production, this will be empty string (same origin)
// In development, you can set VITE_BACKEND_URL in your .env file

export const API_URL = import.meta.env.VITE_BACKEND_URL || '';

// Socket.io configuration
export const SOCKET_CONFIG = {
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling']
};
