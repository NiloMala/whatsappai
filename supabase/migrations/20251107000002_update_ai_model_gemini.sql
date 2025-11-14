-- Update service_name comment to reflect gemini instead of groq
COMMENT ON COLUMN user_credentials.service_name IS 'AI service name: openai, gemini, claude, ollama, evolution, redis, supabase';

-- Update ai_model column comment in agents table
COMMENT ON COLUMN agents.ai_model IS 'AI model provider: openai, gemini, claude, ollama';
