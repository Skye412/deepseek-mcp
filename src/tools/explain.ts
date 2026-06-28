/**
 * Explain Tool
 *
 * Provides an explanation of given text or concepts using DeepSeek.
 * Supports DeepThink for more detailed explanations.
 */

import { BrowserManager } from '../browser-manager';
import { sendDeepSeekPrompt } from './deepseek-client';
import type { ExplainParams } from '../types';

/**
 * Send text to DeepSeek for explanation and return the response.
 *
 * @param browserManager - BrowserManager instance with initialized browser
 * @param params - Explain parameters containing text, optional level, and deepthink
 * @returns DeepSeek explanation response
 */
export async function deepseekExplain(
  browserManager: BrowserManager,
  params: ExplainParams
): Promise<string> {
  const levelMap: Record<string, string> = {
    beginner: '初级',
    intermediate: '中级',
    expert: '专家',
  };

  const level = params.level || 'intermediate';
  const levelDescription = levelMap[level] || level;

  const prompt = `请用${levelDescription}级别解释以下内容：\n\n${params.text}`;

  return sendDeepSeekPrompt(browserManager, prompt, {
    deepthink: params.deepthink,
  });
}
