import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface TrialExpiredModalProps {
  open: boolean;
  onUpgrade: () => void;
}

export const TrialExpiredModal = ({ open, onUpgrade }: TrialExpiredModalProps) => {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-2xl">Período de Teste Expirado</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            Seu período de teste de 3 dias expirou. Para continuar usando o WhatsAgent AI, você precisa assinar um dos nossos planos.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">Benefícios de assinar:</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Acesso ilimitado a todos os recursos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Suporte técnico prioritário</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Atualizações automáticas e novas funcionalidades</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Integração com múltiplos agentes de IA</span>
            </li>
          </ul>
        </div>

        <AlertDialogFooter>
          <Button
            onClick={onUpgrade}
            className="w-full bg-gradient-to-r from-primary to-primary/90"
            size="lg"
          >
            Ver Planos e Assinar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
