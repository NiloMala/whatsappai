-- ===========================================
-- DIAGNÓSTICO ULTRA RÁPIDO
-- Execute este script completo de uma vez
-- ===========================================

SELECT '=== DIAGNÓSTICO CALENDAR EVENTS ===' as status;

-- Estrutura da tabela (deve retornar 8 linhas)
SELECT '1. COLUNAS DA TABELA:' as check_name, COUNT(*) as result, 'Esperado: 8' as expected
FROM information_schema.columns WHERE table_name = 'events';

-- RLS habilitado (deve retornar t)
SELECT '2. RLS HABILITADO:' as check_name, rowsecurity as result, 'Esperado: t' as expected
FROM pg_tables WHERE tablename = 'events';

-- Políticas RLS (deve retornar 4)
SELECT '3. POLÍTICAS RLS:' as check_name, COUNT(*) as result, 'Esperado: 4' as expected
FROM pg_policies WHERE tablename = 'events';

-- Índices (deve retornar 5)
SELECT '4. ÍNDICES:' as check_name, COUNT(*) as result, 'Esperado: 5' as expected
FROM pg_indexes WHERE tablename = 'events';

-- Funções (deve retornar 3)
SELECT '5. FUNÇÕES:' as check_name, COUNT(*) as result, 'Esperado: 3' as expected
FROM information_schema.routines
WHERE routine_name LIKE '%event%' AND routine_schema = 'public';

-- Trigger (deve retornar 1)
SELECT '6. TRIGGER:' as check_name, COUNT(*) as result, 'Esperado: 1' as expected
FROM information_schema.triggers WHERE event_object_table = 'events';

SELECT '=== FIM DO DIAGNÓSTICO ===' as status;