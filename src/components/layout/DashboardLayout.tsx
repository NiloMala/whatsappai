import { ReactNode, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTrialCheck } from "@/hooks/useTrialCheck";
import { TrialExpiredModal } from "@/components/TrialExpiredModal";
import { PaidPlanExpiredModal } from "@/components/PaidPlanExpiredModal";
import { GracePeriodWarning } from "@/components/GracePeriodWarning";
import {
  LayoutDashboard,
  Bot,
  FileText,
  MessageSquare,
  BarChart3,
  Calendar,
  CreditCard,
  HelpCircle,
  LogOut,
  Menu,
  X,
  MessageCircle,
  Users,
  Store,
} from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const { isExpired, loading: trialLoading, isInGracePeriod, gracePeriodDaysRemaining, isPaidPlan } = useTrialCheck();
  const isOnPlansPage = window.location.pathname === '/dashboard/plans';

  const handleUpgradeClick = () => {
    navigate('/dashboard/plans');
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profileData } = await (supabase as any)
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      setProfile(profileData);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate("/auth");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    navigate("/");
  };

  const menuItems = [
    { icon: LayoutDashboard, label: "Visão Geral", path: "/dashboard" },
    { icon: MessageCircle, label: "WhatsApp", path: "/dashboard/whatsapp" },
    { icon: FileText, label: "Templates", path: "/dashboard/templates" },
    { icon: Bot, label: "Agentes IA", path: "/dashboard/agents" },
    { icon: MessageSquare, label: "Mensagens", path: "/dashboard/messages" },
    { icon: FileText, label: "Leads", path: "/dashboard/leads" },
    { icon: BarChart3, label: "Estatísticas", path: "/dashboard/statistics" },
    { icon: Store, label: "Mini Site", path: "/dashboard/minisite" },
    { icon: Calendar, label: "Calendário", path: "/dashboard/calendar" },
    { icon: Users, label: "Perfil", path: "/dashboard/profile" },
    { icon: CreditCard, label: "Planos", path: "/dashboard/plans" },
  { icon: HelpCircle, label: "FAQ", path: "/faq" },
  { icon: FileText, label: "Termos", path: "/terms" },
  
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Trial Expired Modal - only show for trial plans */}
      <TrialExpiredModal open={!trialLoading && isExpired && !isPaidPlan && !isOnPlansPage} onUpgrade={handleUpgradeClick} />

      {/* Paid Plan Expired Modal - only show for paid plans */}
      <PaidPlanExpiredModal open={!trialLoading && isExpired && isPaidPlan && !isOnPlansPage} onRenew={handleUpgradeClick} />

      {/* Grace Period Warning Banner */}
      {!trialLoading && isInGracePeriod && <GracePeriodWarning daysRemaining={gracePeriodDaysRemaining} />}

      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X /> : <Menu />}
            </Button>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-6 w-6 text-primary" />
              <span className="font-bold hidden sm:inline">WhatsApp AI</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard/profile')}
              className="text-sm hidden sm:block text-left max-w-[220px] py-1"
            >
              <p className="font-medium truncate max-w-full -mt-0.5 leading-tight">{profile?.company_name}</p>
              <p className="text-muted-foreground text-xs truncate max-w-full -mt-1">{profile?.email}</p>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/profile')} title="Perfil">
              <Users className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/faq')} title="FAQ">
              <HelpCircle className="h-5 w-5" />
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 fixed md:static inset-y-0 left-0 z-40 w-64 border-r bg-background transition-transform duration-300 ease-in-out`}
        >
          <nav className="flex flex-col gap-2 p-4 mt-16 md:mt-0">
            {menuItems.map((item) => (
              <Button
                key={item.path}
                variant={
                  window.location.pathname === item.path ? "secondary" : "ghost"
                }
                className="justify-start"
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
              >
                <item.icon className="mr-2 h-5 w-5" />
                {item.label}
              </Button>
            ))}
          </nav>
        </aside>

  {/* Main Content */}
  <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default DashboardLayout;