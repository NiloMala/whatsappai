import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function FAQ() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-6">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">Perguntas Frequentes</h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">Encontre aqui respostas rápidas e detalhadas para as dúvidas mais comuns sobre o WhatsAgent AI.</p>
        </header>

        <div className="space-y-6">
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 id="overview" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">O que é o WhatsAgent AI?</h2>
            <p className="text-gray-600 dark:text-gray-300">O WhatsAgent AI é uma plataforma SaaS que permite criar agentes conversacionais inteligentes integrados ao WhatsApp e outras plataformas. Use modelos de IA para automatizar atendimento, vendas, suporte e agendamentos, com painéis de gerenciamento e métricas.</p>
          </section>

          

          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 id="tutorial" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Tutorial rápido: do zero ao seu primeiro agente</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">Siga estes passos simples para criar seu Agente de IA, se quiser, transformar esse agente em um template reutilizável.</p>

            <ol className="list-decimal list-inside text-gray-600 dark:text-gray-300 space-y-3">
              <li>
                <strong>Crie uma instância:</strong> vá em <Link to="/dashboard/whatsapp" className="text-blue-600 dark:text-blue-400">Menu &gt; WhatsApp</Link> e clique em <em>Nova Instância</em>. Siga as instruções para iniciar.
              </li>
              <li>
                <strong>Leia o QR code:</strong> na tela da instância haverá um QR code para conectar o número (web session). Abra o WhatsApp, clique nos três pontinhos &gt; Dispositivos Conectados &gt; Conectar dispositivo e escaneie o QR para autenticar.
              </li>
              <li>
                <strong>Crie seu agente:</strong> agora vá em <Link to="/dashboard/agents" className="text-blue-600 dark:text-blue-400">Menu &gt; Agentes</Link> e clique em <em>Criar Agente</em>. No campo <em>Nome da Instância Evolution</em> cole a <em>Instance Key</em> que você acabou de criar e preencha nome do agente, tipo de linguagem e descrição. Escolha o Modelo de IA, clique em salvar; quando solicitado cole a chave (key) e confirme o salvamento.
              </li>
              <li>
                <strong>Teste o agente:</strong> após criado, abra a instância conectada e envie algumas mensagens de teste pelo WhatsApp para verificar respostas e ajustar o prompt.
              </li>
              <li>
                <strong>Opcional — crie um template:</strong> se quiser salvar o agente como modelo, vá em <Link to="/dashboard/templates" className="text-blue-600 dark:text-blue-400">Menu &gt; Templates</Link>, clique em <em>Novo Template</em> e escolha usar como base um dos nossos modelos. Preencha o título, descrição e salve.
              </li>
            </ol>

            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Dica: comece com um prompt simples (ex.: "Seja educado, responda em até 2 frases e peça confirmação quando necessário"). Ajuste aos poucos e use logs/conversas de teste para iterar.</p>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 id="keys" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Gerando chaves de API (OpenAI e Groq) e modelos usados</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-3">Você precisa de chaves da OpenAI e da Groq para habilitar os modelos de chat no WhatsAgent AI. Abaixo está o passo a passo e os modelos que usamos como padrão.</p>

            <h3 className="font-medium text-gray-800 dark:text-gray-100 mt-3">OpenAI</h3>
            <ol className="list-decimal list-inside text-gray-600 dark:text-gray-300 ml-4 mb-3">
              <li>Acesse https://platform.openai.com/ e faça login na sua conta.</li>
              <li>Vá em <strong>View API keys</strong> (ou Profile → API keys) e clique em <strong>Create new secret key</strong>.</li>
              <li>Copie a chave gerada (começa com <code>sk-</code>) e cole no campo de configuração do agente ou nas configurações do projeto (não compartilhe publicamente).</li>
            </ol>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Modelo de chat OpenAI usado por padrão: <strong>gpt-4o-mini</strong>.</p>

            <h3 className="font-medium text-gray-800 dark:text-gray-100 mt-3">Groq</h3>
            <ol className="list-decimal list-inside text-gray-600 dark:text-gray-300 ml-4 mb-3">
              <li>Acesse o painel da Groq (ou o portal de API que você usa para Groq) e faça login na sua conta Groq.</li>
              <li>Localize a seção de credenciais/API keys e gere uma nova chave (siga as instruções do provedor).</li>
              <li>Copie a chave e cole no campo de configuração do agente ou nas configurações do projeto.</li>
            </ol>
            <p className="text-sm text-gray-500 dark:text-gray-400">Modelo de chat Groq usado por padrão: <strong>Groq (openai/gpt-oss-20b)</strong>.</p>

            <div className="mt-4 text-gray-600 dark:text-gray-300">
              <strong>Observações importantes:</strong>
              <ul className="list-disc list-inside mt-2">
                <li>Guarde as chaves em local seguro e não as exponha no frontend.</li>
                <li>No painel do agente, escolha o provedor (OpenAI ou Groq) e cole a chave quando solicitado ao salvar o agente.</li>
                <li>Observação sobre custos: o modelo Groq (<strong>openai/gpt-oss-20b</strong>) atualmente não gera cobrança pelo provedor; já o OpenAI pode ter custos conforme seu plano. Verifique sempre a política de preços do provedor.</li>
              </ul>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 id="trial" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Como funciona o período de teste grátis de 3 dias?</h2>
            <div className="space-y-3 text-gray-600 dark:text-gray-300">
              <p>Ao iniciar o teste gratuito de 3 dias, você terá acesso total aos recursos do plano escolhido. Não cobramos na ativação — a cobrança só ocorrerá se você não cancelar antes do término do período.</p>
              <ul className="list-disc list-inside">
                <li>Teste começa imediatamente após a ativação.</li>
                <li>Você pode cancelar a qualquer momento durante o teste sem custos.</li>
                <li>Ao final do teste, o Stripe irá cobrar automaticamente o cartão cadastrado (se não houver cancelamento).</li>
              </ul>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 id="payments" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Pagamentos</h2>
            <details className="mb-3">
              <summary className="cursor-pointer text-gray-800 dark:text-gray-100 font-medium">Quais métodos de pagamento aceitam?</summary>
              <div className="mt-2 text-gray-600 dark:text-gray-300">Usamos Stripe para processar pagamentos com cartão de crédito.</div>
            </details>

            <details className="mb-3">
              <summary className="cursor-pointer text-gray-800 dark:text-gray-100 font-medium">Onde encontro meus recibos e faturas?</summary>
              <div className="mt-2 text-gray-600 dark:text-gray-300">Os recibos são enviados ao e-mail associado à cobrança (Stripe). Em breve, disponibilizaremos um histórico de cobranças dentro do painel.</div>
            </details>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 id="cancel" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Cancelamento e Reembolso</h2>
            <details className="mb-3">
              <summary className="cursor-pointer text-gray-800 dark:text-gray-100 font-medium">Como cancelar minha assinatura?</summary>
              <div className="mt-2 text-gray-600 dark:text-gray-300">Pelo painel, vá até a área de assinaturas e clique em "Cancelar assinatura". O acesso permanece até o final do período pago. Para cancelamento imediato, entre em contato com o suporte.</div>
            </details>

            <details>
              <summary className="cursor-pointer text-gray-800 dark:text-gray-100 font-medium">Posso receber reembolso?</summary>
              <div className="mt-2 text-gray-600 dark:text-gray-300">Reembolsos são avaliados caso a caso. Abra um ticket com os detalhes (recibo, motivo) e nossa equipe analisará a solicitação.</div>
            </details>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 id="whatsapp" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Integração com WhatsApp & Webhooks</h2>
            <details className="mb-3">
              <summary className="cursor-pointer text-gray-800 dark:text-gray-100 font-medium">Como funciona a integração?</summary>
              <div className="mt-2 text-gray-600 dark:text-gray-300">Oferecemos integração via infra estrutura própria. Você configura instânciase gerencia agentes que respondem automaticamente via fluxos e modelos de IA.</div>
            </details>

            <details>
              <summary className="cursor-pointer text-gray-800 dark:text-gray-100 font-medium">Por que configurar webhooks?</summary>
              <div className="mt-2 text-gray-600 dark:text-gray-300">Webhooks garantem que eventos externos (ex.: Stripe) atualizem automaticamente o status no nosso sistema, evitando inconsistências entre pagamentos e acessos.</div>
            </details>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 id="limits" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Limites</h2>
            <p className="text-gray-600 dark:text-gray-300">Cada plano tem limites (instâncias e agentes, não de mensagens). Consulte a página de planos para detalhes. Se precisar de mais capacidade, entre em contato para um plano customizado.</p>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 id="security" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Segurança e Privacidade</h2>
            <p className="text-gray-600 dark:text-gray-300">Dados são armazenados em infraestruturas seguras (Supabase/Postgres). Pagamentos processados pela Stripe; não armazenamos números completos de cartão. Consulte a Política de Privacidade para mais detalhes.</p>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 id="troubleshoot" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Problemas comuns e soluções rápidas</h2>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
              <li>Pagamento recusado: Verifique dados do cartão, saldo e tente outro cartão.</li>
              <li>Não recebi e-mail: Verifique spam e confirme o e-mail cadastrado.</li>
              <li>Webhook não funcionando: Confirme endpoint e signing secret no Stripe e nas secrets da função.</li>
              <li>Erro ao criar sessão de pagamento: Verifique Price IDs e a chave Stripe (modo test vs live).</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 id="support" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Suporte</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">Abra um ticket pelo e-mail <a href="mailto:suporte@auroratech.tech" className="text-blue-600 dark:text-blue-400">suporte@auroratech.tech</a> ou use o formulário no painel. Para questões críticas, informe prioridade no assunto.</p>

            <div className="flex gap-3 flex-col sm:flex-row">
              <Link to="/dashboard/plans" className="w-full sm:w-auto">
                <Button className="w-full">Ver Planos</Button>
              </Link>
              <a href="mailto:suporte@auroratech.tech" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full">Contactar Suporte</Button>
              </a>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
