import React, { useState } from 'react';
import { Key, Plus, Trash2, X, Lock, Shield, Check, Calendar, FileText } from 'lucide-react';

export default function KeyVaultModal({ isOpen, onClose, keys, onSaveKey, onDeleteKey }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    privateKey: '',
    passphrase: '',
    description: ''
  });

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setFormData({ name: '', privateKey: '', passphrase: '', description: '' });
    setEditingId(null);
    setIsAdding(true);
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', privateKey: '', passphrase: '', description: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) {
      alert('El nombre de la llave es obligatorio');
      return;
    }
    if (!editingId && !formData.privateKey) {
      alert('Debes ingresar el contenido de la clave privada');
      return;
    }

    onSaveKey({
      id: editingId,
      name: formData.name.trim(),
      privateKey: formData.privateKey ? formData.privateKey.trim() : undefined,
      passphrase: formData.passphrase ? formData.passphrase.trim() : undefined,
      description: formData.description.trim()
    });

    handleCancelForm();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} color="var(--accent-purple)" />
            <h3>Gestor de Llaves SSH (Key Vault)</h3>
          </div>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Guarda tus claves privadas SSH una sola vez y vincúlalas a múltiples servidores.
            Todas las claves se guardan cifradas con <strong>AES-256-GCM</strong> en reposo.
          </div>

          {!isAdding ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 10px 0' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Llaves Disponibles ({keys.length})</span>
                <button className="btn btn-primary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={handleStartAdd}>
                  <Plus size={14} /> Nueva Llave SSH
                </button>
              </div>

              {keys.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
                  <Key size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                  <p>No tienes llaves SSH guardadas en el Key Vault.</p>
                  <button className="btn btn-primary" style={{ marginTop: '10px', fontSize: '12px' }} onClick={handleStartAdd}>
                    Agregar mi primera llave
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                  {keys.map((k) => (
                    <div key={k.id} className="server-card" style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{k.name}</span>
                          <span className="server-tag" style={{ color: 'var(--accent-purple)', borderColor: 'rgba(139, 92, 246, 0.3)' }}>
                            {k.keyType}
                          </span>
                          {k.hasPassphrase && (
                            <span className="server-tag" style={{ color: 'var(--warning-color)' }} title="Protegida con Passphrase">
                              <Lock size={10} style={{ display: 'inline', marginRight: '2px' }} /> Passphrase
                            </span>
                          )}
                        </div>

                        <button
                          className="btn btn-icon"
                          onClick={() => {
                            if (confirm(`¿Estás seguro de eliminar la llave "${k.name}"? Los servidores que la utilicen no podrán conectar.`)) {
                              onDeleteKey(k.id);
                            }
                          }}
                          title="Eliminar llave"
                        >
                          <Trash2 size={13} color="var(--danger-color)" />
                        </button>
                      </div>

                      {k.description && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          {k.description}
                        </div>
                      )}

                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', gap: '12px' }}>
                        <span>ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{k.id}</code></span>
                        {k.createdAt && (
                          <span>Añadida: {new Date(k.createdAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              <div className="form-group">
                <label>Nombre Identificador de la Llave *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ej. AWS Bastion Clave Principal, DevOps Ed25519"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Contenido de la Clave Privada (OpenSSH / PEM) *</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: '140px', fontSize: '11px' }}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                  required={!editingId}
                  value={formData.privateKey}
                  onChange={(e) => setFormData({ ...formData, privateKey: e.target.value })}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Soporta RSA, Ed25519, ECDSA. Se cifra automáticamente en reposo.
                </span>
              </div>

              <div className="form-group">
                <label>Frase de Paso / Passphrase (Opcional)</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Dejar en blanco si la clave no tiene passphrase"
                  value={formData.passphrase}
                  onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Descripción / Notas</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ej. Clave para servidores de la región us-east-1"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn" onClick={handleCancelForm}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar en Key Vault
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
