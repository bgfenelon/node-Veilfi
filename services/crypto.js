const crypto = require("crypto");

// Derive AES key from passphrase + salt
function deriveKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, "sha256");
}

// Encrypt private key
function encryptPrivateKey(secretKey, passphrase) {
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(16);
  const key = deriveKey(passphrase, salt);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(secretKey)),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    salt: salt.toString("base64"),
    tag: tag.toString("base64"),
  };
}

// Decrypt private key
function decryptPrivateKey(ciphertext, passphrase, salt, iv, tag) {
  const key = deriveKey(passphrase, Buffer.from(salt, "base64"));

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64")
  );

  decipher.setAuthTag(Buffer.from(tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);

  return decrypted;
}

module.exports = {
  encryptPrivateKey,
  decryptPrivateKey,
};
