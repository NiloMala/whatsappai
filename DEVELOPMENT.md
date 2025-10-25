# Guia de Desenvolvimento Local

## Pré-requisitos

- Node.js (versão 18+)
- npm (vem com Node.js)
- Git

## Configuração do Ambiente

1. Clone o repositório:
```bash
git clone <seu-repositorio>
cd whatsagenteai-2.0-main
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
- Crie um arquivo `.env` na raiz do projeto com:
```env
VITE_SUPABASE_URL=https://cvyagrunpypnznptkcsf.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

4. Configuração do Supabase:
- Configure as seguintes variáveis de ambiente na Edge Function `evolution-instance`:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `EVOLUTION_API_URL`
  - `EVOLUTION_API_KEY`

## Rodando o Projeto

1. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

2. Acesse no navegador:
- O app estará disponível em: http://localhost:5173 (ou a porta indicada no terminal)

## Troubleshooting

### Erros Comuns

1. **Erro de CORS na Edge Function**
- Sintoma: Erro "preflight request doesn't pass access control check"
- Solução: Já corrigido nos headers da função `evolution-instance`

2. **Erro de Autenticação**
- Sintoma: Error 400 Bad Request ao chamar a Edge Function
- Solução: Certifique-se de estar logado no app antes de usar funcionalidades que requerem autenticação

3. **Erro "supabaseKey is required"**
- Sintoma: Erro ao inicializar o cliente Supabase
- Solução: Verifique se as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão definidas no `.env`

### Dicas de Desenvolvimento

1. **Logs da Edge Function**
- Para ver logs em tempo real da function:
```bash
supabase functions logs evolution-instance
```

2. **Testando a Edge Function localmente**
- Use curl para testar a function (substitua TOKEN):
```bash
curl -i -X POST "https://cvyagrunpypnznptkcsf.supabase.co/functions/v1/evolution-instance" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"create\"}"
```

## Estrutura do Projeto

```
src/
  ├── components/     # Componentes React reutilizáveis
  ├── integrations/   # Integrações (Supabase, etc)
  ├── pages/         # Páginas/rotas da aplicação
  └── services/      # Serviços e lógica de negócio

supabase/
  └── functions/     # Edge Functions do Supabase
      └── evolution-instance/  # Função de integração WhatsApp
```

## Scripts Disponíveis

- `npm run dev`: Inicia o servidor de desenvolvimento
- `npm run build`: Gera build de produção
- `npm run preview`: Preview da build local