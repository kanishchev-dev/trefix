/** USD per 1M tokens. */
export interface LlmModelPrice {
  input: number;
  cachedInput: number;
  output: number;
}

export type LlmPricing = Record<string, LlmModelPrice>;

/** Public list prices at the time of writing; `LLM_PRICING` overrides them. */
export const DEFAULT_LLM_PRICING: LlmPricing = {
  'gpt-4o-mini': { input: 0.15, cachedInput: 0.075, output: 0.6 },
  'gpt-4o': { input: 2.5, cachedInput: 1.25, output: 10 },
  'gpt-4.1-mini': { input: 0.4, cachedInput: 0.1, output: 1.6 },
  'gpt-4.1': { input: 2, cachedInput: 0.5, output: 8 },
  'gpt-5-mini': { input: 0.25, cachedInput: 0.025, output: 2 },
  'gpt-5': { input: 1.25, cachedInput: 0.125, output: 10 },
};

function isPrice(value: unknown): value is LlmModelPrice {
  if (!value || typeof value !== 'object') return false;
  const price = value as Record<string, unknown>;
  return ['input', 'cachedInput', 'output'].every(
    (key) => typeof price[key] === 'number' && Number.isFinite(price[key]) && (price[key] as number) >= 0,
  );
}

/** Built-in prices merged with the JSON from the environment; invalid entries are ignored. */
export function parseLlmPricing(raw: string | undefined): LlmPricing {
  if (!raw?.trim()) return { ...DEFAULT_LLM_PRICING };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_LLM_PRICING };
  }
  const pricing: LlmPricing = { ...DEFAULT_LLM_PRICING };
  if (parsed && typeof parsed === 'object') {
    for (const [model, price] of Object.entries(parsed as Record<string, unknown>)) {
      if (isPrice(price)) pricing[model] = price;
    }
  }
  return pricing;
}

/**
 * Price of a model: an exact match, else the longest known prefix
 * (`gpt-4o-mini-2024-07-18` → `gpt-4o-mini`). Null for an unknown model.
 */
export function priceFor(pricing: LlmPricing, model: string): LlmModelPrice | null {
  if (pricing[model]) return pricing[model];
  const prefix = Object.keys(pricing)
    .filter((known) => model.startsWith(`${known}-`))
    .sort((left, right) => right.length - left.length)[0];
  return prefix ? pricing[prefix] : null;
}

/** Cost in USD; cached input tokens are part of input tokens and billed at the cached rate. */
export function costUsd(price: LlmModelPrice, tokens: { input: number; cachedInput: number; output: number }): number {
  const cached = Math.min(tokens.cachedInput, tokens.input);
  const cost =
    ((tokens.input - cached) * price.input + cached * price.cachedInput + tokens.output * price.output) / 1e6;
  return Math.round(cost * 1e6) / 1e6;
}
