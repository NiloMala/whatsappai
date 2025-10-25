-- Remover políticas antigas da tabela messages
DROP POLICY IF EXISTS "Users can insert own messages" ON messages;
DROP POLICY IF EXISTS "Users can view own messages" ON messages;

-- Criar política para permitir INSERT de usuários autenticados e service_role
CREATE POLICY "Allow authenticated insert messages"
ON messages
FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

-- Criar política para permitir SELECT apenas das próprias mensagens
CREATE POLICY "Users can view own messages"
ON messages
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Permitir service_role (usado por Edge Functions) ler todas as mensagens
CREATE POLICY "Service role can view all messages"
ON messages
FOR SELECT
TO service_role
USING (true);

-- Permitir UPDATE apenas das próprias mensagens
CREATE POLICY "Users can update own messages"
ON messages
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Permitir DELETE apenas das próprias mensagens
CREATE POLICY "Users can delete own messages"
ON messages
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

COMMENT ON POLICY "Allow authenticated insert messages" ON messages IS 'Permite que usuários autenticados e service_role (Edge Functions) insiram mensagens';
COMMENT ON POLICY "Users can view own messages" ON messages IS 'Usuários podem ver apenas suas próprias mensagens';
COMMENT ON POLICY "Service role can view all messages" ON messages IS 'Service role pode ver todas as mensagens para processamento';
