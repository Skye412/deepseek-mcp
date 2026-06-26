/**
 * Explain Tool
 *
 * Provides an explanation of given text or concepts using DeepSeek.
 * Formats an explanation prompt with the appropriate difficulty level.
 */

import { BrowserManager } from '../browser-manager';
import { ExplainParams } from '../types';

/**
 * Send text to DeepSeek for explanation and return the response.
 *
 * @param browserManager - BrowserManager instance with initialized browser
 * @param params - Explain parameters containing text and optional level
 * @returns DeepSeek explanation response
 */
export async function deepseekExplain(
  browserManager: BrowserManager,
  params: ExplainParams
): Promise<string> {
  const page = browserManager.getPage();
  if (!page) {
    throw new Error('Browser not initialized. Call browserManager.initialize() first.');
  }

  // Map level to Chinese description for the prompt
  const levelMap: Record<string, string> = {
    beginner: '初级',
    intermediate: '中级',
    expert: '专家',
  };

  const level = params.level || 'intermediate';
  const levelDescription = levelMap[level] || level;

  // Format the prompt for explanation
  const prompt = `请用${levelDescription}级别解释以下内容：\n\n${params.text}`;

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
