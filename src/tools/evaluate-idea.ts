/**
 * Evaluate Idea Tool
 *
 * Evaluates a technical idea or proposal using DeepSeek.
 * Supports DeepThink for deeper evaluation.
 */

import { BrowserManager } from '../browser-manager';
import { sendDeepSeekPrompt } from './deepseek-client';
import type { EvaluateIdeaParams } from '../types';

/**
 * Send an idea to DeepSeek for evaluation and return the assessment.
 *
 * @param browserManager - BrowserManager instance with initialized browser
 * @param params - Evaluation parameters containing idea, optional context, and deepthink
 * @returns DeepSeek evaluation response
 */
export async function deepseekEvaluateIdea(
  browserManager: BrowserManager,
  params: EvaluateIdeaParams
): Promise<string> {
  let prompt = `请评价以下科研idea的创新性、可行性和研究价值：\n\n${params.idea}`;

  if (params.context) {
    prompt += `\n\n背景和约束条件：\n${params.context}`;
  }

  return sendDeepSeekPrompt(browserManager, prompt, {
    deepthink: params.deepthink,
  });
}
