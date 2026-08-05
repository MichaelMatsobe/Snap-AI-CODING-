export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  system?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResult {
  content: string;
  provider: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface ProviderInfo {
  id: string;
  name: string;
  available: boolean;
  requiresKey: boolean;
  note?: string;
}
