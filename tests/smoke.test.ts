import { ConfigBuilder } from '../src/config';
import { validatePinFormat } from '../src/validators';

describe('KRA Connect Node SDK smoke tests', () => {
  test('validatePinFormat normalizes uppercase', () => {
    expect(validatePinFormat('p051234567a')).toBe('P051234567A');
  });

  test('ConfigBuilder merges defaults', () => {
    const config = ConfigBuilder.fromEnv({
      apiKey: 'test-key',
      timeout: 1234,
    });

    expect(config.apiKey).toBe('test-key');
    expect(config.timeout).toBe(1234);
    expect(config.retryConfig.maxAttempts).toBeGreaterThan(0);
  });
});
