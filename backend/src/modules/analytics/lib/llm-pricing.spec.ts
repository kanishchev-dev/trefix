import { costUsd, DEFAULT_LLM_PRICING, parseLlmPricing, priceFor } from './llm-pricing';

describe('llm pricing', () => {
  it('overrides and extends built-in prices from the environment', () => {
    const pricing = parseLlmPricing(
      '{"gpt-4o-mini":{"input":1,"cachedInput":0.5,"output":2},"my-model":{"input":3,"cachedInput":3,"output":3}}',
    );
    expect(pricing['gpt-4o-mini']).toEqual({ input: 1, cachedInput: 0.5, output: 2 });
    expect(pricing['my-model']).toBeDefined();
    expect(pricing['gpt-5']).toEqual(DEFAULT_LLM_PRICING['gpt-5']);
  });

  it('ignores broken JSON and invalid entries', () => {
    expect(parseLlmPricing('{oops')).toEqual(DEFAULT_LLM_PRICING);
    expect(parseLlmPricing('{"x":{"input":"1"}}').x).toBeUndefined();
  });

  it('matches dated model names by the longest known prefix', () => {
    expect(priceFor(DEFAULT_LLM_PRICING, 'gpt-4o-mini-2024-07-18')).toBe(DEFAULT_LLM_PRICING['gpt-4o-mini']);
    expect(priceFor(DEFAULT_LLM_PRICING, 'gpt-4o-2024-08-06')).toBe(DEFAULT_LLM_PRICING['gpt-4o']);
    expect(priceFor(DEFAULT_LLM_PRICING, 'claude')).toBeNull();
  });

  it('bills cached input tokens at the cached rate', () => {
    const price = { input: 2, cachedInput: 1, output: 10 };
    expect(costUsd(price, { input: 1_000_000, cachedInput: 400_000, output: 100_000 })).toBeCloseTo(2.6, 6);
  });
});
