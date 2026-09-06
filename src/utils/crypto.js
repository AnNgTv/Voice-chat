const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default_secret_key_32bytes_long!', 'salt', 32);
const IV_LENGTH = 16;

function encryptUserId(userId) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    let encrypted = cipher.update(userId, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

function decryptUserId(encryptedText) {
    try {
        const [ivHex, encrypted] = encryptedText.split(':');
        if (!ivHex || !encrypted) return null;

        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        return null;
    }
}

module.exports = { encryptUserId, decryptUserId };
