-- Execute TODAS estas queries uma por vez no SQL Editor do Supabase:

-- 1. Verificar colunas da tabela
SELECT COUNT(*) as colunas_events FROM information_schema.columns WHERE table_name = 'events';

-- 2. Verificar RLS
SELECT rowsecurity as rls_habilitado FROM pg_tables WHERE tablename = 'events';

-- 3. Verificar políticas
SELECT COUNT(*) as politicas_rls FROM pg_policies WHERE tablename = 'events';

-- 4. Verificar índices
SELECT COUNT(*) as indices FROM pg_indexes WHERE tablename = 'events';

-- 5. Verificar funções
SELECT COUNT(*) as funcoes FROM information_schema.routines WHERE routine_name LIKE '%event%' AND routine_schema = 'public';

-- 6. Verificar trigger
SELECT COUNT(*) as triggers FROM information_schema.triggers WHERE event_object_table = 'events';