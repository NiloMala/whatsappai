import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TermsContent } from "./Terms";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">(
    (searchParams.get("mode") as "login" | "signup") || "login"
  );
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    companyName: "",
    phone: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        // Frontend validation: company name and phone are required before calling signup
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
        if (!acceptedTerms) {
          toast({
            title: "Aceite necessário",
            description: "Você precisa aceitar os Termos de Uso e a Política de Privacidade para criar uma conta.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              company_name: formData.companyName,
            },
          },
        });

        // Handle common signup errors explicitly (rate limits, etc.) so we
        // can show user-friendly messages in Portuguese and avoid throwing
        // raw errors that bubble up to the generic catch below.
        if (signUpError) {
          console.error('signUp error:', signUpError);
          const msg = (signUpError.message || '').toLowerCase();
          const status = (signUpError as any)?.status;

          if (status === 429 || /rate limit|too many requests/.test(msg)) {
            toast({
              title: 'Muitas solicitações',
              description:
                'Limite de envio de e-mails atingido. Aguarde alguns minutos antes de tentar novamente. Se o problema persistir, verifique a configuração do provedor de email (SMTP) no painel do Supabase ou entre em contato com o suporte.',
              variant: 'destructive',
            });
            setLoading(false);
            return;
          }

          // Fallback: rethrow to be handled by outer catch which shows a
          // friendly generic message (already localized).
          throw signUpError;
        }

        if (authData.user) {
          // After sign up, a session may or may not be created depending on
          // Supabase auth settings (email confirmations). If there's an
          // active session we create the profile immediately. Otherwise we
          // skip creating the profile here (user must confirm email first)
          // to avoid unauthenticated REST calls which return 401.
          const { data: sessionData } = await supabase.auth.getSession();
          const session = sessionData?.session;

          if (session) {
            // Create profile now that we have an authenticated session
            const { error: profileError } = await (supabase as any)
              .from("profiles")
              .insert({
                id: authData.user.id,
                company_name: formData.companyName,
                email: formData.email,
                phone: formData.phone,
              });

            if (profileError) {
              // If profile insertion fails (403 / RLS or similar), the user
              // account may still have been created and the confirmation
              // email delivered. Show a clear message and navigate to
              // dashboard so user can continue; request them to complete
              // profile manually.
              console.error('Profile insert failed after signup:', profileError);
              toast({
                title: 'Conta criada (parcial)',
                description:
                  'Sua conta foi criada e o e-mail de confirmação enviado, mas não foi possível criar seu perfil automaticamente. Após confirmar o e-mail, acesse Perfil para completar seus dados.',
                variant: 'destructive',
              });
              navigate('/dashboard');
            } else {
              toast({
                title: "Conta criada com sucesso!",
                description: "Você já está logado e pode começar.",
              });
              navigate("/dashboard");
            }
          } else {
            // No session (likely email confirmation required) — do not call
            // the REST insert to avoid 401. Inform the user to confirm email.
            toast({
              title: "Confirme seu e-mail",
              description:
                "Verifique seu e-mail caixa de entrada e spam, confirme a conta antes de prosseguir. Após confirmação, acesse o app.",
            });
            navigate("/auth");
          }
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (signInError) {
          console.error('signIn error:', signInError);
          // Mostrar mensagem específica para credenciais inválidas
          toast({
            title: "E-mail ou senha incorretos",
            description: "Verifique suas credenciais e tente novamente.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        toast({
          title: "Login realizado!",
          description: "Bem-vindo de volta.",
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
      setResetDialogOpen(false);
      setResetEmail("");
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o e-mail de redefinição. Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <MessageSquare className="h-12 w-12 text-primary" />
          <h1 className="text-2xl font-bold">WhatsApp AI</h1>
          <p className="text-muted-foreground text-center">
            {mode === "login"
              ? "Entre na sua conta"
              : "Crie sua conta e comece agora"}
          </p>
        </div>
        <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Termos de Uso e Política de Privacidade</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
                <TermsContent onClose={() => setTermsOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="companyName">Nome da Empresa</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                  required
                  placeholder="Sua empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
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
              </div>
              
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
              placeholder="seu@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          {mode === 'signup' && (
            <div className="flex items-start gap-2 mt-3">
              <Checkbox
                id="acceptedTerms"
                checked={acceptedTerms}
                onCheckedChange={(val: any) => setAcceptedTerms(!!val)}
              />
              <label htmlFor="acceptedTerms" className="text-sm text-gray-600 dark:text-gray-300">
                Li e concordo com os <button type="button" onClick={() => setTermsOpen(true)} className="text-blue-600 dark:text-blue-400 underline">Termos de Uso</button> e a <button type="button" onClick={() => setTermsOpen(true)} className="text-blue-600 dark:text-blue-400 underline">Política de Privacidade</button>.
              </label>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-primary/90"
            disabled={loading}
          >
            {loading
              ? "Aguarde..."
              : mode === "login"
              ? "Entrar"
              : "Criar Conta"}
          </Button>
        </form>

        <div className="text-center space-y-2">
          {mode === "login" && (
            <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="link" className="text-sm">
                  Esqueceu a senha?
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Redefinir Senha</DialogTitle>
                  <DialogDescription>
                    Digite seu email para receber um link de redefinição de senha.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="resetEmail">E-mail</Label>
                    <Input
                      id="resetEmail"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      placeholder="seu@email.com"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={resetLoading}
                  >
                    {resetLoading ? "Enviando..." : "Enviar Link"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Button
            variant="link"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-sm"
          >
            {mode === "login"
              ? "Não tem conta? Cadastre-se"
              : "Já tem conta? Entre"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Auth;