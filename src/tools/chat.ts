/**
 * Chat Tool
 *
 * Sends a prompt to DeepSeek and returns the response.
 * Supports all chat modes (quick/expert/vision), DeepThink, and Smart Search.
 */

import { BrowserManager } from '../browser-manager';
import { sendDeepSeekPrompt } from './deepseek-client';
import type { ChatParams } from '../types';

/**
 * Send a chat prompt to DeepSeek and return the response.
 *
 * @param browserManager - BrowserManager instance with initialized browser
 * @param params - Chat parameters with prompt, mode, deepthink, and smartSearch options
 * @returns DeepSeek response text
 */
export async function deepseekChat(
  browserManager: BrowserManager,
  params: ChatParams
): Promise<string> {
  return sendDeepSeekPrompt(browserManager, params.prompt, {
    mode: params.mode,
    deepthink: params.deepthink,
    smartSearch: params.smartSearch,
    conversation: params.conversation,
  });
}
