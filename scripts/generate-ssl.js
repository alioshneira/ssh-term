const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SSL_DIR = path.join(__dirname, '..', 'data', 'ssl');
const KEY_PATH = path.join(SSL_DIR, 'key.pem');
const CERT_PATH = path.join(SSL_DIR, 'cert.pem');

if (!fs.existsSync(SSL_DIR)) {
  fs.mkdirSync(SSL_DIR, { recursive: true });
}

console.log('Generando certificado SSL autofirmado para HTTPS...');

try {
  const cmd = `openssl req -x509 -newkey rsa:4096 -keyout "${KEY_PATH}" -out "${CERT_PATH}" -days 365 -nodes -subj "/CN=localhost"`;
  execSync(cmd, { stdio: 'inherit' });

  // Permisos restrictivos para la clave privada
  fs.chmodSync(KEY_PATH, 0o600);

  console.log('\n======================================================');
  console.log(' Certificados SSL generados exitosamente:');
  console.log(` - Certificado: ${CERT_PATH}`);
  console.log(` - Clave privada: ${KEY_PATH}`);
  console.log('======================================================');
  console.log('Para activar HTTPS en el servidor:');
  console.log('Establece en tu archivo .env:');
  console.log('  SSL_ENABLED=true');
  console.log('  SSL_CERT_PATH=data/ssl/cert.pem');
  console.log('  SSL_KEY_PATH=data/ssl/key.pem');
  console.log('======================================================\n');
} catch (err) {
  console.error('Error generando certificados con openssl:', err.message);
  process.exit(1);
}
