'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthModal({ isOpen, onClose }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const emailInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setMessage(null);
      setLoading(false);
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, isSignUp]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpErr) throw signUpErr;

        if (data?.session) {
          onClose();
        } else {
          setMessage('Account created! Please check your email to verify your account or sign in.');
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw signInErr;
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal auth-modal" onClick={e => e.stopPropagation()}>
        <div className="auth-modal-header">
          <div className="auth-modal-logo">
            <span className="auth-modal-icon">🎵</span>
            <span className="auth-modal-brand">SAFI</span>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${!isSignUp ? 'active' : ''}`}
            onClick={() => { setIsSignUp(false); setError(null); setMessage(null); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${isSignUp ? 'active' : ''}`}
            onClick={() => { setIsSignUp(true); setError(null); setMessage(null); }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="login-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {message && (
          <div className="auth-success-msg" style={{ marginBottom: 16 }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="auth-email">Email Address</label>
            <input
              ref={emailInputRef}
              id="auth-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </div>

          <div className="auth-modal-footer">
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? (isSignUp ? 'Creating account…' : 'Signing in…') : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
