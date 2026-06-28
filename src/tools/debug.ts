/**
 * Debug Tool
 *
 * Helps debug an error or issue using DeepSeek.
 * Supports DeepThink for deeper analysis.
 */

import { BrowserManager } from '../browser-manager';
import { sendDeepSeekPrompt } from './deepseek-client';
import type { DebugParams } from '../types';

/**
 * Send error details to DeepSeek for debugging help and return the response.
 *
 * @param browserManager - BrowserManager instance with initialized browser
 * @param params - Debug parameters containing error, optional code/context, and deepthink
 * @returns DeepSeek debugging response
 */
export async function deepseekDebug(
  browserManager: BrowserManager,
  params: DebugParams
): Promise<string> {
  let prompt = `请帮我分析以下错误的可能原因和解决方案：\n\n错误信息：${params.error}`;

  if (params.code) {
    prompt += `\n\n相关代码：\n${params.code}`;
  }

  if (params.context) {
    prompt += `\n\n其他上下文信息：\n${params.context}`;
  }

  return sendDeepSeekPrompt(browserManager, prompt, {
    deepthink: params.deepthink,
  });
}
