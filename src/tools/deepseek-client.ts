/**
 * Shared DeepSeek web client helpers.
 *
 * MCP tools call this module to send prompts through the active Playwright page
 * and extract the latest assistant response from chat.deepseek.com.
 *
 * Supports:
 * - Three chat modes: quick (快速), expert (专家), vision (识图)
 * - DeepThink (深度思考) reasoning mode
 * - Smart Search (联网搜索) in quick mode
 * - Thinking/answer separation for DeepThink responses
 *
 * Selectors last validated: 2026-06
 * Uses cascading fallback selectors + text matching for resilience.
 */

import type { ElementHandle, Page } from 'playwright';
import { BrowserManager } from '../browser-manager';
import type { ChatOptions, DeepSeekMode } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────

const CHAT_URL = 'https://chat.deepseek.com/';

// Input selectors - cascading fallback chain
const INPUT_SELECTORS = [
  'textarea[placeholder]',
  'textarea',
  'div[contenteditable="true"]',
  '[role="textbox"]',
];

// Send button selectors
const SEND_BUTTON_SELECTORS = [
  'button[aria-label*="send" i]',
  'button[aria-label*="发送" i]',
  'button[type="submit"]',
];

// Response container selectors - the latest response from DeepSeek
const RESPONSE_SELECTORS = [
  '[data-role="assistant"]',
  '.ds-markdown',
  '.markdown-body',
  '.assistant-message',
];

// Busy/generating indicator selectors
const BUSY_SELECTORS = [
  'button[aria-label*="stop" i]',
  'button[aria-label*="停止" i]',
  '[data-state="generating"]',
  '.generating',
];

// Mode label mappings (English → Chinese UI labels)
const MODE_LABELS: Record<DeepSeekMode, string[]> = {
  quick: ['快速模式', '快速', 'Quick'],
  expert: ['专家模式', '专家', 'Expert'],
  vision: ['识图模式', '识图', 'Vision'],
};

// DeepThink toggle text patterns
const DEEPTHINK_TEXTS = ['深度思考', 'DeepThink', 'deep think'];

// Smart Search toggle text patterns (more specific to avoid false matches)
const SMART_SEARCH_TEXTS = ['联网搜索', '智能搜索'];

type ResponseBaseline = Map<string, number>;

// ── Helper Functions ───────────────────────────────────────────────────────

/**
 * Find the first visible, non-disabled element matching any of the selectors.
 * Polls until timeout if no match is found immediately.
 */
async function firstVisible(
  page: Page,
  selectors: string[],
  timeout = 15000
): Promise<ElementHandle> {
  const started = Date.now();

  while (Date.now() - started < timeout) {
    for (const selector of selectors) {
      const candidates = await page.$$(selector);
      for (const candidate of candidates) {
        const visible = await candidate.isVisible().catch(() => false);
        const disabled = await candidate
          .evaluate((el) => {
            const fc = el as { disabled?: boolean };
            return fc.disabled === true || el.getAttribute('aria-disabled') === 'true';
          })
          .catch(() => false);

        if (visible && !disabled) {
          return candidate;
        }
      }
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Could not find a visible element matching: ${selectors.join(', ')}`);
}

/**
 * Fill an input element with text.
 * Handles both standard form inputs (textarea/input) and contenteditable divs.
 */
async function fillInput(input: ElementHandle, prompt: string): Promise<void> {
  await input.click();
  const tagName = await input.evaluate((el) => el.tagName.toLowerCase());

  if (tagName === 'textarea' || tagName === 'input') {
    await input.fill(prompt);
    return;
  }

  // For contenteditable elements
  await input.evaluate((el, value) => {
    el.textContent = value;
    const event = new Event('input', { bubbles: true });
    el.dispatchEvent(event);
  }, prompt);
}

/**
 * Click the send button or press Enter as fallback.
 */
async function clickSendOrPressEnter(page: Page): Promise<void> {
  for (const selector of SEND_BUTTON_SELECTORS) {
    const buttons = await page.$$(selector);
    for (const button of buttons) {
      const visible = await button.isVisible().catch(() => false);
      const disabled = await button
        .evaluate((el) => {
          const btn = el as { disabled?: boolean };
          return btn.disabled === true || el.getAttribute('aria-disabled') === 'true';
        })
        .catch(() => false);

      if (visible && !disabled) {
        await button.click();
        return;
      }
    }
  }

  // Fallback: press Enter
  await page.keyboard.press('Enter');
}

/**
 * Wait for DeepSeek to finish generating a response.
 * Monitors busy indicators (stop button, loading state).
 */
async function waitForGenerationToFinish(page: Page, timeout = 120000): Promise<void> {
  const started = Date.now();
  // Initial delay to let generation start
  await page.waitForTimeout(800);

  while (Date.now() - started < timeout) {
    let busy = false;
    for (const selector of BUSY_SELECTORS) {
      const element = await page.$(selector);
      if (element && (await element.isVisible().catch(() => false))) {
        busy = true;
        break;
      }
    }

    if (!busy) {
      return;
    }

    await page.waitForTimeout(1000);
  }

  throw new Error('Timed out waiting for DeepSeek response to finish.');
}

/**
 * Capture baseline counts of response elements before sending a prompt.
 * This lets us identify which response elements are new after sending.
 */
async function captureResponseBaseline(page: Page): Promise<ResponseBaseline> {
  const baseline: ResponseBaseline = new Map();
  for (const selector of RESPONSE_SELECTORS) {
    baseline.set(selector, (await page.$$(selector)).length);
  }
  return baseline;
}

/**
 * Get the text content of the latest response element (newer than baseline).
 */
async function latestResponseText(page: Page, baseline: ResponseBaseline): Promise<string> {
  const started = Date.now();

  while (Date.now() - started < 120000) {
    for (const selector of RESPONSE_SELECTORS) {
      const elements = await page.$$(selector);
      const previousCount = baseline.get(selector) ?? 0;

      // Search from the last element backwards for new responses
      for (let i = elements.length - 1; i >= previousCount; i--) {
        const text = await elements[i].textContent();
        const trimmed = text?.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }

    await page.waitForTimeout(1000);
  }

  throw new Error('No response received from DeepSeek.');
}

/**
 * Wait for the response text to stabilize (stop changing).
 * Requires 3 consecutive identical readings with no busy indicators.
 */
async function waitForStableResponse(
  page: Page,
  baseline: ResponseBaseline,
  timeout = 180000
): Promise<string> {
  const started = Date.now();
  let lastText = '';
  let stableSamples = 0;

  while (Date.now() - started < timeout) {
    const currentText = await latestResponseText(page, baseline).catch(() => '');
    const hasBusyIndicator = await isPageBusy(page);

    if (currentText && currentText === lastText && !hasBusyIndicator) {
      stableSamples++;
    } else {
      stableSamples = 0;
      lastText = currentText;
    }

    if (lastText && stableSamples >= 3) {
      return lastText;
    }

    await page.waitForTimeout(1000);
  }

  if (lastText) {
    return lastText;
  }

  throw new Error('Timed out waiting for a complete DeepSeek response.');
}

/**
 * Check if the page is currently generating a response.
 */
async function isPageBusy(page: Page): Promise<boolean> {
  for (const selector of BUSY_SELECTORS) {
    const element = await page.$(selector);
    if (element && (await element.isVisible().catch(() => false))) {
      return true;
    }
  }
  return false;
}

// ── Mode & Toggle Functions ────────────────────────────────────────────────

/**
 * Find a toggle button by text content patterns.
 * Searches buttons AND clickable div/span elements (DeepSeek uses both).
 */
async function findToggleButton(
  page: Page,
  textPatterns: string[]
): Promise<ElementHandle | null> {
  // Search across all potentially interactive elements
  const elements = await page.$$('button, [role="button"], [role="switch"], div[class*="btn"], span[class*="btn"], div[class*="toggle"], a');

  for (const el of elements) {
    const text = await el.textContent().catch(() => '');
    if (!text) continue;

    const lowerText = text.toLowerCase();
    for (const pattern of textPatterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        const visible = await el.isVisible().catch(() => false);
        if (visible) return el;
      }
    }
  }

  // Second pass: try all elements with text matching
  const allEls = await page.$$('div, span');
  for (const el of allEls) {
    // Only check leaf-ish elements (not large containers)
    const childCount = await el.evaluate(e => e.children.length).catch(() => 999);
    if (childCount > 5) continue;

    const text = await el.textContent().catch(() => '');
    if (!text || text.length > 30) continue;

    const trimmed = text.trim();
    for (const pattern of textPatterns) {
      if (trimmed.includes(pattern)) {
        const visible = await el.isVisible().catch(() => false);
        if (visible) return el;
      }
    }
  }

  return null;
}

/**
 * Check if a toggle button is currently in the "active/on" state.
 * DeepSeek uses CSS color changes to indicate toggle state:
 *   - OFF: gray text/background (rgb with low values)
 *   - ON: colored text/background (blue, purple, etc.)
 */
async function isToggleActive(element: ElementHandle): Promise<boolean> {
  return element
    .evaluate((el) => {
      // Check aria attributes first
      if (el.getAttribute('aria-pressed') === 'true') return true;
      if (el.getAttribute('aria-checked') === 'true') return true;
      const state = el.getAttribute('data-state');
      if (state === 'on' || state === 'active' || state === 'checked') return true;

      // Check CSS classes
      const cl = el.classList;
      if (cl.contains('active') || cl.contains('selected') ||
          cl.contains('checked') || cl.contains('toggled')) return true;

      // DeepSeek uses color changes to indicate toggle state.
      // OFF state = gray-ish colors, ON state = blue/purple/green colors.
      const win = el.ownerDocument.defaultView;
      if (!win) return false;
      const style = win.getComputedStyle(el);
      const bg = style.backgroundColor;
      const fg = style.color;

      // Parse "rgb(r, g, b)" or "rgba(r, g, b, a)"
      const parseRgb = (s: string) => {
        const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null;
      };

      // Check background color - a non-gray, non-transparent bg likely means active
      const bgRgb = parseRgb(bg);
      if (bgRgb) {
        const [r, g, b] = bgRgb;
        const isGray = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
        const isTransparent = bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
        if (!isGray && !isTransparent && (r > 30 || g > 30 || b > 30)) {
          return true;
        }
      }

      // Check text color - colored text (blue/purple) likely means active
      const fgRgb = parseRgb(fg);
      if (fgRgb) {
        const [r, g, b] = fgRgb;
        const isGray = Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && Math.abs(r - b) < 30;
        if (!isGray) {
          // Non-gray text color: check if it's notably colorful
          const maxChannel = Math.max(r, g, b);
          const minChannel = Math.min(r, g, b);
          if (maxChannel - minChannel > 40) {
            return true;
          }
        }
      }

      return false;
    })
    .catch(() => false);
}

/**
 * Switch DeepSeek chat mode (quick/expert/vision).
 * If already in the target mode, this is a no-op.
 */
async function switchMode(page: Page, mode: DeepSeekMode): Promise<void> {
  // Default mode is quick - check if we're already in it
  if (mode === 'quick') {
    // Quick mode is the default, try to detect if we need to switch
    // Look for mode indicator showing we're already in quick mode
    const currentMode = await detectCurrentMode(page);
    if (currentMode === 'quick' || currentMode === null) return;
  }

  const targetLabels = MODE_LABELS[mode];

  // First, check if already in the target mode
  const currentMode = await detectCurrentMode(page);
  if (currentMode === mode) return;

  // Find and click the mode selector trigger
  // DeepSeek typically uses a button/dropdown near the top of the chat
  const trigger = await findModeTrigger(page);
  if (!trigger) {
    // If we can't find the mode trigger, the UI might have changed
    // Log but don't throw - the prompt will still work in the current mode
    console.error(`Could not find mode selector to switch to ${mode}`);
    return;
  }

  await trigger.click();
  await page.waitForTimeout(500);

  // Find and click the target mode option
  const targetOption = await findTextButton(page, targetLabels);
  if (targetOption) {
    await targetOption.click();
    await page.waitForTimeout(500);
  } else {
    console.error(`Could not find mode option for: ${targetLabels.join('/')}`);
    // Close the dropdown if open
    await page.keyboard.press('Escape');
  }
}

/**
 * Detect the currently active mode by inspecting the page.
 * Returns null if detection fails.
 */
async function detectCurrentMode(page: Page): Promise<DeepSeekMode | null> {
  // Try to find a mode indicator element
  for (const [mode, labels] of Object.entries(MODE_LABELS) as [DeepSeekMode, string[]][]) {
    for (const label of labels) {
      // Look for elements that display the current mode
      const elements = await page.$$(`text="${label}"`);
      for (const el of elements) {
        // Check if this looks like a mode indicator (not just text content)
        const visible = await el.isVisible().catch(() => false);
        if (visible) {
          const tagName = await el.evaluate((e) => e.tagName.toLowerCase()).catch(() => '');
          // Mode indicators are typically buttons, spans, or divs near the top
          if (['button', 'span', 'div', 'label'].includes(tagName)) {
            return mode;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Find the mode selector trigger element (dropdown/button that opens mode options).
 */
async function findModeTrigger(page: Page): Promise<ElementHandle | null> {
  // Try to find a dropdown or button that shows the current mode
  // Common patterns: a button with the current mode name, or a dropdown trigger

  // Strategy: look for clickable elements near mode-related text
  const selectors = [
    '[data-testid="model-selector"]',
    '[data-testid="mode-selector"]',
    '.mode-selector',
    '.model-selector',
  ];

  for (const selector of selectors) {
    const el = await page.$(selector);
    if (el && (await el.isVisible().catch(() => false))) {
      return el;
    }
  }

  // Fallback: look for buttons/dropdowns with mode-related text
  // The mode trigger is typically the element that shows the current mode name
  const allButtons = await page.$$('button, [role="combobox"], [role="listbox"]');
  for (const button of allButtons) {
    const text = await button.textContent().catch(() => '');
    if (!text) continue;

    const lowerText = text.toLowerCase();
    // Check if button text contains any mode label
    for (const labels of Object.values(MODE_LABELS)) {
      for (const label of labels) {
        if (lowerText.includes(label.toLowerCase())) {
          const visible = await button.isVisible().catch(() => false);
          if (visible) return button;
        }
      }
    }
  }

  return null;
}

/**
 * Find a button by its text content from a list of possible labels.
 */
async function findTextButton(page: Page, labels: string[]): Promise<ElementHandle | null> {
  const elements = await page.$$('button, [role="option"], [role="menuitem"], li, a');

  for (const el of elements) {
    const text = await el.textContent().catch(() => '');
    if (!text) continue;

    const trimmed = text.trim();
    for (const label of labels) {
      if (trimmed === label || trimmed.includes(label)) {
        const visible = await el.isVisible().catch(() => false);
        if (visible) return el;
      }
    }
  }

  return null;
}

/**
 * Toggle DeepThink mode on or off.
 * Works in all three chat modes (quick, expert, vision).
 */
async function toggleDeepThink(page: Page, enabled: boolean): Promise<void> {
  const toggle = await findToggleButton(page, DEEPTHINK_TEXTS);
  if (!toggle) {
    console.error('[deepseek] DeepThink toggle not found on page');
    return;
  }

  const isActive = await isToggleActive(toggle);
  console.error(`[deepseek] DeepThink toggle: active=${isActive}, target=${enabled}`);

  if (isActive !== enabled) {
    await toggle.click();
    await page.waitForTimeout(500);
    // Verify the toggle state after clicking
    const newState = await isToggleActive(toggle).catch(() => 'unknown');
    console.error(`[deepseek] DeepThink toggled: new state=${newState}`);
  } else {
    console.error('[deepthink] DeepThink already in desired state, skipping click');
  }
}

/**
 * Toggle Smart Search (联网搜索) on or off.
 * Only available in quick mode.
 */
async function toggleSmartSearch(page: Page, enabled: boolean): Promise<void> {
  const toggle = await findToggleButton(page, SMART_SEARCH_TEXTS);
  if (!toggle) {
    console.error('[deepseek] Smart Search toggle not found on page');
    return;
  }

  const isActive = await isToggleActive(toggle);
  console.error(`[deepseek] Smart Search toggle: active=${isActive}, target=${enabled}`);

  if (isActive !== enabled) {
    await toggle.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Extract thinking process and final answer from a DeepThink response.
 * When DeepThink is active, the response may contain a thinking/reasoning
 * block followed by the final answer.
 */
export function extractThinkingAndAnswer(text: string): {
  thinking?: string;
  answer: string;
} {
  if (!text) return { answer: '' };

  // Look for thinking block markers
  // DeepSeek typically shows thinking in a collapsible section
  // Common patterns: "思考过程" or content before a separator

  // Try to find thinking markers
  const thinkingMarkers = ['思考过程', 'Thinking', 'Reasoning'];
  const separatorMarkers = ['---', '***', '==='];

  for (const marker of thinkingMarkers) {
    const idx = text.indexOf(marker);
    if (idx !== -1) {
      // Found thinking section - extract it
      const afterMarker = text.substring(idx + marker.length).trim();

      // Look for a separator between thinking and answer
      for (const sep of separatorMarkers) {
        const sepIdx = afterMarker.indexOf(sep);
        if (sepIdx !== -1) {
          return {
            thinking: afterMarker.substring(0, sepIdx).trim(),
            answer: afterMarker.substring(sepIdx + sep.length).trim(),
          };
        }
      }

      // No separator found - the thinking might be the whole text
      // Try to find where the actual answer starts (after thinking ends)
      const lines = afterMarker.split('\n');
      let thinkingEnd = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Empty line or new section marker might indicate end of thinking
        if (line === '' && i > 0 && i < lines.length - 1) {
          const nextLine = lines[i + 1]?.trim();
          if (nextLine && !nextLine.startsWith('-') && !nextLine.startsWith('*')) {
            thinkingEnd = i;
            break;
          }
        }
      }

      if (thinkingEnd > 0) {
        return {
          thinking: lines.slice(0, thinkingEnd).join('\n').trim(),
          answer: lines.slice(thinkingEnd).join('\n').trim(),
        };
      }

      // Couldn't clearly separate - return whole text as answer
      return { thinking: afterMarker, answer: afterMarker };
    }
  }

  // No thinking markers found - this is a regular response
  return { answer: text };
}

// ── Main Export ────────────────────────────────────────────────────────────

/**
 * Send a prompt to DeepSeek and return the response.
 *
 * This is the main entry point called by all MCP tools.
 * It handles:
 * 1. Ensuring we're on the chat page
 * 2. Switching chat mode if requested
 * 3. Toggling DeepThink if requested
 * 4. Toggling Smart Search if requested (quick mode only)
 * 5. Sending the prompt and waiting for the response
 * 6. Resetting toggle states for the next call
 *
 * @param browserManager - Initialized BrowserManager instance
 * @param prompt - The text prompt to send
 * @param options - Chat options (mode, deepthink, smartSearch)
 * @returns The response text from DeepSeek
 */
export async function sendDeepSeekPrompt(
  browserManager: BrowserManager,
  prompt: string,
  options?: ChatOptions
): Promise<string> {
  const page = browserManager.getPage();
  if (!page) {
    throw new Error('Browser not initialized. Call browserManager.initialize() first.');
  }

  const mode = options?.mode ?? 'quick';
  const deepthink = options?.deepthink ?? false;
  const smartSearch = options?.smartSearch ?? false;
  const conversation = options?.conversation ?? 'continue';

  // 1. Handle conversation control
  if (conversation === 'new') {
    // Start a fresh conversation - navigate to the base chat URL
    // DeepSeek treats a fresh load of the base URL as a new conversation
    await page.goto(CHAT_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  } else {
    // Continue existing conversation - only navigate if not already on chat page
    if (!page.url().startsWith(CHAT_URL)) {
      await page.goto(CHAT_URL, { waitUntil: 'domcontentloaded' });
    }
  }

  // 2. Switch mode if needed
  await switchMode(page, mode);

  // 3. Toggle DeepThink if requested (works in all modes)
  if (deepthink) {
    await toggleDeepThink(page, true);
  }

  // 4. Toggle Smart Search if requested (quick mode only)
  if (smartSearch && mode === 'quick') {
    await toggleSmartSearch(page, true);
  }

  // 5. Capture response baseline (to identify new responses)
  const responseBaseline = await captureResponseBaseline(page);

  // 6. Fill input and send
  const input = await firstVisible(page, INPUT_SELECTORS);
  await fillInput(input, prompt);
  await clickSendOrPressEnter(page);

  // 7. Wait for generation to complete
  await waitForGenerationToFinish(page);

  // 8. Wait for stable response
  const response = await waitForStableResponse(page, responseBaseline);

  // 9. Reset toggle states for next call (don't fail if reset errors)
  if (deepthink) {
    await toggleDeepThink(page, false).catch(() => {});
  }
  if (smartSearch && mode === 'quick') {
    await toggleSmartSearch(page, false).catch(() => {});
  }

  if (!response) {
    throw new Error('Empty response received from DeepSeek.');
  }

  return response;
}
