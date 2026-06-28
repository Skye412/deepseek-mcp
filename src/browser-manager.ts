/**
 * Browser Manager
 *
 * Manages Playwright browser instances for the DeepSeek MCP server.
 * Uses launchPersistentContext with a user-data-dir to persist cookies
 * and login sessions across server restarts.
 */

import { chromium, BrowserContext, Page } from 'playwright';
import { homedir } from 'os';
import { join } from 'path';

/**
 * Configuration options for BrowserManager
 */
export interface BrowserOptions {
  /** Run browser in headless mode (default: false, needs headed for first login) */
  headless?: boolean;
  /** Default timeout for operations in milliseconds (default: 30000) */
  timeout?: number;
  /** Browser viewport size */
  viewport?: { width: number; height: number };
  /**
   * Path to user data directory for session persistence.
   * Cookies, localStorage, and login state are stored here.
   * Default: ~/.deepseek-mcp/browser-data
   */
  userDataDir?: string;
}

/**
 * BrowserManager - Manages Playwright browser lifecycle with session persistence
 *
 * Uses chromium.launchPersistentContext() to automatically persist cookies
 * and login state between server restarts. First run requires manual login;
 * subsequent runs restore the session automatically.
 */
export class BrowserManager {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private options: {
    headless: boolean;
    timeout: number;
    viewport: { width: number; height: number };
    userDataDir: string;
  };

  /**
   * Create a new BrowserManager instance
   * @param options - Configuration options
   */
  constructor(options?: BrowserOptions) {
    this.options = {
      headless: options?.headless ?? false,
      timeout: options?.timeout ?? 30000,
      viewport: options?.viewport ?? { width: 1280, height: 720 },
      userDataDir: options?.userDataDir ?? join(homedir(), '.deepseek-mcp', 'browser-data'),
    };
  }

  /**
   * Initialize the browser with persistent context.
   * Uses the user-data-dir to restore cookies and login state from previous sessions.
   * @throws Error if browser initialization fails
   */
  async initialize(): Promise<void> {
    if (this.isInitialized()) {
      return;
    }

    if (this.context || this.page) {
      await this.close();
    }

    try {
      // Launch persistent context - cookies/localStorage are saved to userDataDir
      // and restored automatically on next launch
      this.context = await chromium.launchPersistentContext(this.options.userDataDir, {
        headless: this.options.headless,
        channel: 'msedge',
        viewport: this.options.viewport,
      });

      this.context.on('close', () => {
        this.context = null;
        this.page = null;
      });

      // Use existing page or create a new one
      const pages = this.context.pages();
      this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
      this.page.setDefaultTimeout(this.options.timeout);
      this.page.on('close', () => {
        this.page = null;
      });
    } catch (error) {
      await this.close();
      throw new Error(
        `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if the user is logged into DeepSeek by inspecting the current page.
   * Navigates to chat.deepseek.com if not already there, then checks for
   * the chat input element (textarea/contenteditable).
   * @returns true if logged in with a visible chat composer, false otherwise
   */
  async isLoggedIn(): Promise<boolean> {
    const page = this.getPage();
    if (!page) return false;

    const url = page.url();

    // If on login page, not logged in
    if (url.includes('/sign_in') || url.includes('/login')) {
      return false;
    }

    // If not on chat.deepseek.com at all, not logged in
    if (!url.startsWith('https://chat.deepseek.com/')) {
      return false;
    }

    // Check for chat input presence (textarea, contenteditable, or textbox role)
    try {
      const hasComposer = await page.$(
        'textarea, div[contenteditable="true"], [role="textbox"]'
      );
      return hasComposer !== null;
    } catch {
      return false;
    }
  }

  /**
   * Close the browser and cleanup all resources.
   * Safe to call multiple times. Context data is persisted to userDataDir on close.
   */
  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
    } catch (error) {
      console.error('Error closing page:', error);
    }

    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
    } catch (error) {
      console.error('Error closing context:', error);
    }

    this.page = null;
    this.context = null;
  }

  /**
   * Get the current page
   * @returns Page instance or null if not initialized
   */
  getPage(): Page | null {
    return this.page && !this.page.isClosed() ? this.page : null;
  }

  /**
   * Get the current browser context
   * @returns BrowserContext instance or null if not initialized
   */
  getContext(): BrowserContext | null {
    return this.context;
  }

  /**
   * Check if the browser is initialized and running
   * @returns true if context and page are available
   */
  isInitialized(): boolean {
    return Boolean(this.context && this.page && !this.page.isClosed());
  }

  /**
   * Ensure the browser is initialized. Initializes if needed.
   */
  async ensureReady(): Promise<void> {
    if (!this.isInitialized()) {
      await this.initialize();
    }
  }

  /**
   * Get the configured options (copy)
   */
  getOptions() {
    return { ...this.options };
  }
}
