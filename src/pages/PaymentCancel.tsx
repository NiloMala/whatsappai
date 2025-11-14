import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaymentCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <XCircle className="w-20 h-20 text-orange-500" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Pagamento Cancelado
        </h1>
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Você cancelou o processo de pagamento. Nenhuma cobrança foi realizada.
        </p>
        
        <div className="space-y-3">
          <Button 
            onClick={() => navigate('/dashboard/plans')}
            className="w-full"
            size="lg"
          >
            Voltar para Planos
          </Button>
          
          <Button 
            onClick={() => navigate('/dashboard')}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Ir para o Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
