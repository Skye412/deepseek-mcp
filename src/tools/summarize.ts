/**
 * Summarize Tool
 *
 * Summarizes text using DeepSeek.
 * Formats a summarization prompt and extracts the response.
 */

import { BrowserManager } from '../browser-manager';
import { SummarizeParams } from '../types';

/**
 * Send text to DeepSeek for summarization and return the response.
 *
 * @param browserManager - BrowserManager instance with initialized browser
 * @param params - Summarize parameters containing text and optional max_length
 * @returns DeepSeek summary response
 */
export async function deepseekSummarize(
  browserManager: BrowserManager,
  params: SummarizeParams
): Promise<string> {
  const page = browserManager.getPage();
  if (!page) {
    throw new Error('Browser not initialized. Call browserManager.initialize() first.');
  }

  // Format the prompt for summarization
  let prompt = `请总结以下文本的要点：\n\n${params.text}`;

  if (params.max_length) {
    prompt += `\n\n请将总结控制在${params.max_length}个字符以内。`;
  }

  // Wait for the chat input area to be ready
  const inputSelector = 'textarea, div[contenteditable="true"], input[type="text"]';
  await page.waitForSelector(inputSelector, { timeout: 10000 });

  // Type the prompt into the input field
  const input = await page.$(inputSelector);
  if (!input) {
    throw new Error('Could not find chat input element on the page.');
  }

  await input.click();
  await input.fill(prompt);

  // Submit the prompt
  const sendButtonSelector = 'button[aria-label*="send"], button[type="submit"], button:has(svg)';
  const sendButton = await page.$(sendButtonSelector);

  if (sendButton) {
    await sendButton.click();
  } else {
    await page.keyboard.press('Enter');
  }

  // Wait for the response to appear
  await page.waitForTimeout(2000);

  // Wait for the response to finish generating
  let attempts = 0;
  const maxAttempts = 60;
  while (attempts < maxAttempts) {
    const isGenerating = await page.$('button[aria-label*="stop"], .generating, .loading');
    if (!isGenerating) {
      break;
    }
    await page.waitForTimeout(1000);
    attempts++;
  }

  // Extract the response text
  const responseSelector = '.message-assistant, .assistant-message, [data-role="assistant"], .chat-message:last-child';
  const responseElements = await page.$$(responseSelector);

  if (responseElements.length === 0) {
    throw new Error('No response received from DeepSeek.');
  }

  const lastResponse = responseElements[responseElements.length - 1];
  const responseText = await lastResponse.textContent();

  if (!responseText || responseText.trim().length === 0) {
    throw new Error('Empty response received from DeepSeek.');
  }

  return responseText.trim();
}
