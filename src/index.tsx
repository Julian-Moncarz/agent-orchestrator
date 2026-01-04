// src/index.tsx

import { render } from 'ink';
import React from 'react';
import { App } from './components/App.js';
import { logger } from './logger.js';

logger.info('startup', 'orchestrator starting', {
  logLevel: process.env.LOG_LEVEL || 'debug',
  logFile: process.env.ORCHESTRATOR_LOG_FILE || 'orchestrator-debug.log',
  cwd: process.cwd(),
});

render(<App />);
