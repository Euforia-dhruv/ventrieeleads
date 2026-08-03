import { logger } from '../src/core/logger';

describe('Logger', () => {
  it('should be a valid winston logger', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should log messages without throwing', () => {
    expect(() => {
      logger.info('Test info message', { test: true });
      logger.warn('Test warn message');
      logger.error('Test error message');
      logger.debug('Test debug message');
    }).not.toThrow();
  });

  it('should have correct log level', () => {
    expect(logger.level).toBeDefined();
  });
});
