# WebSSH Terminal - Cliente SSH Web Multi-Servidor

Una aplicación web moderna, rápida y segura que permite conectarte y administrar múltiples servidores Linux directamente desde tu navegador web, con soporte para pestañas simultáneas y libreta de servidores.

---

## Características Principales

- **Emulación Completa de Terminal**: Impulsado por `@xterm/xterm` (el mismo motor utilizado por VS Code), con soporte completo para colores ANSI, secuencias de escape, aplicaciones interactivas (`htop`, `vim`, `nano`, `tmux`, etc.) y enlaces web clicables.
- **Múltiples Pestañas Simultáneas**: Abre conexiones SSH a diferentes servidores concurrentemente y alterna entre ellos sin perder el estado o buffer de tu sesión.
- **Libreta de Servidores (Bookmarks)**:
  - Guarda perfiles de servidores con etiquetas/grupos (ej. *Producción*, *Staging*, *Base de Datos*).
  - Búsqueda instantánea de servidores por nombre, host o usuario.
  - Comprobador integrado de estado de puerto SSH (`TCP Ping`).
- **Autenticación Flexible**:
  - Contraseña tradicional.
  - Clave privada SSH (formato PEM / OpenSSH: RSA, Ed25519) con soporte opcional para frase de paso (`passphrase`).
- **Personalización y Utilidades**:
  - Selector de temas en tiempo real: *One Dark*, *Dracula*, *Tokyo Night* y *Monokai*.
  - Zoom de tipografía (+ / -) con fuente monoespaciada *Fira Code*.
  - Redimensionamiento dinámico automático (sincroniza las filas y columnas del PTY remoto al cambiar el tamaño de la ventana).
  - Botón de limpieza de pantalla, pantalla completa y reconexión rápida.

---

## Arquitectura Técnica

```text
[ Navegador Web ]
   ├── xterm.js (Renderizado de terminal PTY)
   ├── React + Vite (Gestor de pestañas, libreta de servidores, modales)
   └── WebSocket Client (Transmisión bidireccional de baja latencia)
           ↕
      (ws:// / wss://)
           ↕
[ Servidor Node.js ]
   ├── Express (API REST para servidores guardados y assets estáticos)
   ├── ws (WebSocket Server en /ws/ssh)
   └── ssh2 (Cliente SSH que abre el shell interactivo en el host remoto)
           ↕
      (Puerto 22 SSH)
           ↕
[ Servidores Linux Remotos ]
```

---

## Requisitos

- **Node.js** v18 o superior.
- **npm** v9 o superior.

---

## Instalación y Ejecución

### 1. Clonar o ingresar al directorio del proyecto:
```bash
cd /Users/aliosh/antigravity/ssh-term
```

### 2. Instalar dependencias:
```bash
npm install
```

### 3. Iniciar la aplicación (Modo Producción):
```bash
npm run app
```
Este comando compila el frontend e inicia el servidor en el puerto `3001`.

Abre tu navegador en:
```text
http://localhost:3001
```

---

### Modo Desarrollo (con Hot Reloading):
Si deseas modificar el código con recarga en vivo:
1. En una terminal inicia el backend:
   ```bash
   npm run server
   ```
2. En otra terminal inicia Vite para el frontend:
   ```bash
   npm run dev
   ```
   Abre `http://localhost:3000` (las llamadas a la API y WebSocket se redirigen automáticamente al backend en el puerto `3001`).

---

## Cómo Usar la Aplicación

1. **Conexión Rápida**:
   - Haz clic en el botón azul **"Conectar"** en la barra superior.
   - Ingresa el Host/IP (ej. `192.168.1.100`), Puerto (`22`), Usuario (`ubuntu` o `root`) y tu contraseña o clave privada.
   - Presiona **"Iniciar Sesión SSH"**.
   - Se abrirá una nueva pestaña con tu terminal interactiva.
2. **Guardar un Servidor**:
   - Abre el panel lateral izquierdo haciendo clic en **"Servidores"** o en el icono de la terminal.
   - Presiona el botón **"+"** o **"Guardar Servidor"**.
   - Ingresa una etiqueta (ej. `DB Cluster Staging`), los datos de conexión y presiona **"Guardar Servidor"**.
   - Puedes usar el botón **"Probar Puerto"** para comprobar si el puerto 22 responde antes de guardar.
3. **Múltiples Sesiones**:
   - Puedes hacer clic en **"Conectar"** en varios servidores guardados para tener múltiples pestañas activas al mismo tiempo.
   - Cambia entre pestañas en cualquier momento haciendo clic en ellas.
   - Cada pestaña muestra el indicador de estado:
     - 🟢 **Verde**: Conectado.
     - 🟡 **Amarillo**: Conectando.
     - ⚪ **Gris**: Desconectado / Cerrado.
     - 🔴 **Rojo**: Error de autenticación o de conexión.
