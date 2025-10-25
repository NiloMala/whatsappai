import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Download, TrendingUp, MessageSquare, Clock, Users, Loader2 } from "lucide-react";

const formatResponseTime = (seconds: number) => {
  if (seconds === 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (remainingSeconds === 0) return `${minutes}min`;
  return `${minutes}min ${remainingSeconds}s`;
};

const Statistics = () => {
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [chartData, setChartData] = useState<any[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [totals, setTotals] = useState({
    received: 0,
    sent: 0,
    avgResponse: 0,
    activeContacts: 0,
  });

  useEffect(() => {
    fetchStatistics();
  }, [timeRange]);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ Usuário não autenticado');
        return;
      }

      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      
      const fromDateStr = fromDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      const toDateStr = new Date().toISOString().split('T')[0];

      console.log('📊 Buscando estatísticas...');
      console.log('👤 User ID:', user.id);
      console.log('📅 Período:', fromDateStr, 'até', toDateStr);

      // Call the database function to get real-time statistics from messages table
      // This computes stats only for messages sent via platform (agent or AI)
      const { data, error } = await supabase.rpc('get_user_statistics', {
        p_user_id: user.id,
        p_from_date: fromDateStr,
        p_to_date: toDateStr
      });

      console.log('📦 Resposta da função:', data);
      console.log('❌ Erro (se houver):', error);

      if (error) {
        console.error("Erro ao carregar estatísticas:", error);
        
        // Se a função não existe, mostrar mensagem específica
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          toast({
            title: "Função não encontrada",
            description: "Execute a migration 20251022000000_add_statistics_functions.sql no SQL Editor do Supabase.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro",
            description: `Erro ao carregar estatísticas: ${error.message}`,
            variant: "destructive",
          });
        }
        
        setRawData([]);
        setChartData([]);
        setTotals({ received: 0, sent: 0, avgResponse: 0, activeContacts: 0 });
        return;
      }

      if (Array.isArray(data) && data.length > 0) {
        console.log('✅ Dados recebidos:', data.length, 'registros');
        setRawData(data);

        // garantir números e evitar undefined
        const totalsCalc = data.reduce(
          (acc, stat) => ({
            received: acc.received + Number(stat.messages_received || 0),
            sent: acc.sent + Number(stat.messages_sent || 0),
            avgResponse: acc.avgResponse + Number(stat.avg_response_time_seconds || 0),
            activeContacts: Math.max(acc.activeContacts, Number(stat.active_contacts || 0)),
          }),
          { received: 0, sent: 0, avgResponse: 0, activeContacts: 0 }
        );

        setTotals({
          ...totalsCalc,
          avgResponse: data.length > 0 ? Math.round(totalsCalc.avgResponse / data.length) : 0,
        });

        setChartData(
          data.map((stat) => ({
            date: new Date(stat.date).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            }),
            recebidas: Number(stat.messages_received || 0),
            enviadas: Number(stat.messages_sent || 0),
            resposta: Number(stat.avg_response_time_seconds || 0),
          }))
        );
      } else {
        // sem dados
        console.log('⚠️ Nenhum dado retornado da função');
        console.log('💡 Verifique se há mensagens na tabela messages para este usuário');
        
        // Verificar se há mensagens no banco
        const { count, error: countError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        
        console.log('📊 Total de mensagens no banco:', count);
        if (countError) console.error('Erro ao contar mensagens:', countError);
        
        setRawData([]);
        setChartData([]);
        setTotals({ received: 0, sent: 0, avgResponse: 0, activeContacts: 0 });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Erro inesperado ao carregar estatísticas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: "Recebidas", value: totals.received, color: "hsl(var(--primary))" },
    { name: "Enviadas", value: totals.sent, color: "hsl(142, 76%, 46%)" },
  ];

  const exportData = () => {
    if (!rawData || rawData.length === 0) {
      toast({ title: "Sem dados", description: "Não há dados para exportar no período selecionado." });
      return;
    }

    try {
      // Construir CSV a partir do rawData
      const headers = ["date", "messages_received", "messages_sent", "avg_response_time_seconds", "active_contacts"];
      const rows = rawData.map((r) => [
        r.date,
        String(r.messages_received || 0),
        String(r.messages_sent || 0),
        String(r.avg_response_time_seconds || 0),
        String(r.active_contacts || 0),
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `statistics_${timeRange}_${new Date().toISOString()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: 'Exportando dados', description: 'O download começou.' });
    } catch (err) {
      console.error('Erro export CSV', err);
      toast({ title: 'Erro', description: 'Não foi possível exportar os dados.', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Estatísticas Detalhadas</h1>
            <p className="text-muted-foreground">
              Analise o desempenho do seu atendimento
            </p>
          </div>

          <div className="flex gap-3">
            <div className="flex gap-2">
              {(["7d", "30d", "90d"] as const).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? "default" : "outline"}
                  onClick={() => setTimeRange(range)}
                >
                  {range === "7d" ? "7 dias" : range === "30d" ? "30 dias" : "90 dias"}
                </Button>
              ))}
            </div>
            <Button variant="outline" onClick={exportData} disabled={loading || rawData.length === 0}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Exportar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <MessageSquare className="h-8 w-8 text-blue-500" />
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="text-sm text-muted-foreground mb-1">
              Total Recebidas
            </h3>
            <p className="text-3xl font-bold">{totals.received}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <MessageSquare className="h-8 w-8 text-primary" />
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="text-sm text-muted-foreground mb-1">
              Total Enviadas
            </h3>
            <p className="text-3xl font-bold">{totals.sent}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Clock className="h-8 w-8 text-orange-500" />
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="text-sm text-muted-foreground mb-1">
              Tempo Médio
            </h3>
            <p className="text-3xl font-bold">{formatResponseTime(totals.avgResponse)}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Users className="h-8 w-8 text-purple-500" />
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="text-sm text-muted-foreground mb-1">
              Contatos Respondidos
            </h3>
            <p className="text-3xl font-bold">{totals.activeContacts}</p>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6">Volume de Mensagens</h2>
            {loading ? (
              <div className="p-6 text-center text-muted-foreground">Carregando...</div>
            ) : chartData.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">Nenhum dado para o período selecionado.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="recebidas" fill="hsl(var(--primary))" />
                  <Bar dataKey="enviadas" fill="hsl(142, 76%, 46%)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6">Distribuição de Mensagens</h2>
            {loading ? (
              <div className="p-6 text-center text-muted-foreground">Carregando...</div>
            ) : pieData.reduce((s, p) => s + p.value, 0) === 0 ? (
              <div className="p-6 text-center text-muted-foreground">Sem dados para distribuição.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Tempo de Resposta ao Longo do Tempo</h2>
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">Carregando...</div>
          ) : chartData.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">Nenhum dado para o período selecionado.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="resposta"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Tempo (segundos)"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Statistics;