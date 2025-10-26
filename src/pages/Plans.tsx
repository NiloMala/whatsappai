import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";

type Plan = {
  id: string;
  name: string;
  plan_type: "basic" | "pro" | "business";
  price: number;
  max_instances: number;
  max_agents: number;
  support_level: string;
};

type UserPlan = {
  id: string;
  plan_type: "basic" | "pro" | "business";
  status: string;
};

const Plans = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    fetchPlans();
    fetchUserPlan();
  }, []);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .order("price");

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar planos",
        variant: "destructive",
      });
      return;
    }

    setPlans(data || []);
  };

  const fetchUserPlan = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Fetch active or trial plan. Use maybeSingle() to avoid PostgREST 406 when no rows.
    const { data, error } = await supabase
      .from('user_plans')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'trial'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // PostgREST returns 406 if the client asked for a single object but none exist.
    // maybeSingle() avoids that and returns null when there are no rows.
    if (error) {
      // Log non-empty-result errors for debugging
      console.error("Error fetching user plan:", error);
    }

    setUserPlan(data || null);
    setLoading(false);
  };

  const handleSelectPlan = async (planType: "basic" | "pro" | "business") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update existing plan or insert new one
    if (userPlan) {
      const { error } = await supabase
        .from('user_plans')
        .update({ plan_type: planType })
        .eq('id', userPlan.id);

      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
    } else {
      const { error } = await supabase
        .from('user_plans')
        .insert({ user_id: user.id, plan_type: planType });

      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
    }

    toast({
      title: "Plano atualizado!",
      description: "Seu plano foi atualizado com sucesso.",
    });

    fetchUserPlan();
  };

  const handleStartTrial = async (planType: "basic" | "pro" | "business") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    if (userPlan) {
      const { error } = await supabase
        .from('user_plans')
        .update({ plan_type: planType, status: 'trial', trial_expires_at: expiresAt })
        .eq('id', userPlan.id);

      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
    } else {
      const { error } = await supabase
        .from('user_plans')
        .insert({ user_id: user.id, plan_type: planType, status: 'trial', trial_expires_at: expiresAt });

      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
    }

    toast({ title: 'Teste iniciado', description: 'Seu teste gratuito de 3 dias começou.' });
    fetchUserPlan();
  };

  const handleSubscribe = async (planType: string) => {
    // Use Supabase Edge Function to create Stripe Checkout session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });

    setSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { planType, userId: user.id }
      });

      setSubscribing(false);

      if (error) {
        console.error('Error creating checkout session:', error);
        toast({ title: 'Erro', description: error.message || 'Falha ao criar sessão de pagamento', variant: 'destructive' });
        return;
      }

      // data should contain { sessionUrl }
      if (data?.sessionUrl) {
        window.location.href = data.sessionUrl;
      } else {
        toast({ title: 'Erro', description: 'Falha ao criar sessão de pagamento', variant: 'destructive' });
      }
    } catch (err: any) {
      setSubscribing(false);
      toast({ title: 'Erro', description: err.message || String(err), variant: 'destructive' });
    }
  };

  const handleCancelSubscription = async (immediate = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });

    if (!userPlan) return toast({ title: 'Erro', description: 'Nenhuma assinatura ativa encontrada', variant: 'destructive' });

    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        body: { userId: user.id, immediate }
      });

      if (error) {
        console.error('Cancel subscription error:', error);
        return toast({ title: 'Erro', description: error.message || 'Falha ao cancelar assinatura', variant: 'destructive' });
      }

      toast({ title: 'Pedido recebido', description: 'Sua solicitação de cancelamento foi processada.' });
      fetchUserPlan();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro', description: err.message || String(err), variant: 'destructive' });
    }
  };

  const getPlanColor = (planType: string) => {
    switch (planType) {
      case "basic":
        return "from-green-500 to-green-600";
      case "pro":
        return "from-blue-500 to-blue-600";
      case "business":
        return "from-purple-500 to-purple-600";
      default:
        return "from-gray-500 to-gray-600";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Planos</h1>
          <p className="text-muted-foreground">Escolha o plano ideal para o seu negócio</p>
          {userPlan && (
            <p className="mt-2 text-sm text-primary font-medium">
              Plano atual: {plans.find(p => p.plan_type === userPlan.plan_type)?.name}
            </p>
          )}
          {userPlan && userPlan.status === 'active' && (
            <div className="mt-3 flex items-center gap-2">
              <Button variant="destructive" size="sm" onClick={() => handleCancelSubscription(false)}>
                Cancelar (no fim do período)
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleCancelSubscription(true)}>
                Cancelar agora
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = userPlan?.plan_type === plan.plan_type;
            
            return (
              <Card
                key={plan.id}
                className={`p-6 relative overflow-hidden ${
                  isCurrentPlan ? "border-primary border-2" : ""
                }`}
              >
                {isCurrentPlan && (
                  <div className="absolute top-4 right-4">
                    <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                      Plano Atual
                    </div>
                  </div>
                )}

                <div
                  className={`h-2 w-full bg-gradient-to-r ${getPlanColor(
                    plan.plan_type
                  )} mb-6 rounded-full`}
                />

                <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold">
                    R$ {plan.price.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">/mês</span>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>{plan.max_instances} instância{plan.max_instances > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span>{plan.max_agents} agente{plan.max_agents > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    <span className="text-sm">{plan.support_level}</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  variant={isCurrentPlan ? "outline" : "default"}
                  onClick={() => handleSelectPlan(plan.plan_type)}
                  disabled={isCurrentPlan}
                >
                  {isCurrentPlan ? "Plano Atual" : "Selecionar Plano"}
                </Button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleStartTrial(plan.plan_type)}
                    disabled={isCurrentPlan || (userPlan?.status === 'trial')}
                  >
                    Teste grátis 3 dias
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => handleSubscribe(plan.plan_type)}
                    disabled={subscribing}
                  >
                    Assinar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-8">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Plans;
