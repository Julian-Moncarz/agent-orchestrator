// src/input-cleaner.test.ts

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

import { cleanInput } from './input-cleaner.js';

describe('cleanInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns single cleaned task from simple input', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            tasks: [{ prompt: 'Create a hello world function' }],
          }),
        },
      ],
    });

    const result = await cleanInput('hey can you like make a function that says hello world or whatever');

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].prompt).toBe('Create a hello world function');
  });

  it('identifies multiple tasks from compound input', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            tasks: [
              { prompt: 'Fix the login bug' },
              { prompt: 'Add unit tests for authentication' },
            ],
          }),
        },
      ],
    });

    const result = await cleanInput('fix the login bug and also add some tests for auth');

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].prompt).toBe('Fix the login bug');
    expect(result.tasks[1].prompt).toBe('Add unit tests for authentication');
  });

  it('returns suggested tools for each task', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            tasks: [
              { prompt: 'Run the test suite', suggestedTools: ['Bash'] },
              { prompt: 'Update the README file', suggestedTools: ['Read', 'Edit'] },
            ],
          }),
        },
      ],
    });

    const result = await cleanInput('run tests and update the readme');

    expect(result.tasks[0].suggestedTools).toEqual(['Bash']);
    expect(result.tasks[1].suggestedTools).toEqual(['Read', 'Edit']);
  });

  it('returns clarificationNeeded when input is ambiguous', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            tasks: [],
            clarificationNeeded: 'Which file do you want me to update?',
          }),
        },
      ],
    });

    const result = await cleanInput('update it');

    expect(result.tasks).toHaveLength(0);
    expect(result.clarificationNeeded).toBe('Which file do you want me to update?');
  });

  it('handles empty input gracefully', async () => {
    const result = await cleanInput('');

    expect(result.tasks).toHaveLength(0);
    expect(result.clarificationNeeded).toBe('Please provide a task description.');
  });

  it('falls back gracefully on LLM errors', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API Error'));

    const result = await cleanInput('do something');

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].prompt).toBe('do something');
    expect(result.clarificationNeeded).toBeUndefined();
  });

  it('falls back gracefully on invalid JSON response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'This is not valid JSON',
        },
      ],
    });

    const result = await cleanInput('do something else');

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].prompt).toBe('do something else');
  });

  it('uses correct model and parameters', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ tasks: [{ prompt: 'Test' }] }),
        },
      ],
    });

    await cleanInput('test input');

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
        }),
      ]),
    });
  });
});
