import React, { useState } from 'react';
import {
  Server,
  Plus,
  Play,
  Edit2,
  Trash2,
  Search,
  ChevronLeft,
  Key,
  Lock
} from 'lucide-react';

export default function ServerSidebar({
  isOpen,
  onToggle,
  servers,
  onConnect,
  onAddNew,
  onEdit,
  onDelete
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredServers = servers.filter(s => {
    const term = searchTerm.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(term)) ||
      (s.host && s.host.toLowerCase().includes(term)) ||
      (s.username && s.username.toLowerCase().includes(term)) ||
      (s.group && s.group.toLowerCase().includes(term))
    );
  });

  return (
    <aside className={`sidebar ${isOpen ? '' : 'collapsed'}`}>
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={18} color="var(--accent-blue)" />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>Mis Servidores</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({servers.length})</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="btn btn-icon" onClick={onAddNew} title="Agregar servidor">
            <Plus size={16} />
          </button>
          <button className="btn btn-icon" onClick={onToggle} title="Ocultar barra lateral">
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      <div className="sidebar-search">
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nombre, host, tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="server-list">
        {filteredServers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--text-muted)', fontSize: '13px' }}>
            {servers.length === 0 ? (
              <>
                <p>No tienes servidores guardados.</p>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '12px', fontSize: '12px' }}
                  onClick={onAddNew}
                >
                  <Plus size={14} /> Agregar Servidor
                </button>
              </>
            ) : (
              <p>No hay coincidencias para "{searchTerm}"</p>
            )}
          </div>
        ) : (
          filteredServers.map((server) => (
            <div key={server.id} className="server-card">
              <div className="server-card-top">
                <span className="server-name">{server.name}</span>
                {server.group && <span className="server-tag">{server.group}</span>}
              </div>

              <div className="server-endpoint">
                {server.authType === 'key' ? (
                  <Key size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                ) : (
                  <Lock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                )}
                {server.username}@{server.host}:{server.port || 22}
              </div>

              {server.description && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {server.description}
                </div>
              )}

              <div className="server-card-actions">
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className="btn btn-icon"
                    onClick={() => onEdit(server)}
                    title="Editar servidor"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    className="btn btn-icon"
                    onClick={() => {
                      if (confirm(`¿Eliminar ${server.name}?`)) {
                        onDelete(server.id);
                      }
                    }}
                    title="Eliminar servidor"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <button
                  className="btn btn-success"
                  style={{ padding: '3px 10px', fontSize: '12px' }}
                  onClick={() => onConnect(server)}
                >
                  <Play size={12} /> Conectar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
