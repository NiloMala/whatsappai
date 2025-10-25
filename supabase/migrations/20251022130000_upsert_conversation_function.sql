-- Fun\u00e7\u00e3o para buscar ou criar conversa pelo telefone
CREATE OR REPLACE FUNCTION upsert_conversation(
  p_user_id UUID,
  p_contact_phone TEXT,
  p_contact_name TEXT DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Busca conversa existente pelo telefone e user_id
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE user_id = p_user_id
    AND contact_phone = p_contact_phone
  LIMIT 1;
  
  -- Se não existir, cria nova conversa
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (user_id, contact_phone, contact_name, agent_id)
    VALUES (p_user_id, p_contact_phone, p_contact_name, p_agent_id)
    RETURNING id INTO v_conversation_id;
  ELSE
    -- Atualiza updated_at se conversa já existe
    UPDATE conversations
    SET updated_at = NOW(),
        contact_name = COALESCE(p_contact_name, contact_name),
        agent_id = COALESCE(p_agent_id, agent_id)
    WHERE id = v_conversation_id;
  END IF;
  
  RETURN v_conversation_id;
END;
$$;

-- Permitir execução para authenticated users
GRANT EXECUTE ON FUNCTION upsert_conversation TO authenticated;

COMMENT ON FUNCTION upsert_conversation IS 'Busca ou cria uma conversa pelo telefone do contato. Retorna o UUID da conversa.';
