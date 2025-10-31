import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/DashboardLayout';

export function TermsContent({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto py-6">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">🧾 Termos de Uso — WhatsappIA</h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">Última atualização: 31 de outubro de 2025</p>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Bem-vindo ao WhatsappIA (https://ia.auroratech.tech), uma plataforma desenvolvida e mantida por AuroraTech.</p>
      </header>

      <div className="space-y-6">
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">1. Objeto</h2>
          <p className="text-gray-600 dark:text-gray-300">O WhatsappIA é um software como serviço (SaaS) que oferece automação de mensagens, integração com APIs, e gerenciamento de conversas no WhatsApp, com foco em atendimento automatizado e marketing conversacional.</p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">2. Cadastro e Conta de Usuário</h2>
          <p className="text-gray-600 dark:text-gray-300">Para utilizar os serviços, o usuário deverá criar uma conta, fornecendo informações verídicas, completas e atualizadas. O usuário é responsável por manter a confidencialidade de suas credenciais e por todas as atividades realizadas em sua conta.</p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">3. Uso Permitido</h2>
          <p className="text-gray-600 dark:text-gray-300">É vedado ao usuário:</p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 mt-2">
            <li>Utilizar o sistema para envio de spam, fraudes, ou comunicações não autorizadas;</li>
            <li>Violar direitos de terceiros ou leis aplicáveis;</li>
            <li>Tentar obter acesso não autorizado a partes restritas da plataforma.</li>
          </ul>
          <p className="mt-2 text-gray-600 dark:text-gray-300">A AuroraTech poderá suspender ou encerrar contas que violem estes termos.</p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">4. Serviços de Terceiros</h2>
          <p className="text-gray-600 dark:text-gray-300">O WhatsappIA integra serviços de terceiros, como Evolution API, N8N, Supabase, WhatsApp e Stripe. Cada serviço possui seus próprios termos e políticas, e o usuário deve concordar com eles para utilizar as funcionalidades integradas.</p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">5. Propriedade Intelectual</h2>
          <p className="text-gray-600 dark:text-gray-300">Todo o conteúdo da plataforma (código, design, marcas, textos e logotipos) pertence à AuroraTech ou é licenciado para uso exclusivo. É proibido copiar, reproduzir ou redistribuir qualquer parte sem autorização expressa.</p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">6. Limitação de Responsabilidade</h2>
          <p className="text-gray-600 dark:text-gray-300">A AuroraTech não se responsabiliza por danos decorrentes de uso indevido do sistema, interrupções causadas por serviços de terceiros ou conteúdos enviados por usuários através do sistema. O uso é fornecido “no estado em que se encontra”, sem garantias de desempenho contínuo.</p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">7. Pagamentos e Planos</h2>
          <p className="text-gray-600 dark:text-gray-300">Os serviços pagos são processados por meio da Stripe. Cancelamentos e renovações seguem as regras do plano contratado, disponíveis na interface do sistema.</p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">8. Encerramento de Conta</h2>
          <p className="text-gray-600 dark:text-gray-300">O usuário pode encerrar sua conta a qualquer momento. A AuroraTech reserva-se o direito de suspender ou excluir contas que violem estes Termos.</p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">9. Alterações nos Termos</h2>
          <p className="text-gray-600 dark:text-gray-300">A AuroraTech poderá alterar estes Termos a qualquer momento, publicando a nova versão no site. O uso contínuo após a atualização constitui aceitação automática.</p>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">10. Contato</h2>
          <p className="text-gray-600 dark:text-gray-300">Em caso de dúvidas ou solicitações, entre em contato: <a href="mailto:suporte@auroratech.tech" className="text-blue-600 dark:text-blue-400">suporte@auroratech.tech</a></p>
        </section>

        {/* Privacy Policy */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">🔒 Política de Privacidade — WhatsappIA</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Última atualização: 31 de outubro de 2025</p>

          <div className="mt-4 space-y-4 text-gray-600 dark:text-gray-300">
            <div>
              <h3 className="font-semibold">1. Informações Coletadas</h3>
              <p className="mt-1">Podemos coletar nome completo, e-mail, número de WhatsApp, mensagens enviadas/recebidas via integração, dados de uso (registros de acesso) e dados de pagamento processados pela Stripe.</p>
            </div>

            <div>
              <h3 className="font-semibold">2. Finalidade do Tratamento</h3>
              <p className="mt-1">Os dados são coletados para criar e gerenciar contas, integrar e operar automações com o WhatsApp, enviar comunicações de suporte e marketing, e melhorar nossos serviços.</p>
            </div>

            <div>
              <h3 className="font-semibold">3. Base Legal</h3>
              <p className="mt-1">O tratamento de dados é realizado com base no consentimento do usuário, execução de contrato, cumprimento de obrigações legais e interesse legítimo da AuroraTech.</p>
            </div>

            <div>
              <h3 className="font-semibold">4. Compartilhamento de Dados</h3>
              <p className="mt-1">Os dados podem ser compartilhados com Evolution API, N8N, Supabase, WhatsApp e Stripe, conforme necessário; e com autoridades legais mediante requisição formal. Nenhum dado é vendido a terceiros para fins comerciais.</p>
            </div>

            <div>
              <h3 className="font-semibold">5. Armazenamento e Segurança</h3>
              <p className="mt-1">Os dados são armazenados em servidores seguros e protegidos por autenticação e criptografia. Empregamos medidas técnicas e administrativas para prevenir acessos não autorizados.</p>
            </div>

            <div>
              <h3 className="font-semibold">6. Direitos do Titular</h3>
              <p className="mt-1">Nos termos da LGPD, o usuário pode solicitar acesso, correção ou exclusão de seus dados; revogar consentimento; solicitar portabilidade; ou limitar o tratamento. Solicitações podem ser feitas via <a href="mailto:suporte@auroratech.tech" className="text-blue-600 dark:text-blue-400">suporte@auroratech.tech</a>.</p>
            </div>

            <div>
              <h3 className="font-semibold">7. Uso de Cookies</h3>
              <p className="mt-1">O site pode utilizar cookies para análise, autenticação e personalização. O usuário pode gerenciar ou desativar cookies nas configurações do navegador.</p>
            </div>

            <div>
              <h3 className="font-semibold">8. Retenção de Dados</h3>
              <p className="mt-1">Os dados pessoais são mantidos enquanto a conta estiver ativa ou conforme exigido por obrigações legais e contratuais.</p>
            </div>

            <div>
              <h3 className="font-semibold">9. Alterações na Política</h3>
              <p className="mt-1">Esta Política pode ser atualizada periodicamente. Alterações serão publicadas neste endereço com a data de revisão atualizada.</p>
            </div>

            <div>
              <h3 className="font-semibold">10. Contato</h3>
              <p className="mt-1">Dúvidas sobre esta Política podem ser enviadas para: <a href="mailto:suporte@auroratech.tech" className="text-blue-600 dark:text-blue-400">suporte@auroratech.tech</a></p>
            </div>
          </div>
        </section>

        <div className="flex gap-3 mt-4">
          <Button
            onClick={() => {
              if (onClose) onClose();
              else navigate(-1);
            }}
            className="w-full sm:w-auto"
          >
            Fechar
          </Button>

          <Link to="/" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full">Voltar ao Início</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Terms() {
  return (
    <DashboardLayout>
      <TermsContent />
    </DashboardLayout>
  );
}
