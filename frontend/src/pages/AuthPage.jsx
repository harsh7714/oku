import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import './AuthPage.css';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleToggle = () => {
    setIsLogin(!isLogin);
    setUsername('');
    setEmail('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLogin) {
      if (!email || !password) {
        return toast.warning('Please fill in all fields');
      }
      const res = await login(email, password);
      if (res.success) {
        navigate('/');
      }
    } else {
      if (!username || !email || !password) {
        return toast.warning('Please fill in all fields');
      }
      if (password.length < 6) {
        return toast.warning('Password must be at least 6 characters');
      }
      const res = await register(username, email, password);
      if (res.success) {
        navigate('/');
      }
    }
  };

  return (
    <div className="auth-container-fullscreen">
      <div className="auth-card glass glass-glow fade-in">
        <div className="auth-header-logo">
          <img src="/favicon.svg" alt="Oku" className="auth-logo-icon" width="48" height="48" />
          <h1 className="auth-logo">Oku</h1>
          <p className="auth-tagline">Connect. Express. Belong.</p>
        </div>

        <div className="auth-tabs">
          <button 
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => { if (!isLogin) handleToggle(); }}
          >
            Log In
          </button>
          <button 
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => { if (isLogin) handleToggle(); }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Username</label>
              <div className="input-with-icon">
                <User className="input-icon" size={18} />
                <input 
                  type="text" 
                  placeholder="choose_username" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{isLogin ? 'Email or Username' : 'Email Address'}</label>
            <div className="input-with-icon">
              <Mail className="input-icon" size={18} />
              <input 
                type="text" 
                placeholder={isLogin ? "email_or_username" : "email@domain.com"} 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-with-icon">
              <Lock className="input-icon" size={18} />
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input password-input"
                required
              />
              <button 
                type="button" 
                className="btn-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-submit-btn">
            {isLogin ? 'Log In to Oku' : 'Create Oku Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;
