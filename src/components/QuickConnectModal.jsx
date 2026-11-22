import React, { useState } from 'react';
import { X, Terminal, Key } from 'lucide-react';

export default function QuickConnectModal({ isOpen, onClose, onConnect, keys = [] }) {
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password', // 'password' | 'saved_key' | 'key'
    keyId: '',
    password: '',
    privateKey: '',
    passphrase: '',
    saveToFavorites: false
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.host || !formData.username) {
      alert('Host y Usuario son obligatorios');
      return;
    }

    if (formData.authType === 'saved_key' && !formData.keyId) {
      alert('Por favor selecciona una llave del Key Vault');
      return;
    }

    onConnect({
      ...formData,
      name: formData.name.trim() || `${formData.username}@${formData.host}`,
      port: Number(formData.port) || 22
    }, formData.saveToFavorites);

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={18} color="var(--accent-color)" />
            <h3>Conexión Rápida SSH</h3>
          </div>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>Host / IP *</label>
                <input
                  type="text"
                  className="form-input"
                  name="host"
                  placeholder="ej. 192.168.1.100 o midominio.com"
                  required
                  autoFocus
                  value={formData.host}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Puerto *</label>
                <input
                  type="number"
                  className="form-input"
                  name="port"
                  value={formData.port}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Usuario SSH *</label>
              <input
                type="text"
                className="form-input"
                name="username"
                placeholder="ej. root, debian, ubuntu"
                required
                value={formData.username}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Método de Autenticación</label>
              <select
                className="form-select"
                name="authType"
                value={formData.authType}
                onChange={handleChange}
              >
                <option value="password">Contraseña</option>
                {keys.length > 0 && (
                  <option value="saved_key">🔑 Llave Guardada en Key Vault</option>
                )}
                <option value="key">Clave Privada Personalizada (Texto PEM)</option>
              </select>
            </div>

            {formData.authType === 'password' && (
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  className="form-input"
                  name="password"
                  placeholder="Introduce la contraseña"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            )}

            {formData.authType === 'saved_key' && (
              <div className="form-group">
                <label>Selecciona la Llave del Key Vault</label>
                <select
                  className="form-select"
                  name="keyId"
                  value={formData.keyId}
                  onChange={handleChange}
                  required
                >
                  <option value="">-- Elige una llave guardada --</option>
                  {keys.map(k => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.keyType})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.authType === 'key' && (
              <>
                <div className="form-group">
                  <label>Clave Privada</label>
                  <textarea
                    className="form-textarea"
                    name="privateKey"
                    placeholder="Pega aquí la clave privada PEM u OpenSSH..."
                    value={formData.privateKey}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Passphrase (si aplica)</label>
                  <input
                    type="password"
                    className="form-input"
                    name="passphrase"
                    placeholder="Frase de paso opcional"
                    value={formData.passphrase}
                    onChange={handleChange}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <input
                type="checkbox"
                id="saveFav"
                name="saveToFavorites"
                checked={formData.saveToFavorites}
                onChange={handleChange}
              />
              <label htmlFor="saveFav" style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Guardar este servidor en mi lista de favoritos
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Iniciar Sesión SSH
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
