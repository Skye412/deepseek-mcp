/**
 * Summarize Tool
 *
 * Summarizes text using DeepSeek.
 * Supports DeepThink for better summarization.
 */

import { BrowserManager } from '../browser-manager';
import { sendDeepSeekPrompt } from './deepseek-client';
import type { SummarizeParams } from '../types';

/**
 * Send text to DeepSeek for summarization and return the response.
 *
 * @param browserManager - BrowserManager instance with initialized browser
 * @param params - Summarize parameters containing text, optional max_length, and deepthink
 * @returns DeepSeek summary response
 */
export async function deepseekSummarize(
  browserManager: BrowserManager,
  params: SummarizeParams
): Promise<string> {
  let prompt = `请总结以下文本的要点：\n\n${params.text}`;

  if (params.max_length) {
    prompt += `\n\n请将总结控制在${params.max_length}个字符以内。`;
  }

  return sendDeepSeekPrompt(browserManager, prompt, {
    deepthink: params.deepthink,
  });
}
