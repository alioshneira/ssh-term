const { Client } = require('ldapts');

function escapeLdapFilter(str) {
  return str.replace(/[*()\\\/]/g, (match) => {
    switch (match) {
      case '*': return '\\2a';
      case '(': return '\\28';
      case ')': return '\\29';
      case '\\': return '\\5c';
      case '/': return '\\2f';
      default: return match;
    }
  });
}

async function authenticate(username, password) {
  if (!username || !password) {
    throw new Error('Usuario y contraseña son requeridos');
  }

  const devMode = process.env.LDAP_DEV_MODE === 'true';

  // Si está en modo desarrollo y las credenciales son admin/admin
  if (devMode && username === 'admin' && password === 'admin') {
    console.log('[LDAP Dev] Inicio de sesión exitoso con usuario admin local');
    return {
      username: 'admin',
      displayName: 'Administrador (Modo Dev)',
      email: 'admin@empresa.local',
      groups: ['Administradores', 'TI'],
      isDevUser: true
    };
  }

  const ldapUrl = process.env.LDAP_URL;
  if (!ldapUrl) {
    if (devMode) {
      throw new Error('LDAP_URL no configurado. En modo desarrollo usa: usuario "admin" y contraseña "admin"');
    }
    throw new Error('Servicio LDAP no configurado en el servidor');
  }

  const client = new Client({
    url: ldapUrl,
    timeout: 6000,
    connectTimeout: 5000
  });

  try {
    const bindDn = process.env.LDAP_BIND_DN;
    const bindPass = process.env.LDAP_BIND_PASSWORD;
    const searchBase = process.env.LDAP_SEARCH_BASE || 'dc=empresa,dc=local';
    const filterTemplate = process.env.LDAP_SEARCH_FILTER || '(&(objectClass=person)(|(uid={{username}})(sAMAccountName={{username}})))';

    // 1. Bind inicial (administrativo o anónimo si no se especifican credenciales)
    if (bindDn && bindPass) {
      await client.bind(bindDn, bindPass);
    }

    // 2. Buscar al usuario por nombre de usuario
    const safeUser = escapeLdapFilter(username);
    const filter = filterTemplate.replace(/\{\{username\}\}/g, safeUser);

    const { searchEntries } = await client.search(searchBase, {
      filter,
      scope: 'sub',
      attributes: ['dn', 'cn', 'displayName', 'mail', 'memberOf', 'sAMAccountName', 'uid']
    });

    if (!searchEntries || searchEntries.length === 0) {
      throw new Error('Usuario no encontrado en el directorio LDAP');
    }

    const userEntry = searchEntries[0];
    const userDn = userEntry.dn;

    // 3. Re-bind con el DN del usuario y su contraseña
    await client.bind(userDn, password);

    const groups = Array.isArray(userEntry.memberOf)
      ? userEntry.memberOf
      : (userEntry.memberOf ? [userEntry.memberOf] : []);

    return {
      username,
      displayName: userEntry.displayName || userEntry.cn || username,
      email: userEntry.mail || '',
      groups: groups.map(g => typeof g === 'string' ? g.split(',')[0].replace(/^CN=/i, '') : g),
      dn: userDn
    };
  } catch (err) {
    console.error(`[LDAP Auth Error para '${username}']`, err.message);

    // Fallback de desarrollo amigable si el servidor LDAP no está alcanzable físicamente
    if (devMode) {
      if (password === 'admin' || password === username) {
        console.warn(`[LDAP Fallback] Servidor LDAP inaccesible (${err.message}). Autenticado con fallback de desarrollo.`);
        return {
          username,
          displayName: `${username} (Fallback Dev)`,
          email: `${username}@empresa.local`,
          groups: ['Usuarios LDAP'],
          isDevUser: true
        };
      }
    }

    throw new Error(`Credenciales LDAP inválidas o error de conexión: ${err.message}`);
  } finally {
    try {
      await client.unbind();
    } catch (e) {}
  }
}

module.exports = {
  authenticate
};
