const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SERVERS_FILE = path.join(DATA_DIR, 'servers.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SERVERS_FILE)) {
    const defaultServers = [
      {
        id: 'srv-local',
        name: 'Localhost (Ejemplo)',
        host: '127.0.0.1',
        port: 22,
        username: 'root',
        authType: 'password',
        group: 'Desarrollo',
        description: 'Servidor local o máquina de pruebas'
      }
    ];
    fs.writeFileSync(SERVERS_FILE, JSON.stringify(defaultServers, null, 2), 'utf-8');
  }
}

function getServers() {
  ensureDataDir();
  try {
    const data = fs.readFileSync(SERVERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error leyendo servidores:', err);
    return [];
  }
}

function saveServers(servers) {
  ensureDataDir();
  fs.writeFileSync(SERVERS_FILE, JSON.stringify(servers, null, 2), 'utf-8');
  return servers;
}

function addOrUpdateServer(server) {
  const servers = getServers();
  const existingIdx = servers.findIndex(s => s.id === server.id);
  if (existingIdx >= 0) {
    servers[existingIdx] = { ...servers[existingIdx], ...server, updatedAt: new Date().toISOString() };
  } else {
    servers.push({
      ...server,
      id: server.id || `srv-${Date.now()}`,
      createdAt: new Date().toISOString()
    });
  }
  saveServers(servers);
  return servers;
}

function deleteServer(id) {
  let servers = getServers();
  servers = servers.filter(s => s.id !== id);
  saveServers(servers);
  return servers;
}

module.exports = {
  getServers,
  addOrUpdateServer,
  deleteServer
};
