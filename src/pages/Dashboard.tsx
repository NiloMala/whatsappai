import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, Clock, Users, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MessageUsageCard } from "@/components/MessageUsageCard";

interface StatisticsData {
  date: string;
  messages_received: number;
  messages_sent: number;
  avg_response_time_seconds: number;
  active_contacts: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalMessages: 0,
    sentMessages: 0,
    avgResponseTime: 0,
    activeContacts: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [whatsappStatus, setWhatsappStatus] = useState("disconnected");

  useEffect(() => {
    checkProfileCompletion();
  }, []);

  const checkProfileCompletion = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('company_name, phone')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }

      // If profile is incomplete, redirect to complete-profile
      if (!profile || !profile.company_name || profile.company_name.trim() === '' || !profile.phone || profile.phone.trim() === '') {
        navigate('/complete-profile');
      }
    } catch (error) {
      console.error('Error checking profile completion:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate date range (last 7 days)
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7);

      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];

      // Fetch statistics using RPC function (real-time calculation)
      // @ts-ignore - RPC function may not be in generated types yet
      const { data, error } = await supabase.rpc('get_user_statistics', {
        p_user_id: user.id,
        p_from_date: fromDateStr,
        p_to_date: toDateStr
      });

      if (error) {
        console.error('Error fetching statistics:', error);
        return;
      }

      const statisticsData = data as StatisticsData[];

      if (statisticsData && statisticsData.length > 0) {
        const totals = statisticsData.reduce(
          (acc, stat) => ({
            totalMessages: acc.totalMessages + stat.messages_received,
            sentMessages: acc.sentMessages + stat.messages_sent,
            avgResponseTime: acc.avgResponseTime + stat.avg_response_time_seconds,
            activeContacts: acc.activeContacts + stat.active_contacts,
          }),
          { totalMessages: 0, sentMessages: 0, avgResponseTime: 0, activeContacts: 0 }
        );

        setStats({
          totalMessages: totals.totalMessages,
          sentMessages: totals.sentMessages,
          avgResponseTime: Math.round(totals.avgResponseTime / statisticsData.length),
          activeContacts: totals.activeContacts, // Total de contatos únicos nos últimos 7 dias
        });

        setChartData(
          statisticsData.map((stat) => ({
            date: new Date(stat.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
            mensagens: stat.messages_received + stat.messages_sent,
          }))
        );
      }

      // Check WhatsApp connection
      try {
        // @ts-ignore - Table may not be in generated types yet
        const connectionQuery = supabase.from("whatsapp_connections");
        // @ts-ignore
        const { data: connectionData } = await connectionQuery
          .select("status")
          .eq("user_id", user.id)
          .single();

        if (connectionData) {
          // @ts-ignore
          setWhatsappStatus(connectionData.status);
        }
      } catch (error) {
        console.error('Error fetching WhatsApp connection status:', error);
      }
    };

    fetchData();
  }, []);

  const formatResponseTime = (seconds: number) => {
    if (seconds === 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (remainingSeconds === 0) return `${minutes}min`;
    return `${minutes}min ${remainingSeconds}s`;
  };

  const statCards = [
    {
      title: "Mensagens Recebidas",
      value: stats.totalMessages,
      icon: MessageSquare,
      color: "text-blue-500",
    },
    {
      title: "Mensagens Enviadas",
      value: stats.sentMessages,
      icon: Send,
      color: "text-primary",
    },
    {
      title: "Tempo Médio Resposta",
      value: formatResponseTime(stats.avgResponseTime),
      icon: Clock,
      color: "text-orange-500",
    },
    {
      title: "Contatos Respondidos",
      value: stats.activeContacts,
      icon: Users,
      color: "text-purple-500",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Visão Geral</h1>
          <p className="text-muted-foreground">
            Acompanhe o desempenho do seu atendimento automatizado
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => (
            <Card key={stat.title} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="text-sm text-muted-foreground mb-1">{stat.title}</h3>
              <p className="text-3xl font-bold">{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Message Usage Card */}
        <MessageUsageCard />

        {/* WhatsApp Status */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Status do WhatsApp</h2>
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                whatsappStatus === "connected"
                  ? "bg-primary animate-pulse"
                  : "bg-gray-400"
              }`}
            />
            <span className="text-lg">
              {whatsappStatus === "connected"
                ? "Conectado"
                : whatsappStatus === "pairing"
                ? "Pareando..."
                : "Desconectado"}
            </span>
          </div>
        </Card>

        {/* Chart */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Mensagens nos Últimos 7 Dias</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="mensagens"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;