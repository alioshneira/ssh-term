const fs = require('fs');
const path = require('path');
const { encrypt, decrypt, isEncrypted } = require('./crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');

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

// Retorna lista sanitizada (SIN contenido de clave privada ni passphrase)
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

// Obtiene llave descifrada en memoria para su uso en la conexión SSH
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
    // Mantener la clave privada existente si no se pasó una nueva
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
// GESTOR DE SERVIDORES
// ----------------------------------------------------
function readRawServers() {
  ensureDataDir();
  try {
    const data = fs.readFileSync(SERVERS_FILE, 'utf-8');
    const servers = JSON.parse(data);

    // Migración transparente si algún servidor antiguo no está cifrado
    let modified = false;
    servers.forEach(s => {
      // Normalizar tags
      if (!Array.isArray(s.tags)) {
        s.tags = s.group ? [s.group] : ['General'];
        modified = true;
      }
      // Cifrar contraseñas existentes no cifradas
      if (s.password && !isEncrypted(s.password)) {
        s.password = encrypt(s.password);
        modified = true;
      }
      // Cifrar claves privadas directas
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

// Retorna lista sanitizada al frontend (SIN contraseñas ni claves descifradas)
function getServers() {
  const rawServers = readRawServers();
  const keysList = getKeys();

  return rawServers.map(s => {
    // Si usa una llave guardada del Key Vault, vincular información básica
    let keyInfo = null;
    if (s.keyId) {
      const found = keysList.find(k => k.id === s.keyId);
      if (found) {
        keyInfo = { id: found.id, name: found.name, keyType: found.keyType };
      }
    }

    return {
      id: s.id,
      name: s.name,
      host: s.host,
      port: s.port || 22,
      username: s.username,
      authType: s.authType || 'password',
      keyId: s.keyId || null,
      keyInfo,
      tags: Array.isArray(s.tags) ? s.tags : (s.group ? [s.group] : []),
      description: s.description || '',
      hasPassword: Boolean(s.password),
      hasCustomKey: Boolean(s.privateKey),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    };
  });
}

// Obtiene credenciales descifradas exclusivamente para el proceso de conexión SSH en RAM
function getServerSecret(id) {
  const rawServers = readRawServers();
  const server = rawServers.find(s => s.id === id);
  if (!server) return null;

  let resolvedPrivateKey = null;
  let resolvedPassphrase = null;

  // Si hace referencia a una llave del Key Vault
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
    // Mantener la contraseña previamente guardada
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

  // Normalizar tags
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
    tags,
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
  getServerSecret,
  addOrUpdateServer,
  duplicateServer,
  deleteServer,
  getKeys,
  getKeySecret,
  saveKey,
  deleteKey
};
