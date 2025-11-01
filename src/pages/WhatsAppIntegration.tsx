import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, QrCode, RefreshCw, X } from "lucide-react";

const WhatsAppIntegration = () => {
  const { toast } = useToast();
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userPlanInfo, setUserPlanInfo] = useState<{ planType?: string; maxInstances: number; existingCount: number } | null>(null);
  const [notifiedConnections, setNotifiedConnections] = useState<Set<string>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [instanceToDelete, setInstanceToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections();
  }, []);

  // Fetch plan info and counts on mount
  const loadPlanInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userPlanData } = await supabase
        .from('user_plans')
        .select('plan_type')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      let maxInstances = 1;
      if (userPlanData?.plan_type) {
        const { data: planRow } = await supabase
          .from('plans')
          .select('max_instances')
          .eq('plan_type', userPlanData.plan_type)
          .single();
        
        if (planRow?.max_instances != null) maxInstances = planRow.max_instances;
      }

      const { count } = await supabase
        .from('whatsapp_connections')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const existingCount = typeof count === 'number' ? count : 0;

      setUserPlanInfo({ 
        planType: userPlanData?.plan_type, 
        maxInstances, 
        existingCount 
      });
    } catch (err) {
      console.error('Erro ao carregar info do plano:', err);
    }
  };

  useEffect(() => {
    loadPlanInfo();

    // Re-fetch when the page/tab becomes visible to capture plan changes made elsewhere
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadPlanInfo();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Auto-check status when pairing
  useEffect(() => {
    const pairingConnections = connections.filter(c => c.status === 'pairing');
    if (pairingConnections.length === 0) return;

    const interval = setInterval(() => {
      pairingConnections.forEach(conn => {
        checkConnectionStatus(conn.instance_key);
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [connections]);

  const fetchConnections = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("user_id", user.id)
      .order('created_at', { ascending: false });

    setConnections(data || []);
    
    // Atualizar contagem para o userPlanInfo
    loadPlanInfo();
  };

  const checkConnectionStatus = async (instanceKey: string, showToast = false) => {
    if (!instanceKey) return;

    try {
      // Buscar status anterior antes de verificar
      const previousConnection = connections.find(c => c.instance_key === instanceKey);
      const wasConnected = previousConnection?.status === 'connected';

      const { data } = await supabase.functions.invoke('evolution-instance', {
        body: { 
          action: 'checkStatus',
          instanceKey: instanceKey
        }
      });

      if (data?.instanceDeleted) {
        // Instance was deleted, refresh to clear state
        fetchConnections();
        return;
      }

      // Mostrar toast apenas se:
      // 1. A instância acabou de conectar (não estava conectada antes)
      // 2. OU se foi solicitado manualmente (showToast=true)
      const justConnected = data?.connected && !wasConnected;
      
      if (justConnected && !notifiedConnections.has(instanceKey)) {
        // Marcar como notificado para não repetir
        setNotifiedConnections(prev => new Set(prev).add(instanceKey));
        
        toast({
          title: "WhatsApp conectado!",
          description: `Instância ${instanceKey} está pronta para uso.`,
        });
      } else if (data?.connected && showToast) {
        // Mostrar quando solicitado manualmente
        toast({
          title: "WhatsApp conectado!",
          description: `Instância ${instanceKey} está pronta para uso.`,
        });
      }

      // Se desconectou, remover da lista de notificados para poder notificar na próxima conexão
      if (!data?.connected && wasConnected) {
        setNotifiedConnections(prev => {
          const newSet = new Set(prev);
          newSet.delete(instanceKey);
          return newSet;
        });
      }
      
      // Sempre atualizar a lista após verificar para pegar o status atualizado do banco
      setTimeout(() => fetchConnections(), 1000);
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const handleGenerateInstance = async () => {
    setLoading(true);
    try {
      // Verificar se há um usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Você precisa estar autenticado para criar uma instância');
      }

      // Verificar limite por plano
      const { data: userPlanData, error: userPlanError } = await supabase
        .from('user_plans')
        .select('plan_type')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (userPlanError) {
        console.error('Erro ao buscar plano do usuário:', userPlanError);
      }

      let maxInstances = 1; // default fallback
      const planType = userPlanData ? (userPlanData as any).plan_type : null;
      if (planType) {
        const { data: planRow, error: planError } = await supabase
          .from('plans')
          .select('max_instances')
          .eq('plan_type', planType)
          .single();

        if (planError) {
          console.error('Erro ao buscar dados do plano:', planError);
        } else if (planRow && (planRow as any).max_instances != null) {
          maxInstances = (planRow as any).max_instances;
        }
      }

      // Contar instâncias existentes do usuário
      // Use head:true to request only count when supported by Supabase
      const { error: connError, count: exactCount } = await supabase
        .from('whatsapp_connections')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (connError) {
        console.error('Erro ao contar conexões WhatsApp:', connError);
      }

      const existingCount = typeof exactCount === 'number' ? exactCount : 0;
      console.log('Instâncias existentes:', existingCount, 'limite:', maxInstances);
      
      console.log('🔍 DEBUG: Buscando todas as instâncias do usuário...');
      const { data: debugInstances } = await supabase
        .from('whatsapp_connections')
        .select('id, instance_key, status, created_at')
        .eq('user_id', user.id);
      console.log('🔍 Todas as instâncias no banco:', debugInstances);
      console.log('🔍 Total retornado pela query:', debugInstances?.length || 0);

      if (existingCount >= maxInstances) {
        throw new Error(`Limite de instâncias atingido para seu plano (${maxInstances}). Atualize o plano para criar mais instâncias.`);
      }

      console.log('Chamando function com usuário:', user.id);
      const { data, error } = await supabase.functions.invoke('evolution-instance', {
        body: { action: 'create' }
      });

      // Log do erro completo se houver
      if (error) {
        console.error('Erro completo:', error);
        // Tentar extrair mensagem do servidor
        const errorMessage = data?.error || error.message || 'Erro ao criar instância';
        throw new Error(errorMessage);
      }

      if (data?.error) {
        console.error('Erro da função:', data.error);
        throw new Error(data.error);
      }

      toast({
        title: "Instância criada!",
        description: "Escaneie o QR Code para conectar.",
      });

      fetchConnections();
    } catch (error) {
      console.error('Error creating instance:', error);
      toast({
        title: "Erro",
        description: (error as any)?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQR = async (instanceKey: string) => {
    if (!instanceKey) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('evolution-instance', {
        body: { 
          action: 'refreshQR',
          instanceKey: instanceKey
        }
      });

      if (error) throw error;

      if (data?.error) {
        // If instance was deleted, refresh connection to clear state
        if (data?.instanceDeleted) {
          fetchConnections();
          toast({
            title: "Instância expirada",
            description: "A instância anterior expirou. Crie uma nova instância.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.error);
      }

      toast({
        title: "QR Code atualizado",
        description: "Escaneie novamente para conectar.",
      });

      fetchConnections();
    } catch (error) {
      console.error('Error refreshing QR:', error);
      toast({
        title: "Erro",
        description: (error as any)?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (instanceKey: string) => {
    if (!instanceKey) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('evolution-instance', {
        body: { 
          action: 'disconnect',
          instanceKey: instanceKey
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "WhatsApp desconectado",
        description: "Você pode reconectar a qualquer momento.",
      });

      fetchConnections();
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: "Erro",
        description: (error as any)?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = async (instanceKey: string) => {
    if (!instanceKey) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('evolution-instance', {
        body: { 
          action: 'refreshQR',
          instanceKey: instanceKey
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "QR Code gerado",
        description: "Escaneie o código para reconectar.",
      });

      // Aguardar um pouco mais para o banco atualizar
      setTimeout(() => {
        fetchConnections();
      }, 1500);
    } catch (error) {
      toast({
        title: "Erro",
        description: (error as any)?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setLoading(false), 1500);
    }
  };

  // Open the confirmation modal (replaces native confirm())
  const handleDeleteInstance = (instanceKey: string) => {
    setInstanceToDelete(instanceKey);
    setDeleteModalOpen(true);
  };

  // Called when user confirms deletion in modal
  const confirmDeleteInstance = async () => {
    const instanceKey = instanceToDelete;
    setDeleteModalOpen(false);
    setInstanceToDelete(null);
    if (!instanceKey) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Deletar do banco
      const { error: dbError } = await supabase
        .from('whatsapp_connections')
        .delete()
        .eq('user_id', user.id)
        .eq('instance_key', instanceKey);

      if (dbError) throw dbError;

      // Tentar deletar da API Evolution (pode falhar se já foi deletado)
      try {
        await supabase.functions.invoke('evolution-instance', {
          body: { 
            action: 'delete',
            instanceKey: instanceKey
          }
        });
      } catch (apiError) {
        console.log('Erro ao deletar da API Evolution (pode já estar deletado):', apiError);
      }

      toast({
        title: "Instância deletada",
        description: "A instância foi removida com sucesso.",
      });

      fetchConnections();
    } catch (error) {
      console.error('Error deleting instance:', error);
      toast({
        title: "Erro",
        description: (error as any)?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold mb-2">Integração WhatsApp</h1>
            <p className="text-muted-foreground">
              Conecte seus WhatsApps via Evolution API
            </p>
          </div>
          
          {userPlanInfo && (
            <div className="text-right text-sm">
              <p className="font-medium">Plano: {userPlanInfo.planType?.toUpperCase() || 'Basic'}</p>
              <p className="text-muted-foreground">
                {userPlanInfo.existingCount}/{userPlanInfo.maxInstances} instâncias
              </p>
            </div>
          )}
        </div>

        {/* Debug info */}
        {userPlanInfo && (
          <Card className="p-3 bg-muted/30">
            <div className="flex items-center gap-4 text-xs">
              <div><strong>Plano:</strong> {userPlanInfo.planType || 'Nenhum'}</div>
              <div><strong>Limite:</strong> {userPlanInfo.maxInstances}</div>
              <div><strong>Existentes:</strong> {userPlanInfo.existingCount}</div>
              <div><strong>Disponíveis:</strong> {userPlanInfo.maxInstances - userPlanInfo.existingCount}</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadPlanInfo}
                disabled={loading}
                className="ml-auto"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        )}

        {/* Botão para criar nova instância */}
        {userPlanInfo && userPlanInfo.existingCount < userPlanInfo.maxInstances && (
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 text-primary" />
                <div>
                  <h4 className="font-semibold text-sm">Criar Nova Instância</h4>
                  <p className="text-xs text-muted-foreground">
                    Você pode criar mais {userPlanInfo.maxInstances - userPlanInfo.existingCount} instância(s)
                  </p>
                </div>
              </div>
              <Button
                onClick={handleGenerateInstance}
                disabled={loading}
                className="bg-gradient-to-r from-primary to-primary/90"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Criar Instância
              </Button>
            </div>
          </Card>
        )}

        {/* Aviso de excesso de instâncias (downgrade) */}
        {userPlanInfo && userPlanInfo.existingCount > userPlanInfo.maxInstances && (
          <Card className="p-4 bg-red-500/10 border-red-500/20">
            <div className="flex items-start gap-3">
              <MessageCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-red-700 dark:text-red-500">
                  ⚠️ Você tem mais instâncias do que seu plano permite
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Seu plano {userPlanInfo.planType || 'atual'} permite apenas {userPlanInfo.maxInstances} instância(s), 
                  mas você tem {userPlanInfo.existingCount} instância(s) ativa(s).
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
                  Por favor, delete {userPlanInfo.existingCount - userPlanInfo.maxInstances} instância(s) ou faça upgrade do seu plano.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Lista de instâncias */}
        {connections.length === 0 ? (
          <Card className="p-8">
            <div className="text-center space-y-4">
              <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
              <div>
                <h3 className="font-bold text-lg">Nenhuma instância criada</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Clique no botão acima para criar sua primeira instância WhatsApp
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {connections.map((conn, index) => (
              <Card key={conn.id} className="p-6">
                <div className="space-y-4">
                  {/* Header da instância */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          conn.status === "connected"
                            ? "bg-green-500 animate-pulse"
                            : conn.status === "pairing"
                            ? "bg-yellow-500 animate-pulse"
                            : "bg-gray-400"
                        }`}
                      />
                      <div>
                        <h3 className="font-bold">Instância #{index + 1}</h3>
                        <p className="text-xs text-muted-foreground">
                          {conn.status === "connected"
                            ? "Conectado"
                            : conn.status === "pairing"
                            ? "Aguardando pareamento"
                            : "Desconectado"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Info da instância */}
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Instance Key</Label>
                      <Input 
                        value={conn.instance_key} 
                        readOnly 
                        className="text-xs h-8"
                      />
                    </div>
                    {conn.phone_number && (
                      <div>
                        <Label className="text-xs">Número</Label>
                        <Input 
                          value={conn.phone_number} 
                          readOnly 
                          className="text-xs h-8 font-medium"
                        />
                      </div>
                    )}
                  </div>

                  {/* QR Code - se não conectado */}
                  {conn.status !== "connected" && conn.qr_code && (
                    <div className="bg-muted/30 p-4 rounded-lg">
                      <div className="text-center space-y-3">
                        <p className="text-xs font-medium">Escaneie para conectar</p>
                        <div className="flex justify-center">
                          <img
                            src={conn.qr_code.startsWith('data:') ? conn.qr_code : `data:image/png;base64,${conn.qr_code}`}
                            alt="QR Code"
                            className="rounded-lg border max-w-[200px]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status card - se conectado */}
                  {conn.status === "connected" && (
                    <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg text-center">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        ✓ WhatsApp Conectado
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Pronto para enviar e receber mensagens
                      </p>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      {/* Botão verificar status - sempre visível */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => checkConnectionStatus(conn.instance_key, true)}
                        disabled={loading}
                        className="flex-1"
                      >
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Verificar Status
                      </Button>
                      
                      {conn.status !== "connected" && conn.qr_code && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateQR(conn.instance_key)}
                          disabled={loading}
                          className="flex-1"
                        >
                          <RefreshCw className="mr-2 h-3 w-3" />
                          Atualizar QR
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {conn.status === "disconnected" && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleReconnect(conn.instance_key)}
                          disabled={loading}
                          className="flex-1"
                        >
                          <QrCode className="mr-2 h-3 w-3" />
                          Reconectar
                        </Button>
                      )}
                      
                      {conn.status === "connected" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnect(conn.instance_key)}
                          disabled={loading}
                          className="flex-1"
                        >
                          <X className="mr-2 h-3 w-3" />
                          Desconectar
                        </Button>
                      )}
                    </div>
                    
                    {/* Botão deletar - sempre visível */}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteInstance(conn.instance_key)}
                      disabled={loading}
                      className="w-full"
                    >
                      <X className="mr-2 h-3 w-3" />
                      Deletar Instância
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Delete confirmation modal */}
        <Dialog open={deleteModalOpen} onOpenChange={(open) => { if (!open) { setInstanceToDelete(null); } setDeleteModalOpen(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar exclusão</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              <p>Tem certeza que deseja deletar a instância <strong>{instanceToDelete}</strong>? Esta ação removerá a instância do seu painel e pode remover dados relacionados.</p>
            </div>
            <DialogFooter>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setDeleteModalOpen(false); setInstanceToDelete(null); }}>Cancelar</Button>
                <Button variant="destructive" onClick={() => void confirmDeleteInstance()}>Deletar instância</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Aviso de limite atingido */}
        {userPlanInfo && userPlanInfo.existingCount >= userPlanInfo.maxInstances && (
          <Card className="p-4 bg-yellow-500/10 border-yellow-500/20">
            <div className="flex items-start gap-3">
              <MessageCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-yellow-700 dark:text-yellow-500">
                  Limite de instâncias atingido
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Seu plano {userPlanInfo.planType || 'atual'} permite até {userPlanInfo.maxInstances} instância(s). 
                  Para criar mais instâncias, faça upgrade do seu plano.
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6 bg-muted/30">
          <h3 className="font-bold mb-3">Como conectar?</h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Clique em "Criar Instância" para criar uma nova conexão</li>
            <li>Um QR Code será exibido no card da instância</li>
            <li>Abra o WhatsApp no seu celular</li>
            <li>Vá em Configurações → Aparelhos conectados</li>
            <li>Toque em "Conectar um aparelho"</li>
            <li>Escaneie o QR Code exibido</li>
            <li>Aguarde a confirmação de conexão</li>
          </ol>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppIntegration;