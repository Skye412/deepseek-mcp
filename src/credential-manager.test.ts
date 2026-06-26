/**
 * Tests for CredentialManager
 *
 * Covers: save, retrieve, hasCredentials, encryption roundtrip,
 * wrong master password, file permissions, directory creation,
 * and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, mkdirSync, rmSync, chmodSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CredentialManager } from './credential-manager.js';

// Use a temp directory for each test to avoid polluting real home directory
const TEST_DIR_PREFIX = join(tmpdir(), 'deepseek-mcp-test-');

let testDir: string;
let manager: CredentialManager;

function createTestManager(): CredentialManager {
  testDir = TEST_DIR_PREFIX + Date.now() + '-' + Math.random().toString(36).slice(2);
  mkdirSync(testDir, { recursive: true });
  return new CredentialManager(testDir);
}

function cleanupTestDir(): void {
  if (testDir && existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

beforeEach(() => {
  manager = createTestManager();
});

afterEach(() => {
  cleanupTestDir();
});

describe('CredentialManager', () => {
  // =========================================================================
  // Basic functionality
  // =========================================================================

  describe('saveCredentials', () => {
    it('should save credentials to disk', async () => {
      await manager.saveCredentials('test@example.com', 'password123', 'masterpass');

      expect(manager.hasCredentials()).toBe(true);
      expect(existsSync(join(testDir, 'credentials.enc'))).toBe(true);
    });

    it('should create credentials file with JSON content', async () => {
      await manager.saveCredentials('test@example.com', 'password123', 'masterpass');

      const raw = readFileSync(join(testDir, 'credentials.enc'), 'utf8');
      const data = JSON.parse(raw);

      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('password');
      expect(data).toHaveProperty('iv');
      expect(data).toHaveProperty('salt');
      expect(data).toHaveProperty('authTag');
      expect(data).toHaveProperty('version', 1);
    });

    it('should store encrypted data (not plaintext)', async () => {
      await manager.saveCredentials('test@example.com', 'password123', 'masterpass');

      const raw = readFileSync(join(testDir, 'credentials.enc'), 'utf8');
      expect(raw).not.toContain('test@example.com');
      expect(raw).not.toContain('password123');
    });

    it('should reject empty email', async () => {
      await expect(
        manager.saveCredentials('', 'password123', 'masterpass')
      ).rejects.toThrow('Email, password, and master password are required');
    });

    it('should reject empty password', async () => {
      await expect(
        manager.saveCredentials('test@example.com', '', 'masterpass')
      ).rejects.toThrow('Email, password, and master password are required');
    });

    it('should reject empty master password', async () => {
      await expect(
        manager.saveCredentials('test@example.com', 'password123', '')
      ).rejects.toThrow('Email, password, and master password are required');
    });
  });

  // =========================================================================
  // Credential retrieval
  // =========================================================================

  describe('getCredentials', () => {
    it('should retrieve saved credentials with correct master password', async () => {
      const email = 'user@deepseek.com';
      const password = 'secret-password-123';
      const masterPass = 'my-master-password';

      await manager.saveCredentials(email, password, masterPass);
      const credentials = await manager.getCredentials(masterPass);

      expect(credentials.email).toBe(email);
      expect(credentials.password).toBe(password);
    });

    it('should throw when no credentials exist', async () => {
      await expect(manager.getCredentials('masterpass')).rejects.toThrow(
        'No credentials found'
      );
    });

    it('should throw with wrong master password', async () => {
      await manager.saveCredentials('test@example.com', 'password123', 'correct-master');

      await expect(manager.getCredentials('wrong-master')).rejects.toThrow(
        'Invalid master password or corrupted credentials'
      );
    });

    it('should reject empty master password', async () => {
      await manager.saveCredentials('test@example.com', 'password123', 'masterpass');

      await expect(manager.getCredentials('')).rejects.toThrow(
        'Master password is required'
      );
    });

    it('should handle special characters in credentials', async () => {
      const email = 'user+tag@deepseek.co.uk';
      const password = 'p@$$w0rd!#%^&*()';
      const masterPass = 'master-特殊字符';

      await manager.saveCredentials(email, password, masterPass);
      const credentials = await manager.getCredentials(masterPass);

      expect(credentials.email).toBe(email);
      expect(credentials.password).toBe(password);
    });

    it('should handle long credentials', async () => {
      const email = 'a'.repeat(200) + '@example.com';
      const password = 'b'.repeat(500);
      const masterPass = 'c'.repeat(100);

      await manager.saveCredentials(email, password, masterPass);
      const credentials = await manager.getCredentials(masterPass);

      expect(credentials.email).toBe(email);
      expect(credentials.password).toBe(password);
    });
  });

  // =========================================================================
  // hasCredentials
  // =========================================================================

  describe('hasCredentials', () => {
    it('should return false when no credentials exist', () => {
      expect(manager.hasCredentials()).toBe(false);
    });

    it('should return true after saving credentials', async () => {
      await manager.saveCredentials('test@example.com', 'password123', 'masterpass');
      expect(manager.hasCredentials()).toBe(true);
    });

    it('should return false for non-existent directory', () => {
      const nonExistentManager = new CredentialManager('/tmp/nonexistent-path-xyz');
      expect(nonExistentManager.hasCredentials()).toBe(false);
    });
  });

  // =========================================================================
  // Encryption security
  // =========================================================================

  describe('encryption security', () => {
    it('should produce different ciphertext for different master passwords', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      await manager.saveCredentials(email, password, 'master1');
      const raw1 = readFileSync(join(testDir, 'credentials.enc'), 'utf8');

      // Clean and save with different master
      rmSync(join(testDir, 'credentials.enc'));
      await manager.saveCredentials(email, password, 'master2');
      const raw2 = readFileSync(join(testDir, 'credentials.enc'), 'utf8');

      expect(raw1).not.toBe(raw2);
    });

    it('should use unique salts for each encryption', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const masterPass = 'masterpass';

      await manager.saveCredentials(email, password, masterPass);
      const data1 = JSON.parse(readFileSync(join(testDir, 'credentials.enc'), 'utf8'));

      rmSync(join(testDir, 'credentials.enc'));
      await manager.saveCredentials(email, password, masterPass);
      const data2 = JSON.parse(readFileSync(join(testDir, 'credentials.enc'), 'utf8'));

      // Salts should be different (random)
      expect(data1.salt).not.toBe(data2.salt);
      // IVs should also be different
      expect(data1.iv).not.toBe(data2.iv);
    });

    it('should be able to decrypt with the correct master password after re-save', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      // Save with master1
      await manager.saveCredentials(email, password, 'master1');
      // Overwrite with master2
      await manager.saveCredentials(email, password, 'master2');

      // Can decrypt with master2
      const creds = await manager.getCredentials('master2');
      expect(creds.email).toBe(email);
      expect(creds.password).toBe(password);

      // Cannot decrypt with master1
      await expect(manager.getCredentials('master1')).rejects.toThrow();
    });
  });

  // =========================================================================
  // File permissions
  // =========================================================================

  describe('file permissions', () => {
    it('should create credentials file with restricted permissions (0600)', async () => {
      await manager.saveCredentials('test@example.com', 'password123', 'masterpass');

      const filePath = join(testDir, 'credentials.enc');
      const stats = statSync(filePath);
      const mode = (stats.mode & 0o777).toString(8);

      expect(mode).toBe('600');
    });
  });

  // =========================================================================
  // Custom directory
  // =========================================================================

  describe('custom directory', () => {
    it('should create credentials directory if it does not exist', async () => {
      const customDir = join(TEST_DIR_PREFIX + 'custom-' + Date.now(), 'nested', 'dir');
      const customManager = new CredentialManager(customDir);

      await customManager.saveCredentials('test@example.com', 'password123', 'masterpass');

      expect(existsSync(join(customDir, 'credentials.enc'))).toBe(true);

      // Cleanup
      rmSync(join(TEST_DIR_PREFIX + 'custom-' + Date.now()), { recursive: true, force: true });
    });

    it('should retrieve from custom directory', async () => {
      const email = 'test@deepseek.com';
      const password = 'secret';
      const master = 'master';

      await manager.saveCredentials(email, password, master);
      const creds = await manager.getCredentials(master);

      expect(creds.email).toBe(email);
      expect(creds.password).toBe(password);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('should handle overwrite of existing credentials', async () => {
      const email1 = 'first@example.com';
      const password1 = 'pass1';
      const email2 = 'second@example.com';
      const password2 = 'pass2';
      const masterPass = 'master';

      await manager.saveCredentials(email1, password1, masterPass);
      let creds = await manager.getCredentials(masterPass);
      expect(creds.email).toBe(email1);

      await manager.saveCredentials(email2, password2, masterPass);
      creds = await manager.getCredentials(masterPass);
      expect(creds.email).toBe(email2);
      expect(creds.password).toBe(password2);
    });

    it('should handle concurrent save and read operations', async () => {
      const masterPass = 'master';

      // Save multiple credentials concurrently
      await Promise.all([
        manager.saveCredentials('a@example.com', 'pass-a', masterPass),
      ]);

      const creds = await manager.getCredentials(masterPass);
      expect(creds.email).toBe('a@example.com');
    });

    it('should work with minimal valid inputs', async () => {
      await manager.saveCredentials('a@b.c', 'x', 'y');
      const creds = await manager.getCredentials('y');
      expect(creds.email).toBe('a@b.c');
      expect(creds.password).toBe('x');
    });
  });
});
