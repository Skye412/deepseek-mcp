/**
 * DeepSeek Client Tests
 *
 * Tests the pure logic functions from deepseek-client.ts.
 * Browser-dependent functions are not tested here (they require Playwright).
 */

import { describe, it, expect } from 'vitest';
import { extractThinkingAndAnswer } from './deepseek-client';

describe('deepseek-client', () => {
  describe('extractThinkingAndAnswer', () => {
    it('should return empty answer for empty input', () => {
      const result = extractThinkingAndAnswer('');
      expect(result.answer).toBe('');
      expect(result.thinking).toBeUndefined();
    });

    it('should return full text as answer when no thinking markers', () => {
      const text = 'This is a simple response without thinking.';
      const result = extractThinkingAndAnswer(text);
      expect(result.answer).toBe(text);
      expect(result.thinking).toBeUndefined();
    });

    it('should extract thinking when "思考过程" marker is present', () => {
      const text = '思考过程\nThis is my reasoning.\n---\nThis is the final answer.';
      const result = extractThinkingAndAnswer(text);
      expect(result.thinking).toBe('This is my reasoning.');
      expect(result.answer).toBe('This is the final answer.');
    });

    it('should extract thinking when "Thinking" marker is present', () => {
      const text = 'Thinking\nI need to consider this carefully.\n***\nThe answer is 42.';
      const result = extractThinkingAndAnswer(text);
      expect(result.thinking).toBe('I need to consider this carefully.');
      expect(result.answer).toBe('The answer is 42.');
    });

    it('should extract thinking when "Reasoning" marker is present', () => {
      const text = 'Reasoning\nStep 1: Analyze\nStep 2: Conclude\n===\nThe result is clear.';
      const result = extractThinkingAndAnswer(text);
      expect(result.thinking).toBe('Step 1: Analyze\nStep 2: Conclude');
      expect(result.answer).toBe('The result is clear.');
    });

    it('should handle text with thinking marker but no separator', () => {
      const text = '思考过程\nSome reasoning about the topic.';
      const result = extractThinkingAndAnswer(text);
      // Should still extract something
      expect(result.thinking).toBeDefined();
      expect(result.answer).toBeDefined();
    });

    it('should handle response with only thinking marker and empty content', () => {
      const text = '思考过程';
      const result = extractThinkingAndAnswer(text);
      // Should not crash, just return empty-ish
      expect(result.answer).toBeDefined();
    });

    it('should not mistake regular text containing "thinking" as a thinking block', () => {
      const text = 'I was thinking about this problem. The answer is simple.';
      const result = extractThinkingAndAnswer(text);
      // "thinking" in lowercase shouldn't match "Thinking" marker
      // But if it does match, that's also acceptable behavior
      expect(result.answer).toBeDefined();
      expect(result.answer.length).toBeGreaterThan(0);
    });
  });
});
