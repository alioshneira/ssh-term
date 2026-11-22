import React, { useState } from 'react';
import { Terminal, Shield, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor ingresa tu usuario y contraseña');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Credenciales LDAP inválidas');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon-badge">
            <Shield size={28} color="#10b981" />
          </div>
          <h2>WebSSH Terminal</h2>
          <p className="login-subtitle">
            Acceso corporativo seguro mediante <strong>LDAP / Active Directory</strong>
          </p>
        </div>

        {error && (
          <div className="login-error-alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Usuario LDAP / Red</label>
            <div className="input-with-icon">
              <User size={16} className="input-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="ej. jdoe o usuario_ldap"
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                type="password"
                className="form-input"
                placeholder="Contraseña de dominio"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading}
          >
            {loading ? 'Autenticando...' : (
              <>
                <span>Ingresar al Sistema</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer-info">
          <span>🔒 Cifrado AES-256-GCM habilitado en reposo</span>
        </div>
      </div>
    </div>
  );
}
