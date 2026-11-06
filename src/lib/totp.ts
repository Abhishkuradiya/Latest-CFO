import crypto from 'crypto';

// In-memory 2FA fallback cache
export const admin2FAState: {
  secret: string | null;
  enabled: boolean;
} = {
  secret: null,
  enabled: false,
};

import { db } from '@/lib/db';

export async function ensure2FAColumnsExist() {
  if (db.isPgActive()) {
    try {
      await db.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);
      `);
    } catch (e) {
      console.warn('2FA columns check:', e);
    }
  }
}

export async function getAdmin2FAInfo() {
  await ensure2FAColumnsExist();
  if (db.isPgActive()) {
    try {
      const res = await db.query("SELECT two_factor_enabled, two_factor_secret FROM users WHERE email = 'admin@virtualcfo.com' LIMIT 1");
      if (res.rows.length > 0) {
        const row = res.rows[0];
        const enabled = !!row.two_factor_enabled;
        const secret = enabled ? (row.two_factor_secret || null) : null;
        return { enabled, secret };
      }
    } catch (e) {
      console.warn('Error fetching 2FA from DB:', e);
    }
  }
  return { enabled: admin2FAState.enabled, secret: admin2FAState.enabled ? admin2FAState.secret : null };
}

export async function setAdmin2FADbState(enabled: boolean, secret: string | null) {
  await ensure2FAColumnsExist();
  admin2FAState.enabled = enabled;
  admin2FAState.secret = enabled ? secret : null;

  if (db.isPgActive()) {
    try {
      await db.query(
        "UPDATE users SET two_factor_enabled = $1, two_factor_secret = $2 WHERE email = 'admin@virtualcfo.com'",
        [enabled, enabled ? secret : null]
      );
    } catch (e) {
      console.warn('Error updating 2FA in DB:', e);
    }
  }
}

// Base32 alphabet according to RFC 4648
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encodes a Buffer into a Base32 string
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes a Base32 string into a Buffer
 */
export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const index = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/**
 * Generates a random Base32 secret key for Google Authenticator (e.g. JBSWY3DPEHPK3PXP)
 */
export function generate2FASecret(length = 20): string {
  const randomBytes = crypto.randomBytes(length);
  return base32Encode(randomBytes);
}

/**
 * Calculates RFC 6238 TOTP 6-digit code for a given secret & time step
 */
export function generateTOTPCode(secret: string, timeStepWindow = 0): string {
  const key = base32Decode(secret);
  const timeStep = 30; // 30 seconds period
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep) + timeStepWindow;

  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(0, 0);
  buffer.writeUInt32BE(counter, 4);

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0xf;
  const code = (
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  ) % 1000000;

  return code.toString().padStart(6, '0');
}

/**
 * Verifies a 6-digit TOTP code against a secret with ±1 time window drift tolerance
 */
export function verify2FAToken(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  const cleanToken = token.trim().replace(/\s+/g, '');

  for (let offset = -1; offset <= 1; offset++) {
    const validCode = generateTOTPCode(secret, offset);
    if (cleanToken === validCode) {
      return true;
    }
  }

  return false;
}

/**
 * Generates otpauth:// URI for Google Authenticator apps
 */
export function generateOtpauthUrl(label: string, issuer: string, secret: string): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedLabel = encodeURIComponent(label);
  return `otpauth://totp/${encodedIssuer}:${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

