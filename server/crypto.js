const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recomendado para GCM
const KEY_FILE = path.join(__dirname, '..', 'data', '.encryption_key');

let derivedKey = null;

function getEncryptionKey() {
  if (derivedKey) return derivedKey;

  let rawKey = process.env.APP_ENCRYPTION_KEY;

  if (!rawKey) {
    if (fs.existsSync(KEY_FILE)) {
      rawKey = fs.readFileSync(KEY_FILE, 'utf-8').trim();
    } else {
      const generated = crypto.randomBytes(32).toString('hex');
      try {
        const dataDir = path.dirname(KEY_FILE);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(KEY_FILE, generated, { mode: 0o600 });
        rawKey = generated;
        console.log('[Crypto] Se ha generado una clave de cifrado maestra segura en data/.encryption_key');
      } catch (e) {
        rawKey = generated;
      }
    }
  }

  // Derivar exactamente 32 bytes usando SHA-256
  derivedKey = crypto.createHash('sha256').update(rawKey).digest();
  return derivedKey;
}

function encrypt(text) {
  if (!text || typeof text !== 'string') return text;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    // Formato serializado: enc:v1:iv:authTag:ciphertext
    return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (err) {
    console.error('[Crypto] Error al cifrar dato sensible:', err);
    throw new Error('Fallo al cifrar datos');
  }
}

function decrypt(cipherText) {
  if (!cipherText || typeof cipherText !== 'string') return cipherText;

  // Si no tiene el prefijo de cifrado, es un dato legacy o texto plano
  if (!cipherText.startsWith('enc:v1:')) {
    return cipherText;
  }

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 5) {
      throw new Error('Formato de cifrado inválido');
    }

    const [, , ivHex, tagHex, dataHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const encryptedData = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (err) {
    console.error('[Crypto] Error al descifrar dato sensible (clave o integridad incorrecta):', err.message);
    throw new Error('No se pudo descifrar la credencial (clave maestra incorrecta o archivo alterado)');
  }
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith('enc:v1:');
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted
};
