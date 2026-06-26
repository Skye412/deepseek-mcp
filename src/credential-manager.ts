/**
 * Credential Manager for DeepSeek MCP
 *
 * Provides AES-256-GCM encryption for storing DeepSeek credentials
 * using PBKDF2 key derivation. Credentials are stored encrypted
 * at ~/.deepseek-mcp/credentials.enc with file permissions 600.
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { DeepSeekCredentials, EncryptedCredentials } from './types/index.js';

/** Encryption algorithm identifier */
const ALGORITHM = 'aes-256-gcm';

/** PBKDF2 iteration count for key derivation */
const PBKDF2_ITERATIONS = 100_000;

/** Key length for AES-256 */
const KEY_LENGTH = 32;

/** Salt length in bytes */
const SALT_LENGTH = 16;

/** IV length in bytes for AES-GCM */
const IV_LENGTH = 12;

/** Directory for storing credentials */
const CREDENTIALS_DIR = '.deepseek-mcp';

/** Credentials file name */
const CREDENTIALS_FILE = 'credentials.enc';

export class CredentialManager {
  private credentialsPath: string;

  constructor(credentialsDir?: string) {
    const dir = credentialsDir || join(homedir(), CREDENTIALS_DIR);
    this.credentialsPath = join(dir, CREDENTIALS_FILE);
  }

  /**
   * Derive an AES-256 key from a master password using PBKDF2.
   */
  private deriveKey(masterPassword: string, salt: Buffer): Buffer {
    return pbkdf2Sync(masterPassword, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
  }

  /**
   * Encrypt a plaintext string using AES-256-GCM.
   * Returns hex-encoded ciphertext, auth tag, and the IV used.
   */
  private encrypt(plaintext: string, masterPassword: string): { ciphertext: string; iv: string; salt: string; authTag: string } {
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const key = this.deriveKey(masterPassword, salt);

    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt a hex-encoded ciphertext using AES-256-GCM.
   */
  private decrypt(ciphertext: string, authTag: string, iv: string, salt: string, masterPassword: string): string {
    const key = this.deriveKey(masterPassword, Buffer.from(salt, 'hex'));
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Ensure the credentials directory exists and has correct permissions.
   */
  private ensureDirectory(): void {
    const dir = join(homedir(), CREDENTIALS_DIR);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Save credentials to disk with AES-256-GCM encryption.
   *
   * @param email - DeepSeek account email
   * @param password - DeepSeek account password
   * @param masterPassword - Password used to derive the encryption key
   */
  async saveCredentials(email: string, password: string, masterPassword: string): Promise<void> {
    if (!email || !password || !masterPassword) {
      throw new Error('Email, password, and master password are required');
    }

    this.ensureDirectory();

    // Encrypt email and password separately but use the same master password
    const encryptedEmail = this.encrypt(email, masterPassword);
    const encryptedPassword = this.encrypt(password, masterPassword);

    // We store two encrypted entries. For simplicity, we encrypt them
    // as a single JSON blob to keep IV/salt count manageable.
    const payload = JSON.stringify({ email, password });
    const encryptedPayload = this.encrypt(payload, masterPassword);

    const storedData: EncryptedCredentials & { authTag: string; version: number } = {
      email: encryptedPayload.ciphertext,
      password: encryptedPayload.authTag,
      iv: encryptedPayload.iv,
      salt: encryptedPayload.salt,
      authTag: encryptedPayload.authTag,
      version: 1,
    };

    writeFileSync(this.credentialsPath, JSON.stringify(storedData, null, 2), { mode: 0o600 });

    // Ensure the file itself has 600 permissions
    chmodSync(this.credentialsPath, 0o600);
  }

  /**
   * Retrieve and decrypt credentials from disk.
   *
   * @param masterPassword - Password used to derive the decryption key
   * @returns Decrypted DeepSeek credentials
   * @throws Error if credentials file doesn't exist or master password is wrong
   */
  async getCredentials(masterPassword: string): Promise<DeepSeekCredentials> {
    if (!masterPassword) {
      throw new Error('Master password is required');
    }

    if (!existsSync(this.credentialsPath)) {
      throw new Error('No credentials found. Run saveCredentials first.');
    }

    const rawData = readFileSync(this.credentialsPath, 'utf8');
    const storedData: EncryptedCredentials & { authTag: string; version: number } = JSON.parse(rawData);

    try {
      const decrypted = this.decrypt(
        storedData.email,
        storedData.authTag,
        storedData.iv,
        storedData.salt,
        masterPassword
      );

      const { email, password } = JSON.parse(decrypted);
      return { email, password };
    } catch {
      throw new Error('Invalid master password or corrupted credentials');
    }
  }

  /**
   * Check if credentials exist on disk.
   *
   * @returns true if credentials file exists
   */
  hasCredentials(): boolean {
    return existsSync(this.credentialsPath);
  }
}
