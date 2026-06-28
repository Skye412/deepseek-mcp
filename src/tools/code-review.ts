/**
 * Code Review Tool
 *
 * Sends code to DeepSeek for review and analysis.
 * Supports DeepThink for more thorough analysis.
 */

import { BrowserManager } from '../browser-manager';
import { sendDeepSeekPrompt } from './deepseek-client';
import type { CodeReviewParams } from '../types';

/**
 * Send code to DeepSeek for review and return the analysis.
 *
 * @param browserManager - BrowserManager instance with initialized browser
 * @param params - Code review parameters containing code, optional language, and deepthink
 * @returns DeepSeek code review response
 */
export async function deepseekCodeReview(
  browserManager: BrowserManager,
  params: CodeReviewParams
): Promise<string> {
  const languageHint = params.language ? `（${params.language}语言）` : '';
  const prompt = `请对以下代码进行审查，提供问题分析和改进建议${languageHint}：\n\n${params.code}`;

  return sendDeepSeekPrompt(browserManager, prompt, {
    deepthink: params.deepthink,
  });
}
