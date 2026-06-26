/**
 * Browser Manager
 * 
 * Manages Playwright browser instances for the DeepSeek MCP server.
 * Supports headless/headed mode, timeout configuration, and viewport settings.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';

/**
 * Configuration options for BrowserManager
 */
export interface BrowserOptions {
  /** Run browser in headless mode (default: true) */
  headless?: boolean;
  /** Default timeout for operations in milliseconds (default: 30000) */
  timeout?: number;
  /** Browser viewport size */
  viewport?: {
    width: number;
    height: number;
  };
}

/**
 * BrowserManager - Manages Playwright browser lifecycle
 * 
 * Provides methods to initialize, control, and shutdown a Chromium browser.
 * Implements basic login state tracking and proper resource cleanup.
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private options: Required<BrowserOptions>;
  private loggedIn: boolean = false;

  /**
   * Create a new BrowserManager instance
   * @param options - Configuration options
   */
  constructor(options?: BrowserOptions) {
    this.options = {
      headless: options?.headless ?? true,
      timeout: options?.timeout ?? 30000,
      viewport: options?.viewport ?? { width: 1280, height: 720 },
    };
  }

  /**
   * Initialize the browser instance
   * Creates a Chromium browser, context, and initial page
   * @throws Error if browser initialization fails
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      console.warn('Browser already initialized');
      return;
    }

    try {
      // Launch Chromium with configured options
      this.browser = await chromium.launch({
        headless: this.options.headless,
      });

      // Create a new browser context with viewport
      this.context = await this.browser.newContext({
        viewport: this.options.viewport,
        timeout: this.options.timeout,
      });

      // Create initial page
      this.page = await this.context.newPage();

      console.log('Browser initialized successfully');
    } catch (error) {
      await this.close();
      throw new Error(`Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if the user is logged in
   * @returns true if logged in, false otherwise
   */
  isLoggedIn(): boolean {
    return this.loggedIn;
  }

  /**
   * Set login state
   * @param state - Whether user is logged in
   */
  setLoggedIn(state: boolean): void {
    this.loggedIn = state;
  }

  /**
   * Close the browser and cleanup all resources
   * Safe to call multiple times
   */
  async close(): Promise<void> {
    // Close in reverse order of creation
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

    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }

    this.loggedIn = false;
  }

  /**
   * Get the current browser instance
   * @returns Browser instance or null if not initialized
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * Get the current browser context
   * @returns BrowserContext instance or null if not initialized
   */
  getContext(): BrowserContext | null {
    return this.context;
  }

  /**
   * Get the current page
   * @returns Page instance or null if not initialized
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Check if the browser is initialized and running
   * @returns true if browser is initialized, false otherwise
   */
  isInitialized(): boolean {
    return this.browser !== null;
  }

  /**
   * Get the configured options
   * @returns Browser configuration options
   */
  getOptions(): Required<BrowserOptions> {
    return { ...this.options };
  }
}
