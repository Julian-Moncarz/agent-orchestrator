// src/logger.ts

import * as fs from 'fs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LoggerConfig {
  level: LogLevel;
  filePath: string;
}

interface Logger {
  debug: (component: string, msg: string, data?: Record<string, unknown>) => void;
  info: (component: string, msg: string, data?: Record<string, unknown>) => void;
  warn: (component: string, msg: string, data?: Record<string, unknown>) => void;
  error: (component: string, msg: string, data?: Record<string, unknown>) => void;
}

export function createLogger(config: LoggerConfig): Logger {
  const shouldLog = (level: LogLevel): boolean => {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[config.level];
  };

  const log = (level: LogLevel, component: string, msg: string, data?: Record<string, unknown>) => {
    if (!shouldLog(level)) return;

    const entry = {
      level,
      ts: new Date().toISOString(),
      component,
      msg,
      data: data ?? {},
    };

    try {
      fs.appendFileSync(config.filePath, JSON.stringify(entry) + '\n');
    } catch {
      // Silently ignore - logging shouldn't crash the app
    }
  };

  return {
    debug: (component, msg, data) => log('debug', component, msg, data),
    info: (component, msg, data) => log('info', component, msg, data),
    warn: (component, msg, data) => log('warn', component, msg, data),
    error: (component, msg, data) => log('error', component, msg, data),
  };
}
