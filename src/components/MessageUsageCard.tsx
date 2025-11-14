import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, AlertTriangle, CheckCircle } from "lucide-react";

interface MessageUsage {
  used: number;
  limit: number;
  remaining: number;
}

export function MessageUsageCard() {
  const [usage, setUsage] = useState<MessageUsage>({ used: 0, limit: 1000, remaining: 1000 });
  const [loading, setLoading] = useState(true);
  const [planName, setPlanName] = useState<string>("");

  useEffect(() => {
    fetchUsage();

    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar plano do usuário com informações de uso
      const { data: userPlan } = await supabase
        .from('user_plans')
        .select(`
          messages_used_current_month,
          messages_limit,
          plan_type
        `)
        .eq('user_id', user.id)
        .single();

      if (userPlan) {
        const used = userPlan.messages_used_current_month || 0;
        const limit = userPlan.messages_limit || 1000;
        const remaining = Math.max(0, limit - used);

        setUsage({ used, limit, remaining });

        // Converter plan_type para nome exibível
        const planNames: Record<string, string> = {
          basic: 'Basic',
          pro: 'Pro',
          business: 'Business'
        };
        setPlanName(planNames[userPlan.plan_type] || userPlan.plan_type);
      }
    } catch (error) {
      console.error('Erro ao buscar uso de mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  const percentage = (usage.used / usage.limit) * 100;
  const isUnlimited = usage.limit >= 999999;
  const isWarning = percentage >= 80 && !isUnlimited;
  const isDanger = percentage >= 95 && !isUnlimited;

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-8 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold text-lg">Uso de Mensagens</h3>
            {planName && (
              <p className="text-xs text-muted-foreground">Plano {planName}</p>
            )}
          </div>
        </div>
        {isDanger && !isUnlimited && (
          <AlertTriangle className="h-5 w-5 text-destructive" />
        )}
        {isWarning && !isDanger && !isUnlimited && (
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
        )}
        {!isWarning && !isUnlimited && (
          <CheckCircle className="h-5 w-5 text-green-500" />
        )}
      </div>

      {isUnlimited ? (
        <div className="space-y-2">
          <div className="flex items-center justify-center py-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">∞</p>
              <p className="text-sm text-muted-foreground mt-2">
                Mensagens ilimitadas
              </p>
            </div>
          </div>
          <div className="text-xs text-center text-muted-foreground">
            Enviadas este mês: {usage.used.toLocaleString()}
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            <Progress
              value={percentage}
              className={`h-3 ${
                isDanger
                  ? '[&>div]:bg-destructive'
                  : isWarning
                  ? '[&>div]:bg-yellow-500'
                  : ''
              }`}
            />
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {usage.used.toLocaleString()} / {usage.limit.toLocaleString()}
              </span>
              <span className="text-muted-foreground">
                {percentage.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Mensagens restantes:</span>
            <span className={`font-semibold ${
              isDanger ? 'text-destructive' : isWarning ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {usage.remaining.toLocaleString()}
            </span>
          </div>

          {isDanger && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-xs text-destructive font-medium">
                ⚠️ Você está próximo do limite! Considere fazer upgrade do seu plano.
              </p>
            </div>
          )}

          {isWarning && !isDanger && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
              <p className="text-xs text-yellow-700 dark:text-yellow-600 font-medium">
                ⚠️ Você usou mais de 80% do seu limite mensal.
              </p>
            </div>
          )}

          <div className="mt-3 text-xs text-muted-foreground text-center">
            Contador reseta no início de cada mês
          </div>
        </>
      )}
    </Card>
  );
}
