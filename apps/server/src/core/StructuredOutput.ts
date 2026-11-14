import { ApiError } from './ApiError.ts';

type JsonSchema = Record<string, unknown>;
const str: JsonSchema = { type: 'string' };
const nullableString: JsonSchema = { type: ['string', 'null'] };
const strings: JsonSchema = { type: 'array', items: str };
const object = (properties: Record<string, JsonSchema>): JsonSchema => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const configuration = object({
  slug: str, version: nullableString, screenId: str,
  values: { type: 'array', items: object({ key: str, value: { anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'boolean' }] } }) },
});
const nullableConfiguration: JsonSchema = { anyOf: [configuration, { type: 'null' }] };

/** Wire schemas meet strict Structured Outputs: closed objects and all keys required. */
export const learningOutputSchemas = {
  'analyze-photo': object({
    status: { type: 'string', enum: ['readable', 'unreadable', 'no_simulation'] },
    message: str, transcription: str,
    facts: { type: 'array', items: object({ label: str, value: str, unit: nullableString }) },
    misconceptions: strings, hints: strings, simulationConfig: nullableConfiguration, simulationSlug: nullableString,
  }),
  'check-work': object({ status: { type: 'string', enum: ['checked', 'unreadable'] }, message: str, firstIncorrectStep: nullableString, hint: str }),
  'evaluate-teach-back': object({ status: { type: 'string', enum: ['evaluated'] }, correct: { type: 'boolean' }, missingLinks: strings, feedback: str }),
  'generate-variant': object({ status: { type: 'string', enum: ['generated'] }, problem: str, changedCondition: str, hints: strings, simulationConfig: nullableConfiguration }),
} satisfies Record<string, JsonSchema>;

/** Convert closed wire entries to app DTO maps, rejecting duplicates and prototype keys. */
export function normalizeStructuredOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const output = { ...raw } as Record<string, unknown>;
  if (Array.isArray(output.facts)) {
    output.facts = output.facts.map(fact => {
      if (!fact || typeof fact !== 'object' || Array.isArray(fact)) return fact;
      const cleaned = { ...fact } as Record<string, unknown>;
      if (cleaned.unit === null) delete cleaned.unit;
      return cleaned;
    });
  }
  if (output.simulationConfig && typeof output.simulationConfig === 'object' && !Array.isArray(output.simulationConfig)) {
    const config = { ...output.simulationConfig } as Record<string, unknown>;
    if (Array.isArray(config.values)) {
      const values: Record<string, unknown> = Object.create(null);
      for (const entry of config.values) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) invalidOutput();
        const item = entry as Record<string, unknown>;
        if (typeof item.key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(item.key) || Object.hasOwn(values, item.key)) invalidOutput();
        values[item.key] = item.value;
      }
      config.values = values;
    }
    if (config.version === null) delete config.version;
    output.simulationConfig = config;
  }
  return output;
}

export function invalidOutput(): never {
  throw new ApiError('AI_INVALID_RESPONSE', 502, 'Chưa đọc được phản hồi hợp lệ từ AI. Hãy thử lại.', true);
}
