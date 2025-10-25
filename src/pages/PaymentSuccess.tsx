import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Opcional: fazer uma chamada para verificar o status do pagamento
    console.log('Payment session ID:', sessionId);
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle className="w-20 h-20 text-green-500" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Pagamento Confirmado!
        </h1>
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Sua assinatura foi ativada com sucesso. Você já pode começar a usar todos os recursos do seu plano.
        </p>
        
        {sessionId && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            ID da sessão: {sessionId.substring(0, 20)}...
          </p>
        )}
        
        <div className="space-y-3">
          <Button 
            onClick={() => navigate('/dashboard')}
            className="w-full"
            size="lg"
          >
            Ir para o Dashboard
          </Button>
          
          <Button 
            onClick={() => navigate('/dashboard/agents')}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Criar meu Primeiro Agente
          </Button>
        </div>
      </div>
    </div>
  );
}
