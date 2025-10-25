-- Script para limpar mensagens de teste
-- Execute no Supabase SQL Editor

-- 1. Ver quantas mensagens você tem antes de deletar
SELECT 
  user_id,
  sender_type,
  COUNT(*) as total,
  MIN(created_at) as primeira_msg,
  MAX(created_at) as ultima_msg
FROM messages
GROUP BY user_id, sender_type
ORDER BY user_id, sender_type;

-- 2. CUIDADO: Isso vai DELETAR TODAS as mensagens do seu usuário
-- Substitua 'SEU_USER_ID_AQUI' pelo seu user_id real
-- DELETE FROM messages WHERE user_id = 'SEU_USER_ID_AQUI';

-- 3. Se quiser deletar apenas mensagens antigas (antes de hoje)
-- DELETE FROM messages 
-- WHERE user_id = 'SEU_USER_ID_AQUI' 
-- AND DATE(created_at) < CURRENT_DATE;

-- 4. Também pode limpar conversações antigas
-- DELETE FROM conversations WHERE user_id = 'SEU_USER_ID_AQUI';

-- 5. Verificar depois da deleção
-- SELECT COUNT(*) as total_restante FROM messages WHERE user_id = 'SEU_USER_ID_AQUI';
