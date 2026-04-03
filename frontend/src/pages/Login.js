import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', name: '', company_name: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegister) {
        await register(form.email, form.password, form.name, form.company_name);
      } else {
        await login(form.email, form.password);
      }
      navigate('/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) setError(detail.map(e => e.msg).join(', '));
      else setError(typeof detail === 'string' ? detail : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => setForm(f => ({ ...f, email: 'admin@acme.com', password: 'admin123' }));

  return (
    <div className="min-h-screen login-bg flex items-center justify-center relative overflow-hidden">
      {/* Animated blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 60, 0], y: [0, -40, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-20 -left-20 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)' }}
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 60, 0], scale: [1, 1.3, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md px-4 relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/30">
            <Building2 size={26} color="white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-50" style={{ fontFamily: 'Work Sans, sans-serif' }}>FinAI</h1>
          <p className="text-slate-400 text-sm mt-1">AI-Powered Accounting Platform</p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-slate-100 mb-6" style={{ fontFamily: 'Work Sans, sans-serif' }}>
            {isRegister ? 'Create your account' : 'Sign in to your account'}
          </h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm text-red-300 bg-red-500/10 border border-red-500/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Full Name</label>
                  <input
                    type="text"
                    className="fin-input"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                    data-testid="register-name-input"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Company Name</label>
                  <input
                    type="text"
                    className="fin-input"
                    placeholder="Acme Pvt Ltd"
                    value={form.company_name}
                    onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                    required
                    data-testid="register-company-input"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  className="fin-input pl-10"
                  placeholder="admin@acme.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  data-testid="login-email-input"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="fin-input pl-10 pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3"
              data-testid="login-submit-btn"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isRegister ? 'Create Account' : 'Sign In'}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {!isRegister && (
            <button
              onClick={fillDemo}
              className="w-full mt-3 text-center text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              data-testid="demo-login-btn"
            >
              Use demo credentials (admin@acme.com)
            </button>
          )}

          <div className="mt-6 text-center text-sm text-slate-500">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-indigo-400 hover:text-indigo-300 font-medium"
              data-testid="toggle-auth-mode"
            >
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Demo: admin@acme.com / admin123
        </p>
      </motion.div>
    </div>
  );
}
