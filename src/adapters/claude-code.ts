// src/adapters/claude-code.ts

import { execa, ExecaChildProcess } from 'execa';
import { AgentConfig, AgentHandle } from '../types.js';

export function spawnClaudeCode(config: AgentConfig): AgentHandle {
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

  const proc = execa('claude', args, {
    cwd: config.workingDirectory,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // Send initial task
  proc.stdin?.write(config.task + '\n');

  const outputCallbacks: ((chunk: string) => void)[] = [];
  const exitCallbacks: ((code: number) => void)[] = [];

  proc.stdout?.on('data', (data: Buffer) => {
    const chunk = data.toString();
    outputCallbacks.forEach(cb => cb(chunk));
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const chunk = data.toString();
    outputCallbacks.forEach(cb => cb(chunk));
  });

  proc.on('exit', (code) => {
    exitCallbacks.forEach(cb => cb(code ?? 0));
  });

  return {
    id: config.id,
    config,
    send: (message: string) => {
      proc.stdin?.write(message + '\n');
    },
    kill: () => {
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
