import type { OpenAiUsageContext } from '../openai.events';

export interface OpenAiTextFormatJsonSchema {
  type: 'json_schema';
  name: string;
  schema: Record<string, unknown>;
  strict: boolean;
  description?: string;
}

export interface OpenAiInputTextContent {
  type: 'input_text' | 'output_text';
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
  strict?: boolean;
  /** Feature and user the call is made for; when set, token usage is published for analytics. */
  usage?: OpenAiUsageContext;
}

export interface OpenAiResponseOutputContent {
  type: 'output_text' | 'reasoning' | 'tool_call';
  text?: string;
}

export interface OpenAiResponseOutputItem {
  id: string;
  type: 'message' | 'reasoning' | 'tool_call';
  role?: 'assistant';
  content?: OpenAiResponseOutputContent[];
}

export interface OpenAiResponseResult {
  id: string;
  status: string;
  output_text?: string;
  output?: OpenAiResponseOutputItem[];
  usage?: Record<string, unknown>;
}
