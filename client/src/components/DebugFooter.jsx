import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';

const DebugFooter = () => {
    const [status, setStatus] = useState('Checking...');
    const [error, setError] = useState(null);

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const start = Date.now();
                const res = await fetch(`${API_URL}/`);
                const text = await res.text();
                const ms = Date.now() - start;
                if (res.ok) {
                    setStatus(`Online (${ms}ms)`);
                } else {
                    setStatus(`Error: ${res.status}`);
                }
            } catch (e) {
                setStatus('Offline / Connection Failed');
                setError(e.message);
            }
        };
        checkHealth();
    }, []);

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-black/80 text-xs text-slate-400 p-2 font-mono flex justify-between items-center z-50">
            <div>
                <span className="font-bold text-slate-200">Debug Info:</span>
                <span className="mx-2">API_URL: <span className="text-yellow-400">{API_URL}</span></span>
                <span className="mx-2">Backend: <span className={status.includes('Online') ? "text-green-400" : "text-red-400"}>{status}</span></span>
            </div>
            {error && <div className="text-red-400 max-w-xs truncate" title={error}>{error}</div>}
        </div>
    );
};

export default DebugFooter;
