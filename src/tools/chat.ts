/**
 * Chat Tool
 *
 * Sends a prompt to DeepSeek and returns the response.
 * Uses BrowserManager to interact with the DeepSeek chat interface.
 */

import { BrowserManager } from '../browser-manager';
import { ChatParams } from '../types';

/**
 * Send a chat prompt to DeepSeek and return the response.
 *
 * @param browserManager - BrowserManager instance with initialized browser
 * @param params - Chat parameters containing the prompt
 * @returns DeepSeek response text
 */
export async function deepseekChat(
  browserManager: BrowserManager,
  params: ChatParams
): Promise<string> {
  const page = browserManager.getPage();
  if (!page) {
    throw new Error('Browser not initialized. Call browserManager.initialize() first.');
  }

  // Format the prompt
  const prompt = params.prompt;

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

  // Submit the prompt (press Enter or click send button)
  const sendButtonSelector = 'button[aria-label*="send"], button[type="submit"], button:has(svg)';
  const sendButton = await page.$(sendButtonSelector);

  if (sendButton) {
    await sendButton.click();
  } else {
    await page.keyboard.press('Enter');
  }

  // Wait for the response to appear
  // DeepSeek typically renders responses in a specific container
  await page.waitForTimeout(2000);

  // Wait for the response to finish generating (check for stop/loading indicators)
  let attempts = 0;
  const maxAttempts = 60; // Max 60 seconds wait
  while (attempts < maxAttempts) {
    const isGenerating = await page.$('button[aria-label*="stop"], .generating, .loading');
    if (!isGenerating) {
      break;
    }
    await page.waitForTimeout(1000);
    attempts++;
  }

  // Extract the response text from the last assistant message
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
