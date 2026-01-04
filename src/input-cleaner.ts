// src/input-cleaner.ts

import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger.js';

const client = new Anthropic();

export interface CleanedInput {
  tasks: {
    prompt: string;
    suggestedTools?: string[];
  }[];
  clarificationNeeded?: string;
}

export async function cleanInput(rawInput: string): Promise<CleanedInput> {
  logger.debug('cleanInput', 'received input', { raw: rawInput });

  // Handle empty input gracefully
  if (!rawInput.trim()) {
    logger.info('cleanInput', 'empty input');
    return {
      tasks: [],
      clarificationNeeded: 'Please provide a task description.',
    };
  }

  try {
    const requestBody = {
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user' as const,
          content: `Analyze this user input and clean it up into clear, actionable tasks.

INPUT:
${rawInput}

RESPOND WITH ONLY A JSON OBJECT. NO OTHER TEXT BEFORE OR AFTER.

JSON format:
{"tasks": [{"prompt": "Clear task description", "suggestedTools": ["Tool1"]}], "clarificationNeeded": "optional question"}

Available tools: Bash, Read, Edit, Write, Glob, Grep

Rules:
- Clean up informal language into clear prompts
- Identify distinct tasks if multiple exist
- If input is too vague, return empty tasks with clarificationNeeded
- CRITICAL: Output ONLY valid JSON, nothing else`,
        },
      ],
    };

    logger.debug('cleanInput', 'calling anthropic', { model: requestBody.model });

    const response = await client.messages.create(requestBody);

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    logger.debug('cleanInput', 'received response', { text });

    // Extract JSON from response (in case model adds extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }
    const parsed = JSON.parse(jsonMatch[0]) as CleanedInput;

    logger.info('cleanInput', 'parsed result', {
      taskCount: parsed.tasks.length,
      clarificationNeeded: !!parsed.clarificationNeeded,
    });

    return parsed;
  } catch (error) {
    logger.error('cleanInput', 'failed', { error: String(error) });
    throw error;
  }
}
