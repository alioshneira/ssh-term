const fs = require('fs');
const path = require('path');
const { encrypt, decrypt, isEncrypted } = require('./crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_logs.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Archivo de servidores
  if (!fs.existsSync(SERVERS_FILE)) {
    const defaultServers = [
      {
        id: 'srv-local',
        name: 'Localhost (Ejemplo)',
        host: '127.0.0.1',
        port: 22,
        username: 'root',
        authType: 'password',
        tags: ['Desarrollo', 'Local'],
        description: 'Servidor local o máquina de pruebas'
      }
    ];
    fs.writeFileSync(SERVERS_FILE, JSON.stringify(defaultServers, null, 2), 'utf-8');
  }

  // Archivo de llaves SSH (Key Vault)
  if (!fs.existsSync(KEYS_FILE)) {
    fs.writeFileSync(KEYS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }

  // Archivo de usuarios (Aprobación y Roles)
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }

  // Archivo de Grupos de Acceso
  if (!fs.existsSync(GROUPS_FILE)) {
    const defaultGroups = [
      {
        id: 'grp-devops',
        name: 'DevOps / Infraestructura',
        description: 'Acceso a servidores de desarrollo e infraestructura',
        serverIds: ['srv-local'],
        serverTags: ['Desarrollo'],
        memberUsernames: ['admin'],
        createdAt: new Date().toISOString()
      }
    ];
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(defaultGroups, null, 2), 'utf-8');
  }

  // Archivo de logs de auditoría
  if (!fs.existsSync(AUDIT_FILE)) {
    fs.writeFileSync(AUDIT_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function detectKeyType(privateKey) {
  if (!privateKey) return 'Desconocido';
  if (privateKey.includes('ED25519')) return 'Ed25519';
  if (privateKey.includes('RSA')) return 'RSA';
  if (privateKey.includes('EC')) return 'ECDSA';
  if (privateKey.includes('OPENSSH')) return 'OpenSSH';
  return 'Genérica';
}

// ----------------------------------------------------
// GESTOR DE USUARIOS Y APROBACIÓN LDAP
// ----------------------------------------------------
function readRawUsers() {
  ensureDataDir();
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error leyendo users.json:', err);
    return [];
  }
}

function writeRawUsers(users) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function getUsers() {
  return readRawUsers();
}

function getUser(username) {
  if (!username) return null;
  const users = readRawUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}

function saveUser(userData) {
  const users = readRawUsers();
  const existingIdx = users.findIndex(u => u.username.toLowerCase() === userData.username.toLowerCase());

  const record = {
    username: userData.username,
    displayName: userData.displayName || userData.username,
    email: userData.email || '',
    dn: userData.dn || '',
    ldapGroups: userData.ldapGroups || [],
    role: userData.role || 'user', // 'global_admin' | 'admin' | 'user'
    status: userData.status || 'pending', // 'pending' | 'active' | 'disabled'
    accessGroups: Array.isArray(userData.accessGroups) ? userData.accessGroups : [],
    createdAt: existingIdx >= 0 ? users[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: userData.lastLoginAt || (existingIdx >= 0 ? users[existingIdx].lastLoginAt : null)
  };

  if (existingIdx >= 0) {
    users[existingIdx] = { ...users[existingIdx], ...record };
  } else {
    users.push(record);
  }

  writeRawUsers(users);
  return record;
}

function updateUserStatus(username, { status, role, accessGroups }) {
  const users = readRawUsers();
  const existingIdx = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  if (existingIdx === -1) {
    throw new Error(`Usuario '${username}' no encontrado`);
  }

  if (status) users[existingIdx].status = status;
  if (role) users[existingIdx].role = role;
  if (Array.isArray(accessGroups)) users[existingIdx].accessGroups = accessGroups;
  users[existingIdx].updatedAt = new Date().toISOString();

  writeRawUsers(users);
  return users[existingIdx];
}

function getPendingUsersCount() {
  const users = readRawUsers();
  return users.filter(u => u.status === 'pending').length;
}

// ----------------------------------------------------
// GESTOR DE GRUPOS DE ACCESO (RBAC)
// ----------------------------------------------------
function readRawGroups() {
  ensureDataDir();
  try {
    const data = fs.readFileSync(GROUPS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error leyendo groups.json:', err);
    return [];
  }
}

function writeRawGroups(groups) {
  ensureDataDir();
  fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2), 'utf-8');
}

function getGroups() {
  return readRawGroups();
}

function saveGroup(groupData) {
  const groups = readRawGroups();
  const existingIdx = groups.findIndex(g => g.id === groupData.id);

  const record = {
    id: groupData.id || `grp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: groupData.name || 'Nuevo Grupo',
    description: groupData.description || '',
    serverIds: Array.isArray(groupData.serverIds) ? groupData.serverIds : [],
    serverTags: Array.isArray(groupData.serverTags) ? groupData.serverTags : [],
    memberUsernames: Array.isArray(groupData.memberUsernames) ? groupData.memberUsernames : [],
    createdAt: existingIdx >= 0 ? groups[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    groups[existingIdx] = record;
  } else {
    groups.push(record);
  }

  writeRawGroups(groups);
  return getGroups();
}

function deleteGroup(id) {
  let groups = readRawGroups();
  groups = groups.filter(g => g.id !== id);
  writeRawGroups(groups);
  return getGroups();
}

// ----------------------------------------------------
// REGISTRO DE AUDITORÍA (AUDIT LOGS)
// ----------------------------------------------------
function readRawAuditLogs() {
  ensureDataDir();
  try {
    const data = fs.readFileSync(AUDIT_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error leyendo audit_logs.json:', err);
    return [];
  }
}

function writeRawAuditLogs(logs) {
  ensureDataDir();
  // Mantener como máximo los últimos 2000 registros para evitar sobrecarga
  const trimmed = logs.slice(0, 2000);
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
}

function appendAuditLog(entry) {
  const logs = readRawAuditLogs();
  const newEntry = {
    id: entry.id || `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    username: entry.username || 'desconocido',
    userDisplayName: entry.userDisplayName || entry.username || 'desconocido',
    serverId: entry.serverId || null,
    serverName: entry.serverName || 'Desconocido',
    serverHost: entry.serverHost || 'N/A',
    clientIp: entry.clientIp || '127.0.0.1',
    status: entry.status || 'success', // 'success' | 'failed' | 'rejected_by_rbac' | 'disconnected'
    durationSeconds: entry.durationSeconds || null,
    details: entry.details || ''
  };

  // Insertar al inicio (los más recientes primero)
  logs.unshift(newEntry);
  writeRawAuditLogs(logs);
  return newEntry;
}

function updateAuditLogDuration(logId, durationSeconds) {
  const logs = readRawAuditLogs();
  const target = logs.find(l => l.id === logId);
  if (target) {
    target.durationSeconds = durationSeconds;
    target.status = 'disconnected';
    writeRawAuditLogs(logs);
  }
}

function getAuditLogs(query = {}) {
  let logs = readRawAuditLogs();

  if (query.username) {
    logs = logs.filter(l => l.username.toLowerCase().includes(query.username.toLowerCase()));
  }
  if (query.serverId) {
    logs = logs.filter(l => l.serverId === query.serverId);
  }
  if (query.status) {
    logs = logs.filter(l => l.status === query.status);
  }

  const limit = Number(query.limit) || 100;
  const offset = Number(query.offset) || 0;

  return {
    total: logs.length,
    logs: logs.slice(offset, offset + limit)
  };
}

function getUserAuditLogs(username, limit = 50) {
  if (!username) return [];
  const logs = readRawAuditLogs();
  return logs
    .filter(l => l.username.toLowerCase() === username.toLowerCase())
    .slice(0, limit);
}

// ----------------------------------------------------
// GESTOR DE LLAVES SSH (KEY VAULT)
// ----------------------------------------------------
function readRawKeys() {
  ensureDataDir();
  try {
    const data = fs.readFileSync(KEYS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error leyendo llaves SSH:', err);
    return [];
  }
}

function writeRawKeys(keys) {
  ensureDataDir();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf-8');
}

function getKeys() {
  const rawKeys = readRawKeys();
  return rawKeys.map(k => ({
    id: k.id,
    name: k.name,
    keyType: k.keyType || 'Genérica',
    description: k.description || '',
    hasPassphrase: Boolean(k.passphrase),
    createdAt: k.createdAt,
    updatedAt: k.updatedAt
  }));
}

function getKeySecret(id) {
  const rawKeys = readRawKeys();
  const key = rawKeys.find(k => k.id === id);
  if (!key) return null;

  return {
    ...key,
    privateKey: key.privateKey ? decrypt(key.privateKey) : null,
    passphrase: key.passphrase ? decrypt(key.passphrase) : null
  };
}

function saveKey(keyData) {
  const rawKeys = readRawKeys();
  const existingIdx = rawKeys.findIndex(k => k.id === keyData.id);

  let encryptedPrivateKey = keyData.privateKey;
  let encryptedPassphrase = keyData.passphrase;
  let keyType = keyData.keyType;

  if (keyData.privateKey) {
    keyType = detectKeyType(keyData.privateKey);
    encryptedPrivateKey = encrypt(keyData.privateKey);
  } else if (existingIdx >= 0) {
    encryptedPrivateKey = rawKeys[existingIdx].privateKey;
    keyType = rawKeys[existingIdx].keyType;
  }

  if (keyData.passphrase) {
    encryptedPassphrase = encrypt(keyData.passphrase);
  } else if (existingIdx >= 0 && keyData.passphrase === undefined) {
    encryptedPassphrase = rawKeys[existingIdx].passphrase;
  }

  const record = {
    id: keyData.id || `key-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: keyData.name || 'Clave SSH',
    keyType: keyType || 'Genérica',
    description: keyData.description || '',
    privateKey: encryptedPrivateKey,
    passphrase: encryptedPassphrase,
    createdAt: existingIdx >= 0 ? rawKeys[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    rawKeys[existingIdx] = record;
  } else {
    rawKeys.push(record);
  }

  writeRawKeys(rawKeys);
  return getKeys();
}

function deleteKey(id) {
  let rawKeys = readRawKeys();
  rawKeys = rawKeys.filter(k => k.id !== id);
  writeRawKeys(rawKeys);
  return getKeys();
}

// ----------------------------------------------------
// GESTOR DE SERVIDORES Y FILTRADO RBAC
// ----------------------------------------------------
function readRawServers() {
  ensureDataDir();
  try {
    const data = fs.readFileSync(SERVERS_FILE, 'utf-8');
    const servers = JSON.parse(data);

    let modified = false;
    servers.forEach(s => {
      if (!Array.isArray(s.tags)) {
        s.tags = s.group ? [s.group] : ['General'];
        modified = true;
      }
      if (s.password && !isEncrypted(s.password)) {
        s.password = encrypt(s.password);
        modified = true;
      }
      if (s.privateKey && !isEncrypted(s.privateKey)) {
        s.privateKey = encrypt(s.privateKey);
        modified = true;
      }
      if (s.passphrase && !isEncrypted(s.passphrase)) {
        s.passphrase = encrypt(s.passphrase);
        modified = true;
      }
    });

    if (modified) {
      writeRawServers(servers);
    }

    return servers;
  } catch (err) {
    console.error('Error leyendo servidores:', err);
    return [];
  }
}

function writeRawServers(servers) {
  ensureDataDir();
  fs.writeFileSync(SERVERS_FILE, JSON.stringify(servers, null, 2), 'utf-8');
}

function getServers() {
  const rawServers = readRawServers();
  const keysList = getKeys();
  const groupsList = getGroups();

  return rawServers.map(s => {
    let keyInfo = null;
    if (s.keyId) {
      const found = keysList.find(k => k.id === s.keyId);
      if (found) {
        keyInfo = { id: found.id, name: found.name, keyType: found.keyType };
      }
    }

    // Identificar grupos a los que pertenece el servidor
    const belongingGroups = groupsList
      .filter(g => (Array.isArray(g.serverIds) && g.serverIds.includes(s.id)) ||
        (Array.isArray(g.serverTags) && Array.isArray(s.tags) && g.serverTags.some(t => s.tags.includes(t))))
      .map(g => ({ id: g.id, name: g.name }));

    return {
      id: s.id,
      name: s.name,
      host: s.host,
      port: s.port || 22,
      username: s.username,
      authType: s.authType || 'password',
      keyId: s.keyId || null,
      keyInfo,
      tags: Array.isArray(s.tags) ? s.tags : [],
      group: s.group || (s.tags && s.tags[0]) || 'General',
      groups: belongingGroups,
      assignedUsernames: Array.isArray(s.assignedUsernames) ? s.assignedUsernames : [],
      description: s.description || '',
      hasPassword: Boolean(s.password),
      hasCustomKey: Boolean(s.privateKey),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    };
  });
}

// Filtra servidores de acuerdo a los permisos RBAC del usuario autenticado
function getServersForUser(user) {
  const allServers = getServers();
  if (!user) return [];

  const globalAdminUser = (process.env.GLOBAL_ADMIN_USER || 'admin').trim().toLowerCase();
  const globalAdminCn = (process.env.GLOBAL_ADMIN_CN || '').trim().toLowerCase();
  const username = (user.username || '').trim().toLowerCase();
  const dn = (user.dn || '').trim().toLowerCase();

  const isGlobal = username === globalAdminUser ||
    (globalAdminCn && (dn === globalAdminCn || dn.includes(globalAdminCn))) ||
    user.role === 'global_admin';

  if (isGlobal) {
    return allServers;
  }

  const allGroups = getGroups();
  const userAccessGroups = Array.isArray(user.accessGroups) ? user.accessGroups : [];

  return allServers.filter(server => {
    // 1. Asignado directamente al usuario
    if (Array.isArray(server.assignedUsernames) && server.assignedUsernames.includes(user.username)) {
      return true;
    }

    // 2. Pertenece a un grupo del que el usuario es miembro
    for (const grp of allGroups) {
      const isMember = (Array.isArray(grp.memberUsernames) && grp.memberUsernames.includes(user.username)) ||
        userAccessGroups.includes(grp.id);

      if (isMember) {
        if (Array.isArray(grp.serverIds) && grp.serverIds.includes(server.id)) {
          return true;
        }
        if (Array.isArray(grp.serverTags) && Array.isArray(server.tags) && grp.serverTags.some(t => server.tags.includes(t))) {
          return true;
        }
      }
    }

    return false;
  });
}

function getServerSecret(id) {
  const rawServers = readRawServers();
  const server = rawServers.find(s => s.id === id);
  if (!server) return null;

  let resolvedPrivateKey = null;
  let resolvedPassphrase = null;

  if (server.authType === 'saved_key' && server.keyId) {
    const keyRecord = getKeySecret(server.keyId);
    if (keyRecord) {
      resolvedPrivateKey = keyRecord.privateKey;
      resolvedPassphrase = keyRecord.passphrase;
    }
  } else if (server.privateKey) {
    resolvedPrivateKey = decrypt(server.privateKey);
    resolvedPassphrase = server.passphrase ? decrypt(server.passphrase) : null;
  }

  return {
    ...server,
    password: server.password ? decrypt(server.password) : null,
    privateKey: resolvedPrivateKey,
    passphrase: resolvedPassphrase
  };
}

function addOrUpdateServer(serverData) {
  const rawServers = readRawServers();
  const existingIdx = rawServers.findIndex(s => s.id === serverData.id);

  let encryptedPassword = serverData.password;
  let encryptedPrivateKey = serverData.privateKey;
  let encryptedPassphrase = serverData.passphrase;

  if (serverData.password) {
    encryptedPassword = encrypt(serverData.password);
  } else if (existingIdx >= 0 && serverData.password === undefined) {
    encryptedPassword = rawServers[existingIdx].password;
  }

  if (serverData.privateKey) {
    encryptedPrivateKey = encrypt(serverData.privateKey);
  } else if (existingIdx >= 0 && serverData.privateKey === undefined) {
    encryptedPrivateKey = rawServers[existingIdx].privateKey;
  }

  if (serverData.passphrase) {
    encryptedPassphrase = encrypt(serverData.passphrase);
  } else if (existingIdx >= 0 && serverData.passphrase === undefined) {
    encryptedPassphrase = rawServers[existingIdx].passphrase;
  }

  let tags = [];
  if (Array.isArray(serverData.tags)) {
    tags = serverData.tags.map(t => String(t).trim()).filter(Boolean);
  } else if (serverData.group) {
    tags = [serverData.group.trim()];
  }

  const record = {
    id: serverData.id || `srv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: serverData.name || `${serverData.username}@${serverData.host}`,
    host: serverData.host,
    port: Number(serverData.port) || 22,
    username: serverData.username,
    authType: serverData.authType || 'password',
    keyId: serverData.authType === 'saved_key' ? serverData.keyId : null,
    password: encryptedPassword,
    privateKey: encryptedPrivateKey,
    passphrase: encryptedPassphrase,
    group: (serverData.group && serverData.group.trim()) || (tags.length > 0 ? tags[0] : 'General'),
    tags,
    assignedUsernames: Array.isArray(serverData.assignedUsernames) ? serverData.assignedUsernames : [],
    description: serverData.description || '',
    createdAt: existingIdx >= 0 ? rawServers[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    rawServers[existingIdx] = record;
  } else {
    rawServers.push(record);
  }

  writeRawServers(rawServers);
  return getServers();
}

function duplicateServer(id) {
  const rawServers = readRawServers();
  const orig = rawServers.find(s => s.id === id);
  if (!orig) {
    throw new Error('Servidor no encontrado para duplicar');
  }

  const cloned = {
    ...orig,
    id: `srv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: `[Copia] ${orig.name}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  rawServers.push(cloned);
  writeRawServers(rawServers);
  return getServers();
}

function deleteServer(id) {
  let rawServers = readRawServers();
  rawServers = rawServers.filter(s => s.id !== id);
  writeRawServers(rawServers);
  return getServers();
}

module.exports = {
  getServers,
  getServersForUser,
  getServerSecret,
  addOrUpdateServer,
  duplicateServer,
  deleteServer,
  getKeys,
  getKeySecret,
  saveKey,
  deleteKey,
  getUsers,
  getUser,
  saveUser,
  updateUserStatus,
  getPendingUsersCount,
  getGroups,
  saveGroup,
  deleteGroup,
  appendAuditLog,
  updateAuditLogDuration,
  getAuditLogs,
  getUserAuditLogs
};
