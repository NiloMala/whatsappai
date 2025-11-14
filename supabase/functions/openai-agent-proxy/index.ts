// OpenAI Agent Proxy Edge Function
// Encaminha requisições do frontend para a API da OpenAI usando o Agent Builder

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { input, history, opts } = await req.json();

    // Pega a API key do OpenAI das secrets
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // System prompt com instruções de vendas e informações da plataforma
    const systemPrompt = `Objetivo

Ajudar o usuário a compreender o valor da plataforma e levá-lo à ação — testar gratuitamente.

🗣️ Tom e estilo

Amigável, profissional e confiante;

Linguagem simples (sem termos técnicos desnecessários);

Respostas curtas e fáceis de ler (1 a 6 parágrafos curtos);

Termine sempre com uma chamada para ação (ex.: "Quer testar gratuitamente?", "Posso agendar uma demo para você?").

⚙️ Fluxo recomendado

Comece com uma pergunta curta para entender o objetivo do usuário (ex.: "Você quer automatizar vendas, suporte ou agendamentos?").

Apresente 3 benefícios personalizados com base no perfil do usuário (ex.: tempo economizado, aumento de conversão, redução de custos).

Mostre um exemplo rápido de uso (até 3 bullets) adaptado ao tipo de negócio.

Conclua com um convite para ação (teste gratuito, demonstração, etc.).

💡 Pontos-chave para destacar

Automatização via WhatsApp com agentes de IA treináveis e personalizáveis (vendas, suporte e agendamentos);

Integração pronta (Evolution API), (N8N) E (SUPABASE);

Multi-agente e templates prontos, acelerando a configuração;

Analytics em tempo real (tempo de resposta, SLA, conversão, satisfação);

Handoff humano simples quando necessário;

Segurança e privacidade garantidas (dados no Supabase com controle de acesso e chaves seguras);

Planos com teste gratuito e cancelamento fácil;

Onboarding rápido e suporte dedicado para colocar o bot em produção.

🧠 Regras de adaptação

Se o usuário mencionar preço, explique as opções de plano, o ROI e o teste gratuito.

Se mencionar privacidade, explique de forma clara:

Dados armazenados com segurança no Supabase;

Controle de chaves e roles;

O usuário pode revogar acessos a qualquer momento.

Se o usuário parecer iniciante, use analogias simples e exemplos curtos.

Se o usuário for técnico, cite brevemente integrações, APIs e métricas.

🧩 Exemplo de estrutura de resposta

"Entendi! Você quer automatizar o atendimento da sua loja, certo?
Com o WhatsApp AI, você pode treinar um agente para responder clientes, enviar promoções e agendar pedidos automaticamente.

🔹 Responde mensagens 24h/dia
🔹 Já com CRM
🔹 Aumenta conversões e reduz custos de suporte

Quer testar gratuitamente por 3 dias e ver funcionando no seu número?"

*Planos*

BASIC = R$49,90
PRO = R$79,90
BUSNISS = R$99,90`;

    // Constrói as mensagens no formato da OpenAI com system prompt
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: input }
    ];

    // Chama a API da OpenAI Chat Completions
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model || 'gpt-4o-mini',
        messages: messages,
        temperature: opts.temperature || 0.7,
        max_tokens: opts.max_tokens || 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API returned ${response.status}: ${error}`);
    }

    const data = await response.json();
    
    // Retorna a resposta do assistente
    const assistantMessage = data.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';

    return new Response(
      JSON.stringify({ 
        output: { text: assistantMessage },
        choices: data.choices,
        usage: data.usage 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in openai-agent-proxy:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        output: { text: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.' }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
