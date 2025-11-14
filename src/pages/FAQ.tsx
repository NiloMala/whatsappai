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
                <strong>Crie seu agente:</strong> agora vá em <Link to="/dashboard/agents" className="text-blue-600 dark:text-blue-400">Menu &gt; Agentes</Link> e clique em <em>Criar Agente</em>. Sua instância será selecionada automaticamente (caso não seja, cole a <em>Instance Key</em> no campo indicado). Preencha nome do agente, tipo de linguagem, descrição e prompt. Escolha o Modelo de IA (OpenAI ou Google Gemini) e o Modo de Resposta (Apenas Texto ou Automático para voz). Clique em salvar.
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
            <h2 id="keys" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Modelos de IA e Credenciais</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-3">O WhatsAgent AI utiliza credenciais centralizadas para OpenAI e Google Gemini configuradas pelo administrador. Você não precisa fornecer suas próprias chaves de API.</p>

            <h3 className="font-medium text-gray-800 dark:text-gray-100 mt-3">Modelos Disponíveis</h3>
            <div className="space-y-3 ml-4 mb-3">
              <div>
                <p className="text-gray-700 dark:text-gray-200"><strong>OpenAI (Padrão)</strong></p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Modelo: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">GPT-5-Nano</code></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Rápido, eficiente e com suporte a voz (text-to-speech)</p>
              </div>

              <div>
                <p className="text-gray-700 dark:text-gray-200"><strong>Google Gemini</strong></p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Modelo: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Gemini-2.5-Flash</code></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Modelo avançado do Google com alta performance</p>
              </div>
            </div>

            <h3 className="font-medium text-gray-800 dark:text-gray-100 mt-4">Modo de Resposta</h3>
            <div className="space-y-2 ml-4 mb-3 text-sm text-gray-600 dark:text-gray-300">
              <p><strong>📝 Apenas Texto (Padrão):</strong> O agente sempre responde com mensagens de texto divididas em sentenças.</p>
              <p><strong>🎯 Automático:</strong> O agente responde em áudio quando recebe áudio, e em texto quando recebe texto.</p>
            </div>

            <div className="mt-4 text-gray-600 dark:text-gray-300">
              <strong>Observações:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>As credenciais OpenAI e Google Gemini são gerenciadas centralmente pelo sistema</li>
                <li>Você só precisa escolher o modelo ao criar o agente</li>
                <li>Funcionalidade de voz disponível em ambos os modelos</li>
              </ul>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 id="trial" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Como funciona o período de teste grátis de 3 dias?</h2>
            <div className="space-y-3 text-gray-600 dark:text-gray-300">
              <p>Ao iniciar o teste gratuito de 3 dias, você terá acesso total aos recursos da plataforma sem precisar cadastrar cartão de crédito.</p>
              <ul className="list-disc list-inside">
                <li>Teste começa imediatamente após o cadastro.</li>
                <li>Não é necessário cadastrar cartão de crédito para testar.</li>
                <li>Após os 3 dias, você pode escolher um plano e assinar se quiser continuar usando.</li>
                <li>Sem compromisso, sem cobranças automáticas.</li>
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
            <h2 id="whatsapp" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Integração com WhatsApp</h2>
            <details className="mb-3">
              <summary className="cursor-pointer text-gray-800 dark:text-gray-100 font-medium">Como funciona a integração?</summary>
              <div className="mt-2 text-gray-600 dark:text-gray-300">Oferecemos integração via infraestrutura própria. Você configura sua instância e gerencia agentes que respondem automaticamente via fluxos e modelos de IA.</div>
            </details>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 id="limits" className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Limites dos Planos</h2>
            <div className="space-y-3 text-gray-600 dark:text-gray-300">
              <p>Cada plano possui limites específicos de respostas mensais. Todos os planos incluem 1 instância e 1 agente:</p>
              <ul className="list-disc list-inside ml-4">
                <li><strong>Basic (R$ 69,90/mês):</strong> Até 500 respostas/mês</li>
                <li><strong>Pro (R$ 99,90/mês):</strong> Até 1.000 respostas/mês</li>
                <li><strong>Business (R$ 129,90/mês):</strong> Mensagens ilimitadas + suporte dedicado</li>
              </ul>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Se precisar de mais capacidade ou recursos customizados, entre em contato para um plano personalizado.</p>
            </div>
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
              <li>Agente não está respondendo: Verifique se o agente está ativo e se a instância está conectada ao WhatsApp.</li>
              <li>Problemas com pagamento: Entre em contato com nosso suporte que resolveremos rapidamente.</li>
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
