import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";

const CompleteProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    phone: "",
  });
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    checkUserAndProfile();
  }, []);

  const checkUserAndProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      setUserEmail(session.user.email || "");

      // Check if profile already has company_name and phone
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('company_name, phone')
        .eq('id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }

      // If profile is complete, redirect to dashboard
      if (profile && profile.company_name && profile.company_name.trim() !== '' && profile.phone && profile.phone.trim() !== '') {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error('Error checking profile:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.companyName || formData.companyName.trim().length === 0) {
        toast({
          title: "Campo obrigatório",
          description: "O nome da empresa é obrigatório.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!formData.phone || formData.phone.trim().length === 0) {
        toast({
          title: "Campo obrigatório",
          description: "O telefone é obrigatório.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não encontrado");

      // Update profile with company name and phone
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          company_name: formData.companyName.trim(),
          phone: formData.phone.trim(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast({
        title: "Perfil completado!",
        description: "Suas informações foram salvas com sucesso.",
      });

      navigate("/dashboard");
    } catch (error: any) {
      console.error('Complete profile error:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar suas informações. Tente novamente.",
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
          <h1 className="text-2xl font-bold">Complete seu Perfil</h1>
          <p className="text-muted-foreground text-center">
            Para continuar, precisamos de algumas informações adicionais
          </p>
        </div>

        {userEmail && (
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Conectado como:</p>
            <p className="font-medium">{userEmail}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Nome da Empresa *</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) =>
                setFormData({ ...formData, companyName: e.target.value })
              }
              required
              placeholder="Sua empresa"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              O nome da sua empresa ou negócio
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              required
              placeholder="(00) 00000-0000"
            />
            <p className="text-xs text-muted-foreground">
              Seu telefone de contato
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-primary/90"
            disabled={loading}
          >
            {loading ? "Salvando..." : "Continuar"}
          </Button>
        </form>

        <div className="text-center">
          <Button
            variant="link"
            className="text-sm"
            onClick={() => {
              supabase.auth.signOut();
              navigate("/auth");
            }}
          >
            Sair
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default CompleteProfile;
