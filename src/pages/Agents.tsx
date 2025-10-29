import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bot, Plus, Pencil, Trash2, Sparkles, RefreshCw, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { AIModelProvider, AI_MODEL_OPTIONS } from "@/types/ai-models";
import { WorkflowGenerator } from "@/services/workflowGenerator";
import { CredentialsDialog } from "@/components/agents/CredentialsDialog";

const Agents = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [userPlan, setUserPlan] = useState<any>(null);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    language_type: "friendly",
    description: "",
    prompt: "Você é um assistente virtual prestativo e amigável. Responda de forma clara e objetiva.",
    auto_response: true,
    is_active: true,
    provider: "",
    api_key: "",
    ai_model: "openai" as AIModelProvider,
    instance_name: "",
  });

  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [missingCredentials, setMissingCredentials] = useState<string[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<any | null>(null);

  useEffect(() => {
    fetchAgents();
    fetchTemplates();
    fetchUserPlan();
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar conexões WhatsApp:', error);
        return;
      }

      setConnections(data || []);

      // Auto-select when exactly one connection exists and the form doesn't already have a value
      if (data && data.length === 1 && (!formData.instance_name || !formData.instance_name.trim())) {
        setFormData({ ...formData, instance_name: data[0].instance_key || '' });
      }
    } catch (err) {
      console.error('Erro ao buscar conexões:', err);
    }
  };

  const fetchUserPlan = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Fetch user's active or trial plan (prefer active, fall back to trial)
    const { data: userPlanData } = await supabase
      .from("user_plans")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "trial"]) // include trial rows
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!userPlanData) return;

    // If it's a trial, verify it hasn't expired
    if (userPlanData.status === 'trial' && userPlanData.trial_expires_at) {
      const expires = new Date(userPlanData.trial_expires_at);
      const now = new Date();
      if (expires < now) {
        // trial expired — treat as no plan
        return;
      }
    }

    setUserPlan(userPlanData);

    // Fetch plan details
    const { data: planData } = await supabase
      .from("plans")
      .select("*")
      .eq("plan_type", userPlanData.plan_type)
      .single();

    setCurrentPlan(planData);
  };

  const fetchAgents = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar agentes",
        variant: "destructive",
      });
      return;
    }

    setAgents(data || []);
  };

  const fetchTemplates = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar templates",
        variant: "destructive",
      });
      return;
    }

    setTemplates(data || []);
  };

  const checkCredentials = async (aiModel: AIModelProvider): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const requiredServices = [aiModel];

      const { data: creds } = await supabase
        .from('user_credentials')
        .select('service_name')
        .eq('user_id', user.id)
        .in('service_name', requiredServices);

      const existingServices = creds?.map(c => c.service_name) || [];
      const missing = requiredServices.filter(s => !existingServices.includes(s));

      if (missing.length > 0) {
        setMissingCredentials(missing);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking credentials:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Validar campos obrigatórios
    if (!formData.name.trim()) {
      toast({
        title: "Erro de validação",
        description: "O nome do agente é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    // Instance name is required now
    if (!formData.instance_name || !formData.instance_name.trim()) {
      toast({
        title: "Erro de validação",
        description: "O nome da Instância Evolution é obrigatório. Cole a Instance Key aqui.",
        variant: "destructive",
      });
      return;
    }

    // Verificar se a Instance Key pertence ao usuário
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: instanceRows, error: instanceError } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('instance_key', formData.instance_name)
        .eq('user_id', user.id)
        .limit(1);

      if (instanceError) {
        console.error('Erro ao verificar Instance Key:', instanceError);
        toast({
          title: 'Erro',
          description: 'Não foi possível validar a Instance Key no momento.',
          variant: 'destructive',
        });
        return;
      }

      if (!instanceRows || instanceRows.length === 0) {
        toast({
          title: 'Instance Key inválida',
          description: 'A Instance Key informada não pertence à sua conta. Verifique em Dashboard → WhatsApp → Instance Key.',
          variant: 'destructive',
        });
        return;
      }
    } catch (err) {
      console.error('Erro na validação da Instance Key:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao validar a Instance Key.',
        variant: 'destructive',
      });
      return;
    }

    // Check credentials
    if (!editingAgent) {
      const hasCredentials = await checkCredentials(formData.ai_model);
      if (!hasCredentials) {
        setCredentialsDialogOpen(true);
        return;
      }
    }

    // Check plan limits when creating new agent
    if (!editingAgent) {
      if (!userPlan) {
        toast({
          title: "Plano necessário",
          description: "Você precisa selecionar um plano para criar agentes.",
          variant: "destructive",
        });
        navigate("/dashboard/plans");
        return;
      }

      if (currentPlan && agents.length >= currentPlan.max_agents) {
        toast({
          title: "Limite atingido",
          description: `Você atingiu o limite de ${currentPlan.max_agents} agente(s) do seu plano ${currentPlan.name}. Faça upgrade para continuar.`,
          variant: "destructive",
        });
        navigate("/dashboard/plans");
        return;
      }
    }

    try {
      // Buscar instância Evolution do usuário
      const { data: instances } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      let instanceName = formData.instance_name;
      
      if (instances && instances.length > 0) {
        instanceName = instances[0].instance_key || formData.instance_name;
      }

      // Buscar credenciais do usuário
      const { data: userCreds } = await supabase
        .from('user_credentials')
        .select('service_name, api_key')
        .eq('user_id', user.id);

      const credentialsMap: Record<string, string> = {};
      userCreds?.forEach(cred => {
        credentialsMap[cred.service_name] = cred.api_key;
      });

      // Adicionar credenciais do Supabase do ambiente
      credentialsMap['supabase_url'] = import.meta.env.VITE_SUPABASE_URL;
      credentialsMap['supabase_service_role_key'] = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      credentialsMap['supabase_anon_key'] = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // URL do webhook
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

      // Buscar API Key da instância Evolution
      const { data: instanceData } = await supabase
        .from('whatsapp_connections')
        .select('instance_token')
        .eq('instance_key', instanceName)
        .single();
      
      const instanceApiKey = instanceData?.instance_token || import.meta.env.VITE_EVOLUTION_API_KEY;

      // Gerar workflow
      const { workflow, webhookPath } = WorkflowGenerator.generate(
        formData.ai_model,
        instanceName,
        formData.prompt,
        credentialsMap,
        webhookUrl,
        instanceApiKey, // Passar API Key da instância
        user.id // Passar user_id para injetar no workflow
      );

      const agentData = {
        ...formData,
        user_id: user.id,
        instance_name: instanceName,
        workflow_json: JSON.parse(JSON.stringify(workflow)) as any,
      };

      if (editingAgent) {
        const { error } = await supabase
          .from("agents")
          .update(agentData)
          .eq("id", editingAgent.id);

        if (error) {
          toast({
            title: "Erro",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        // Reimportar workflow atualizado no n8n
        if (editingAgent.workflow_id) {
          try {
            console.log('Atualizando workflow no n8n...');
            const { data: n8nResponse, error: n8nError } = await supabase.functions.invoke('n8n-import-workflow', {
              body: {
                workflow: workflow,
                workflowName: `Agent: ${formData.name} (${instanceName})`,
                n8nUrl: import.meta.env.VITE_N8N_URL || 'https://n8n.auroratech.tech',
                n8nApiKey: import.meta.env.VITE_N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZjY5NzFkOS0zNjJkLTRkNjMtYmU2ZS1hNmIyZGFiYjgzMzYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYwNzQ5Mzg1fQ._KFFXp-uHl6bik-aePj4owBt6Oog_rOj_3VJa2xCHpY',
                workflowId: editingAgent.workflow_id, // ID do workflow existente para atualizar
              }
            });

            if (n8nError) {
              console.error('Erro ao atualizar workflow no n8n:', n8nError);
              toast({
                title: "Workflow não atualizado",
                description: "Agente salvo no banco, mas workflow não foi atualizado no n8n. Reimporte manualmente.",
                variant: "destructive",
              });
            } else {
              console.log('Workflow atualizado no n8n:', n8nResponse);
            }
          } catch (n8nError) {
            console.error('Erro ao atualizar workflow no n8n:', n8nError);
            toast({
              title: "Workflow não atualizado",
              description: "Agente salvo, mas workflow não foi atualizado no n8n.",
              variant: "destructive",
            });
          }
        }

        // Configurar webhook na instância Evolution
        try {
          console.log('Configurando webhook...', { instanceName, webhookPath });
          const { data: webhookResponse, error: webhookError } = await supabase.functions.invoke('configure-webhook', {
            body: {
              instanceName,
              webhookUrl: webhookPath // webhookPath já contém a URL completa
            }
          });

          if (webhookError) {
            console.error('Erro ao configurar webhook:', webhookError);
            toast({
              title: "Webhook não configurado",
              description: "Agente salvo, mas webhook falhou. Configure manualmente.",
              variant: "destructive",
            });
          } else {
            console.log('Webhook configurado:', webhookResponse);
          }
        } catch (webhookError) {
          console.error('Erro ao configurar webhook:', webhookError);
          toast({
            title: "Webhook não configurado",
            description: "Agente salvo, mas webhook falhou. Configure manualmente.",
            variant: "destructive",
          });
        }

        toast({
          title: "Agente atualizado!",
          description: "Workflow atualizado com sucesso.",
        });
      } else {
        // Primeiro inserir o agente
        const { data: insertedAgent, error } = await supabase
          .from("agents")
          .insert(agentData)
          .select()
          .single();

        if (error) {
          toast({
            title: "Erro",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        // Importar workflow no n8n
        try {
          console.log('Importando workflow no n8n...');
          const { data: n8nResponse, error: n8nError } = await supabase.functions.invoke('n8n-import-workflow', {
            body: {
              workflow: workflow,
              workflowName: `Agent: ${formData.name} (${instanceName})`,
              n8nUrl: import.meta.env.VITE_N8N_URL || 'https://n8n.auroratech.tech',
              n8nApiKey: import.meta.env.VITE_N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZjY5NzFkOS0zNjJkLTRkNjMtYmU2ZS1hNmIyZGFiYjgzMzYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYwNzQ5Mzg1fQ._KFFXp-uHl6bik-aePj4owBt6Oog_rOj_3VJa2xCHpY',
            }
          });

          if (n8nError) {
            console.error('Erro ao importar workflow no n8n:', n8nError);
            toast({
              title: "Workflow não importado",
              description: "Agente salvo, mas workflow não foi importado no n8n. Importe manualmente.",
              variant: "destructive",
            });
          } else {
            console.log('Workflow importado no n8n:', n8nResponse);
            
            // Atualizar o agente com o workflow_id
            if (n8nResponse?.workflowId && insertedAgent?.id) {
              await supabase
                .from("agents")
                .update({ workflow_id: n8nResponse.workflowId })
                .eq("id", insertedAgent.id);
              
              console.log('✅ workflow_id salvo no agente:', n8nResponse.workflowId);
            }
            
            toast({
              title: "Workflow importado!",
              description: `Workflow criado no n8n: ${n8nResponse.workflowId}`,
            });
          }
        } catch (n8nError) {
          console.error('Erro ao importar workflow:', n8nError);
          toast({
            title: "Workflow não importado",
            description: "Agente salvo, mas workflow não foi importado no n8n.",
            variant: "destructive",
          });
        }

        // Configurar webhook na instância Evolution
        try {
          console.log('Configurando webhook...', { instanceName, webhookPath });
          const { data: webhookResponse, error: webhookError } = await supabase.functions.invoke('configure-webhook', {
            body: {
              instanceName,
              webhookUrl: webhookPath // webhookPath já contém a URL completa
            }
          });

          if (webhookError) {
            console.error('Erro ao configurar webhook:', webhookError);
            toast({
              title: "Webhook não configurado",
              description: "Agente salvo, mas webhook falhou. Verifique as credenciais Evolution API.",
              variant: "destructive",
            });
          } else {
            console.log('Webhook configurado:', webhookResponse);
          }
        } catch (webhookError) {
          console.error('Erro ao configurar webhook:', webhookError);
          toast({
            title: "Webhook não configurado",
            description: "Agente salvo, mas webhook falhou. Verifique as credenciais Evolution API.",
            variant: "destructive",
          });
        }

        toast({
          title: "Agente Criado!",
          description: "Workflow e Webhook configurado.",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchAgents();
    } catch (error: any) {
      console.error('Error saving agent:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar agente.",
        variant: "destructive",
      });
    }
  };

  // Open delete confirmation modal (replaces native confirm)
  const handleDelete = (idOrAgent: string | any) => {
    if (typeof idOrAgent === 'object') {
      setAgentToDelete(idOrAgent);
    } else {
      const found = agents.find(a => a.id === idOrAgent) || { id: idOrAgent };
      setAgentToDelete(found);
    }
    setDeleteModalOpen(true);
  };

  // Called when user confirms deletion in modal
  const confirmDeleteAgent = async () => {
    const id = agentToDelete?.id;
    setDeleteModalOpen(false);
    setAgentToDelete(null);
    if (!id) return;

    // Buscar o agente para pegar o workflow_id (se existir)
    const { data: agent } = await supabase
      .from("agents")
      .select("*")
      .eq("id", id)
      .single();

    // Deletar o agente do banco
    const { error } = await supabase.from("agents").delete().eq("id", id);

    if (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Tentar deletar o workflow do n8n se existir workflow_id
    if (agent?.workflow_id) {
      try {
        console.log('Deletando workflow do n8n...', agent.workflow_id);
        const { error: n8nError } = await supabase.functions.invoke('n8n-delete-workflow', {
          body: {
            workflowId: agent.workflow_id,
            n8nUrl: import.meta.env.VITE_N8N_URL || 'https://n8n.auroratech.tech',
            n8nApiKey: import.meta.env.VITE_N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZjY5NzFkOS0zNjJkLTRkNjMtYmU2ZS1hNmIyZGFiYjgzMzYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYwNzQ5Mzg1fQ._KFFXp-uHl6bik-aePj4owBt6Oog_rOj_3VJa2xCHpY',
          }
        });

        if (n8nError) {
          console.error('Erro ao deletar workflow do n8n:', n8nError);
          toast({
            title: "Agente excluído",
            description: "Agente removido, mas o workflow do n8n não foi deletado. Delete manualmente se necessário.",
          });
        } else {
          console.log('Workflow deletado do n8n');
          toast({
            title: "Agente e workflow excluídos",
            description: "O agente e o workflow do n8n foram removidos com sucesso.",
          });
        }
      } catch (n8nError) {
        console.error('Erro ao deletar workflow:', n8nError);
        toast({
          title: "Agente excluído",
          description: "Agente removido, mas o workflow do n8n não foi deletado.",
        });
      }
    } else {
      toast({
        title: "Agente excluído",
        description: "O agente foi removido.",
      });
    }

    fetchAgents();
  };

  const handleReconfigureWebhook = async (agent: any) => {
    try {
      // Extrair webhook path do workflow
      const webhookNode = agent.workflow_json?.nodes?.find((n: any) => 
        n.type === 'n8n-nodes-base.webhook'
      );
      
      if (!webhookNode || !webhookNode.parameters?.path) {
        toast({
          title: "Erro",
          description: "Webhook path não encontrado no workflow do agente",
          variant: "destructive",
        });
        return;
      }

      const webhookPath = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook/${webhookNode.parameters.path}`;
      const instanceName = agent.instance_name;

      console.log('Reconfigurando webhook...', { instanceName, webhookPath });

      const { data, error } = await supabase.functions.invoke('configure-webhook', {
        body: {
          instanceName,
          webhookUrl: webhookPath
        }
      });

      if (error) {
        console.error('Erro ao reconfigurar webhook:', error);
        toast({
          title: "Erro ao configurar webhook",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      console.log('Webhook reconfigurado:', data);
      toast({
        title: "Webhook reconfigurado!",
        description: `Webhook configurado para ${instanceName}`,
      });
    } catch (error: any) {
      console.error('Erro ao reconfigurar webhook:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      language_type: "friendly",
      description: "",
      prompt: "Você é um assistente virtual prestativo e amigável. Responda de forma clara e objetiva.",
      auto_response: true,
      is_active: true,
      provider: "",
      api_key: "",
      ai_model: "openai",
      instance_name: "",
    });
    setEditingAgent(null);
  };

  const openEditDialog = (agent: any) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      language_type: agent.language_type,
      description: agent.description || "",
      prompt: agent.prompt,
      auto_response: agent.auto_response,
      is_active: agent.is_active,
      provider: agent.provider || "",
      api_key: agent.api_key || "",
      ai_model: agent.ai_model || "openai",
      instance_name: agent.instance_name || "",
    });
    setIsDialogOpen(true);
  };

  const handleTemplateSelect = async (templateId: string) => {
    if (!templateId) return;

    const { data, error } = await supabase
      .from("templates")
      .select("prompt")
      .eq("id", templateId)
      .single();

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar template",
        variant: "destructive",
      });
      return;
    }

    if (data?.prompt) {
      setFormData({ ...formData, prompt: data.prompt });
    }
  };

  return (
    <>
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Agentes IA</h1>
            <p className="text-muted-foreground">
              Gerencie seus assistentes virtuais
            </p>
            {currentPlan && (
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="text-primary font-medium">
                  💼 Plano {currentPlan.name}: {agents.length}/{currentPlan.max_agents} agentes
                </span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => navigate("/dashboard/plans")}
                  className="h-auto p-0"
                >
                  Gerenciar plano
                </Button>
              </div>
            )}
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                Novo Agente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingAgent ? "Editar Agente" : "Criar Novo Agente"}
                </DialogTitle>
                <DialogDescription>
                  Configure o comportamento e as credenciais do seu agente IA
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Agente</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    placeholder="Ex: Atendente de Vendas"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language_type">Tipo de Linguagem</Label>
                  <Select
                    value={formData.language_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, language_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Amigável</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="technical">Técnico</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Breve descrição do agente"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template">Template de Prompt</Label>
                  <Select onValueChange={handleTemplateSelect}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione um template (opcional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">Ou crie um Prompt Base manualmente</Label>
                  <Textarea
                    id="prompt"
                    value={formData.prompt}
                    onChange={(e) =>
                      setFormData({ ...formData, prompt: e.target.value })
                    }
                    required
                    rows={6}
                    placeholder="Descreva o comportamento e as instruções do agente..."
                  />
                </div>

                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-lg font-semibold">Configuração da IA</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ai_model">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Modelo de IA
                      </span>
                    </Label>
                    <Select
                      value={formData.ai_model}
                      onValueChange={(value: AIModelProvider) =>
                        setFormData({ ...formData, ai_model: value })
                      }
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Selecione o modelo" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {AI_MODEL_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      O workflow será gerado automaticamente para o modelo escolhido.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="instance_name">Nome da Instância Evolution <span className="text-destructive">*</span></Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="text-muted-foreground">
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Cole aqui a <strong>Instance Key</strong> da sua instância.
                          <div className="mt-1 text-sm">
                            Você encontra essa chave no menu → WhatsApp → Instance Key.
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {connections && connections.length > 1 ? (
                      <Select
                        value={formData.instance_name}
                        onValueChange={(value) => setFormData({ ...formData, instance_name: value })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Selecione uma instância" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {connections.map((conn) => (
                            <SelectItem key={conn.instance_key} value={conn.instance_key}>
                              {conn.instance_key}{conn.instance_name ? ` — ${conn.instance_name}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="instance_name"
                        type="text"
                        placeholder="Cole a Instance Key aqui"
                        value={formData.instance_name}
                        onChange={(e) => setFormData({ ...formData, instance_name: e.target.value })}
                        required
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      A Instance Key é obrigatória para associar o Agente a uma instância e seu Workflow funcionar.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto_response">Respostas Automáticas</Label>
                  <Switch
                    id="auto_response"
                    checked={formData.auto_response}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, auto_response: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Agente Ativo</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingAgent ? "Salvar Alterações" : "Criar Agente"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6">
          {agents.length === 0 ? (
            <Card className="p-12 text-center">
              <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Nenhum agente criado</h3>
              <p className="text-muted-foreground mb-4">
                Crie seu primeiro agente de atendimento
              </p>
            </Card>
          ) : (
            agents.map((agent) => (
              <Card key={agent.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <Bot className="h-10 w-10 text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">{agent.name}</h3>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            agent.is_active
                              ? "bg-primary/10 text-primary"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {agent.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      {agent.description && (
                        <p className="text-muted-foreground mb-2">
                          {agent.description}
                        </p>
                      )}
                      <div className="flex gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {AI_MODEL_OPTIONS.find(m => m.value === agent.ai_model)?.label || agent.ai_model || 'OpenAI'}
                        </Badge>
                        {agent.instance_name && (
                          <Badge variant="secondary" className="text-xs">
                            {agent.instance_name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>Tipo: {(() => {
                          const map: Record<string,string> = {
                            friendly: 'Amigável',
                            formal: 'Formal',
                            technical: 'Técnico',
                            casual: 'Casual'
                          };
                          return map[agent.language_type] || agent.language_type;
                        })()}</span>
                        <span>
                          Auto-resposta:{" "}
                          {agent.auto_response ? "Sim" : "Não"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                        onClick={() => handleReconfigureWebhook(agent)}
                      title="Reconfigurar Webhook"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEditDialog(agent)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                        onClick={() => handleDelete(agent)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
      {/* Delete confirmation modal for agents */}
      <Dialog open={deleteModalOpen} onOpenChange={(open) => { if (!open) setAgentToDelete(null); setDeleteModalOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão do agente</DialogTitle>
            <DialogDescription>
              Esta ação removerá o agente e possivelmente o workflow associado no n8n. Tem certeza que deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <p>Agente: <strong>{agentToDelete?.name || agentToDelete?.id}</strong></p>
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setDeleteModalOpen(false); setAgentToDelete(null); }}>Cancelar</Button>
              <Button variant="destructive" onClick={() => void confirmDeleteAgent()}>Excluir agente</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    <CredentialsDialog
      open={credentialsDialogOpen}
      onOpenChange={setCredentialsDialogOpen}
      serviceNames={missingCredentials}
      onSaved={() => {
        setCredentialsDialogOpen(false);
        const event = new Event('submit');
        handleSubmit(event as any);
      }}
    />
    </>
  );
};

export default Agents;
