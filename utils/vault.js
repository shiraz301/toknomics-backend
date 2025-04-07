const crypto = require('crypto');

const algorithm = 'aes-256-ctr';
const secretKey = crypto.createHash('sha256').update(process.env.VAULT_SECRET).digest(); // 32-byte key
const iv = crypto.randomBytes(16); // Initialization vector

const encrypt = (text) => {
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

const decrypt = (text) => {
    const [ivHex, encryptedText] = text.split(':');
    const decipher = crypto.createCipheriv(algorithm, secretKey, Buffer.from(ivHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedText, 'hex')), decipher.final()]);
    return decrypted.toString();
};

module.exports = { encrypt, decrypt };
