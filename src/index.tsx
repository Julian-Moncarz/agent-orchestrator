// src/index.tsx

import 'dotenv/config';
import { render } from 'ink';
import React from 'react';
import { App } from './components/App.js';
import { logger } from './logger.js';

// Check for required API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is required.');
  console.error('Create a .env file with: ANTHROPIC_API_KEY=your-key-here');
  process.exit(1);
}

logger.info('startup', 'orchestrator starting', {
  logLevel: process.env.LOG_LEVEL || 'debug',
  logFile: process.env.ORCHESTRATOR_LOG_FILE || 'orchestrator-debug.log',
  cwd: process.cwd(),
});

render(<App />);
