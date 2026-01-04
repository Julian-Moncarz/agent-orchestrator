// src/adapters/claude-code.ts

import { execa } from 'execa';
import { AgentConfig, AgentHandle } from '../types.js';
import { logger } from '../logger.js';

export function spawnClaudeCode(config: AgentConfig): AgentHandle {
  logger.info('claude-code', 'spawning agent', {
    id: config.id,
    task: config.task,
    tools: config.tools,
    cwd: config.workingDirectory,
  });

  const args = [
    '-p',
    '--output-format', 'text',
  ];

  if (config.tools && config.tools.length > 0) {
    args.push('--tools', config.tools.join(','));
  }

  if (config.systemPrompt) {
    args.push('--system-prompt', config.systemPrompt);
  }

  logger.debug('claude-code', 'exec args', { args });

  const proc = execa('claude', args, {
    cwd: config.workingDirectory,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // Send initial task and close stdin (for -p/print mode)
  proc.stdin?.write(config.task + '\n');
  proc.stdin?.end();

  const outputCallbacks: ((chunk: string) => void)[] = [];
  const exitCallbacks: ((code: number) => void)[] = [];

  proc.stdout?.on('data', (data: Buffer) => {
    const chunk = data.toString();
    logger.debug('claude-code', 'stdout', { id: config.id, chunk });
    outputCallbacks.forEach(cb => cb(chunk));
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const chunk = data.toString();
    logger.debug('claude-code', 'stderr', { id: config.id, chunk });
    outputCallbacks.forEach(cb => cb(chunk));
  });

  proc.on('exit', (code) => {
    logger.info('claude-code', 'agent exited', { id: config.id, code });
    exitCallbacks.forEach(cb => cb(code ?? 0));
  });

  return {
    id: config.id,
    config,
    send: (message: string) => {
      proc.stdin?.write(message + '\n');
    },
    kill: () => {
      logger.info('claude-code', 'killing agent', { id: config.id });
      proc.kill();
    },
    onOutput: (callback) => {
      outputCallbacks.push(callback);
    },
    onExit: (callback) => {
      exitCallbacks.push(callback);
    },
  };
}
