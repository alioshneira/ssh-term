import React, { useState, useEffect } from 'react';
import { X, Key, Lock, Activity, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ServerModal({ isOpen, onClose, onSave, serverToEdit }) {
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password',
    password: '',
    privateKey: '',
    passphrase: '',
    group: 'General',
    description: ''
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (serverToEdit) {
      setFormData({
        ...serverToEdit,
        port: serverToEdit.port || 22,
        authType: serverToEdit.authType || 'password'
      });
    } else {
      setFormData({
        name: '',
        host: '',
        port: 22,
        username: '',
        authType: 'password',
        password: '',
        privateKey: '',
        passphrase: '',
        group: 'General',
        description: ''
      });
    }
    setTestResult(null);
  }, [serverToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTestConnection = async () => {
    if (!formData.host) {
      alert('Por favor ingresa al menos la dirección del host');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: formData.host, port: formData.port || 22 })
      });
      const data = await res.json();
      setTestResult({
        success: res.ok,
        message: data.message
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: `Fallo al verificar puerto: ${err.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.host || !formData.username) {
      alert('El host y el usuario son obligatorios');
      return;
    }
    onSave({
      ...formData,
      name: formData.name.trim() || `${formData.username}@${formData.host}`,
      port: Number(formData.port) || 22
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{serverToEdit ? 'Editar Servidor' : 'Nuevo Servidor SSH'}</h3>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Nombre identificador / Etiqueta</label>
              <input
                type="text"
                className="form-input"
                name="name"
                placeholder="Ej. Servidor de Producción Web"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Host / IP *</label>
                <input
                  type="text"
                  className="form-input"
                  name="host"
                  placeholder="192.168.1.50 o midominio.com"
                  required
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

            <div className="form-row">
              <div className="form-group">
                <label>Usuario *</label>
                <input
                  type="text"
                  className="form-input"
                  name="username"
                  placeholder="root, ubuntu, etc."
                  required
                  value={formData.username}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Grupo / Categoría</label>
                <input
                  type="text"
                  className="form-input"
                  name="group"
                  placeholder="Ej. Producción, DB"
                  value={formData.group}
                  onChange={handleChange}
                />
              </div>
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
                <option value="key">Clave Privada SSH (PEM / OpenSSH)</option>
              </select>
            </div>

            {formData.authType === 'password' ? (
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  className="form-input"
                  name="password"
                  placeholder="Contraseña del usuario SSH"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>Contenido de la Clave Privada (RSA / Ed25519)</label>
                  <textarea
                    className="form-textarea"
                    name="privateKey"
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                    value={formData.privateKey}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Passphrase de la clave (opcional)</label>
                  <input
                    type="password"
                    className="form-input"
                    name="passphrase"
                    placeholder="Dejar en blanco si no tiene frase de paso"
                    value={formData.passphrase}
                    onChange={handleChange}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label>Descripción / Notas</label>
              <input
                type="text"
                className="form-input"
                name="description"
                placeholder="Detalles adicionales del servidor"
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            {testResult && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  background: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: testResult.success ? '#10b981' : '#ef4444',
                  border: `1px solid ${testResult.success ? '#10b98144' : '#ef444444'}`
                }}
              >
                {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn"
              onClick={handleTestConnection}
              disabled={testing}
            >
              <Activity size={14} />
              {testing ? 'Comprobando...' : 'Probar Puerto'}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Guardar Servidor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
