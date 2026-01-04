// src/status-detector.ts

import Anthropic from '@anthropic-ai/sdk';
import { AgentStatus } from './types.js';
import { logger } from './logger.js';

const client = new Anthropic();

interface DetectionResult {
  status: 'working' | 'needs_input' | 'done';
  summary: string;
}

export async function detectStatus(
  agentId: string,
  recentOutput: string
): Promise<Partial<AgentStatus>> {
  // Truncate to last ~500 chars
  const truncated = recentOutput.slice(-500);

  logger.debug('status-detector', 'detecting status', { agentId, outputLength: truncated.length });

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `Analyze this agent output and respond with JSON only:

OUTPUT:
${truncated}

Respond with exactly this JSON format:
{"status": "working" | "needs_input" | "done", "summary": "1-2 sentence summary of what agent is doing"}

- "working" = agent is actively processing
- "needs_input" = agent asked a question or is waiting for user
- "done" = agent completed its task`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    logger.debug('status-detector', 'received response', { agentId, text });

    const parsed = JSON.parse(text) as DetectionResult;

    logger.info('status-detector', 'status detected', {
      agentId,
      status: parsed.status,
      summary: parsed.summary,
    });

    return {
      state: parsed.status,
      summary: parsed.summary,
      lastOutput: truncated,
    };
  } catch (error) {
    logger.error('status-detector', 'detection failed', { agentId, error: String(error) });
    // Fallback if LLM fails
    return {
      state: 'working',
      summary: 'Processing...',
      lastOutput: truncated,
    };
  }
}
