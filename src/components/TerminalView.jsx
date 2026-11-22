import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import {
  RotateCcw,
  PowerOff,
  Trash2,
  ZoomIn,
  ZoomOut,
  Palette,
  Maximize2
} from 'lucide-react';

const THEMES = {
  dracula: {
    background: '#1e1f29',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    selectionBackground: '#44475a',
    black: '#000000',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#bfbfbf',
    brightBlack: '#4d4d4d',
    brightRed: '#ff6e67',
    brightGreen: '#5af78e',
    brightYellow: '#f4f99d',
    brightBlue: '#caa9fa',
    brightMagenta: '#ff92d0',
    brightCyan: '#9aedfe',
    brightWhite: '#e6e6e6'
  },
  tokyoNight: {
    background: '#1a1b26',
    foreground: '#a9b1d6',
    cursor: '#c0caf5',
    selectionBackground: '#283457',
    black: '#32344a',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#787c99',
    brightBlack: '#444b6a',
    brightRed: '#ff7a93',
    brightGreen: '#b9f27c',
    brightYellow: '#ff9e64',
    brightBlue: '#7da6ff',
    brightMagenta: '#bb9af7',
    brightCyan: '#0db9d7',
    brightWhite: '#acb0d0'
  },
  oneDark: {
    background: '#0d1117',
    foreground: '#c9d1d9',
    cursor: '#58a6ff',
    selectionBackground: '#1f6feb',
    black: '#484f58',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#b1bac4',
    brightBlack: '#6e7681',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#f0f6fc'
  },
  monokai: {
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    selectionBackground: '#49483e',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
    brightBlack: '#75715e',
    brightRed: '#f92672',
    brightGreen: '#a6e22e',
    brightYellow: '#f4bf75',
    brightBlue: '#66d9ef',
    brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4',
    brightWhite: '#f9f8f5'
  }
};

export default function TerminalView({ session, onStatusChange, isActive }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);

  const [fontSize, setFontSize] = useState(14);
  const [currentTheme, setCurrentTheme] = useState('oneDark');
  const [status, setStatus] = useState('connecting');
  const [statusMessage, setStatusMessage] = useState('Iniciando...');

  const connectSSH = () => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }

    setStatus('connecting');
    setStatusMessage('Conectando con el servidor...');
    onStatusChange?.(session.id, 'connecting');

    const token = localStorage.getItem('ssh_term_token');
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/ssh?token=${encodeURIComponent(token || '')}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const term = termRef.current;
      const cols = term ? term.cols : 80;
      const rows = term ? term.rows : 24;

      ws.send(JSON.stringify({
        type: 'init',
        token,
        serverId: session.serverConfig.id,
        keyId: session.serverConfig.keyId,
        host: session.serverConfig.host,
        port: session.serverConfig.port || 22,
        username: session.serverConfig.username,
        authType: session.serverConfig.authType || 'password',
        password: session.serverConfig.password,
        privateKey: session.serverConfig.privateKey,
        passphrase: session.serverConfig.passphrase,
        cols,
        rows,
        term: 'xterm-256color'
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const term = termRef.current;

        if (msg.type === 'data') {
          term?.write(msg.data);
        } else if (msg.type === 'status') {
          setStatus(msg.status);
          setStatusMessage(msg.message || msg.status);
          onStatusChange?.(session.id, msg.status);
          if (msg.message && term) {
            term.writeln(`\r\n\x1b[36m[SISTEMA] ${msg.message}\x1b[0m\r\n`);
          }
        } else if (msg.type === 'error') {
          setStatus('error');
          setStatusMessage(msg.message);
          onStatusChange?.(session.id, 'error');
          if (term) {
            term.writeln(`\r\n\x1b[31;1m[ERROR SSH] ${msg.message}\x1b[0m\r\n`);
          }
        }
      } catch (err) {
        console.error('Error procesando respuesta WebSocket:', err);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      setStatusMessage('Desconectado');
      onStatusChange?.(session.id, 'disconnected');
    };

    ws.onerror = (err) => {
      console.error('Error de WebSocket:', err);
      setStatus('error');
      setStatusMessage('Fallo en el canal WebSocket');
      onStatusChange?.(session.id, 'error');
    };
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize,
      fontFamily: "'Fira Code', 'Cascadia Code', monospace",
      theme: THEMES[currentTheme],
      convertEol: true,
      allowProposedApi: true
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'data', data }));
      }
    });

    term.onResize(({ cols, rows }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    // Iniciar conexión SSH
    connectSSH();

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {}
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (e) {}
      }
      term.dispose();
    };
  }, []);

  // Re-ajustar tamaño cuando la pestaña pasa a activa
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current.fit();
          termRef.current?.focus();
        } catch (e) {}
      }, 50);
    }
  }, [isActive]);

  // Actualizar tema
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = THEMES[currentTheme];
    }
  }, [currentTheme]);

  // Actualizar tamaño de fuente
  useEffect(() => {
    if (termRef.current && fitAddonRef.current) {
      termRef.current.options.fontSize = fontSize;
      fitAddonRef.current.fit();
    }
  }, [fontSize]);

  const handleClear = () => {
    termRef.current?.clear();
    termRef.current?.focus();
  };

  const handleDisconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.parentElement?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="terminal-wrapper" style={{ display: isActive ? 'flex' : 'none' }}>
      <div className="terminal-toolbar">
        <div className="terminal-info">
          <span className={`badge badge-${status}`}>
            <span className={`tab-status-dot status-${status}`} />
            {status.toUpperCase()}
          </span>
          <span>
            {session.serverConfig.username}@{session.serverConfig.host}:{session.serverConfig.port || 22}
          </span>
        </div>

        <div className="terminal-controls">
          <select
            className="form-select"
            style={{ padding: '2px 8px', fontSize: '11px', height: '26px' }}
            value={currentTheme}
            onChange={(e) => setCurrentTheme(e.target.value)}
            title="Seleccionar tema"
          >
            <option value="oneDark">Tema: One Dark</option>
            <option value="dracula">Tema: Dracula</option>
            <option value="tokyoNight">Tema: Tokyo Night</option>
            <option value="monokai">Tema: Monokai</option>
          </select>

          <button
            className="btn btn-icon"
            onClick={() => setFontSize(prev => Math.max(10, prev - 1))}
            title="Reducir fuente"
          >
            <ZoomOut size={14} />
          </button>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fontSize}px</span>
          <button
            className="btn btn-icon"
            onClick={() => setFontSize(prev => Math.min(24, prev + 1))}
            title="Aumentar fuente"
          >
            <ZoomIn size={14} />
          </button>

          <button className="btn btn-icon" onClick={handleClear} title="Limpiar pantalla">
            <Trash2 size={14} />
          </button>

          {status !== 'connected' ? (
            <button className="btn btn-success" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={connectSSH} title="Reconectar">
              <RotateCcw size={13} /> Reconectar
            </button>
          ) : (
            <button className="btn btn-danger" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={handleDisconnect} title="Desconectar">
              <PowerOff size={13} /> Desconectar
            </button>
          )}

          <button className="btn btn-icon" onClick={toggleFullscreen} title="Pantalla completa">
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      <div className="terminal-container" ref={containerRef} />
    </div>
  );
}
