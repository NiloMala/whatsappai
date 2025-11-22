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
import { Bot, Plus, Pencil, Trash2, Sparkles, RefreshCw, Info, Calendar, Settings } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { AIModelProvider, AI_MODEL_OPTIONS } from "@/types/ai-models";
import { WorkflowGenerator } from "@/services/workflowGenerator";
import { DeliveryWorkflowGenerator } from "@/services/deliveryWorkflowGenerator";
import { ScheduleConfigModal } from "@/components/agents/ScheduleConfigModal";
import { ScheduleConfig, Holiday, DEFAULT_SCHEDULE_CONFIG } from "@/types/schedule";

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
    voice_response_mode: "text_only" as "auto" | "text_only",
    agent_type: "general" as "general" | "delivery" | "support",
  });

  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE_CONFIG);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

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

  // Credentials check removed - OpenAI and Gemini API keys are now centralized in n8n
  // and configured once for all users via n8n credential store

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
      // Mostrar toast imediato informando que o processo começou
      if (!editingAgent) {
        toast({
          title: "Criando agente...",
          description: "Seu agente está sendo criado. Aguarde até receber a confirmação.",
        });
      } else {
        toast({
          title: "Atualizando agente...",
          description: "Seu agente está sendo atualizado. Aguarde até receber a confirmação.",
        });
      }

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
      const { data: instanceData, error: instanceError } = await supabase
        .from('whatsapp_connections')
        .select('instance_token')
        .eq('instance_key', instanceName)
        .single();

      if (instanceError) {
        console.error('Erro ao buscar instance_token:', instanceError);
      }

      const instanceApiKey = instanceData?.instance_token || import.meta.env.VITE_EVOLUTION_API_KEY;

  console.log('🔍 DEBUG: Dados da instância:');
      console.log('   - instanceName:', instanceName);
      console.log('   - instanceData:', instanceData);
      console.log('   - instance_token obtido:', instanceData?.instance_token ? `SIM (***${instanceData.instance_token.slice(-4)})` : 'NÃO');
      console.log('   - instanceApiKey final:', instanceApiKey ? `SIM (***${instanceApiKey.slice(-4)})` : 'NÃO');

  // DEBUG: log do scheduleConfig atual antes de gerar workflow / salvar
  console.log('🔍 DEBUG: scheduleConfig at submit:', scheduleConfig);
  console.log('🔍 DEBUG: holidays at submit:', holidays);

      // Gerar workflow (diferente para delivery vs general)
      let workflow, webhookPath;

      if (formData.agent_type === 'delivery') {
        // Para agentes de delivery, criar workflow genérico
        // Os dados específicos do mini-site serão aplicados quando vincular
        const deliveryWorkflow = DeliveryWorkflowGenerator.generate({
          miniSiteId: '', // Será preenchido quando vincular ao mini-site
          miniSiteName: formData.name, // Usar nome do agente como placeholder
          instanceName: instanceName,
          whatsappNumber: '', // Será preenchido quando vincular ao mini-site
          webhookUrl: `${import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://webhook.auroratech.tech/webhook'}`,
          userId: user.id,
          miniSiteAddress: undefined,
          scheduleConfig: scheduleConfig.scheduling_enabled ? scheduleConfig : undefined,
          holidays: scheduleConfig.scheduling_enabled ? holidays : undefined,
          customInstructions: formData.prompt, // Para delivery, o prompt contém as instruções personalizadas
        });

        workflow = deliveryWorkflow.workflow;
        webhookPath = deliveryWorkflow.webhookPath;

      } else {
        // Para agentes gerais, usar WorkflowGenerator normal
        const generalWorkflow = WorkflowGenerator.generate(
          formData.ai_model,
          instanceName,
          formData.prompt,
          credentialsMap,
          webhookUrl,
          instanceApiKey,
          user.id,
          scheduleConfig.scheduling_enabled ? scheduleConfig : undefined,
          scheduleConfig.scheduling_enabled ? holidays : undefined,
          formData.voice_response_mode
        );

        workflow = generalWorkflow.workflow;
        webhookPath = generalWorkflow.webhookPath;
      }

      console.log('🔍 Workflow gerado:', {
        totalNodes: workflow?.nodes?.length,
        hasConnections: !!workflow?.connections,
        nodeTypes: workflow?.nodes?.map((n: any) => n.type).slice(0, 5)
      });

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

        // Salvar/atualizar configuração de agendamento
          if (scheduleConfig.scheduling_enabled) {
          const payload = {
            agent_id: editingAgent.id,
            user_id: user.id,
            ...scheduleConfig
          };

          console.log('DEBUG: upserting agent_schedule_config payload:', payload);

          const { data: scheduleData, error: scheduleError } = await supabase
            .from('agent_schedule_config')
            .upsert(payload, { onConflict: 'agent_id' });

          console.log('DEBUG: upsert response agent_schedule_config:', { scheduleData, scheduleError });

          if (scheduleError) {
            console.error('Erro ao salvar configuração de agendamento:', scheduleError);
            toast({
              title: 'Erro ao salvar agendamento',
              description: scheduleError.message || JSON.stringify(scheduleError),
              variant: 'destructive',
            });
          } else {
            console.log('Configuração de agendamento salva (upsert):', scheduleData);
          }

          // Backup existing holidays before modifying so we can restore on failure
          const { data: existingHolidays, error: existingHolidaysError } = await supabase
            .from('agent_holidays')
            .select('*')
            .eq('agent_id', editingAgent.id);

          if (existingHolidaysError) {
            console.error('Erro ao buscar feriados existentes (backup):', existingHolidaysError);
          } else {
            console.log('Feriados existentes (backup):', existingHolidays);
          }

          // Deletar feriados antigos
          const { data: deletedHolidaysData, error: deletedHolidaysError } = await supabase
            .from('agent_holidays')
            .delete()
            .eq('agent_id', editingAgent.id);

          if (deletedHolidaysError) {
            console.error('Erro ao deletar feriados antigos:', deletedHolidaysError);
            toast({
              title: 'Erro ao atualizar feriados',
              description: deletedHolidaysError.message || JSON.stringify(deletedHolidaysError),
              variant: 'destructive',
            });
          } else {
            console.log('Feriados antigos deletados:', deletedHolidaysData);
          }

          // Inserir novos feriados
          if (holidays.length > 0) {
            const formatDate = (s: any) => {
              if (!s) return s;
              // If already YYYY-MM-DD, return as is
              if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
              try {
                const d = new Date(s);
                if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
              } catch (e) {
                // fallback
              }
              // Try to split if it contains T
              if (typeof s === 'string' && s.includes('T')) return s.split('T')[0];
              return s;
            };

            const builtPayload: any[] = [];
            const invalidHolidays: any[] = [];

            holidays.forEach(h => {
              const fd = formatDate(h.date);
              const desc = (h.description || '').slice(0, 255);
              if (!fd) {
                invalidHolidays.push({ original: h, reason: 'invalid date' });
                return;
              }
              builtPayload.push({
                agent_id: editingAgent.id,
                user_id: user.id,
                holiday_date: fd,
                description: desc,
              });
            });

            if (invalidHolidays.length > 0) {
              console.warn('Alguns feriados foram ignorados por data inválida:', invalidHolidays);
              toast({
                title: 'Alguns feriados não foram salvos',
                description: `Datas inválidas: ${invalidHolidays.map(i => i.original.date).join(', ')}`,
                variant: 'destructive',
              });
            }

            console.log('DEBUG: inserindo feriados payload:', builtPayload);

            const { data: insertedHolidaysData, error: holidaysError } = await supabase
              .from('agent_holidays')
              .insert(builtPayload);

            console.log('DEBUG: insert holidays response:', { insertedHolidaysData, holidaysError });

            if (holidaysError) {
              console.error('Erro ao salvar feriados:', holidaysError);
              toast({
                title: 'Erro ao salvar feriados',
                description: holidaysError.message || JSON.stringify(holidaysError),
                variant: 'destructive',
              });

              // Attempt to restore backup if available
              if (existingHolidays && existingHolidays.length > 0) {
                try {
                  const restorePayload = existingHolidays.map((h: any) => ({
                    agent_id: h.agent_id,
                    user_id: h.user_id,
                    holiday_date: h.holiday_date || h.date || h.holiday_date,
                    description: h.description
                  }));
                  console.log('DEBUG: restaurando feriados a partir do backup:', restorePayload);
                  const { data: restoreData, error: restoreError } = await supabase
                    .from('agent_holidays')
                    .insert(restorePayload);

                  console.log('DEBUG: restore holidays response:', { restoreData, restoreError });
                  if (restoreError) {
                    console.error('Erro ao restaurar feriados do backup:', restoreError);
                  }
                } catch (restoreErr) {
                  console.error('Erro inesperado ao restaurar feriados:', restoreErr);
                }
              }
            } else {
              console.log('Feriados inseridos:', insertedHolidaysData);
            }
          }
        } else {
          // Se desabilitou agendamento, deletar configurações existentes
          const { data: deletedScheduleData, error: deletedScheduleError } = await supabase
            .from('agent_schedule_config')
            .delete()
            .eq('agent_id', editingAgent.id);

          if (deletedScheduleError) {
            console.error('Erro ao deletar configuração de agendamento existente:', deletedScheduleError);
            toast({
              title: 'Erro ao deletar configuração de agendamento',
              description: deletedScheduleError.message || JSON.stringify(deletedScheduleError),
              variant: 'destructive',
            });
          } else {
            console.log('Configuração de agendamento deletada:', deletedScheduleData);
          }

          const { data: deletedAllHolidays, error: deletedAllHolidaysError } = await supabase
            .from('agent_holidays')
            .delete()
            .eq('agent_id', editingAgent.id);

          if (deletedAllHolidaysError) {
            console.error('Erro ao deletar feriados existentes:', deletedAllHolidaysError);
            toast({
              title: 'Erro ao deletar feriados',
              description: deletedAllHolidaysError.message || JSON.stringify(deletedAllHolidaysError),
              variant: 'destructive',
            });
          } else {
            console.log('Feriados deletados:', deletedAllHolidays);
          }
        }

        // Reimportar workflow atualizado no n8n
        // TEMPORARIAMENTE DESABILITADO: Precisa configurar variáveis de ambiente no Supabase
        console.log('⚠️ Atualização automática de workflow desabilitada');
        console.log('✅ Agente atualizado no banco de dados com sucesso');

        // Workflow não é atualizado automaticamente ao editar agente
        // Para atualizar o prompt/configuração, edite manualmente no n8n
        // ou recrie o agente do zero

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

        // Salvar configuração de agendamento se habilitada
        if (scheduleConfig.scheduling_enabled && insertedAgent?.id) {
          const { error: scheduleError } = await supabase
            .from('agent_schedule_config')
            .insert({
              agent_id: insertedAgent.id,
              user_id: user.id,
              ...scheduleConfig
            });

          if (scheduleError) {
            console.error('Erro ao salvar configuração de agendamento:', scheduleError);
          }

          // Salvar feriados
          if (holidays.length > 0) {
            const { error: holidaysError } = await supabase
              .from('agent_holidays')
              .insert(holidays.map(h => ({
                agent_id: insertedAgent.id,
                user_id: user.id,
                holiday_date: h.date,
                description: h.description
              })));

            if (holidaysError) {
              console.error('Erro ao salvar feriados:', holidaysError);
            }
          }
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
              instanceApiKey: instanceApiKey,
              instanceName: instanceName,
            }
          });

          if (n8nError) {
            console.error('Erro ao importar workflow no n8n:', n8nError);
            console.error('Resposta da Edge Function:', n8nResponse);
            toast({
              title: "Workflow não importado",
              description: `Erro: ${n8nResponse?.error || n8nError.message}`,
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
    } catch (error) {
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

    // Deletar webhook da tabela webhooks se existir instance_name
    if (agent?.instance_name) {
      try {
        console.log('Deletando webhook da tabela webhooks...', agent.instance_name);
        const { error: webhookError } = await supabase
          .from('webhooks')
          .delete()
          .eq('instance_id', agent.instance_name);

        if (webhookError) {
          console.error('Erro ao deletar webhook:', webhookError);
        } else {
          console.log('Webhook deletado da tabela webhooks');
        }
      } catch (err) {
        console.error('Erro ao deletar webhook:', err);
      }
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
    } catch (error) {
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
      voice_response_mode: "text_only",
      agent_type: "general",
    });
    setScheduleConfig(DEFAULT_SCHEDULE_CONFIG);
    setHolidays([]);
    setEditingAgent(null);
  };

  const openEditDialog = async (agent: any) => {
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
      voice_response_mode: agent.voice_response_mode || "text_only",
      agent_type: agent.agent_type || "general",
    });

    // Carregar configuração de horários se existir
    try {
      const scheduleResp = await supabase
        .from('agent_schedule_config')
        .select('*')
        .eq('agent_id', agent.id)
        .maybeSingle();

      console.log('DEBUG: resposta agent_schedule_config GET:', scheduleResp);

      const scheduleData = scheduleResp.data;
      const scheduleError = scheduleResp.error;

      if (scheduleError) {
        console.error('Erro ao buscar agent_schedule_config:', scheduleError);
      }

      if (scheduleData) {
        setScheduleConfig({
          scheduling_enabled: scheduleData.scheduling_enabled,
          monday: scheduleData.monday,
          tuesday: scheduleData.tuesday,
          wednesday: scheduleData.wednesday,
          thursday: scheduleData.thursday,
          friday: scheduleData.friday,
          saturday: scheduleData.saturday,
          sunday: scheduleData.sunday,
          start_time: scheduleData.start_time,
          end_time: scheduleData.end_time,
          slot_duration: scheduleData.slot_duration,
          allow_partial_hours: scheduleData.allow_partial_hours,
        });
      } else {
        setScheduleConfig(DEFAULT_SCHEDULE_CONFIG);
      }

      // Carregar feriados
      const holidaysResp = await supabase
        .from('agent_holidays')
        .select('*')
        .eq('agent_id', agent.id)
        .order('holiday_date');

      console.log('DEBUG: resposta agent_holidays GET:', holidaysResp);

      const holidaysData = holidaysResp.data;
      const holidaysError = holidaysResp.error;

      if (holidaysError) {
        console.error('Erro ao buscar agent_holidays:', holidaysError);
      }

      // Normalize DB rows to the UI Holiday shape { date, description }
      const normalizedHolidays = (holidaysData || []).map((h: any) => ({
        // PostgREST returns holiday_date column; UI expects `date`
        date: h.holiday_date || h.date || h.holidayDate || null,
        description: h.description || h.desc || "",
      }));

      setHolidays(normalizedHolidays);
    } catch (error) {
      console.error('Erro ao carregar configurações de agendamento:', error);
      setScheduleConfig(DEFAULT_SCHEDULE_CONFIG);
      setHolidays([]);
    }

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
      <div className="space-y-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Agentes IA</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Gerencie seus assistentes virtuais
            </p>
            {currentPlan && (
              <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                <span className="text-primary font-medium">
                  💼 Plano {currentPlan.name}: {agents.length}/{currentPlan.max_agents} agentes
                </span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => navigate("/dashboard/plans")}
                  className="h-auto p-0 self-start sm:self-auto"
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
              <Button className="bg-gradient-to-r from-primary to-primary/90 w-full sm:w-auto min-h-[48px]">
                <Plus className="mr-2 h-5 w-5" />
                Novo Agente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">
                  {editingAgent ? "Editar Agente" : "Criar Novo Agente"}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Configure o comportamento e as credenciais do seu agente IA
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto flex-1 pr-2 sm:pr-4">
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
                  <Label htmlFor="agent_type">Tipo de Agente</Label>
                  <Select
                    value={formData.agent_type}
                    onValueChange={(value: "general" | "delivery" | "support") =>
                      setFormData({ ...formData, agent_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Agente Geral</SelectItem>
                      <SelectItem value="delivery">Agente de Delivery</SelectItem>
                      <SelectItem value="support">Agente de Suporte</SelectItem>
                    </SelectContent>
                  </Select>
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

                {/* Template de Prompt - Oculto para agentes de delivery */}
                {formData.agent_type !== "delivery" && (
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
                )}

                {/* Seção de Agendamentos / Horários de Atendimento */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="scheduling_enabled" className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formData.agent_type === "delivery"
                          ? "Configurar horários de funcionamento?"
                          : "Este agente fará agendamentos?"}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formData.agent_type === "delivery"
                          ? "Defina os dias e horários que o restaurante aceita pedidos"
                          : "Habilite para configurar horários de atendimento personalizados"}
                      </p>
                    </div>
                    <Switch
                      id="scheduling_enabled"
                      checked={scheduleConfig.scheduling_enabled}
                      onCheckedChange={(checked) =>
                        setScheduleConfig({ ...scheduleConfig, scheduling_enabled: checked })
                      }
                    />
                  </div>

                  {scheduleConfig.scheduling_enabled && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setScheduleModalOpen(true)}
                      className="w-full min-h-[44px]"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      {formData.agent_type === "delivery"
                        ? "Configurar Horários de Funcionamento"
                        : "Configurar Horários e Feriados"}
                    </Button>
                  )}
                </div>

                {/* Campo de Prompt/Instruções - Customizado por tipo de agente */}
                <div className="space-y-2">
                  <Label htmlFor="prompt">
                    {formData.agent_type === "delivery"
                      ? "Instruções Personalizadas (Opcional)"
                      : "Ou crie um Prompt Base manualmente"}
                  </Label>
                  <Textarea
                    id="prompt"
                    value={formData.prompt}
                    onChange={(e) =>
                      setFormData({ ...formData, prompt: e.target.value })
                    }
                    required
                    rows={6}
                    placeholder={
                      formData.agent_type === "delivery"
                        ? "Ex: Não aceitamos troco acima de R$ 50. Tempo médio de entrega: 30-45 minutos. Taxa de entrega: R$ 5,00 para distâncias até 3km."
                        : "Descreva o comportamento e as instruções do agente..."
                    }
                  />
                  {formData.agent_type === "delivery" && (
                    <p className="text-xs text-muted-foreground">
                      Adicione regras específicas do seu negócio (horários especiais, taxas, políticas, etc.)
                    </p>
                  )}
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

                <div className="space-y-2">
                  <Label htmlFor="voice_response_mode">Modo de Resposta</Label>
                  <Select
                    value={formData.voice_response_mode}
                    onValueChange={(value: "auto" | "text_only") =>
                      setFormData({ ...formData, voice_response_mode: value })
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione o modo" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="text_only">
                        📝 Apenas Texto (sempre responde com texto)
                      </SelectItem>
                      <SelectItem value="auto">
                        🎯 Automático (Voz ↔ Voz, Texto ↔ Texto)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Padrão: Apenas Texto. Use Automático para responder áudios com voz.
                  </p>
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

                <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                    className="w-full sm:w-auto min-h-[44px]"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="w-full sm:w-auto min-h-[44px]">
                    {editingAgent ? "Salvar Alterações" : "Criar Agente"}
                  </Button>
                </div>
              </form>
              </div>
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
              <Card key={agent.id} className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex gap-4 flex-1">
                    <Bot className="h-10 w-10 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-lg sm:text-xl font-bold">{agent.name}</h3>
                        <span
                          className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
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
                      <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
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
                  <div className="flex gap-2 self-start sm:self-auto">
                    <Button
                      variant="outline"
                      size="icon"
                      className="min-h-[44px] min-w-[44px]"
                      onClick={() => handleReconfigureWebhook(agent)}
                      title="Reconfigurar Webhook"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="min-h-[44px] min-w-[44px]"
                      onClick={() => openEditDialog(agent)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="min-h-[44px] min-w-[44px]"
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Confirmar exclusão do agente</DialogTitle>
            <DialogDescription className="text-sm">
              Esta ação removerá o agente e possivelmente o workflow associado no n8n. Tem certeza que deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <p className="text-sm">Agente: <strong>{agentToDelete?.name || agentToDelete?.id}</strong></p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              onClick={() => { setDeleteModalOpen(false); setAgentToDelete(null); }}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDeleteAgent()}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Excluir agente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    <ScheduleConfigModal
      open={scheduleModalOpen}
      onOpenChange={setScheduleModalOpen}
      scheduleConfig={scheduleConfig}
      holidays={holidays}
      agentType={formData.agent_type}
      onSave={(config, newHolidays) => {
        setScheduleConfig(config);
        setHolidays(newHolidays);
      }}
    />
    </>
  );
};

export default Agents;
