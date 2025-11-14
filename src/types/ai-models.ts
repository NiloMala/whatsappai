export type AIModelProvider = 'openai' | 'gemini' | 'claude' | 'ollama';

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
  gemini: {
    nodeType: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
    defaultModel: 'gemini-pro',
    credentialType: 'googlePalmApi',
    displayName: 'Google Chat Model'
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
  { value: 'openai', label: 'OpenAI (GPT-5-Nano)' },
  { value: 'gemini', label: 'Google (Gemini-2.5-Flash)' }
] as const;
