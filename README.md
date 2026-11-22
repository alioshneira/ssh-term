# WebSSH Terminal - Cliente SSH Web Multi-Servidor (v2.1)

Una aplicación web moderna, rápida y de seguridad corporativa que permite conectarte y administrar múltiples servidores Linux directamente desde tu navegador web, con soporte para pestañas simultáneas, autenticación corporativa LDAP con flujo de aprobación, control de acceso basado en roles (RBAC), grupos de servidores y usuarios, registro de auditoría de sesiones y cifrado fuerte en reposo (AES-256-GCM).

---

## Novedades de la Versión 2.1 (RBAC, Auditoría y Aprobación)

- 👑 **Administrador Global (`GLOBAL_ADMIN_USER`)**:
  - Variable en `.env` que define al superadministrador del sistema.
  - Acceso total y permanente para gestionar usuarios, aprobar cuentas y administrar servidores.
- 🚦 **Flujo de Aprobación de Usuarios LDAP**:
  - Todo nuevo usuario que inicie sesión por LDAP entra en estado `pending` y no puede acceder al sistema hasta que el Administrador Global lo apruebe.
- 🛡️ **Control de Acceso Basado en Roles (RBAC) y Grupos**:
  - Creación de **Grupos de Acceso** (ej. *DevOps*, *DBAs*, *Frontend*).
  - Los servidores y los usuarios se asignan a estos grupos.
  - Los usuarios regulares **solo pueden ver y conectarse a los servidores autorizados** para su perfil.
  - Validación de permisos en tiempo real tanto en la API como a nivel del WebSocket SSH.
- 📜 **Registro de Auditoría de Accesos (Audit Trail)**:
  - Registro de todas las sesiones: usuario, servidor, IP cliente, fecha/hora, resultado (`success`, `failed`, `rejected_by_rbac`) y duración en segundos.
  - Panel administrativo con filtros y vista de historial personal para cada usuario.

---

## Características Base

- **Emulación Completa de Terminal**: Impulsado por `@xterm/xterm` (el mismo motor utilizado por VS Code), con soporte completo para colores ANSI, secuencias de escape, aplicaciones interactivas (`htop`, `vim`, `nano`, `tmux`) y enlaces web clicables.
- **Múltiples Pestañas Simultáneas**: Abre conexiones SSH a diferentes servidores concurrentemente y alterna entre ellos sin perder el estado o buffer de tu sesión.
- **Personalización y Utilidades**:
  - Selector de temas visuales: *One Dark*, *Dracula*, *Tokyo Night* y *Monokai*.
  - Zoom de tipografía (+ / -) con fuente monoespaciada *Fira Code*.
  - Redimensionamiento dinámico automático (sincroniza las filas y columnas del PTY remoto al cambiar el tamaño de la ventana).
  - Herramienta integrada para probar puertos TCP SSH (`Test Port`).

---

## Arquitectura de Seguridad

```text
[ Navegador Web ]
   ├── Login LDAP / Sesión JWT
   ├── React + xterm.js (PTY Terminal)
   ├── Key Vault Manager (Gestor de llaves)
   └── WebSocket seguro (/ws/ssh?token=JWT)
           ↕
[ Servidor Node.js ]
   ├── Auth Middleware (Validación JWT)
   ├── Servicio LDAP (Active Directory / OpenLDAP)
   ├── Motor Criptográfico (AES-256-GCM)
   └── Bridge SSH2 (Pasa secrets descifrados en RAM al host remoto)
           ↕
[ Almacenamiento Cifrado en Disco ]
   ├── data/servers.json (Credenciales cifradas con AES-256-GCM)
   └── data/keys.json (Key Vault cifrado con AES-256-GCM)
```

---

## Configuración y Variables de Entorno

Crea un archivo `.env` basado en `.env.example`:

```env
PORT=3001

# Clave maestra de cifrado AES-256 (32 caracteres / bytes)
APP_ENCRYPTION_KEY=clave_secreta_maestra_de_32_bytes_123

# Secreto para firma de tokens JWT de sesión
JWT_SECRET=super_secret_jwt_key_para_sesiones_ssh_term_2026

# Configuración del Directorio LDAP / Active Directory
LDAP_URL=ldap://127.0.0.1:389
LDAP_BIND_DN=cn=admin,dc=empresa,dc=local
LDAP_BIND_PASSWORD=admin_password
LDAP_SEARCH_BASE=dc=empresa,dc=local
LDAP_SEARCH_FILTER=(&(objectClass=person)(|(uid={{username}})(sAMAccountName={{username}})))

# Habilitar modo desarrollo / fallback local
# Permite ingresar con 'admin' / 'admin' cuando no haya un LDAP disponible físicamente
LDAP_DEV_MODE=true
```

---

## Instalación y Ejecución

### 1. Instalar dependencias:
```bash
npm install
```

### 2. Compilar y ejecutar (Modo Producción):
```bash
npm run app
```
Abre tu navegador en:
👉 **`http://localhost:3001`**

> **Credenciales de inicio rápido (Modo Dev)**:
> - **Usuario**: `admin`
> - **Contraseña**: `admin`

---

### Modo Desarrollo (con Hot Reloading):
1. Iniciar backend: `npm run server`
2. En otra terminal iniciar frontend Vite: `npm run dev`
3. Abre `http://localhost:3000`.

---

## 🔒 Habilitar HTTPS / WSS (Cifrado TLS)

La aplicación soporta **HTTPS nativo** (y conexión WebSocket segura `wss://`):

### 1. Generar certificados autofirmados (para pruebas o red local):
```bash
npm run ssl:gen
```
Este comando crea `data/ssl/cert.pem` y `data/ssl/key.pem` con permisos seguros.

### 2. Activar HTTPS en `.env`:
Modifica en tu archivo `.env`:
```env
SSL_ENABLED=true
SSL_CERT_PATH=data/ssl/cert.pem
SSL_KEY_PATH=data/ssl/key.pem
```

Al iniciar la aplicación (`npm run app`), el servidor responderá exclusivamente a través de:
👉 **`https://localhost:3001`** (y `wss://localhost:3001/ws/ssh`).
*(Si usas certificados de producción de Let's Encrypt o corporativos, solo debes apuntar las variables `SSL_CERT_PATH` y `SSL_KEY_PATH` a tus archivos `.pem` o `.crt` correspondientes).*

