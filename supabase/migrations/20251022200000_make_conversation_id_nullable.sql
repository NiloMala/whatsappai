-- Tornar conversation_id nullable para permitir salvar mensagens sem conversation
ALTER TABLE messages 
ALTER COLUMN conversation_id DROP NOT NULL;

-- Remover os nós desnecessários e simplificar o workflow
-- Agora as mensagens podem ser salvas apenas com user_id para estatísticas básicas
