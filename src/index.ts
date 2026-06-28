#!/usr/bin/env node
/**
 * DeepSeek MCP Server
 *
 * A Model Context Protocol server providing DeepSeek AI tools for chat,
 * code review, idea evaluation, explanation, summarization, and debugging.
 *
 * Uses Playwright for browser automation with persistent session storage.
 * First run requires manual login (phone + verification code).
 * Subsequent runs restore the session automatically from saved browser data.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { BrowserManager } from './browser-manager';
import { deepseekChat } from './tools/chat';
import { deepseekCodeReview } from './tools/code-review';
import { deepseekEvaluateIdea } from './tools/evaluate-idea';
import { deepseekExplain } from './tools/explain';
import { deepseekSummarize } from './tools/summarize';
import { deepseekDebug } from './tools/debug';

import type {
  ChatParams,
  CodeReviewParams,
  EvaluateIdeaParams,
  ExplainParams,
  SummarizeParams,
  DebugParams,
} from './types';

// ── Singletons ──────────────────────────────────────────────────────────────

const browserManager = new BrowserManager({ headless: true });

/**
 * Ensure the user is logged into DeepSeek.
 * 1. Check if persistent session is still valid (headless)
 * 2. If yes, use it (no login needed)
 * 3. If no, relaunch browser with visible window for manual login,
 *    then switch back to headless mode. Session persists via user-data-dir.
 */
async function ensureLoggedIn(): Promise<void> {
  const page = browserManager.getPage();
  if (!page) {
    throw new Error('Browser page not available for login');
  }

  // Check if already logged in (persistent session)
  if (await browserManager.isLoggedIn()) {
    return;
  }

  // Navigate to DeepSeek
  if (!page.url().startsWith('https://chat.deepseek.com/')) {
    await page.goto('https://chat.deepseek.com/', { waitUntil: 'domcontentloaded' });
  }

  // Check again after navigation (session might be restored from cookies)
  if (await browserManager.isLoggedIn()) {
    console.error('[deepseek] Session restored from saved browser data');
    return;
  }

  // Need manual login - switch to visible browser so user can interact
  console.error('[deepseek] No saved session found, opening browser for manual login...');
  await browserManager.close();

  // Relaunch with visible window
  const opts = browserManager.getOptions();
  const headedManager = new BrowserManager({ ...opts, headless: false });
  await headedManager.initialize();
  const headedPage = headedManager.getPage();
  if (!headedPage) {
    throw new Error('Failed to create visible browser page');
  }

  if (!headedPage.url().startsWith('https://chat.deepseek.com/')) {
    await headedPage.goto('https://chat.deepseek.com/', { waitUntil: 'domcontentloaded' });
  }

  console.error('');
  console.error('=========================================');
  console.error('  Please login manually in the browser');
  console.error('  (Phone number + verification code)');
  console.error('  Waiting up to 5 minutes...');
  console.error('  Session will be saved automatically');
  console.error('=========================================');
  console.error('');

  try {
    await headedPage.waitForFunction(
      `(() => {
        const url = window.location.href;
        const onLoginPage = url.includes('/sign_in') || url.includes('/login');
        const hasComposer = Boolean(
          document.querySelector('textarea, div[contenteditable="true"], [role="textbox"]')
        );
        return url.startsWith('https://chat.deepseek.com/') && !onLoginPage && hasComposer;
      })()`,
      undefined,
      { timeout: 300000 }
    );

    console.error('[deepseek] Login successful! Session saved for future use.');
  } catch {
    await headedManager.close();
    throw new Error('Login timeout (5 minutes). Please restart and try again.');
  }

  // Close headed browser, relaunch headless (session is persisted in user-data-dir)
  await headedManager.close();
  await browserManager.initialize();
  console.error('[deepseek] Switched back to headless mode');
}

// ── MCP Server ──────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'deepseek-mcp',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools with their schemas.
 * All tools now support the deepthink parameter.
 * The chat tool additionally supports mode and smartSearch.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'deepseek_chat',
        description:
          'Send a prompt to DeepSeek and return the AI response. ' +
          'Supports three modes: quick (default, with search+upload), ' +
          'expert (reasoning-focused), vision (image analysis). ' +
          'All modes support DeepThink reasoning.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            prompt: {
              type: 'string',
              description: 'The prompt or message to send to DeepSeek',
            },
            mode: {
              type: 'string',
              enum: ['quick', 'expert', 'vision'],
              description:
                'Chat mode: quick (default, with search+upload), ' +
                'expert (reasoning-focused), vision (image analysis)',
            },
            deepthink: {
              type: 'boolean',
              description: 'Enable DeepThink reasoning mode (default: false)',
            },
            smartSearch: {
              type: 'boolean',
              description:
                'Enable Smart Search /联网搜索 for web results (quick mode only, default: false)',
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'deepseek_code_review',
        description:
          'Send code to DeepSeek for review and receive analysis of ' +
          'potential bugs, performance issues, and improvement suggestions.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            code: {
              type: 'string',
              description: 'The source code to review',
            },
            language: {
              type: 'string',
              description: 'Programming language of the code (e.g., "typescript", "python")',
            },
            deepthink: {
              type: 'boolean',
              description: 'Enable DeepThink for more thorough analysis (default: false)',
            },
          },
          required: ['code'],
        },
      },
      {
        name: 'deepseek_evaluate_idea',
        description:
          'Evaluate a technical idea or research proposal for innovation, ' +
          'feasibility, and potential impact.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            idea: {
              type: 'string',
              description: 'The idea or proposal to evaluate',
            },
            context: {
              type: 'string',
              description: 'Additional background context or constraints for the evaluation',
            },
            deepthink: {
              type: 'boolean',
              description: 'Enable DeepThink for deeper evaluation (default: false)',
            },
          },
          required: ['idea'],
        },
      },
      {
        name: 'deepseek_explain',
        description:
          'Get a clear explanation of a concept, code snippet, or text ' +
          'at a specified difficulty level.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            text: {
              type: 'string',
              description: 'The text, concept, or code to explain',
            },
            level: {
              type: 'string',
              enum: ['beginner', 'intermediate', 'expert'],
              description: 'Difficulty level for the explanation (default: intermediate)',
            },
            deepthink: {
              type: 'boolean',
              description: 'Enable DeepThink for more detailed explanations (default: false)',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'deepseek_summarize',
        description: 'Summarize long text into key points, with an optional maximum length constraint.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            text: {
              type: 'string',
              description: 'The text to summarize',
            },
            max_length: {
              type: 'number',
              description: 'Maximum number of characters for the summary (optional)',
            },
            deepthink: {
              type: 'boolean',
              description: 'Enable DeepThink for better summarization (default: false)',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'deepseek_debug',
        description: 'Analyse an error message and related code to suggest likely causes and fixes.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            error: {
              type: 'string',
              description: 'The error message or exception text',
            },
            code: {
              type: 'string',
              description: 'The source code where the error occurred (optional)',
            },
            context: {
              type: 'string',
              description: 'Additional context such as stack trace or logs (optional)',
            },
            deepthink: {
              type: 'boolean',
              description: 'Enable DeepThink for deeper analysis (default: false)',
            },
          },
          required: ['error'],
        },
      },
    ],
  };
});

/**
 * Handle tool calls and dispatch to the appropriate handler.
 * Ensures browser is initialized and user is logged in before each call.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Ensure browser is initialized
  if (!browserManager.isInitialized()) {
    await browserManager.initialize();
  }

  // Ensure user is logged in (uses persistent session if available)
  try {
    await ensureLoggedIn();
  } catch (loginError) {
    console.error(
      'Login failed:',
      loginError instanceof Error ? loginError.message : String(loginError)
    );
    // Continue — the tool call itself will report the auth error
  }

  try {
    switch (name) {
      case 'deepseek_chat': {
        const params = args as unknown as ChatParams;
        const result = await deepseekChat(browserManager, params);
        return { content: [{ type: 'text' as const, text: result }] };
      }

      case 'deepseek_code_review': {
        const params = args as unknown as CodeReviewParams;
        const result = await deepseekCodeReview(browserManager, params);
        return { content: [{ type: 'text' as const, text: result }] };
      }

      case 'deepseek_evaluate_idea': {
        const params = args as unknown as EvaluateIdeaParams;
        const result = await deepseekEvaluateIdea(browserManager, params);
        return { content: [{ type: 'text' as const, text: result }] };
      }

      case 'deepseek_explain': {
        const params = args as unknown as ExplainParams;
        const result = await deepseekExplain(browserManager, params);
        return { content: [{ type: 'text' as const, text: result }] };
      }

      case 'deepseek_summarize': {
        const params = args as unknown as SummarizeParams;
        const result = await deepseekSummarize(browserManager, params);
        return { content: [{ type: 'text' as const, text: result }] };
      }

      case 'deepseek_debug': {
        const params = args as unknown as DebugParams;
        const result = await deepseekDebug(browserManager, params);
        return { content: [{ type: 'text' as const, text: result }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// ── Lifecycle ───────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('DeepSeek MCP Server v2.0.0 running on stdio');
}

async function cleanup() {
  if (browserManager.isInitialized()) {
    await browserManager.close();
  }
}

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
