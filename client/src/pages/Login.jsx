import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Eye, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const navigate = useNavigate();
    const { login, loginAsGuest } = useAuth();
    const [username, setUsername] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(username, password);
        console.log("Login Result:", result); // Debugging

        if (result.success) {
            // Defensive check: Ensure user object exists
            const user = result.user || { role: 'USER', username: username };

            // Redirect based on role
            if (user.role === 'OPERATOR' || user.role === 'ADMIN' || user.username === 'ram54') {
                navigate('/admin');
            } else {
                navigate('/');
            }
        } else {
            setError(result.error || 'Login failed');
        }
        setLoading(false);
    };

    const handleGuestLogin = () => {
        loginAsGuest();
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 w-full max-w-md rounded-3xl p-8 shadow-2xl">
                <button onClick={() => navigate('/')} className="mb-6 text-slate-400 hover:text-white"><ArrowLeft /></button>

                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
                    <p className="text-slate-400">Sign in to continue</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl mb-6 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-slate-300 text-sm font-bold mb-2">Username</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-slate-500" size={20} />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-gold-500 transition-colors"
                                placeholder="Enter username"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-slate-300 text-sm font-bold mb-2">Password</label>
                        <div className="relative">
                            <Eye className="absolute left-3 top-3 text-slate-500" size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-gold-500 transition-colors"
                                placeholder="Enter password"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="mt-6 pt-6 border-t border-white/10">
                    <button
                        onClick={handleGuestLogin}
                        className="w-full py-3 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10 transition-all text-sm"
                    >
                        Continue as Guest (Viewer)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
