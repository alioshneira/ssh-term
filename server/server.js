require('dotenv').config();

const http = require('http');
const path = require('path');
const url = require('url');
const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const { Client } = require('ssh2');
const jwt = require('jsonwebtoken');

const storage = require('./storage');
const ldap = require('./ldap');

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'ssh-term-secret-key-fallback-2026';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Middleware de verificación de Token JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado: Token JWT requerido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ----------------------------------------------------
// RUTAS DE AUTENTICACIÓN LDAP
// ----------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  try {
    const userProfile = await ldap.authenticate(username, password);

    const token = jwt.sign(
      {
        username: userProfile.username,
        displayName: userProfile.displayName,
        email: userProfile.email,
        groups: userProfile.groups
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        username: userProfile.username,
        displayName: userProfile.displayName,
        email: userProfile.email,
        groups: userProfile.groups
      }
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ----------------------------------------------------
// RUTAS DE SERVIDORES (PROTEGIDAS)
// ----------------------------------------------------
app.get('/api/servers', authMiddleware, (req, res) => {
  res.json(storage.getServers());
});

app.post('/api/servers', authMiddleware, (req, res) => {
  const server = req.body;
  if (!server.host || !server.username) {
    return res.status(400).json({ error: 'Host y usuario son requeridos' });
  }
  const updatedList = storage.addOrUpdateServer(server);
  res.json({ success: true, servers: updatedList });
});

app.post('/api/servers/:id/duplicate', authMiddleware, (req, res) => {
  try {
    const updatedList = storage.duplicateServer(req.params.id);
    res.json({ success: true, servers: updatedList });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.delete('/api/servers/:id', authMiddleware, (req, res) => {
  const updatedList = storage.deleteServer(req.params.id);
  res.json({ success: true, servers: updatedList });
});

// ----------------------------------------------------
// RUTAS DE KEY VAULT (LLAVES SSH)
// ----------------------------------------------------
app.get('/api/keys', authMiddleware, (req, res) => {
  res.json(storage.getKeys());
});

app.post('/api/keys', authMiddleware, (req, res) => {
  const keyData = req.body;
  if (!keyData.name) {
    return res.status(400).json({ error: 'El nombre de la llave es requerido' });
  }
  const updatedList = storage.saveKey(keyData);
  res.json({ success: true, keys: updatedList });
});

app.delete('/api/keys/:id', authMiddleware, (req, res) => {
  const updatedList = storage.deleteKey(req.params.id);
  res.json({ success: true, keys: updatedList });
});

// ----------------------------------------------------
// TEST DE CONEXIÓN TCP
// ----------------------------------------------------
app.post('/api/test-connection', authMiddleware, (req, res) => {
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

wss.on('connection', (ws, req) => {
  let sshClient = null;
  let sshStream = null;
  let isConnected = false;
  let authenticatedUser = null;

  // Validar token JWT en query string si viene provisto
  const parsedUrl = url.parse(req.url, true);
  const tokenFromQuery = parsedUrl.query.token;

  if (tokenFromQuery) {
    try {
      authenticatedUser = jwt.verify(tokenFromQuery, JWT_SECRET);
    } catch (e) {
      // Se permitirá validar en el primer mensaje 'init' si no vino por query
    }
  }

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);

      if (msg.type === 'init') {
        // Validar token si aún no se autenticó
        if (!authenticatedUser) {
          const token = msg.token || tokenFromQuery;
          if (!token) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Conexión WebSocket rechazada: Token de sesión requerido.'
            }));
            ws.close();
            return;
          }
          try {
            authenticatedUser = jwt.verify(token, JWT_SECRET);
          } catch (jwtErr) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Sesión expirada o token inválido. Por favor inicia sesión nuevamente.'
            }));
            ws.close();
            return;
          }
        }

        // Resolución de credenciales: serverId o ad-hoc
        let host = msg.host;
        let port = msg.port || 22;
        let username = msg.username;
        let authType = msg.authType || 'password';
        let password = msg.password;
        let privateKey = msg.privateKey;
        let passphrase = msg.passphrase;
        let keyId = msg.keyId;

        // Si se envió un serverId guardado, recuperar secretos cifrados de forma segura
        if (msg.serverId) {
          const secretServer = storage.getServerSecret(msg.serverId);
          if (secretServer) {
            host = secretServer.host;
            port = secretServer.port || 22;
            username = secretServer.username;
            authType = secretServer.authType;
            password = secretServer.password;
            privateKey = secretServer.privateKey;
            passphrase = secretServer.passphrase;
          }
        } else if (authType === 'saved_key' && keyId) {
          // Si se seleccionó una llave compartida del Key Vault
          const secretKey = storage.getKeySecret(keyId);
          if (secretKey) {
            privateKey = secretKey.privateKey;
            passphrase = secretKey.passphrase;
            authType = 'key';
          }
        }

        const cols = msg.cols || 80;
        const rows = msg.rows || 24;
        const term = msg.term || 'xterm-256color';

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
          message: `Iniciando conexión SSH hacia ${username}@${host}:${port}...`
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
        } else if (authType === 'key' || authType === 'saved_key') {
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
            message: '¡Conexión SSH autenticada con éxito!'
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
            message: `Fallo al inicializar cliente SSH: ${connErr.message}`
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
  console.log(` WebSSH Terminal Server v2.0 (Seguro)`);
  console.log(` Autenticación: LDAP / Active Directory`);
  console.log(` Cifrado en reposo: AES-256-GCM`);
  console.log(` HTTP & WebSocket en http://localhost:${PORT}`);
  console.log(`=========================================`);
});
