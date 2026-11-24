import React, { useState, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Plus,
  X,
  Server,
  Zap,
  Key,
  LogOut,
  User,
  Shield,
  History,
  AlertTriangle,
  Play
} from 'lucide-react';
import TerminalView from './components/TerminalView';
import ServerSidebar from './components/ServerSidebar';
import ServerModal from './components/ServerModal';
import QuickConnectModal from './components/QuickConnectModal';
import KeyVaultModal from './components/KeyVaultModal';
import LoginModal from './components/LoginModal';
import AdminPanelModal from './components/AdminPanelModal';
import UserHistoryModal from './components/UserHistoryModal';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('ssh_term_token'));
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('ssh_term_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [servers, setServers] = useState([]);
  const [keys, setKeys] = useState([]);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [serverToEdit, setServerToEdit] = useState(null);
  const [isQuickConnectOpen, setIsQuickConnectOpen] = useState(false);
  const [isKeyVaultOpen, setIsKeyVaultOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Helper para peticiones con autorización JWT
  const authFetch = async (url, options = {}) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      handleLogout();
      throw new Error('Sesión expirada o no autorizada');
    }
    return res;
  };

  const checkAuthMe = async () => {
    try {
      const res = await authFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.pendingUsersCount !== undefined) {
          setPendingUsersCount(data.pendingUsersCount);
        }
      }
    } catch (e) {}
  };

  // Cargar servidores y llaves cuando hay sesión activa
  const fetchServers = async () => {
    try {
      const res = await authFetch('/api/servers');
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      }
    } catch (err) {
      console.error('Error al cargar servidores:', err);
    }
  };

  const fetchKeys = async () => {
    try {
      const res = await authFetch('/api/keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      }
    } catch (err) {
      console.error('Error al cargar llaves SSH:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchServers();
      fetchKeys();
      checkAuthMe();
    }
  }, [token]);

  const handleLoginSuccess = (newToken, user, initialPendingCount = 0) => {
    localStorage.setItem('ssh_term_token', newToken);
    localStorage.setItem('ssh_term_user', JSON.stringify(user));
    setToken(newToken);
    setCurrentUser(user);
    setPendingUsersCount(initialPendingCount);
  };

  const handleLogout = () => {
    localStorage.removeItem('ssh_term_token');
    localStorage.removeItem('ssh_term_user');
    setToken(null);
    setCurrentUser(null);
    setSessions([]);
    setActiveSessionId(null);
  };

  // Iniciar una nueva sesión SSH en una pestaña
  const startSession = (serverConfig, saveToServerList = false) => {
    const newSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: serverConfig.name || `${serverConfig.username}@${serverConfig.host}`,
      serverConfig,
      status: 'connecting'
    };

    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newSession.id);

    if (saveToServerList) {
      handleSaveServer(serverConfig);
    }
  };

  // Cerrar pestaña de sesión
  const closeSession = (sessionId, e) => {
    e?.stopPropagation();
    setSessions(prev => {
      const nextSessions = prev.filter(s => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        if (nextSessions.length > 0) {
          setActiveSessionId(nextSessions[nextSessions.length - 1].id);
        } else {
          setActiveSessionId(null);
        }
      }
      return nextSessions;
    });
  };

  const handleStatusChange = (sessionId, newStatus) => {
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, status: newStatus } : s))
    );
  };

  const handleSaveServer = async (serverData) => {
    try {
      const res = await authFetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData)
      });
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers);
      }
    } catch (err) {
      console.error('Error guardando servidor:', err);
    }
  };

  const handleDuplicateServer = async (id) => {
    try {
      const res = await authFetch(`/api/servers/${id}/duplicate`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers);
      }
    } catch (err) {
      console.error('Error duplicando servidor:', err);
    }
  };

  const handleDeleteServer = async (id) => {
    try {
      const res = await authFetch(`/api/servers/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers);
      }
    } catch (err) {
      console.error('Error eliminando servidor:', err);
    }
  };

  const handleSaveKey = async (keyData) => {
    try {
      const res = await authFetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keyData)
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys);
        fetchServers();
      }
    } catch (err) {
      console.error('Error guardando llave SSH:', err);
    }
  };

  const handleDeleteKey = async (id) => {
    try {
      const res = await authFetch(`/api/keys/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys);
        fetchServers();
      }
    } catch (err) {
      console.error('Error eliminando llave SSH:', err);
    }
  };

  const [defaultServerGroup, setDefaultServerGroup] = useState('General');

  const existingGroups = Array.from(
    new Set(
      servers.map(s => s.group || (s.tags && s.tags[0]) || 'General')
    )
  ).filter(Boolean);

  const handleEditServer = (server) => {
    setServerToEdit(server);
    setIsServerModalOpen(true);
  };

  const handleAddNewServer = (group = 'General') => {
    setServerToEdit(null);
    setDefaultServerGroup(typeof group === 'string' ? group : 'General');
    setIsServerModalOpen(true);
  };

  const isAdmin = currentUser?.isGlobalAdmin || currentUser?.role === 'global_admin' || currentUser?.role === 'admin';

  if (!token) {
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Barra superior de navegación y pestañas */}
      <header className="top-bar">
        <div className="brand" onClick={() => setIsSidebarOpen(prev => !prev)} title="Alternar panel de servidores">
          <TerminalIcon className="brand-icon" size={20} />
          <span>WebSSH</span>
        </div>

        <div className="tabs-container">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`tab ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => setActiveSessionId(session.id)}
              title={`${session.serverConfig.username}@${session.serverConfig.host}`}
            >
              <span className={`tab-status-dot status-${session.status}`} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session.title}
              </span>
              <span
                className="tab-close"
                onClick={(e) => closeSession(session.id, e)}
                title="Cerrar pestaña"
              >
                <X size={12} />
              </span>
            </div>
          ))}

          <button
            className="new-tab-btn"
            onClick={() => setIsQuickConnectOpen(true)}
            title="Nueva conexión SSH"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="top-actions">
          <button
            className="btn btn-primary"
            onClick={() => setIsQuickConnectOpen(true)}
            title="Conexión SSH inmediata"
          >
            <Zap size={14} />
            <span>Conectar</span>
          </button>

          <button
            className="btn"
            onClick={() => setIsKeyVaultOpen(true)}
            title="Gestor de Llaves SSH compartidas"
          >
            <Key size={14} color="var(--accent-purple)" />
            <span>Llaves ({keys.length})</span>
          </button>

          <button
            className="btn"
            onClick={() => setIsHistoryOpen(true)}
            title="Mi historial de conexiones SSH"
          >
            <History size={14} />
            <span>Historial</span>
          </button>

          {/* Botón de Panel Admin si tiene privilegios */}
          {isAdmin && (
            <button
              className="btn"
              style={{ borderColor: 'rgba(59, 130, 246, 0.4)', background: 'rgba(59, 130, 246, 0.1)' }}
              onClick={() => setIsAdminPanelOpen(true)}
              title="Panel de Administración y Control RBAC"
            >
              <Shield size={14} color="var(--accent-blue)" />
              <span>Admin</span>
              {pendingUsersCount > 0 && (
                <span className="badge-pending-count" title={`${pendingUsersCount} usuarios pendientes de aprobación`}>
                  {pendingUsersCount}
                </span>
              )}
            </button>
          )}

          <button
            className={`btn ${isSidebarOpen ? 'btn-primary' : ''}`}
            onClick={() => setIsSidebarOpen(prev => !prev)}
            title="Ver servidores guardados"
          >
            <Server size={14} />
            <span>Servidores ({servers.length})</span>
          </button>

          {/* Perfil de usuario y Logout */}
          <div className="user-profile-badge" title={`Conectado como ${currentUser?.displayName || currentUser?.username} (${currentUser?.role || 'user'})`}>
            <div className="user-avatar" style={{ background: isAdmin ? 'var(--accent-purple)' : 'var(--accent-blue)' }}>
              {(currentUser?.displayName || currentUser?.username || 'U')[0].toUpperCase()}
            </div>
            <span className="user-name">
              {currentUser?.displayName || currentUser?.username}
            </span>
            <button
              className="btn btn-icon btn-logout"
              onClick={handleLogout}
              title="Cerrar sesión LDAP"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Cuerpo principal: Barra lateral + Área de terminales */}
      <div className="workspace-body">
        <ServerSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(false)}
          servers={servers}
          keys={keys}
          onConnect={startSession}
          onAddNew={handleAddNewServer}
          onEdit={handleEditServer}
          onDuplicate={handleDuplicateServer}
          onDelete={handleDeleteServer}
          onOpenKeyVault={() => setIsKeyVaultOpen(true)}
        />

        {sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-card">
              <div style={{ display: 'inline-flex', padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '16px', color: 'var(--accent-color)' }}>
                <TerminalIcon size={44} />
              </div>
              <h2>WebSSH Terminal</h2>
              <p>
                Cliente SSH interactivo seguro para múltiples servidores Linux.
                Protegido con <strong>control de acceso RBAC</strong>, <strong>aprobación LDAP</strong> y <strong>cifrado en reposo AES-256-GCM</strong>.
              </p>

              <div className="empty-quick-actions">
                <button
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                  onClick={() => setIsQuickConnectOpen(true)}
                >
                  <Zap size={16} /> Conexión Rápida
                </button>
                <button
                  className="btn"
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                  onClick={handleAddNewServer}
                >
                  <Plus size={16} /> Guardar Servidor
                </button>
                <button
                  className="btn"
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                  onClick={() => setIsKeyVaultOpen(true)}
                >
                  <Key size={16} color="var(--accent-purple)" /> Key Vault
                </button>
              </div>

              {servers.length > 0 && (
                <div style={{ marginTop: '28px', textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Tus servidores autorizados:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {servers.slice(0, 4).map(srv => (
                      <div
                        key={srv.id}
                        style={{
                          background: 'var(--bg-primary)',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onClick={() => startSession(srv)}
                      >
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 600, fontSize: '12px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {srv.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {srv.username}@{srv.host}
                          </div>
                          {srv.tags && srv.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                              {srv.tags.slice(0, 2).map(t => (
                                <span key={t} style={{ fontSize: '10px', color: 'var(--accent-color)' }}>#{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <Play size={14} color="var(--accent-color)" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
            {sessions.map(session => (
              <TerminalView
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modales */}
      <ServerModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        onSave={handleSaveServer}
        serverToEdit={serverToEdit}
        keys={keys}
        existingGroups={existingGroups}
        defaultGroup={defaultServerGroup}
        onOpenKeyVault={() => {
          setIsServerModalOpen(false);
          setIsKeyVaultOpen(true);
        }}
      />

      <QuickConnectModal
        isOpen={isQuickConnectOpen}
        onClose={() => setIsQuickConnectOpen(false)}
        onConnect={startSession}
        keys={keys}
      />

      <KeyVaultModal
        isOpen={isKeyVaultOpen}
        onClose={() => setIsKeyVaultOpen(false)}
        keys={keys}
        onSaveKey={handleSaveKey}
        onDeleteKey={handleDeleteKey}
      />

      <AdminPanelModal
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        authFetch={authFetch}
        allServers={servers}
        onRefreshData={() => {
          fetchServers();
          checkAuthMe();
        }}
      />

      <UserHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        authFetch={authFetch}
      />
    </div>
  );
}
