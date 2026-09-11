export interface OpenAiTextFormatJsonSchema {
  type: 'json_schema';
  name: string;
  schema: Record<string, unknown>;
  strict: boolean;
  description?: string;
}

export interface OpenAiInputTextContent {
  type: 'input_text';
  text: string;
}

export interface OpenAiInputMessage {
  role: 'system' | 'developer' | 'user' | 'assistant';
  content: OpenAiInputTextContent[];
}

export interface OpenAiResponseRequest {
  instructions: string;
  input: OpenAiInputMessage[];
  schemaName: string;
  schema: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  previousResponseId?: string | null;
  metadata?: Record<string, string>;
}

export interface OpenAiResponseResult {
  id: string;
  status: string;
  output_text?: string;
  output?: Array<Record<string, unknown>>;
  usage?: Record<string, unknown>;
}
