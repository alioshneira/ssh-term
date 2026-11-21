import React, { useState, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Plus,
  X,
  Server,
  Zap,
  Globe,
  Settings,
  Shield,
  CheckCircle,
  Play
} from 'lucide-react';
import TerminalView from './components/TerminalView';
import ServerSidebar from './components/ServerSidebar';
import ServerModal from './components/ServerModal';
import QuickConnectModal from './components/QuickConnectModal';

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [servers, setServers] = useState([]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [serverToEdit, setServerToEdit] = useState(null);
  const [isQuickConnectOpen, setIsQuickConnectOpen] = useState(false);

  // Cargar lista de servidores guardados desde el backend
  const fetchServers = async () => {
    try {
      const res = await fetch('/api/servers');
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      }
    } catch (err) {
      console.error('Error al cargar servidores:', err);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

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

  // Actualizar estado de conexión de una sesión específica
  const handleStatusChange = (sessionId, newStatus) => {
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, status: newStatus } : s))
    );
  };

  // Guardar o actualizar servidor
  const handleSaveServer = async (serverData) => {
    try {
      const res = await fetch('/api/servers', {
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

  // Eliminar servidor
  const handleDeleteServer = async (id) => {
    try {
      const res = await fetch(`/api/servers/${id}`, {
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

  const handleEditServer = (server) => {
    setServerToEdit(server);
    setIsServerModalOpen(true);
  };

  const handleAddNewServer = () => {
    setServerToEdit(null);
    setIsServerModalOpen(true);
  };

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
          >
            <Zap size={14} />
            <span>Conectar</span>
          </button>

          <button
            className={`btn ${isSidebarOpen ? 'btn-primary' : ''}`}
            onClick={() => setIsSidebarOpen(prev => !prev)}
            title="Ver servidores guardados"
          >
            <Server size={14} />
            <span>Servidores ({servers.length})</span>
          </button>
        </div>
      </header>

      {/* Cuerpo principal: Barra lateral + Área de terminales */}
      <div className="workspace-body">
        <ServerSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(false)}
          servers={servers}
          onConnect={startSession}
          onAddNew={handleAddNewServer}
          onEdit={handleEditServer}
          onDelete={handleDeleteServer}
        />

        {sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-card">
              <div style={{ display: 'inline-flex', padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '16px', color: 'var(--accent-color)' }}>
                <TerminalIcon size={44} />
              </div>
              <h2>WebSSH Terminal</h2>
              <p>
                Cliente SSH web interactivo con emulación completa de terminal,
                soporte para múltiples pestañas simultáneas y gestión segura de servidores Linux.
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
              </div>

              {servers.length > 0 && (
                <div style={{ marginTop: '28px', textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Conexión rápida a servidores guardados:
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
      />

      <QuickConnectModal
        isOpen={isQuickConnectOpen}
        onClose={() => setIsQuickConnectOpen(false)}
        onConnect={startSession}
      />
    </div>
  );
}
