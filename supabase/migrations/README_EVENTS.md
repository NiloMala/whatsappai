# Calendar Events Database Setup

Este documento explica como configurar o banco de dados para a funcionalidade de calendário/agenda.

## Arquivos SQL

### 1. `20251027000000_create_events_table.sql`
Cria a tabela `events` com:
- `id`: UUID primário
- `user_id`: Referência para o usuário (auth.users)
- `title`: Título do evento
- `description`: Descrição opcional
- `start_time`: Data/hora de início
- `end_time`: Data/hora de fim
- `created_at`/`updated_at`: Timestamps automáticos

**Recursos incluídos:**
- Row Level Security (RLS) habilitado
- Políticas RLS para isolamento por usuário
- Índices para performance
- Trigger para updated_at
- Constraint para validar que end_time > start_time

### 2. `20251027000001_sample_events_data.sql`
Dados de exemplo para teste (opcional).

### 3. `20251027000002_events_functions.sql`
Funções úteis:
- `get_events_in_range()`: Busca eventos em um período
- `get_events_for_date()`: Busca eventos de um dia específico
- `check_event_conflict()`: Verifica conflitos de horário

## Como Aplicar as Migrations

1. Execute as migrations em ordem no Supabase SQL Editor:
```sql
-- Execute em ordem:
-- 1. 20251027000000_create_events_table.sql
-- 2. 20251027000002_events_functions.sql
-- 3. (Opcional) 20251027000001_sample_events_data.sql
```

## Integração com o Frontend

### Tipos TypeScript

```typescript
interface Event {
  id: string; // UUID do Supabase
  user_id: string;
  title: string;
  description?: string;
  start_time: string; // ISO string
  end_time: string;   // ISO string
  created_at: string;
  updated_at: string;
}
```

### Exemplo de Queries Supabase

```typescript
// Buscar eventos de uma data específica
const { data: events } = await supabase
  .from('events')
  .select('*')
  .eq('user_id', user.id)
  .gte('start_time', startOfDay.toISOString())
  .lt('start_time', endOfDay.toISOString())
  .order('start_time');

// Criar novo evento
const { data, error } = await supabase
  .from('events')
  .insert({
    user_id: user.id,
    title: 'Reunião',
    description: 'Discussão do projeto',
    start_time: '2025-10-26T10:00:00Z',
    end_time: '2025-10-26T11:00:00Z'
  });

// Atualizar evento
const { data, error } = await supabase
  .from('events')
  .update({
    title: 'Reunião Atualizada',
    description: 'Nova descrição'
  })
  .eq('id', eventId)
  .eq('user_id', user.id);

// Excluir evento
const { error } = await supabase
  .from('events')
  .delete()
  .eq('id', eventId)
  .eq('user_id', user.id);
```

### Usando as Funções SQL

```typescript
// Buscar eventos por período usando função
const { data, error } = await supabase
  .rpc('get_events_in_range', {
    p_user_id: user.id,
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString()
  });

// Verificar conflitos
const { data: hasConflict, error } = await supabase
  .rpc('check_event_conflict', {
    p_user_id: user.id,
    p_start_time: startTime.toISOString(),
    p_end_time: endTime.toISOString(),
    p_exclude_event_id: editingEvent?.id || null
  });
```

## Próximos Passos

1. Execute as migrations no Supabase
2. Atualize o código frontend para usar o Supabase em vez de estado local
3. Implemente sincronização em tempo real (opcional)
4. Adicione validações no frontend usando as funções SQL