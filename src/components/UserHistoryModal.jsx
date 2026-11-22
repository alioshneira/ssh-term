import React, { useState, useEffect } from 'react';
import { History, X, Clock, Laptop, CheckCircle2, AlertCircle } from 'lucide-react';

export default function UserHistoryModal({ isOpen, onClose, authFetch }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchMyLogs = async () => {
        setLoading(true);
        try {
          const res = await authFetch('/api/audit-logs/my');
          if (res.ok) {
            setLogs(await res.json());
          }
        } catch (err) {
          console.error('Error al cargar historial personal:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchMyLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} color="var(--accent-blue)" />
            <h3>Mi Historial de Conexiones SSH</h3>
          </div>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Registro de las sesiones SSH que has iniciado en los servidores corporativos.
          </p>

          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Servidor</th>
                  <th>IP Cliente</th>
                  <th>Resultado</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      {loading ? 'Cargando historial...' : 'No tienes conexiones registradas aún.'}
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '11px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <strong>{log.serverName}</strong>
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
                          {log.status === 'rejected_by_rbac' && 'Denegado'}
                          {log.status === 'disconnected' && 'Cerrado'}
                        </span>
                      </td>
                      <td style={{ fontSize: '11px' }}>
                        {log.durationSeconds !== null && log.durationSeconds !== undefined
                          ? `${Math.floor(log.durationSeconds / 60)}m ${log.durationSeconds % 60}s`
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
