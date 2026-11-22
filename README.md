# WebSSH Terminal - Cliente SSH Web Multi-Servidor (v2.0)

Una aplicación web moderna, rápida y segura de nivel empresarial que permite conectarte y administrar múltiples servidores Linux directamente desde tu navegador web, con soporte para pestañas simultáneas, autenticación corporativa LDAP, gestor de llaves privadas SSH (Key Vault) y cifrado fuerte en reposo.

---

## Novedades de la Versión 2.0

- 🔒 **Cifrado en Reposo (AES-256-GCM)**:
  - Todas las contraseñas y claves privadas se almacenan cifradas en el disco con un vector de inicialización (`iv`) único y autenticación de integridad (`authTag`).
  - Las credenciales se descifran **únicamente en la memoria RAM** del proceso en el momento de establecer la sesión SSH.
  - La API nunca devuelve claves o contraseñas en texto plano al frontend.
- 🏢 **Autenticación Corporativa LDAP / Active Directory**:
  - Integración nativa con directorios LDAP mediante `ldapts`.
  - Control de acceso completo y emisión de sesiones seguras mediante **JWT**.
  - Modo de desarrollo/fallback para pruebas locales (`LDAP_DEV_MODE=true`).
- 🔑 **Gestor Independiente de Llaves SSH (Key Vault)**:
  - Guarda tus claves privadas (RSA, Ed25519, OpenSSH con o sin passphrase) una sola vez como objetos independientes.
  - Asocia una misma llave a múltiples servidores; al actualizar la llave en el Key Vault, el cambio se refleja en todos los servidores vinculados.
- 🏷️ **Soporte para Múltiples Tags / Etiquetas**:
  - Asigna múltiples etiquetas a cada servidor (ej. `#Producción`, `#AWS`, `#Database`, `#Nginx`).
  - Barra de filtrado interactivo por etiquetas en la barra lateral para segmentar servidores al instante.
- 📋 **Duplicación de Conexiones**:
  - Botón de clonación inmediata en cada tarjeta de servidor para crear réplicas con un solo clic.

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

