import React, { useState, useEffect } from 'react';
import { X, Key, Lock, Activity, CheckCircle2, AlertCircle, Plus, Tag } from 'lucide-react';

export default function ServerModal({
  isOpen,
  onClose,
  onSave,
  serverToEdit,
  keys = [],
  onOpenKeyVault
}) {
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password', // 'password' | 'saved_key' | 'custom_key'
    keyId: '',
    password: '',
    privateKey: '',
    passphrase: '',
    tags: ['General'],
    description: ''
  });

  const [tagInput, setTagInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (serverToEdit) {
      const initialTags = Array.isArray(serverToEdit.tags)
        ? serverToEdit.tags
        : (serverToEdit.group ? [serverToEdit.group] : ['General']);

      setFormData({
        ...serverToEdit,
        port: serverToEdit.port || 22,
        authType: serverToEdit.authType || 'password',
        keyId: serverToEdit.keyId || '',
        tags: initialTags,
        password: '', // Por seguridad no se rellenan contraseñas en claro
        privateKey: '',
        passphrase: ''
      });
    } else {
      setFormData({
        name: '',
        host: '',
        port: 22,
        username: '',
        authType: keys.length > 0 ? 'saved_key' : 'password',
        keyId: keys.length > 0 ? keys[0].id : '',
        password: '',
        privateKey: '',
        passphrase: '',
        tags: ['General'],
        description: ''
      });
    }
    setTagInput('');
    setTestResult(null);
  }, [serverToEdit, isOpen, keys]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddTag = (e) => {
    e?.preventDefault();
    const cleanTag = tagInput.trim();
    if (cleanTag && !formData.tags.includes(cleanTag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, cleanTag] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tagToRemove)
    }));
  };

  const handleTestConnection = async () => {
    if (!formData.host) {
      alert('Por favor ingresa al menos la dirección del host');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem('ssh_term_token');
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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

    if (formData.authType === 'saved_key' && !formData.keyId) {
      alert('Por favor selecciona una llave del Key Vault');
      return;
    }

    onSave({
      ...formData,
      name: formData.name.trim() || `${formData.username}@${formData.host}`,
      port: Number(formData.port) || 22,
      tags: formData.tags.length > 0 ? formData.tags : ['General'],
      // Si estamos editando y no se escribió nueva contraseña/clave, omitir para conservar la previa
      password: formData.password ? formData.password : undefined,
      privateKey: formData.privateKey ? formData.privateKey : undefined,
      passphrase: formData.passphrase ? formData.passphrase : undefined
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

            <div className="form-group">
              <label>Usuario SSH *</label>
              <input
                type="text"
                className="form-input"
                name="username"
                placeholder="root, ubuntu, debian..."
                required
                value={formData.username}
                onChange={handleChange}
              />
            </div>

            {/* Gestión de Tags / Etiquetas */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Tag size={13} /> Tags / Etiquetas
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                {formData.tags.map(t => (
                  <span key={t} className="server-tag tag-badge-editable">
                    {t}
                    <X
                      size={11}
                      style={{ cursor: 'pointer', marginLeft: '4px' }}
                      onClick={() => handleRemoveTag(t)}
                    />
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder="Agregar tag (ej. Producción, AWS, DB)..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <button type="button" className="btn" onClick={handleAddTag}>
                  <Plus size={14} /> Añadir
                </button>
              </div>
            </div>

            {/* Método de Autenticación */}
            <div className="form-group">
              <label>Método de Autenticación</label>
              <select
                className="form-select"
                name="authType"
                value={formData.authType}
                onChange={handleChange}
              >
                <option value="password">Contraseña</option>
                <option value="saved_key">🔑 Llave Guardada en Key Vault (Compartida)</option>
                <option value="custom_key">Clave Privada Personalizada (Texto PEM)</option>
              </select>
            </div>

            {formData.authType === 'password' && (
              <div className="form-group">
                <label>
                  Contraseña
                  {serverToEdit && serverToEdit.hasPassword && (
                    <span style={{ fontSize: '11px', color: 'var(--accent-color)', marginLeft: '8px' }}>
                      (Ya tiene contraseña cifrada guardada. Deja en blanco para no cambiarla)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  className="form-input"
                  name="password"
                  placeholder={serverToEdit && serverToEdit.hasPassword ? '••••••••' : 'Contraseña del servidor'}
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            )}

            {formData.authType === 'saved_key' && (
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Seleccionar Llave del Key Vault *</label>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '11px', cursor: 'pointer' }}
                    onClick={onOpenKeyVault}
                  >
                    + Gestionar Llaves
                  </button>
                </div>
                {keys.length === 0 ? (
                  <div style={{ padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: '6px', fontSize: '12px', color: 'var(--warning-color)' }}>
                    No tienes llaves en el Key Vault.{' '}
                    <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={onOpenKeyVault}>
                      Haz clic aquí para agregar una
                    </span>.
                  </div>
                ) : (
                  <select
                    className="form-select"
                    name="keyId"
                    value={formData.keyId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">-- Selecciona una llave SSH --</option>
                    {keys.map(k => (
                      <option key={k.id} value={k.id}>
                        {k.name} ({k.keyType})
                      </option>
                    ))}
                  </select>
                )}
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Varios servidores pueden utilizar esta misma llave.
                </span>
              </div>
            )}

            {formData.authType === 'custom_key' && (
              <>
                <div className="form-group">
                  <label>
                    Contenido de la Clave Privada (PEM / OpenSSH)
                    {serverToEdit && serverToEdit.hasCustomKey && (
                      <span style={{ fontSize: '11px', color: 'var(--accent-color)', marginLeft: '8px' }}>
                        (Clave guardada previamente. Deja en blanco para conservarla)
                      </span>
                    )}
                  </label>
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
                    placeholder="Frase de paso si la clave está protegida"
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
