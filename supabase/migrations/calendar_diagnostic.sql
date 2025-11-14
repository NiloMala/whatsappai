-- ===========================================
-- DIAGNÓSTICO RÁPIDO - CALENDAR EVENTS
-- Execute este script para verificar o status
-- ===========================================

-- 1. Verificar estrutura da tabela events
SELECT 'TABELA EVENTS - ESTRUTURA:' as info;
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'events'
ORDER BY ordinal_position;

-- 2. Verificar RLS
SELECT 'RLS HABILITADO:' as info, rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'events';

-- 3. Contar políticas RLS
SELECT 'POLÍTICAS RLS:' as info, COUNT(*) as policies_count
FROM pg_policies
WHERE tablename = 'events';

-- 4. Listar políticas RLS
SELECT 'LISTA DE POLÍTICAS:' as info, policyname, cmd
FROM pg_policies
WHERE tablename = 'events'
ORDER BY cmd;

-- 5. Contar índices
SELECT 'ÍNDICES CRIADOS:' as info, COUNT(*) as indexes_count
FROM pg_indexes
WHERE tablename = 'events';

-- 6. Verificar funções
SELECT 'FUNÇÕES CRIADAS:' as info, COUNT(*) as functions_count
FROM information_schema.routines
WHERE routine_name LIKE '%event%'
AND routine_schema = 'public';

-- 7. Listar funções
SELECT 'LISTA DE FUNÇÕES:' as info, routine_name
FROM information_schema.routines
WHERE routine_name LIKE '%event%'
AND routine_schema = 'public';

-- 8. Verificar trigger
SELECT 'TRIGGER CRIADO:' as info, COUNT(*) as triggers_count
FROM information_schema.triggers
WHERE event_object_table = 'events';

-- ===========================================
-- TESTE FUNCIONAL - Execute após diagnóstico
-- ===========================================

-- Teste: Buscar eventos (substitua 'user-uuid' pelo seu ID real)
-- SELECT * FROM public.events WHERE user_id = 'user-uuid';

-- Teste: Usar função get_events_for_date
-- SELECT * FROM get_events_for_date('user-uuid', CURRENT_DATE);