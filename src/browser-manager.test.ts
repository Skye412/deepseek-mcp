/**
 * BrowserManager Tests
 *
 * Tests the BrowserManager class constructor, options, and state management.
 * Does NOT launch a real browser (that requires Playwright installation).
 */

import { describe, it, expect, vi } from 'vitest';
import { BrowserManager } from './browser-manager';
import { homedir } from 'os';
import { join } from 'path';

describe('BrowserManager', () => {
  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const manager = new BrowserManager();
      const options = manager.getOptions();

      expect(options.headless).toBe(false);
      expect(options.timeout).toBe(30000);
      expect(options.viewport).toEqual({ width: 1280, height: 720 });
      expect(options.userDataDir).toBe(join(homedir(), '.deepseek-mcp', 'browser-data'));
    });

    it('should accept custom options', () => {
      const manager = new BrowserManager({
        headless: true,
        timeout: 60000,
        viewport: { width: 1920, height: 1080 },
        userDataDir: '/custom/path',
      });
      const options = manager.getOptions();

      expect(options.headless).toBe(true);
      expect(options.timeout).toBe(60000);
      expect(options.viewport).toEqual({ width: 1920, height: 1080 });
      expect(options.userDataDir).toBe('/custom/path');
    });

    it('should accept partial options', () => {
      const manager = new BrowserManager({ headless: true });
      const options = manager.getOptions();

      expect(options.headless).toBe(true);
      expect(options.timeout).toBe(30000);
      expect(options.viewport).toEqual({ width: 1280, height: 720 });
    });

    it('should have userDataDir default to ~/.deepseek-mcp/browser-data', () => {
      const manager = new BrowserManager();
      const expected = join(homedir(), '.deepseek-mcp', 'browser-data');
      expect(manager.getOptions().userDataDir).toBe(expected);
    });
  });

  describe('initial state', () => {
    it('should not be initialized', () => {
      const manager = new BrowserManager();
      expect(manager.isInitialized()).toBe(false);
    });

    it('should return null for getPage', () => {
      const manager = new BrowserManager();
      expect(manager.getPage()).toBeNull();
    });

    it('should return null for getContext', () => {
      const manager = new BrowserManager();
      expect(manager.getContext()).toBeNull();
    });
  });

  describe('close', () => {
    it('should be callable on uninitialized manager', async () => {
      const manager = new BrowserManager();
      await expect(manager.close()).resolves.toBeUndefined();
    });

    it('should be callable multiple times', async () => {
      const manager = new BrowserManager();
      await manager.close();
      await expect(manager.close()).resolves.toBeUndefined();
    });

    it('should reset state after close', async () => {
      const manager = new BrowserManager();
      await manager.close();

      expect(manager.isInitialized()).toBe(false);
      expect(manager.getPage()).toBeNull();
      expect(manager.getContext()).toBeNull();
    });
  });

  describe('isLoggedIn', () => {
    it('should return false when not initialized', async () => {
      const manager = new BrowserManager();
      expect(await manager.isLoggedIn()).toBe(false);
    });

    it('should return false when page is null', async () => {
      const manager = new BrowserManager();
      // getPage returns null when not initialized
      expect(await manager.isLoggedIn()).toBe(false);
    });
  });

  describe('ensureReady', () => {
    it('should be callable', () => {
      const manager = new BrowserManager();
      expect(typeof manager.ensureReady).toBe('function');
    });
  });

  describe('interface compliance', () => {
    it('should have all required methods', () => {
      const manager = new BrowserManager();

      expect(typeof manager.initialize).toBe('function');
      expect(typeof manager.close).toBe('function');
      expect(typeof manager.getPage).toBe('function');
      expect(typeof manager.getContext).toBe('function');
      expect(typeof manager.isInitialized).toBe('function');
      expect(typeof manager.isLoggedIn).toBe('function');
      expect(typeof manager.ensureReady).toBe('function');
      expect(typeof manager.getOptions).toBe('function');
    });
  });
});
