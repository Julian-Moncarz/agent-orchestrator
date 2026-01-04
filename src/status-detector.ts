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
          content: `Analyze this agent output. RESPOND WITH ONLY JSON, NO OTHER TEXT.

OUTPUT:
${truncated}

JSON format: {"status": "working", "summary": "brief description"}

Status values: "working" (processing), "needs_input" (waiting for user), "done" (completed)

CRITICAL: Output ONLY the JSON object, nothing else.`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    logger.debug('status-detector', 'received response', { agentId, text });

    // Extract JSON from response (in case model adds extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }
    const parsed = JSON.parse(jsonMatch[0]) as DetectionResult;

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
