const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const { Client } = require('ssh2');
const storage = require('./storage');

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API endpoints para gestión de servidores guardados
app.get('/api/servers', (req, res) => {
  res.json(storage.getServers());
});

app.post('/api/servers', (req, res) => {
  const server = req.body;
  if (!server.host || !server.username) {
    return res.status(400).json({ error: 'Host y usuario son requeridos' });
  }
  const updatedList = storage.addOrUpdateServer(server);
  res.json({ success: true, servers: updatedList });
});

app.delete('/api/servers/:id', (req, res) => {
  const updatedList = storage.deleteServer(req.params.id);
  res.json({ success: true, servers: updatedList });
});

// Endpoint de prueba de ping TCP básico
app.post('/api/test-connection', (req, res) => {
  const { host, port = 22 } = req.body;
  const net = require('net');
  const socket = new net.Socket();
  socket.setTimeout(4000);

  socket.on('connect', () => {
    socket.destroy();
    res.json({ reachable: true, message: `Puerto ${port} abierto en ${host}` });
  });

  socket.on('timeout', () => {
    socket.destroy();
    res.status(408).json({ reachable: false, message: 'Tiempo de espera agotado al conectar al host' });
  });

  socket.on('error', (err) => {
    socket.destroy();
    res.status(500).json({ reachable: false, message: err.message });
  });

  socket.connect(Number(port), host);
});

// Servir frontend compilado en producción
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Fallback SPA para rutas no coincidentes
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Frontend no compilado. Ejecuta `npm run build` o inicia en modo desarrollo.');
    }
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/ssh' });

wss.on('connection', (ws) => {
  let sshClient = null;
  let sshStream = null;
  let isConnected = false;

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);

      if (msg.type === 'init') {
        const {
          host,
          port = 22,
          username,
          authType = 'password',
          password,
          privateKey,
          passphrase,
          cols = 80,
          rows = 24,
          term = 'xterm-256color'
        } = msg;

        if (!host || !username) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Faltan parámetros requeridos: host y usuario.'
          }));
          return;
        }

        ws.send(JSON.stringify({
          type: 'status',
          status: 'connecting',
          message: `Conectando por SSH a ${username}@${host}:${port}...`
        }));

        sshClient = new Client();

        const sshConfig = {
          host,
          port: Number(port),
          username,
          readyTimeout: 25000,
          keepaliveInterval: 10000,
          keepaliveCountMax: 3
        };

        if (authType === 'password') {
          sshConfig.password = password;
        } else if (authType === 'key') {
          sshConfig.privateKey = privateKey;
          if (passphrase) {
            sshConfig.passphrase = passphrase;
          }
        }

        sshClient.on('ready', () => {
          isConnected = true;
          ws.send(JSON.stringify({
            type: 'status',
            status: 'connected',
            message: '¡Conexión SSH establecida!'
          }));

          sshClient.shell({
            term,
            cols: Number(cols),
            rows: Number(rows)
          }, (err, stream) => {
            if (err) {
              ws.send(JSON.stringify({
                type: 'error',
                message: `Error al abrir shell interactivo: ${err.message}`
              }));
              sshClient.end();
              return;
            }

            sshStream = stream;

            stream.on('data', (data) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'data',
                  data: data.toString('utf-8')
                }));
              }
            });

            stream.on('close', () => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'status',
                  status: 'closed',
                  message: '\r\n[Sesión SSH cerrada por el servidor remoto]\r\n'
                }));
              }
              sshClient.end();
            });

            stream.stderr.on('data', (data) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'data',
                  data: data.toString('utf-8')
                }));
              }
            });
          });
        });

        sshClient.on('error', (err) => {
          console.error(`[SSH Error ${host}]:`, err.message);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'error',
              message: `Error de conexión SSH: ${err.message}`
            }));
          }
        });

        sshClient.on('close', () => {
          isConnected = false;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'status',
              status: 'disconnected',
              message: '\r\n[Desconectado de SSH]\r\n'
            }));
          }
        });

        try {
          sshClient.connect(sshConfig);
        } catch (connErr) {
          ws.send(JSON.stringify({
            type: 'error',
            message: `Fallo al iniciar conexión: ${connErr.message}`
          }));
        }
      } else if (msg.type === 'data') {
        if (sshStream && sshStream.writable) {
          sshStream.write(msg.data);
        }
      } else if (msg.type === 'resize') {
        if (sshStream && msg.cols && msg.rows) {
          sshStream.setWindow(Number(msg.rows), Number(msg.cols), 0, 0);
        }
      } else if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (parseErr) {
      console.error('Error parseando mensaje WebSocket:', parseErr);
    }
  });

  ws.on('close', () => {
    if (sshStream) {
      try { sshStream.end(); } catch (e) {}
    }
    if (sshClient) {
      try { sshClient.end(); } catch (e) {}
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket Error:', err);
    if (sshClient) {
      try { sshClient.end(); } catch (e) {}
    }
  });
});

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` WebSSH Terminal Server activo`);
  console.log(` HTTP & WebSocket en http://localhost:${PORT}`);
  console.log(`=========================================`);
});
