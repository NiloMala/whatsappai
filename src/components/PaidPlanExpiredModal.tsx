import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";

interface PaidPlanExpiredModalProps {
  open: boolean;
  onRenew: () => void;
}

export const PaidPlanExpiredModal = ({ open, onRenew }: PaidPlanExpiredModalProps) => {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10">
              <CreditCard className="h-6 w-6 text-orange-500" />
            </div>
            <AlertDialogTitle className="text-2xl">Plano Vencido</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            Seu plano expirou e o período de carência de 3 dias terminou. Para continuar usando o WhatsAgent AI, você precisa renovar sua assinatura.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">O que aconteceu:</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-orange-500">•</span>
              <span>Suas instâncias do WhatsApp foram desconectadas</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500">•</span>
              <span>O acesso aos recursos foi bloqueado</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500">•</span>
              <span>Seus dados estão seguros e serão restaurados após renovação</span>
            </li>
          </ul>
        </div>

        <div className="my-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <h4 className="font-semibold mb-2 text-primary">Ao renovar, você terá novamente:</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Acesso ilimitado a todos os recursos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Reconexão automática das suas instâncias</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Suporte técnico prioritário</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Continuidade do seu histórico e configurações</span>
            </li>
          </ul>
        </div>

        <AlertDialogFooter>
          <Button
            onClick={onRenew}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            size="lg"
          >
            Renovar Plano Agora
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
