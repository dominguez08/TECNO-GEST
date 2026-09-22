const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new Error('La contraseña debe tener entre 8 y 128 caracteres.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password, saved) {
  if (typeof password !== 'string' || password.length > 128 || !saved) return false;
  const [salt, hash] = saved.split(':');
  if (!salt || !hash) return false;
  const candidate = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

module.exports = { hashPassword, verifyPassword };
