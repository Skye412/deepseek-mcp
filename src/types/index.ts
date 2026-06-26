/**
 * Type Definitions for DeepSeek MCP
 *
 * Contains all TypeScript interfaces for credentials, configuration,
 * and MCP tool parameters used throughout the project.
 */

// ============================================================================
// Credential Types
// ============================================================================

/**
 * Raw DeepSeek credentials provided by the user
 */
export interface DeepSeekCredentials {
  /** DeepSeek account email address */
  email: string;
  /** DeepSeek account password */
  password: string;
}

/**
 * Encrypted DeepSeek credentials stored on disk
 */
export interface EncryptedCredentials {
  /** Encrypted email address (hex-encoded) */
  email: string;
  /** Encrypted password (hex-encoded) */
  password: string;
  /** Initialization vector used for encryption (hex-encoded) */
  iv: string;
  /** Salt used for key derivation (hex-encoded) */
  salt: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * DeepSeek server configuration
 */
export interface DeepSeekConfig {
  /** DeepSeek credentials */
  credentials: DeepSeekCredentials;

  /** Browser settings for Playwright */
  browser: {
    /** Whether to run browser in headless mode */
    headless: boolean;
    /** Browser timeout in milliseconds */
    timeout: number;
    /** Viewport width in pixels */
    viewportWidth: number;
    /** Viewport height in pixels */
    viewportHeight: number;
  };

  /** Logging configuration */
  logging: {
    /** Log level: 'debug', 'info', 'warn', 'error' */
    level: 'debug' | 'info' | 'warn' | 'error';
    /** Whether to log to file */
    fileEnabled: boolean;
    /** Path to log file (if file logging enabled) */
    filePath: string;
  };
}

// ============================================================================
// MCP Tool Parameter Types
// ============================================================================

/**
 * Parameters for the Chat tool
 * Sends a prompt to DeepSeek and returns the response
 */
export interface ChatParams {
  /** The user prompt or message to send to DeepSeek */
  prompt: string;
}

/**
 * Parameters for the Code Review tool
 * Sends code to DeepSeek for review and analysis
 */
export interface CodeReviewParams {
  /** The source code to review */
  code: string;
  /** Programming language of the code (optional, e.g., 'typescript', 'python') */
  language?: string;
}

/**
 * Parameters for the Evaluate Idea tool
 * Evaluates a technical idea or proposal using DeepSeek
 */
export interface EvaluateIdeaParams {
  /** The idea or proposal to evaluate */
  idea: string;
  /** Additional context or constraints for evaluation (optional) */
  context?: string;
}

/**
 * Parameters for the Explain tool
 * Provides an explanation of given text or concepts
 */
export interface ExplainParams {
  /** The text or concept to explain */
  text: string;
  /** Explanation level: 'beginner', 'intermediate', 'expert' (optional) */
  level?: 'beginner' | 'intermediate' | 'expert';
}

/**
 * Parameters for the Summarize tool
 * Summarizes text using DeepSeek
 */
export interface SummarizeParams {
  /** The text to summarize */
  text: string;
  /** Maximum length of summary in characters (optional) */
  max_length?: number;
}

/**
 * Parameters for the Debug tool
 * Helps debug an error or issue using DeepSeek
 */
export interface DebugParams {
  /** The error message or exception text */
  error: string;
  /** The code where the error occurred (optional) */
  code?: string;
  /** Additional context about the error, such as stack trace or logs (optional) */
  context?: string;
}

// ============================================================================
// Browser Tool Parameter Types
// ============================================================================

/**
 * Parameters for Navigate tool
 */
export interface NavigateParams {
  /** URL to navigate to */
  url: string;
}

/**
 * Parameters for Click tool
 */
export interface ClickParams {
  /** CSS selector for the element to click */
  selector: string;
}

/**
 * Parameters for GetContent tool
 * No parameters required (empty object)
 */
export interface GetContentParams {}

/**
 * Parameters for Screenshot tool
 * No parameters required (empty object)
 */
export interface ScreenshotParams {}

/**
 * Parameters for StartBrowser tool
 * No parameters required (empty object)
 */
export interface StartBrowserParams {}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Standard MCP tool response content
 */
export interface ToolResponseContent {
  /** Response type (always 'text') */
  type: 'text';
  /** Response text content */
  text: string;
}

/**
 * Standard MCP tool response
 */
export interface ToolResponse {
  /** Array of response content items */
  content: ToolResponseContent[];
  /** Whether the response indicates an error */
  isError?: boolean;
}
