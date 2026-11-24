import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Layers,
  FileText,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  Search,
  Clock,
  Laptop,
  Lock,
  UserCheck,
  Folder
} from 'lucide-react';

export default function AdminPanelModal({ isOpen, onClose, authFetch, allServers = [], onRefreshData }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'groups' | 'audit'
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [adminServers, setAdminServers] = useState(allServers);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState({ username: '', status: '' });

  // Estado para crear/editar grupo
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [groupFormData, setGroupFormData] = useState({
    id: null,
    name: '',
    description: '',
    serverIds: [],
    serverGroups: [],
    memberUsernames: []
  });
  const [customServerGroupInput, setCustomServerGroupInput] = useState('');

  // Sincronizar servidores recibidos por props
  useEffect(() => {
    if (allServers && allServers.length > 0) {
      setAdminServers(allServers);
    }
  }, [allServers]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const res = await authFetch('/api/admin/users');
        if (res.ok) setUsers(await res.json());
      } else if (activeTab === 'groups') {
        const res = await authFetch('/api/admin/groups');
        if (res.ok) setGroups(await res.json());
        // Cargar usuarios para asignación
        const resUsers = await authFetch('/api/admin/users');
        if (resUsers.ok) setUsers(await resUsers.json());
        // Cargar lista completa de servidores del backend para administradores
        const resServers = await authFetch('/api/admin/servers');
        if (resServers.ok) {
          const srvList = await resServers.json();
          setAdminServers(srvList);
        }
      } else if (activeTab === 'audit') {
        const params = new URLSearchParams();
        if (auditFilter.username) params.append('username', auditFilter.username);
        if (auditFilter.status) params.append('status', auditFilter.status);

        const res = await authFetch(`/api/admin/audit-logs?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setAuditLogs(data.logs || []);
        }
      }
    } catch (err) {
      console.error('Error cargando datos de administración:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, activeTab, auditFilter]);

  // Grupos de servidores disponibles extraídos de todos los servidores registrados
  const availableServerGroups = Array.from(
    new Set(
      adminServers.map(s => s.group || (s.tags && s.tags[0]) || 'General')
    )
  ).filter(Boolean);

  const getServerCountByGroup = (groupName) => {
    return adminServers.filter(s => (s.group || (s.tags && s.tags[0]) || 'General') === groupName).length;
  };

  const addCustomServerGroup = () => {
    const trimmed = customServerGroupInput.trim();
    if (!trimmed) return;
    const current = groupFormData.serverGroups || [];
    if (!current.includes(trimmed)) {
      setGroupFormData({ ...groupFormData, serverGroups: [...current, trimmed] });
    }
    setCustomServerGroupInput('');
  };

  if (!isOpen) return null;

  // Acciones sobre usuarios
  const handleUpdateUserStatus = async (username, status, role, accessGroups) => {
    try {
      const res = await authFetch(`/api/admin/users/${encodeURIComponent(username)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, role, accessGroups })
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        onRefreshData?.();
      }
    } catch (err) {
      console.error('Error actualizando usuario:', err);
    }
  };

  // Acciones sobre grupos
  const handleSaveGroup = async (e) => {
    e.preventDefault();
    if (!groupFormData.name) {
      alert('El nombre del grupo es obligatorio');
      return;
    }

    try {
      const res = await authFetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupFormData)
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups);
        setIsEditingGroup(false);
        setGroupFormData({ id: null, name: '', description: '', serverIds: [], serverGroups: [], memberUsernames: [] });
        onRefreshData?.();
      }
    } catch (err) {
      console.error('Error guardando grupo:', err);
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este grupo de acceso?')) return;
    try {
      const res = await authFetch(`/api/admin/groups/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups);
        onRefreshData?.();
      }
    } catch (err) {
      console.error('Error eliminando grupo:', err);
    }
  };

  const pendingUsers = users.filter(u => u.status === 'pending');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content admin-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} color="var(--accent-blue)" />
            <h3>Panel de Administración y Gobierno RBAC</h3>
          </div>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Pestañas de navegación interna */}
        <div className="admin-nav-tabs">
          <button
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={15} />
            <span>Usuarios y Aprobaciones</span>
            {pendingUsers.length > 0 && (
              <span className="badge-pending-count">{pendingUsers.length}</span>
            )}
          </button>

          <button
            className={`admin-tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            <Layers size={15} />
            <span>Grupos de Acceso (RBAC)</span>
          </button>

          <button
            className={`admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <FileText size={15} />
            <span>Registro de Auditoría (Logs)</span>
          </button>
        </div>

        <div className="modal-body admin-modal-body">
          {/* TAB 1: USUARIOS Y APROBACIONES */}
          {activeTab === 'users' && (
            <div>
              {pendingUsers.length > 0 && (
                <div className="admin-pending-banner">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} color="var(--warning-color)" />
                    <strong>Usuarios pendientes de aprobación ({pendingUsers.length})</strong>
                  </div>
                  <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-secondary)' }}>
                    Los siguientes usuarios autenticados por LDAP requieren que habilites su acceso antes de poder ingresar.
                  </p>
                </div>
              )}

              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Usuario / Nombre</th>
                      <th>Email / LDAP</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Grupos Asignados</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.username} className={u.status === 'pending' ? 'row-pending' : ''}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{u.displayName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            @{u.username}
                          </div>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <div>{u.email || 'N/A'}</div>
                          {u.ldapGroups && u.ldapGroups.length > 0 && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              LDAP: {u.ldapGroups.slice(0, 2).join(', ')}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${u.role === 'global_admin' ? 'badge-primary' : 'badge-default'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-status-${u.status}`}>
                            {u.status === 'active' && 'Habilitado'}
                            {u.status === 'pending' && 'Pendiente'}
                            {u.status === 'disabled' && 'Deshabilitado'}
                          </span>
                        </td>
                        <td style={{ fontSize: '11px' }}>
                          {u.accessGroups && u.accessGroups.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {u.accessGroups.map(gid => (
                                <span key={gid} className="server-tag">{gid}</span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Ninguno</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {u.status === 'pending' && (
                              <button
                                className="btn btn-success"
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                onClick={() => handleUpdateUserStatus(u.username, 'active', u.role, u.accessGroups)}
                                title="Aprobar y habilitar usuario"
                              >
                                <UserCheck size={13} /> Aprobar
                              </button>
                            )}

                            {u.status === 'active' && u.role !== 'global_admin' && (
                              <button
                                className="btn btn-danger"
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                onClick={() => handleUpdateUserStatus(u.username, 'disabled', u.role, u.accessGroups)}
                                title="Deshabilitar usuario"
                              >
                                Deshabilitar
                              </button>
                            )}

                            {u.status === 'disabled' && (
                              <button
                                className="btn btn-success"
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                onClick={() => handleUpdateUserStatus(u.username, 'active', u.role, u.accessGroups)}
                                title="Reactivar usuario"
                              >
                                Activar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: GRUPOS DE ACCESO (RBAC) */}
          {activeTab === 'groups' && (
            <div>
              {!isEditingGroup ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Los grupos permiten asociar servidores y carpetas enteras a usuarios de manera centralizada.
                    </span>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setGroupFormData({ id: null, name: '', description: '', serverIds: [], serverGroups: [], memberUsernames: [] });
                        setIsEditingGroup(true);
                      }}
                    >
                      <Plus size={14} /> Nuevo Grupo
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                    {groups.map(g => (
                      <div key={g.id} className="server-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{g.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{g.description || 'Sin descripción'}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="btn btn-icon"
                              onClick={() => {
                                setGroupFormData({
                                  ...g,
                                  serverIds: g.serverIds || [],
                                  serverGroups: g.serverGroups || [],
                                  memberUsernames: g.memberUsernames || []
                                });
                                setIsEditingGroup(true);
                              }}
                              title="Editar grupo"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              className="btn btn-icon"
                              onClick={() => handleDeleteGroup(g.id)}
                              title="Eliminar grupo"
                            >
                              <Trash2 size={13} color="var(--danger-color)" />
                            </button>
                          </div>
                        </div>

                        {/* Grupos de Servidores (Carpetas) asociados */}
                        {g.serverGroups && g.serverGroups.length > 0 && (
                          <div style={{ marginTop: '10px', fontSize: '12px' }}>
                            <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                              📁 <strong>Grupos de Servidores ({g.serverGroups.length}):</strong>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {g.serverGroups.map(grpName => (
                                <span key={grpName} className="server-group-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Folder size={11} /> {grpName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Servidores específicos asignados */}
                        <div style={{ marginTop: '8px', fontSize: '12px' }}>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            🖥️ <strong>Servidores específicos ({g.serverIds ? g.serverIds.length : 0}):</strong>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {g.serverIds && g.serverIds.length > 0 ? (
                              g.serverIds.map(sid => {
                                const srv = adminServers.find(s => s.id === sid);
                                return (
                                  <span key={sid} className="server-tag" style={{ color: 'var(--accent-blue)' }}>
                                    {srv ? srv.name : sid}
                                  </span>
                                );
                              })
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {g.serverGroups && g.serverGroups.length > 0 ? 'Habilitado por grupos' : 'Ninguno'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Miembros */}
                        <div style={{ marginTop: '8px', fontSize: '12px' }}>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            👤 <strong>Usuarios miembros ({g.memberUsernames ? g.memberUsernames.length : 0}):</strong>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {g.memberUsernames && g.memberUsernames.length > 0 ? (
                              g.memberUsernames.map(u => (
                                <span key={u} className="server-tag" style={{ color: 'var(--accent-color)' }}>
                                  @{u}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ninguno</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveGroup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h4>{groupFormData.id ? 'Editar Grupo de Acceso' : 'Crear Grupo de Acceso'}</h4>

                  <div className="form-group">
                    <label>Nombre del Grupo *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="ej. Equipo DevOps, DBAs, Soporte Técnico"
                      required
                      value={groupFormData.name}
                      onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Descripción</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Propósito del grupo"
                      value={groupFormData.description}
                      onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                    />
                  </div>

                  {/* Selector de Grupos de Servidores (Carpetas) */}
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Folder size={15} color="var(--accent-blue)" />
                        <strong>Acceso por Grupos de Servidores (Carpetas):</strong>
                      </label>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Otorga acceso automático a todos los servidores de estas carpetas
                      </span>
                    </div>

                    <div style={{ maxHeight: '140px', overflowY: 'auto', background: 'var(--bg-primary)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      {availableServerGroups.length === 0 ? (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No hay grupos de servidores registrados</p>
                      ) : (
                        availableServerGroups.map(grpName => {
                          const checked = (groupFormData.serverGroups || []).includes(grpName);
                          const count = getServerCountByGroup(grpName);
                          return (
                            <label key={grpName} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '12px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const current = groupFormData.serverGroups || [];
                                  if (e.target.checked) {
                                    setGroupFormData({ ...groupFormData, serverGroups: [...current, grpName] });
                                  } else {
                                    setGroupFormData({ ...groupFormData, serverGroups: current.filter(g => g !== grpName) });
                                  }
                                }}
                              />
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Folder size={13} color="var(--accent-blue)" />
                                <strong>{grpName}</strong>
                                <span className="server-group-count">{count} {count === 1 ? 'servidor' : 'servidores'}</span>
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>

                    {/* Input para agregar o pre-configurar otro grupo de servidores */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                        placeholder="Otro grupo o carpeta personalizada (ej. Staging, Producción)..."
                        value={customServerGroupInput}
                        onChange={(e) => setCustomServerGroupInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomServerGroup();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: '11px', padding: '4px 10px', whiteSpace: 'nowrap' }}
                        onClick={addCustomServerGroup}
                      >
                        <Plus size={12} /> Añadir
                      </button>
                    </div>
                  </div>

                  {/* Selector de Servidores Individuales */}
                  <div className="form-group">
                    <label>Servidores específicos adicionales:</label>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', background: 'var(--bg-primary)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      {adminServers.length === 0 ? (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No hay servidores registrados</p>
                      ) : (
                        adminServers.map(s => {
                          const checked = groupFormData.serverIds.includes(s.id);
                          return (
                            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '12px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setGroupFormData({ ...groupFormData, serverIds: [...groupFormData.serverIds, s.id] });
                                  } else {
                                    setGroupFormData({ ...groupFormData, serverIds: groupFormData.serverIds.filter(id => id !== s.id) });
                                  }
                                }}
                              />
                              <span>
                                <strong>{s.name}</strong> ({s.username}@{s.host})
                                {s.group && <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>[📁 {s.group}]</span>}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Selector de Usuarios Miembros */}
                  <div className="form-group">
                    <label>Usuarios que pertenecen a este grupo:</label>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', background: 'var(--bg-primary)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      {users.length === 0 ? (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No hay usuarios registrados</p>
                      ) : (
                        users.map(u => {
                          const checked = groupFormData.memberUsernames.includes(u.username);
                          return (
                            <label key={u.username} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '12px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setGroupFormData({ ...groupFormData, memberUsernames: [...groupFormData.memberUsernames, u.username] });
                                  } else {
                                    setGroupFormData({ ...groupFormData, memberUsernames: groupFormData.memberUsernames.filter(un => un !== u.username) });
                                  }
                                }}
                              />
                              <span><strong>{u.displayName}</strong> (@{u.username}) - {u.status}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" className="btn" onClick={() => setIsEditingGroup(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Guardar Grupo
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: REGISTRO DE AUDITORÍA */}
          {activeTab === 'audit' && (
            <div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ maxWidth: '240px' }}
                  placeholder="Filtrar por usuario..."
                  value={auditFilter.username}
                  onChange={(e) => setAuditFilter({ ...auditFilter, username: e.target.value })}
                />
                <select
                  className="form-select"
                  style={{ maxWidth: '180px' }}
                  value={auditFilter.status}
                  onChange={(e) => setAuditFilter({ ...auditFilter, status: e.target.value })}
                >
                  <option value="">Todos los estados</option>
                  <option value="success">Éxito / Conectado</option>
                  <option value="failed">Fallo de Conexión</option>
                  <option value="rejected_by_rbac">Bloqueado por RBAC</option>
                  <option value="disconnected">Finalizado</option>
                </select>
              </div>

              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Fecha / Hora</th>
                      <th>Usuario</th>
                      <th>Servidor Destino</th>
                      <th>IP Cliente</th>
                      <th>Resultado</th>
                      <th>Duración</th>
                      <th>Detalles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                          No se encontraron registros de auditoría.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map(log => (
                        <tr key={log.id}>
                          <td style={{ fontSize: '11px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td>
                            <strong>{log.userDisplayName}</strong>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>@{log.username}</div>
                          </td>
                          <td>
                            <div>{log.serverName}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {log.serverHost}
                            </div>
                          </td>
                          <td style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                            {log.clientIp}
                          </td>
                          <td>
                            <span className={`badge badge-audit-${log.status}`}>
                              {log.status === 'success' && 'Conectado'}
                              {log.status === 'failed' && 'Fallo'}
                              {log.status === 'rejected_by_rbac' && 'Denegado RBAC'}
                              {log.status === 'disconnected' && 'Cerrado'}
                            </span>
                          </td>
                          <td style={{ fontSize: '11px' }}>
                            {log.durationSeconds !== null && log.durationSeconds !== undefined
                              ? `${Math.floor(log.durationSeconds / 60)}m ${log.durationSeconds % 60}s`
                              : '-'}
                          </td>
                          <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {log.details}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
