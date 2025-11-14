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
import { TrendingUp, MessageSquare, Clock, Users, Loader2, FileText } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  const exportToPDF = async () => {
    if (!rawData || rawData.length === 0) {
      toast({ title: "Sem dados", description: "Não há dados para exportar no período selecionado." });
      return;
    }

    try {
      const doc = new jsPDF();

      // Header com logo e título
      doc.setFillColor(79, 70, 229); // Primary color
      doc.rect(0, 0, 220, 40, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Estatísticas', 105, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const periodText = timeRange === "7d" ? "Últimos 7 dias" : timeRange === "30d" ? "Últimos 30 dias" : "Últimos 90 dias";
      doc.text(periodText, 105, 30, { align: 'center' });

      // Data de geração
      doc.setFontSize(9);
      const now = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${now}`, 105, 36, { align: 'center' });

      // Reset cor do texto
      doc.setTextColor(0, 0, 0);

      // Resumo executivo
      let yPos = 50;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo Executivo', 14, yPos);

      yPos += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      // Cards de resumo em grid
      const cardWidth = 45;
      const cardHeight = 25;
      const gap = 5;

      // Card 1 - Mensagens Recebidas
      doc.setFillColor(59, 130, 246); // Blue
      doc.roundedRect(14, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text('Total Recebidas', 16, yPos + 6);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(String(totals.received), 16, yPos + 17);

      // Card 2 - Mensagens Enviadas
      doc.setFillColor(34, 197, 94); // Green
      doc.roundedRect(14 + cardWidth + gap, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Total Enviadas', 16 + cardWidth + gap, yPos + 6);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(String(totals.sent), 16 + cardWidth + gap, yPos + 17);

      // Card 3 - Tempo Médio
      doc.setFillColor(249, 115, 22); // Orange
      doc.roundedRect(14 + (cardWidth + gap) * 2, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Tempo Médio', 16 + (cardWidth + gap) * 2, yPos + 6);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(formatResponseTime(totals.avgResponse), 16 + (cardWidth + gap) * 2, yPos + 17);

      // Card 4 - Contatos Ativos
      doc.setFillColor(168, 85, 247); // Purple
      doc.roundedRect(14 + (cardWidth + gap) * 3, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Contatos Ativos', 16 + (cardWidth + gap) * 3, yPos + 6);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(String(totals.activeContacts), 16 + (cardWidth + gap) * 3, yPos + 17);

      // Reset cor
      doc.setTextColor(0, 0, 0);

      // Tabela de dados detalhados
      yPos += cardHeight + 15;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Dados Detalhados', 14, yPos);

      yPos += 5;

      autoTable(doc, {
        startY: yPos,
        head: [['Data', 'Recebidas', 'Enviadas', 'Tempo Resp.', 'Contatos']],
        body: rawData.map((r) => [
          new Date(r.date).toLocaleDateString('pt-BR'),
          String(r.messages_received || 0),
          String(r.messages_sent || 0),
          formatResponseTime(r.avg_response_time_seconds || 0),
          String(r.active_contacts || 0),
        ]),
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10,
        },
        bodyStyles: {
          fontSize: 9,
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        margin: { left: 14, right: 14 },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Página ${i} de ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      // Salvar PDF
      const filename = `relatorio_estatisticas_${timeRange}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      toast({
        title: 'PDF Gerado!',
        description: 'O relatório foi baixado com sucesso.'
      });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar o PDF.',
        variant: 'destructive'
      });
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
            <Button variant="outline" onClick={exportToPDF} disabled={loading || rawData.length === 0}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Exportar PDF
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