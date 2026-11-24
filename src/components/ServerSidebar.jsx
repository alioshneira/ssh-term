import React, { useState } from 'react';
import {
  Server,
  Plus,
  Play,
  Edit2,
  Trash2,
  Copy,
  Search,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Key,
  Lock,
  Tag,
  Layers,
  List
} from 'lucide-react';

export default function ServerSidebar({
  isOpen,
  onToggle,
  servers,
  keys = [],
  onConnect,
  onAddNew,
  onEdit,
  onDuplicate,
  onDelete,
  onOpenKeyVault
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'flat'
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // Extraer todos los tags únicos disponibles
  const allTags = Array.from(
    new Set(
      servers.flatMap(s => (Array.isArray(s.tags) ? s.tags : []))
    )
  ).filter(Boolean);

  const filteredServers = servers.filter(s => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (s.name && s.name.toLowerCase().includes(term)) ||
      (s.host && s.host.toLowerCase().includes(term)) ||
      (s.username && s.username.toLowerCase().includes(term)) ||
      (s.group && s.group.toLowerCase().includes(term)) ||
      (s.tags && s.tags.some(t => t.toLowerCase().includes(term)));

    const matchesTag = selectedTag ? (s.tags && s.tags.includes(selectedTag)) : true;

    return matchesSearch && matchesTag;
  });

  // Agrupar servidores por su Grupo de Servidores
  const groupedServers = {};
  filteredServers.forEach(server => {
    const grp = server.group || (server.tags && server.tags[0]) || 'General';
    if (!groupedServers[grp]) {
      groupedServers[grp] = [];
    }
    groupedServers[grp].push(server);
  });

  const toggleGroupCollapse = (groupName) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const collapseAllGroups = () => {
    const allCollapsed = {};
    Object.keys(groupedServers).forEach(g => {
      allCollapsed[g] = true;
    });
    setCollapsedGroups(allCollapsed);
  };

  const expandAllGroups = () => {
    setCollapsedGroups({});
  };

  const renderServerCard = (server) => (
    <div key={server.id} className="server-card">
      <div className="server-card-top">
        <span className="server-name">{server.name}</span>
        {viewMode === 'flat' && server.group && (
          <span className="server-group-pill">📁 {server.group}</span>
        )}
      </div>

      {/* Tags y Grupos RBAC del servidor */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '2px 0' }}>
        {server.groups && server.groups.map(g => (
          <span key={g.id} className="server-tag" style={{ color: 'var(--accent-blue)', borderColor: 'rgba(59, 130, 246, 0.3)' }} title="Grupo de Acceso RBAC">
            👥 {g.name}
          </span>
        ))}
        {server.tags && server.tags.map(t => (
          <span key={t} className="server-tag">
            #{t}
          </span>
        ))}
      </div>

      <div className="server-endpoint">
        {server.authType === 'saved_key' ? (
          <span title={`Usa llave guardada: ${server.keyInfo?.name || 'Key Vault'}`}>
            <Key size={12} color="var(--accent-purple)" style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
          </span>
        ) : server.authType === 'custom_key' ? (
          <Key size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
        ) : (
          <Lock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
        )}
        {server.username}@{server.host}:{server.port || 22}
      </div>

      {server.keyInfo && (
        <div style={{ fontSize: '11px', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Key size={10} /> Llave: {server.keyInfo.name} ({server.keyInfo.keyType})
        </div>
      )}

      {server.description && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {server.description}
        </div>
      )}

      <div className="server-card-actions">
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className="btn btn-icon"
            onClick={() => onDuplicate(server.id)}
            title="Duplicar conexión"
          >
            <Copy size={13} color="var(--accent-blue)" />
          </button>
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
  );

  return (
    <aside className={`sidebar ${isOpen ? '' : 'collapsed'}`}>
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={18} color="var(--accent-blue)" />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>Servidores</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({servers.length})</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="btn btn-icon" onClick={onOpenKeyVault} title="Gestor de Llaves SSH (Key Vault)">
            <Key size={15} color="var(--accent-purple)" />
          </button>
          <button className="btn btn-icon" onClick={() => onAddNew()} title="Agregar servidor">
            <Plus size={16} />
          </button>
          <button className="btn btn-icon" onClick={onToggle} title="Ocultar barra lateral">
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          className="search-input"
          placeholder="Buscar por host, nombre, grupo, tag..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Controles de vista: Vista por Grupos / Vista Plana */}
      <div className="sidebar-view-controls">
        <div className="view-mode-toggle">
          <button
            className={`btn-toggle-view ${viewMode === 'grouped' ? 'active' : ''}`}
            onClick={() => setViewMode('grouped')}
            title="Ver servidores agrupados en carpetas"
          >
            <Layers size={13} /> Por Grupos
          </button>
          <button
            className={`btn-toggle-view ${viewMode === 'flat' ? 'active' : ''}`}
            onClick={() => setViewMode('flat')}
            title="Ver lista simple"
          >
            <List size={13} /> Lista
          </button>
        </div>

        {viewMode === 'grouped' && Object.keys(groupedServers).length > 1 && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="btn-link-action" onClick={expandAllGroups} title="Expandir todos los grupos">
              Expandir
            </button>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <button className="btn-link-action" onClick={collapseAllGroups} title="Colapsar todos los grupos">
              Colapsar
            </button>
          </div>
        )}
      </div>

      {/* Barra de Filtros por Tags */}
      {allTags.length > 0 && (
        <div className="tag-filter-container">
          <button
            className={`tag-filter-btn ${selectedTag === null ? 'active' : ''}`}
            onClick={() => setSelectedTag(null)}
          >
            Todos ({servers.length})
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              className={`tag-filter-btn ${selectedTag === tag ? 'active' : ''}`}
              onClick={() => setSelectedTag(prev => prev === tag ? null : tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div className="server-list">
        {filteredServers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--text-muted)', fontSize: '13px' }}>
            {servers.length === 0 ? (
              <>
                <p>No tienes servidores guardados.</p>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '12px', fontSize: '12px' }}
                  onClick={() => onAddNew()}
                >
                  <Plus size={14} /> Agregar Servidor
                </button>
              </>
            ) : (
              <p>No hay servidores que coincidan con el filtro.</p>
            )}
          </div>
        ) : viewMode === 'grouped' ? (
          /* VISTA POR GRUPOS DE SERVIDORES (ACORDEÓN / CARPETAS) */
          Object.entries(groupedServers).map(([groupName, groupServers]) => {
            const isCollapsed = Boolean(collapsedGroups[groupName]);

            return (
              <div key={groupName} className="server-group-section">
                <div
                  className="server-group-header"
                  onClick={() => toggleGroupCollapse(groupName)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    {isCollapsed ? (
                      <ChevronRight size={14} color="var(--text-muted)" />
                    ) : (
                      <ChevronDown size={14} color="var(--text-muted)" />
                    )}
                    {isCollapsed ? (
                      <Folder size={15} color="var(--accent-blue)" />
                    ) : (
                      <FolderOpen size={15} color="var(--accent-blue)" />
                    )}
                    <span className="server-group-title">{groupName}</span>
                    <span className="server-group-count">{groupServers.length}</span>
                  </div>

                  <button
                    className="btn btn-icon btn-add-in-group"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddNew(groupName);
                    }}
                    title={`Agregar nuevo servidor en el grupo '${groupName}'`}
                  >
                    <Plus size={13} />
                  </button>
                </div>

                {!isCollapsed && (
                  <div className="server-group-items">
                    {groupServers.map(server => renderServerCard(server))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          /* VISTA PLANA */
          filteredServers.map(server => renderServerCard(server))
        )}
      </div>
    </aside>
  );
}
