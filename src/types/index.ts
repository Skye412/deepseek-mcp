/**
 * Type Definitions for DeepSeek MCP
 *
 * Contains TypeScript interfaces for MCP tool parameters,
 * browser automation options, and response types.
 */

// ============================================================================
// DeepSeek Chat Modes
// ============================================================================

/**
 * DeepSeek chat modes with different capabilities:
 * - quick: Default mode with Smart Search + File Upload + DeepThink
 * - expert: Reasoning-focused mode with DeepThink (no search/upload)
 * - vision: Image analysis mode with DeepThink + File Upload
 */
export type DeepSeekMode = 'quick' | 'expert' | 'vision';

// ============================================================================
// Browser Automation Options
// ============================================================================

/**
 * Options passed to the browser-level sendPrompt function.
 * Controls which DeepSeek features are active during a chat interaction.
 */
export interface ChatOptions {
  /** Chat mode (default: 'quick') */
  mode?: DeepSeekMode;
  /** Enable DeepThink reasoning mode (default: false) */
  deepthink?: boolean;
  /** Enable Smart Search /联网搜索, quick mode only (default: false) */
  smartSearch?: boolean;
}

// ============================================================================
// MCP Tool Parameter Types
// ============================================================================

/**
 * Parameters for the Chat tool.
 * General-purpose chat with full mode and feature control.
 */
export interface ChatParams {
  /** The user prompt or message to send to DeepSeek */
  prompt: string;
  /** Chat mode: quick (default), expert, or vision */
  mode?: DeepSeekMode;
  /** Enable DeepThink reasoning mode */
  deepthink?: boolean;
  /** Enable Smart Search (联网搜索), quick mode only */
  smartSearch?: boolean;
}

/**
 * Parameters for the Code Review tool.
 * Sends code to DeepSeek for analysis and improvement suggestions.
 */
export interface CodeReviewParams {
  /** The source code to review */
  code: string;
  /** Programming language of the code (e.g., 'typescript', 'python') */
  language?: string;
  /** Enable DeepThink for more thorough analysis */
  deepthink?: boolean;
}

/**
 * Parameters for the Evaluate Idea tool.
 * Evaluates a technical idea or research proposal.
 */
export interface EvaluateIdeaParams {
  /** The idea or proposal to evaluate */
  idea: string;
  /** Additional background context or constraints */
  context?: string;
  /** Enable DeepThink for deeper evaluation */
  deepthink?: boolean;
}

/**
 * Parameters for the Explain tool.
 * Provides explanations at a specified difficulty level.
 */
export interface ExplainParams {
  /** The text, concept, or code to explain */
  text: string;
  /** Difficulty level for the explanation (default: intermediate) */
  level?: 'beginner' | 'intermediate' | 'expert';
  /** Enable DeepThink for more detailed explanations */
  deepthink?: boolean;
}

/**
 * Parameters for the Summarize tool.
 * Summarizes text with optional length constraint.
 */
export interface SummarizeParams {
  /** The text to summarize */
  text: string;
  /** Maximum number of characters for the summary */
  max_length?: number;
  /** Enable DeepThink for better summarization */
  deepthink?: boolean;
}

/**
 * Parameters for the Debug tool.
 * Analyzes error messages and suggests fixes.
 */
export interface DebugParams {
  /** The error message or exception text */
  error: string;
  /** The source code where the error occurred */
  code?: string;
  /** Additional context such as stack trace or logs */
  context?: string;
  /** Enable DeepThink for deeper analysis */
  deepthink?: boolean;
}

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
