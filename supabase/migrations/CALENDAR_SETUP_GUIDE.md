# 📅 Configuração do Banco de Dados - Calendário/Agendamento

## 🚨 **TABELA JÁ EXISTE?**

Se você recebeu o erro **"relation 'events' already exists"**, significa que a tabela já foi criada anteriormente. 

### Execute o Diagnóstico Rápido:

1. Abra o arquivo **`calendar_diagnostic.sql`** (criado automaticamente)
2. **Copie TODO o conteúdo** e execute no SQL Editor do Supabase
3. Verifique os resultados - deve mostrar o status completo

### Resultados Esperados:
```
TABELA EVENTS - ESTRUTURA: [8 linhas com as colunas]
RLS HABILITADO: t
POLÍTICAS RLS: 4
ÍNDICES CRIADOS: 5  
FUNÇÕES CRIADAS: 3
TRIGGER CRIADO: 1
```

### Se Tudo Está OK:
- ✅ Vá para o aplicativo e teste criando eventos
- ✅ Use o botão "🧪 Testar Conexão" para verificar

### Se Algo Falta:
Execute apenas as partes que estão faltando do script `complete_events_setup.sql`.

## �🚀 Como Aplicar as Migrations

### Passo 1: Acesse o Supabase Dashboard
1. Vá para [supabase.com](https://supabase.com)
2. Entre no seu projeto
3. Clique em "SQL Editor" no menu lateral

### Passo 2: Execute o Script Principal
1. Abra uma nova query no SQL Editor
2. **COPIE E COLE TODO o conteúdo** do arquivo `complete_events_setup.sql`
3. Clique em "Run" para executar

### Passo 3: Verifique a Instalação
Execute esta query para confirmar que tudo foi criado corretamente:

```sql
-- Verificar se a tabela foi criada
SELECT * FROM information_schema.tables WHERE table_name = 'events';

-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'events';

-- Verificar funções criadas
SELECT routine_name FROM information_schema.routines
WHERE routine_name LIKE '%event%';
```

## 📋 O que será Criado

### 🗄️ Tabela `events`
- **id**: UUID único do evento
- **user_id**: Referência ao usuário dono do evento
- **title**: Título do evento (obrigatório)
- **description**: Descrição opcional
- **start_time**: Data/hora de início
- **end_time**: Data/hora de fim
- **created_at**/**updated_at**: Timestamps automáticos

### 🔒 Segurança
- **Row Level Security (RLS)** habilitado
- Políticas que garantem que usuários só acessam seus próprios eventos
- Isolamento completo entre usuários

### ⚡ Performance
- Índices otimizados para consultas por data e usuário
- Funções eficientes para buscar eventos

### 🛠️ Funções Úteis
- `get_events_in_range()`: Busca eventos em um período
- `get_events_for_date()`: Busca eventos de um dia específico
- `check_event_conflict()`: Verifica conflitos de horário

## 🔧 Próximos Passos - Após Aplicar Migrations

Após executar as migrations, você poderá:
1. Criar eventos normalmente
2. Visualizar eventos salvos
3. Editar e excluir eventos
4. Navegar entre datas no calendário

## ✅ Status da Implementação

- [x] Código frontend pronto
- [x] Serviço eventService implementado
- [x] Componentes UI funcionais
- [ ] **Migrations aplicadas no Supabase** ⬅️ **FAZER AGORA**

## 🐛 Troubleshooting

### Erro: "relation 'events' does not exist"
- ✅ **SOLUÇÃO**: Execute o script `complete_events_setup.sql` no SQL Editor

### Erro: "permission denied for table events"
- Verifique se o usuário está autenticado
- Confirme que as políticas RLS estão corretas

### Erro: "violates check constraint events_end_after_start"
- Certifique-se que `end_time` é posterior a `start_time`

## � **Verificação do Status Atual**

Como a tabela `events` já existe, vamos verificar se todas as configurações foram aplicadas corretamente.

### Execute estas queries no SQL Editor do Supabase:

```sql
-- 1. Verificar se a tabela events existe e sua estrutura
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;

-- 2. Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'events';

-- 3. Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'events';

-- 4. Verificar índices criados
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'events';

-- 5. Verificar funções criadas
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name LIKE '%event%' 
AND routine_schema = 'public';

-- 6. Verificar triggers
SELECT event_object_table, trigger_name, event_manipulation, action_timing 
FROM information_schema.triggers 
WHERE event_object_table = 'events';
```

### Resultados Esperados:

- ✅ **Tabela events**: Deve ter 7 colunas (id, user_id, title, description, start_time, end_time, created_at, updated_at)
- ✅ **RLS**: Deve estar habilitado (rowsecurity = 't')
- ✅ **Políticas RLS**: Deve ter 4 políticas (SELECT, INSERT, UPDATE, DELETE)
- ✅ **Índices**: Deve ter 5 índices criados
- ✅ **Funções**: Deve ter 3 funções (get_events_in_range, get_events_for_date, check_event_conflict)
- ✅ **Triggers**: Deve ter 1 trigger (update_events_updated_at)

## 🧪 **Teste Funcional**

Após verificar que tudo está configurado, teste no aplicativo:

1. **Clique no botão "🧪 Testar Conexão"** na agenda diária
2. **Verifique o console** do navegador (F12) para mensagens de erro
3. **Tente criar um evento** e veja se aparece na lista

## 🔧 **Se Algo Falta**

Se alguma configuração estiver faltando, execute apenas as partes específicas que faltam. Por exemplo:

```sql
-- Se RLS não estiver habilitado:
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Se políticas não existirem:
CREATE POLICY "Users can view own events" ON public.events
  FOR SELECT USING (auth.uid() = user_id);
-- ... (repetir para INSERT, UPDATE, DELETE)
```

## 📞 **Relate os Resultados**

Execute as queries de verificação acima e me diga quais itens estão ✅ funcionando e quais estão ❌ faltando!