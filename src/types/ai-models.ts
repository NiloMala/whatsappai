export type AIModelProvider = 'openai' | 'groq' | 'claude' | 'ollama';

export interface AIModelConfig {
  nodeType: string;
  defaultModel: string;
  credentialType: string;
  displayName: string;
}

export const AI_MODEL_CONFIGS: Record<AIModelProvider, AIModelConfig> = {
  openai: {
    nodeType: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
    defaultModel: 'gpt-4o-mini',
    credentialType: 'openAiApi',
    displayName: 'OpenAI Chat Model'
  },
  groq: {
    nodeType: '@n8n/n8n-nodes-langchain.lmChatGroq',
    defaultModel: 'deepseek-r1-distill-llama-70b',
    credentialType: 'groqApi',
    displayName: 'Groq Chat Model'
  },
  claude: {
    nodeType: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
    defaultModel: 'claude-3-5-sonnet-20241022',
    credentialType: 'anthropicApi',
    displayName: 'Claude Chat Model'
  },
  ollama: {
    nodeType: '@n8n/n8n-nodes-langchain.lmChatOllama',
    defaultModel: 'llama3',
    credentialType: 'ollamaApi',
    displayName: 'Ollama Chat Model'
  }
};

export const AI_MODEL_OPTIONS = [
  { value: 'openai', label: 'OpenAI (GPT-4o Mini)' },
  { value: 'groq', label: 'Groq (openai/gpt-oss-20b)' }
] as const;
