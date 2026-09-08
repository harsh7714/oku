import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Eye, EyeOff, Lock, Mail, User, AlertCircle, Loader2 } from 'lucide-react';
import { checkExplicitUsername, checkExplicitEmail } from '../utils/explicitFilter';
import './AuthPage.css';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const usernameValidation = !isLogin && username ? checkExplicitUsername(username) : { isValid: true };
  const emailValidation = !isLogin && email ? checkExplicitEmail(email) : { isValid: true };

  const handleToggle = () => {
    setIsLogin(!isLogin);
    setUsername('');
    setEmail('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting) return;

    if (isLogin) {
      if (!email || !password) {
        return toast.warning('Please fill in all fields');
      }
      setSubmitting(true);
      try {
        const res = await login(email, password);
        if (res.success) {
          navigate('/');
        }
      } finally {
        setSubmitting(false);
      }
    } else {
      if (!username || !email || !password) {
        return toast.warning('Please fill in all fields');
      }
      if (!usernameValidation.isValid) {
        return toast.warning(usernameValidation.reason || 'Invalid username');
      }
      if (!emailValidation.isValid) {
        return toast.warning(emailValidation.reason || 'Invalid email address');
      }
      if (password.length < 6) {
        return toast.warning('Password must be at least 6 characters');
      }
      setSubmitting(true);
      try {
        const res = await register(username, email, password);
        if (res.success) {
          navigate('/');
        }
      } finally {
        setSubmitting(false);
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
              <div className={`input-with-icon ${!usernameValidation.isValid ? 'has-error' : ''}`}>
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
              {!usernameValidation.isValid && (
                <div className="input-warning-msg fade-in">
                  <AlertCircle size={14} />
                  <span>{usernameValidation.reason}</span>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{isLogin ? 'Email or Username' : 'Email Address'}</label>
            <div className={`input-with-icon ${!emailValidation.isValid ? 'has-error' : ''}`}>
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
            {!isLogin && !emailValidation.isValid && (
              <div className="input-warning-msg fade-in">
                <AlertCircle size={14} />
                <span>{emailValidation.reason}</span>
              </div>
            )}
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

          <button 
            type="submit" 
            className="btn btn-primary auth-submit-btn"
            disabled={submitting || (!isLogin && (!usernameValidation.isValid || !emailValidation.isValid))}
          >
            {submitting ? (
              <span className="btn-loading-content">
                <Loader2 className="spinner" size={18} />
                <span>{isLogin ? 'Logging in...' : 'Creating Account...'}</span>
              </span>
            ) : (
              isLogin ? 'Log In to Oku' : 'Create Oku Account'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;
