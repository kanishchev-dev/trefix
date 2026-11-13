import { registerAs } from '@nestjs/config';

export default registerAs('openai', () => ({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  model: process.env.OPENAI_MODEL || 'gpt-5',
  timeoutMs: parseInt(process.env.OPENAI_TIMEOUT_MS || '30000', 10),
  maxOutputTokens: parseInt(process.env.OPENAI_MAX_OUTPUT_TOKENS || '1200', 10),
  temperature: Number(process.env.OPENAI_TEMPERATURE || '0.2'),
  tracingEnabled: process.env.OPENAI_TRACING_ENABLED === 'true',
}));
