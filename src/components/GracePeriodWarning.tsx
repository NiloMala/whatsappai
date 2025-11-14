import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface GracePeriodWarningProps {
  daysRemaining: number;
}

export const GracePeriodWarning = ({ daysRemaining }: GracePeriodWarningProps) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-4 relative">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm md:text-base">
              Seu plano expirou! Período de carência: {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'} restante{daysRemaining === 1 ? '' : 's'}
            </p>
            <p className="text-xs md:text-sm opacity-90 mt-1">
              Renove agora para evitar a desconexão das suas instâncias do WhatsApp
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/dashboard/plans')}
            variant="secondary"
            size="sm"
            className="bg-white text-orange-600 hover:bg-gray-100 font-semibold whitespace-nowrap"
          >
            Renovar Agora
          </Button>

          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Fechar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
