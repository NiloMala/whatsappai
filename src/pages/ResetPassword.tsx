import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const checkRecoveryToken = async () => {
      // Verifica se há um hash na URL (token de reset)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');

      console.log('Recovery check:', { accessToken: !!accessToken, type });

      // Se não tem token de recovery, verifica se está autenticado normalmente
      if (type !== 'recovery') {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Se está autenticado normalmente (não via recovery), redireciona
        if (session && !accessToken) {
          toast({
            title: "Link inválido",
            description: "Este link de redefinição é inválido ou expirou.",
            variant: "destructive",
          });
          navigate("/dashboard");
          return;
        }
        
        // Se não tem token nem sessão, volta para login
        if (!accessToken) {
          toast({
            title: "Link inválido",
            description: "Este link de redefinição é inválido ou expirou.",
            variant: "destructive",
          });
          navigate("/auth");
          return;
        }
      }
    };
    
    checkRecoveryToken();
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      // Fazer logout após redefinir a senha para forçar novo login
      await supabase.auth.signOut();

      toast({
        title: "Senha alterada!",
        description: "Sua senha foi redefinida com sucesso. Faça login com a nova senha.",
      });
      
      navigate("/auth");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível redefinir a senha.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <MessageSquare className="h-12 w-12 text-primary" />
          <h1 className="text-2xl font-bold">Redefinir Senha</h1>
          <p className="text-muted-foreground text-center">
            Digite sua nova senha
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-primary/90"
            disabled={loading}
          >
            {loading ? "Aguarde..." : "Redefinir Senha"}
          </Button>
        </form>

        <div className="text-center">
          <Button
            variant="link"
            onClick={() => navigate("/auth")}
            className="text-sm"
          >
            Voltar para o login
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ResetPassword;
