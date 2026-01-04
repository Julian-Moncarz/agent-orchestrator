// src/status-detector.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create the mock function using vi.hoisted so it's available before vi.mock runs
const { mockCreate } = vi.hoisted(() => {
  return { mockCreate: vi.fn() };
});

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: function MockAnthropic() {
      return {
        messages: {
          create: mockCreate,
        },
      };
    },
  };
});

import { detectStatus } from './status-detector.js';

describe('detectStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns "working" status when agent is actively processing', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"status": "working", "summary": "Agent is processing files"}',
        },
      ],
    });

    const result = await detectStatus('agent-1', 'Running build command...');

    expect(result).toEqual({
      id: 'agent-1',
      state: 'working',
      summary: 'Agent is processing files',
      lastOutput: 'Running build command...',
    });
  });

  it('returns "needs_input" when agent asked a question', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"status": "needs_input", "summary": "Agent is waiting for user confirmation"}',
        },
      ],
    });

    const result = await detectStatus('agent-2', 'Do you want me to proceed with the changes?');

    expect(result).toEqual({
      id: 'agent-2',
      state: 'needs_input',
      summary: 'Agent is waiting for user confirmation',
      lastOutput: 'Do you want me to proceed with the changes?',
    });
  });

  it('returns "done" when agent completed task', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"status": "done", "summary": "Task completed successfully"}',
        },
      ],
    });

    const result = await detectStatus('agent-3', 'All tests passed. Task complete.');

    expect(result).toEqual({
      id: 'agent-3',
      state: 'done',
      summary: 'Task completed successfully',
      lastOutput: 'All tests passed. Task complete.',
    });
  });

  it('falls back to "working" on LLM errors', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API Error'));

    const result = await detectStatus('agent-4', 'Some output here');

    expect(result).toEqual({
      id: 'agent-4',
      state: 'working',
      summary: 'Processing...',
      lastOutput: 'Some output here',
    });
  });

  it('falls back to "working" on invalid JSON response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'This is not valid JSON',
        },
      ],
    });

    const result = await detectStatus('agent-5', 'Some output');

    expect(result).toEqual({
      id: 'agent-5',
      state: 'working',
      summary: 'Processing...',
      lastOutput: 'Some output',
    });
  });

  it('truncates output to last 500 chars', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"status": "working", "summary": "Processing"}',
        },
      ],
    });

    // Create a string longer than 500 chars (600 total)
    const longOutput = 'A'.repeat(300) + 'B'.repeat(300);

    const result = await detectStatus('agent-6', longOutput);

    // Should only contain the last 500 chars
    // From 600 chars, take last 500: that's 100 A's (from 200-299) + 300 B's
    expect(result.lastOutput.length).toBe(500);
    expect(result.lastOutput).toBe('A'.repeat(200) + 'B'.repeat(300));

    // Verify the truncated output was sent to the LLM
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('A'.repeat(200) + 'B'.repeat(300)),
          }),
        ]),
      })
    );
  });

  it('handles empty content array from LLM', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [],
    });

    const result = await detectStatus('agent-7', 'Some output');

    // Should fall back since empty content can't be parsed as JSON
    expect(result).toEqual({
      id: 'agent-7',
      state: 'working',
      summary: 'Processing...',
      lastOutput: 'Some output',
    });
  });

  it('handles non-text content type from LLM', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'some_tool',
          input: {},
        },
      ],
    });

    const result = await detectStatus('agent-8', 'Some output');

    // Should fall back since non-text content results in empty string
    expect(result).toEqual({
      id: 'agent-8',
      state: 'working',
      summary: 'Processing...',
      lastOutput: 'Some output',
    });
  });

  it('uses correct model and parameters', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"status": "working", "summary": "Test"}',
        },
      ],
    });

    await detectStatus('agent-9', 'Some output');

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 150,
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
        }),
      ]),
    });
  });
});
