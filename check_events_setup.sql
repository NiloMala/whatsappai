-- ===========================================
-- VERIFICAÇÃO RÁPIDA DO CALENDAR EVENTS
-- Execute este script no Supabase SQL Editor
-- ===========================================

-- Verificar se a tabela events existe
SELECT 'Tabela events existe:' as check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'events' AND table_schema = 'public'
       ) THEN 'SIM' ELSE 'NÃO' END as result;

-- Verificar se RLS está habilitado
SELECT 'RLS habilitado:' as check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_tables
         WHERE tablename = 'events' AND rowsecurity = true
       ) THEN 'SIM' ELSE 'NÃO' END as result;

-- Contar políticas RLS
SELECT 'Políticas RLS:' as check_name, COUNT(*) as result, 'Esperado: 4' as expected
FROM pg_policies WHERE tablename = 'events';

-- Verificar funções
SELECT 'Função get_events_for_date existe:' as check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.routines
         WHERE routine_name = 'get_events_for_date' AND routine_schema = 'public'
       ) THEN 'SIM' ELSE 'NÃO' END as result;

-- Verificar se há eventos na tabela
SELECT 'Total de eventos na tabela:' as check_name, COUNT(*) as result
FROM events;

-- Verificar eventos de hoje (se houver)
SELECT 'Eventos hoje:' as check_name, COUNT(*) as result
FROM events
WHERE DATE(start_time) = CURRENT_DATE;

-- ===========================================
-- SE ALGUMA VERIFICAÇÃO RETORNAR "NÃO" OU CONTAGEM INCORRETA,
-- EXECUTE O ARQUIVO complete_events_setup.sql INTEIRO
-- ===========================================