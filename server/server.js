require('dotenv').config();

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const { Client } = require('ssh2');
const jwt = require('jsonwebtoken');

const storage = require('./storage');
const ldap = require('./ldap');
const rbac = require('./rbac');

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
// RUTAS DE AUTENTICACIÓN LDAP Y APROBACIÓN DE USUARIOS
// ----------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  try {
    // 1. Validar credenciales con LDAP
    const userProfile = await ldap.authenticate(username, password);

    // 2. Comprobar si es el Administrador Global configurado en .env
    const isGlobal = rbac.isGlobalAdmin(userProfile);

    let userRecord = storage.getUser(userProfile.username);

    if (isGlobal) {
      // El administrador global se auto-aprueba con rol global_admin permanente
      userRecord = storage.saveUser({
        username: userProfile.username,
        displayName: userProfile.displayName,
        email: userProfile.email,
        dn: userProfile.dn,
        ldapGroups: userProfile.groups,
        role: 'global_admin',
        status: 'active',
        accessGroups: ['*'],
        lastLoginAt: new Date().toISOString()
      });
    } else {
      // Si no existe, registrarlo con estado 'pending' (requiere aprobación)
      if (!userRecord) {
        userRecord = storage.saveUser({
          username: userProfile.username,
          displayName: userProfile.displayName,
          email: userProfile.email,
          dn: userProfile.dn,
          ldapGroups: userProfile.groups,
          role: 'user',
          status: 'pending',
          accessGroups: [],
          lastLoginAt: null
        });

        return res.status(403).json({
          code: 'ACCOUNT_PENDING',
          error: 'Tu cuenta ha sido registrada en el sistema, pero requiere aprobación por el Administrador Global antes de poder ingresar.'
        });
      }

      // Si existe pero está pendiente de aprobación
      if (userRecord.status === 'pending') {
        return res.status(403).json({
          code: 'ACCOUNT_PENDING',
          error: 'Tu cuenta aún está pendiente de aprobación por el Administrador Global. Por favor contacta al administrador.'
        });
      }

      // Si la cuenta ha sido deshabilitada
      if (userRecord.status === 'disabled') {
        return res.status(403).json({
          code: 'ACCOUNT_DISABLED',
          error: 'Tu cuenta ha sido deshabilitada por el Administrador.'
        });
      }

      // Usuario activo: actualizar última fecha de login
      userRecord = storage.saveUser({
        ...userRecord,
        displayName: userProfile.displayName || userRecord.displayName,
        email: userProfile.email || userRecord.email,
        dn: userProfile.dn || userRecord.dn,
        ldapGroups: userProfile.groups || userRecord.ldapGroups,
        lastLoginAt: new Date().toISOString()
      });
    }

    // 3. Emitir token JWT con roles y grupos de acceso
    const token = jwt.sign(
      {
        username: userRecord.username,
        displayName: userRecord.displayName,
        email: userRecord.email,
        dn: userRecord.dn,
        role: userRecord.role,
        accessGroups: userRecord.accessGroups,
        isGlobalAdmin: isGlobal
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        username: userRecord.username,
        displayName: userRecord.displayName,
        email: userRecord.email,
        role: userRecord.role,
        status: userRecord.status,
        accessGroups: userRecord.accessGroups,
        isGlobalAdmin: isGlobal
      },
      pendingUsersCount: isGlobal ? storage.getPendingUsersCount() : 0
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const isGlobal = rbac.isGlobalAdmin(req.user);
  res.json({
    user: req.user,
    pendingUsersCount: isGlobal ? storage.getPendingUsersCount() : 0
  });
});

// ----------------------------------------------------
// RUTAS DE ADMINISTRACIÓN (USUARIOS, APROBACIÓN, GRUPOS, LOGS)
// ----------------------------------------------------
app.get('/api/admin/users', authMiddleware, rbac.requireAdmin, (req, res) => {
  res.json(storage.getUsers());
});

app.post('/api/admin/users/:username/status', authMiddleware, rbac.requireAdmin, (req, res) => {
  try {
    const { status, role, accessGroups } = req.body;
    const updatedUser = storage.updateUserStatus(req.params.username, {
      status,
      role,
      accessGroups
    });
    res.json({ success: true, user: updatedUser, users: storage.getUsers() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/groups', authMiddleware, rbac.requireAdmin, (req, res) => {
  res.json(storage.getGroups());
});

app.post('/api/admin/groups', authMiddleware, rbac.requireAdmin, (req, res) => {
  try {
    const updatedGroups = storage.saveGroup(req.body);
    res.json({ success: true, groups: updatedGroups });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/groups/:id', authMiddleware, rbac.requireAdmin, (req, res) => {
  try {
    const updatedGroups = storage.deleteGroup(req.params.id);
    res.json({ success: true, groups: updatedGroups });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/audit-logs', authMiddleware, rbac.requireAdmin, (req, res) => {
  res.json(storage.getAuditLogs(req.query));
});

// Ruta para que el usuario consulte su propio historial de accesos
app.get('/api/audit-logs/my', authMiddleware, (req, res) => {
  res.json(storage.getUserAuditLogs(req.user.username));
});

// ----------------------------------------------------
// RUTAS DE SERVIDORES (FILTRADO POR RBAC)
// ----------------------------------------------------
app.get('/api/servers', authMiddleware, (req, res) => {
  // Solo devuelve los servidores a los que el usuario tiene acceso
  res.json(storage.getServersForUser(req.user));
});

app.post('/api/servers', authMiddleware, (req, res) => {
  const server = req.body;
  if (!server.host || !server.username) {
    return res.status(400).json({ error: 'Host y usuario son requeridos' });
  }
  storage.addOrUpdateServer(server);
  res.json({ success: true, servers: storage.getServersForUser(req.user) });
});

app.post('/api/servers/:id/duplicate', authMiddleware, (req, res) => {
  try {
    storage.duplicateServer(req.params.id);
    res.json({ success: true, servers: storage.getServersForUser(req.user) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.delete('/api/servers/:id', authMiddleware, (req, res) => {
  storage.deleteServer(req.params.id);
  res.json({ success: true, servers: storage.getServersForUser(req.user) });
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

// ----------------------------------------------------
// CONFIGURACIÓN HTTP / HTTPS Y WEBSOCKETS
// ----------------------------------------------------
const SSL_ENABLED = process.env.SSL_ENABLED === 'true';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH
  ? path.resolve(process.env.SSL_CERT_PATH)
  : path.join(__dirname, '..', 'data', 'ssl', 'cert.pem');
const SSL_KEY_PATH = process.env.SSL_KEY_PATH
  ? path.resolve(process.env.SSL_KEY_PATH)
  : path.join(__dirname, '..', 'data', 'ssl', 'key.pem');

let server;
let protocol = 'http';

if (SSL_ENABLED) {
  if (!fs.existsSync(SSL_CERT_PATH) || !fs.existsSync(SSL_KEY_PATH)) {
    console.error(`\n[SSL Error] No se encontraron los certificados en:`);
    console.error(` - Certificado: ${SSL_CERT_PATH}`);
    console.error(` - Clave privada: ${SSL_KEY_PATH}`);
    console.error(`Ejecuta 'npm run ssl:gen' para generar certificados de prueba o desactiva SSL_ENABLED en .env\n`);
    process.exit(1);
  }

  const sslOptions = {
    cert: fs.readFileSync(SSL_CERT_PATH),
    key: fs.readFileSync(SSL_KEY_PATH)
  };

  server = https.createServer(sslOptions, app);
  protocol = 'https';
} else {
  server = http.createServer(app);
}

const wss = new WebSocketServer({ server, path: '/ws/ssh' });

wss.on('connection', (ws, req) => {
  let sshClient = null;
  let sshStream = null;
  let isConnected = false;
  let authenticatedUser = null;
  let currentAuditLogId = null;
  let sessionStartTime = null;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  // Validar token JWT en query string si viene provisto
  const parsedUrl = url.parse(req.url, true);
  const tokenFromQuery = parsedUrl.query.token;

  if (tokenFromQuery) {
    try {
      authenticatedUser = jwt.verify(tokenFromQuery, JWT_SECRET);
    } catch (e) {}
  }

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);

      if (msg.type === 'init') {
        if (!authenticatedUser) {
          const token = msg.token || tokenFromQuery;
          if (!token) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Conexión rechazada: Token de sesión requerido.'
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
        let serverName = msg.name || `${username}@${host}`;

        // 1. Control de Acceso RBAC
        if (msg.serverId) {
          // Verificar si el usuario tiene permiso para este servidor
          const hasAccess = rbac.canAccessServer(authenticatedUser, msg.serverId);
          if (!hasAccess) {
            storage.appendAuditLog({
              username: authenticatedUser.username,
              userDisplayName: authenticatedUser.displayName,
              serverId: msg.serverId,
              serverName: serverName,
              serverHost: host,
              clientIp,
              status: 'rejected_by_rbac',
              details: 'Intento de conexión bloqueado por política de acceso RBAC'
            });

            ws.send(JSON.stringify({
              type: 'error',
              message: 'Acceso denegado: No tienes permisos asignados por el administrador para conectarte a este servidor.'
            }));
            ws.close();
            return;
          }

          const secretServer = storage.getServerSecret(msg.serverId);
          if (secretServer) {
            host = secretServer.host;
            port = secretServer.port || 22;
            username = secretServer.username;
            authType = secretServer.authType;
            password = secretServer.password;
            privateKey = secretServer.privateKey;
            passphrase = secretServer.passphrase;
            serverName = secretServer.name;
          }
        } else if (authType === 'saved_key' && keyId) {
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
          sessionStartTime = Date.now();

          // Registrar en log de auditoría
          const logEntry = storage.appendAuditLog({
            username: authenticatedUser.username,
            userDisplayName: authenticatedUser.displayName,
            serverId: msg.serverId || null,
            serverName: serverName,
            serverHost: host,
            clientIp,
            status: 'success',
            details: 'Conexión SSH establecida con éxito'
          });
          currentAuditLogId = logEntry.id;

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
              if (sessionStartTime && currentAuditLogId) {
                const duration = Math.round((Date.now() - sessionStartTime) / 1000);
                storage.updateAuditLogDuration(currentAuditLogId, duration);
              }

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

          storage.appendAuditLog({
            username: authenticatedUser ? authenticatedUser.username : 'anónimo',
            userDisplayName: authenticatedUser ? authenticatedUser.displayName : 'anónimo',
            serverId: msg.serverId || null,
            serverName: serverName,
            serverHost: host,
            clientIp,
            status: 'failed',
            details: `Fallo SSH: ${err.message}`
          });

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'error',
              message: `Error de conexión SSH: ${err.message}`
            }));
          }
        });

        sshClient.on('close', () => {
          isConnected = false;
          if (sessionStartTime && currentAuditLogId) {
            const duration = Math.round((Date.now() - sessionStartTime) / 1000);
            storage.updateAuditLogDuration(currentAuditLogId, duration);
          }

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
    if (sessionStartTime && currentAuditLogId) {
      const duration = Math.round((Date.now() - sessionStartTime) / 1000);
      storage.updateAuditLogDuration(currentAuditLogId, duration);
    }
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
  console.log(` WebSSH Terminal Server v2.1 (RBAC & Audit)`);
  console.log(` Protocolo: ${protocol.toUpperCase()} & ${protocol === 'https' ? 'WSS (Cifrado TLS)' : 'WS'}`);
  console.log(` Administrador Global: ${process.env.GLOBAL_ADMIN_USER || 'admin'}`);
  console.log(` Autenticación: LDAP / Active Directory con Aprobación`);
  console.log(` Control de Acceso: RBAC + Grupos de Servidores`);
  console.log(` Acceso en: ${protocol}://localhost:${PORT}`);
  console.log(`=========================================`);
});
