import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = Number.parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

export async function hashPassword(password) {
  const rounds = Number.isInteger(BCRYPT_ROUNDS) && BCRYPT_ROUNDS >= 10 ? BCRYPT_ROUNDS : 12;
  return bcrypt.hash(password, rounds);
}

function isBcryptHash(value) {
  if (typeof value !== 'string') {
    return false;
  }
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

export async function verifyPassword(plainPassword, storedPassword) {
  if (typeof plainPassword !== 'string' || typeof storedPassword !== 'string') {
    return { matched: false, needs_upgrade: false };
  }

  if (isBcryptHash(storedPassword)) {
    return {
      matched: await bcrypt.compare(plainPassword, storedPassword),
      needs_upgrade: false
    };
  }

  const matched = plainPassword === storedPassword;
  return {
    matched,
    needs_upgrade: matched
  };
}
