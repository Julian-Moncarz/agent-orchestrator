// src/input-cleaner.ts

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export interface CleanedInput {
  tasks: {
    prompt: string;
    suggestedTools?: string[];
  }[];
  clarificationNeeded?: string;
}

export async function cleanInput(rawInput: string): Promise<CleanedInput> {
  // Handle empty input gracefully
  if (!rawInput.trim()) {
    return {
      tasks: [],
      clarificationNeeded: 'Please provide a task description.',
    };
  }

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Analyze this user input and clean it up into clear, actionable tasks.

INPUT:
${rawInput}

Respond with exactly this JSON format:
{
  "tasks": [
    { "prompt": "Clear, actionable task description", "suggestedTools": ["Tool1", "Tool2"] }
  ],
  "clarificationNeeded": "Question to ask user if input is ambiguous (optional)"
}

Available tools: Bash, Read, Edit, Write, Glob, Grep

Rules:
- Clean up informal language into clear prompts
- Identify distinct tasks if multiple exist
- Each task should be a clear, actionable instruction
- Suggest which tools each task might need (optional)
- If input is too vague or ambiguous to create tasks, return empty tasks array with clarificationNeeded`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(text) as CleanedInput;

    return parsed;
  } catch {
    // Fallback if LLM fails - return the raw input as a single task
    return {
      tasks: [{ prompt: rawInput }],
    };
  }
}
