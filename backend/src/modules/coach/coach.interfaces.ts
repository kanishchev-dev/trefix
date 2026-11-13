import type { CoachToolName } from './coach.constants';

export interface CoachToolRequest {
  name: CoachToolName;
  arguments: Record<string, unknown>;
}

export interface CoachDraftResponse {
  stage: 'need_tools' | 'final' | 'need_clarification';
  reply: string;
  summary: string;
  toolRequests: CoachToolRequest[];
  clarifyingQuestion: string | null;
  safetyFlags: string[];
}

export interface CoachFinalResponse {
  reply: string;
  summary: string;
  safetyFlags: string[];
}

export interface CoachToolExecutionResult {
  name: CoachToolName;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}
