import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Eye, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const navigate = useNavigate();
    const { login, loginAsGuest } = useAuth();

    const handleOperatorLogin = async () => {
        // Hardcoded for now as per original
        const result = await login('admin', 'admin123');
        if (result.success) {
            navigate('/setup');
        } else {
            alert("Login failed: " + result.error);
        }
    };

    const handleViewerLogin = () => {
        loginAsGuest();
        navigate('/'); // Back to welcome/grid to pick a game
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 w-full max-w-md rounded-3xl p-8 shadow-2xl">
                <button onClick={() => navigate('/')} className="mb-6 text-slate-400 hover:text-white"><ArrowLeft /></button>
                <h2 className="text-3xl font-bold text-white mb-8 text-center">Choose Your Role</h2>
                <div className="space-y-4">
                    <button
                        onClick={handleOperatorLogin}
                        className="w-full py-6 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-4"
                    >
                        <User size={24} />
                        Operator (Host Game)
                    </button>
                    <button
                        onClick={handleViewerLogin}
                        className="w-full py-6 bg-white/5 border border-white/10 text-white rounded-2xl font-bold text-lg hover:bg-white/10 transition-all flex items-center justify-center gap-4"
                    >
                        <Eye size={24} />
                        Audience (Watch Game)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
