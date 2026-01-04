// src/logger.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { createLogger, LogLevel } from './logger.js';

vi.mock('fs');

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('log level filtering', () => {
    it('should log debug when level is debug', () => {
      const logger = createLogger({ level: 'debug', filePath: 'test.log' });
      logger.debug('test', 'message', { data: 1 });

      expect(fs.appendFileSync).toHaveBeenCalledTimes(1);
      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      const logged = JSON.parse(call[1] as string);
      expect(logged.level).toBe('debug');
      expect(logged.component).toBe('test');
      expect(logged.msg).toBe('message');
      expect(logged.data).toEqual({ data: 1 });
    });

    it('should not log debug when level is info', () => {
      const logger = createLogger({ level: 'info', filePath: 'test.log' });
      logger.debug('test', 'message', {});

      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });

    it('should log error at all levels', () => {
      const logger = createLogger({ level: 'error', filePath: 'test.log' });
      logger.error('test', 'message', {});

      expect(fs.appendFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('JSON format', () => {
    it('should include timestamp in ISO format', () => {
      const logger = createLogger({ level: 'debug', filePath: 'test.log' });
      logger.info('comp', 'msg', {});

      const call = vi.mocked(fs.appendFileSync).mock.calls[0];
      const logged = JSON.parse(call[1] as string);
      expect(logged.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should write to correct file path', () => {
      const logger = createLogger({ level: 'debug', filePath: '/tmp/mylog.log' });
      logger.info('comp', 'msg', {});

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        '/tmp/mylog.log',
        expect.any(String)
      );
    });
  });
});
