#!/usr/bin/env node
/**
 * DeepSeek MCP Server
 *
 * A Model Context Protocol server providing DeepSeek AI tools for chat,
 * code review, idea evaluation, explanation, summarization, and debugging.
 * Uses Playwright for browser automation and CredentialManager for secure
 * credential storage with AES-256-GCM encryption.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { BrowserManager } from './browser-manager.js';
import { CredentialManager } from './credential-manager.js';
import { deepseekChat } from './tools/chat.js';
import { deepseekCodeReview } from './tools/code-review.js';
import { deepseekEvaluateIdea } from './tools/evaluate-idea.js';
import { deepseekExplain } from './tools/explain.js';
import { deepseekSummarize } from './tools/summarize.js';
import { deepseekDebug } from './tools/debug.js';

import type {
  ChatParams,
  CodeReviewParams,
  EvaluateIdeaParams,
  ExplainParams,
  SummarizeParams,
  DebugParams,
} from './types/index.js';

// ── Singletons ──────────────────────────────────────────────────────────────

const credentialManager = new CredentialManager();
const browserManager = new BrowserManager({ headless: true });

/**
 * Navigate to DeepSeek chat and log in using stored credentials.
 * Skipped if the browser reports that the user is already logged in.
 */
async function autoLogin(): Promise<void> {
  const masterPassword = process.env.DEEPSEEK_MASTER_PASSWORD;
  if (!masterPassword) {
    console.warn(
      'DEEPSEEK_MASTER_PASSWORD not set — skipping automatic login. ' +
      'Tools that require authentication will fail until you log in manually.'
    );
    return;
  }

  if (browserManager.isLoggedIn()) {
    return;
  }

  if (!credentialManager.hasCredentials()) {
    console.warn(
      'No stored credentials found. Run saveCredentials first ' +
      'or set DEEPSEEK_MASTER_PASSWORD only after credentials have been saved.'
    );
    return;
  }

  const page = browserManager.getPage();
  if (!page) {
    throw new Error('Browser page not available for login');
  }

  const { email, password } = await credentialManager.getCredentials(masterPassword);

  // Navigate to DeepSeek login page
  await page.goto('https://chat.deepseek.com/sign_in', { waitUntil: 'networkidle' });

  // Fill email
  const emailSelector = 'input[type="email"], input[name="email"], #email';
  await page.waitForSelector(emailSelector, { timeout: 10000 });
  await page.fill(emailSelector, email);

  // Fill password
  const passwordSelector = 'input[type="password"], input[name="password"], #password';
  await page.waitForSelector(passwordSelector, { timeout: 5000 });
  await page.fill(passwordSelector, password);

  // Submit login form
  const submitSelector = 'button[type="submit"], button:has-text("Log in"), button:has-text("登录")';
  const submitButton = await page.$(submitSelector);
  if (submitButton) {
    await submitButton.click();
  } else {
    await page.keyboard.press('Enter');
  }

  // Wait for navigation / chat page to load
  await page.waitForURL('**/chat**', { timeout: 30000 });
  browserManager.setLoggedIn(true);
  console.error('Automatic login successful');
}

// ── MCP Server ──────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'deepseek-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ── DeepSeek AI Tools ──────────────────────────────────────────────
      {
        name: 'deepseek_chat',
        description:
          'Send a prompt to DeepSeek and return the AI response. ' +
          'General-purpose chat for questions, writing, translation, and more.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            prompt: {
              type: 'string',
              description: 'The prompt or message to send to DeepSeek',
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
      