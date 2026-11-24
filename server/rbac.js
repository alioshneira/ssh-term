const storage = require('./storage');

function isGlobalAdmin(user) {
  if (!user) return false;

  const globalAdminUser = (process.env.GLOBAL_ADMIN_USER || 'admin').trim().toLowerCase();
  const globalAdminCn = (process.env.GLOBAL_ADMIN_CN || '').trim().toLowerCase();

  const username = (user.username || '').trim().toLowerCase();
  const dn = (user.dn || '').trim().toLowerCase();

  if (username && username === globalAdminUser) {
    return true;
  }

  if (globalAdminCn && (dn === globalAdminCn || dn.includes(globalAdminCn))) {
    return true;
  }

  return user.role === 'global_admin';
}

function canAccessServer(user, serverId) {
  if (!user || !serverId) return false;

  // El administrador global tiene acceso a todos los servidores
  if (isGlobalAdmin(user) || user.role === 'global_admin') {
    return true;
  }

  const allServers = storage.getServers();
  const targetServer = allServers.find(s => s.id === serverId);
  if (!targetServer) return false;

  // 1. Acceso directo asignado al usuario
  if (Array.isArray(targetServer.assignedUsernames) && targetServer.assignedUsernames.includes(user.username)) {
    return true;
  }

  // 2. Acceso por Grupos de Acceso
  const allGroups = storage.getGroups();
  const userGroups = Array.isArray(user.accessGroups) ? user.accessGroups : [];

  for (const group of allGroups) {
    // Si el usuario es miembro de este grupo
    const isMember = (group.memberUsernames && group.memberUsernames.includes(user.username)) ||
      userGroups.includes(group.id);

    if (isMember) {
      // Verificar si el grupo contiene este servidor
      if (Array.isArray(group.serverIds) && group.serverIds.includes(serverId)) {
        return true;
      }
      // O si el grupo da acceso a la carpeta/grupo al que pertenece el servidor
      if (Array.isArray(group.serverGroups) && targetServer.group && group.serverGroups.includes(targetServer.group)) {
        return true;
      }
      // O si el grupo tiene un tag que coincide con los tags del servidor
      if (Array.isArray(group.serverTags) && Array.isArray(targetServer.tags)) {
        if (group.serverTags.some(t => targetServer.tags.includes(t))) {
          return true;
        }
      }
    }
  }

  return false;
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  if (isGlobalAdmin(req.user) || req.user.role === 'global_admin' || req.user.role === 'admin') {
    return next();
  }

  return res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de Administrador' });
}

module.exports = {
  isGlobalAdmin,
  canAccessServer,
  requireAdmin
};
