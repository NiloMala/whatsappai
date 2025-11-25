import workflowDeliveryBase from '@/assets/workflow_delivery_clean.json';
import { DELIVERY_SYSTEM_PROMPT_TEMPLATE } from './deliveryWorkflowInstructions';
import { generateDeliveryPrompt } from './deliveryPromptTemplate';
import { ScheduleConfig, Holiday } from '@/types/schedule';

interface DeliveryWorkflowConfig {
  miniSiteId: string;
  miniSiteName: string;
  instanceName: string;
  whatsappNumber: string;
  webhookUrl: string;
  userId: string;
  miniSiteAddress?: string;
  scheduleConfig?: ScheduleConfig;
  holidays?: Holiday[];
  customInstructions?: string;
  aiModel?: 'openai' | 'gemini';
}

interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion?: number;
  position: [number, number];
  parameters?: any;
  credentials?: any;
  webhookId?: string;
}

interface WorkflowConnection {
  [key: string]: {
    main?: Array<Array<{ node: string; type: string; index: number }>>;
    ai_languageModel?: Array<Array<{ node: string; type: string; index: number }>>;
    ai_tool?: Array<Array<{ node: string; type: string; index: number }>>;
    ai_memory?: Array<Array<{ node: string; type: string; index: number }>>;
  };
}

interface Workflow {
  nodes: WorkflowNode[];
  connections: WorkflowConnection;
}

export class DeliveryWorkflowGenerator {
  private workflow: Workflow;
  private config: DeliveryWorkflowConfig;

  constructor(config: DeliveryWorkflowConfig) {
    // Usa workflow_delivery_clean como template
    this.workflow = JSON.parse(JSON.stringify(workflowDeliveryBase));
    this.config = config;
  }

  /**
   * Gera um workflow completo para delivery baseado no workflow_base
   */
  public static generate(config: DeliveryWorkflowConfig): { workflow: any; webhookPath: string } {
    const generator = new DeliveryWorkflowGenerator(config);

    // Configurar webhook
    const webhookPath = generator.updateWebhook(config.webhookUrl);

    // Atualizar System Prompt para delivery
    generator.updateSystemPromptForDelivery();

    // Atualizar user_id
    generator.updateUserId(config.userId);

    // Configurar Evolution API
    generator.updateEvolutionApi(config.instanceName);

    // Configurar modelo de IA (OpenAI ou Gemini)
    generator.updateAIModelConnection(config.aiModel || 'gemini');

    // Adicionar queries de pedidos (mantém conexões)
    generator.addOrderQueriesTools();

    // Gerar IDs únicos (mantém conexões)
    generator.regenerateNodeIds();

    return {
      workflow: generator.getWorkflow(),
      webhookPath
    };
  }

  /**
   * Atualiza o System Prompt do AI Agent para delivery
   */
  private updateSystemPromptForDelivery(): void {
    const aiAgentNode = this.workflow.nodes.find(n => n.name === 'AI Agent');

    if (aiAgentNode && aiAgentNode.parameters?.options) {
      // Usar o novo sistema de templates
      const prompt = generateDeliveryPrompt({
        miniSite: {
          name: this.config.miniSiteName,
          whatsapp_number: this.config.whatsappNumber,
          address: this.config.miniSiteAddress,
          mini_site_id: this.config.miniSiteId,
        },
        scheduleConfig: this.config.scheduleConfig,
        holidays: this.config.holidays,
        customInstructions: this.config.customInstructions,
      });

      aiAgentNode.parameters.options.systemMessage = prompt;
    }
  }

  /**
   * Atualiza user_id no Edit Fields
   */
  private updateUserId(userId: string): void {
    const editFieldsNode = this.workflow.nodes.find(n => n.name === 'Edit Fields');

    if (editFieldsNode && editFieldsNode.parameters?.assignments?.assignments) {
      const userIdAssignment = editFieldsNode.parameters.assignments.assignments.find(
        (a: any) => a.name === 'user_id'
      );
      if (userIdAssignment) {
        userIdAssignment.value = userId;
      }
    }
  }

  /**
   * Atualiza as conexões do modelo de IA baseado na escolha do usuário
   */
  private updateAIModelConnection(aiModel: 'openai' | 'gemini'): void {
    const aiAgentNode = this.workflow.nodes.find(n => n.name === 'AI Agent');
    if (!aiAgentNode) return;

    // Determinar qual modelo deve ser conectado
    const modelNodeName = aiModel === 'openai' ? 'OpenAI Chat Model' : 'Google Gemini Chat Model';
    const otherModelName = aiModel === 'openai' ? 'Google Gemini Chat Model' : 'OpenAI Chat Model';

    // Remover conexão do modelo não selecionado
    if (this.workflow.connections[otherModelName]) {
      delete this.workflow.connections[otherModelName].ai_languageModel;
    }

    // Adicionar/garantir conexão do modelo selecionado
    if (!this.workflow.connections[modelNodeName]) {
      this.workflow.connections[modelNodeName] = {};
    }

    this.workflow.connections[modelNodeName].ai_languageModel = [[{
      node: 'AI Agent',
      type: 'ai_languageModel',
      index: 0
    }]];

    console.log(`✅ Modelo de IA configurado: ${modelNodeName}`);
  }

  /**
   * Adiciona Tools de consulta de pedidos ao workflow (mantendo conexões)
   */
  private addOrderQueriesTools(): void {
    const aiAgentNode = this.workflow.nodes.find(n => n.name === 'AI Agent');
    if (!aiAgentNode) return;

    // Verificar se já existem os nós de pedidos
    let searchOrdersNode = this.workflow.nodes.find(n => n.name === 'Buscar Pedidos do Cliente');
    let searchByNumberNode = this.workflow.nodes.find(n => n.name === 'Buscar Pedido por Número');

    // Se não existirem, criar
    if (!searchOrdersNode) {
      searchOrdersNode = {
        id: this.generateUUID(),
        name: 'Buscar Pedidos do Cliente',
        type: 'n8n-nodes-base.supabaseTool',
        typeVersion: 1,
        position: [1776, 592] as [number, number],
        parameters: {
          operation: 'getMany',
          tableId: 'minisite_orders',
          filters: {
            conditions: [
              {
                keyName: 'customer_phone',
                condition: 'eq',
                keyValue: "={{ (() => { const digits = $('Edit Fields').item.json.Telefone.replace(/\\\\D/g, ''); return digits.startsWith('55') ? digits : '55' + digits; })() }}"
              },
              {
                keyName: 'mini_site_id',
                condition: 'eq',
                keyValue: this.config.miniSiteId
              }
            ]
          },
          returnAll: false,
          limit: 10,
          sort: {
            fields: [{ field: 'created_at', direction: 'DESC' }]
          }
        },
        credentials: {
          supabaseApi: {
            id: 'sQw0N1EVFGS7nGKf',
            name: 'whatsappai'
          }
        }
      };
      this.workflow.nodes.push(searchOrdersNode);
    } else {
      // Atualizar mini_site_id e customer_phone
      if (searchOrdersNode.parameters?.filters?.conditions) {
        const miniSiteCondition = searchOrdersNode.parameters.filters.conditions.find(
          (c: any) => c.keyName === 'mini_site_id'
        );
        if (miniSiteCondition) {
          miniSiteCondition.keyValue = this.config.miniSiteId;
        }

        // Atualizar customer_phone para usar formato E.164
        const phoneCondition = searchOrdersNode.parameters.filters.conditions.find(
          (c: any) => c.keyName === 'customer_phone'
        );
        if (phoneCondition) {
          phoneCondition.keyValue = "={{ (() => { const digits = $('Edit Fields').item.json.Telefone.replace(/\\\\D/g, ''); return digits.startsWith('55') ? digits : '55' + digits; })() }}";
        }
      }
    }

    if (!searchByNumberNode) {
      searchByNumberNode = {
        id: this.generateUUID(),
        name: 'Buscar Pedido por Número',
        type: 'n8n-nodes-base.supabaseTool',
        typeVersion: 1,
        position: [1600, 592] as [number, number],
        parameters: {
          operation: 'get',
          tableId: 'minisite_orders',
          filters: {
            conditions: [
              {
                keyName: 'order_number',
                condition: 'eq',
                keyValue: '={{ $json.orderNumber }}'
              },
              {
                keyName: 'mini_site_id',
                condition: 'eq',
                keyValue: this.config.miniSiteId
              }
            ]
          }
        },
        credentials: {
          supabaseApi: {
            id: 'sQw0N1EVFGS7nGKf',
            name: 'whatsappai'
          }
        }
      };
      this.workflow.nodes.push(searchByNumberNode);
    } else {
      // Atualizar mini_site_id
      if (searchByNumberNode.parameters?.filters?.conditions) {
        const miniSiteCondition = searchByNumberNode.parameters.filters.conditions.find(
          (c: any) => c.keyName === 'mini_site_id'
        );
        if (miniSiteCondition) {
          miniSiteCondition.keyValue = this.config.miniSiteId;
        }
      }
    }

    // Garantir conexões ai_tool (se não existirem)
    if (!this.workflow.connections[searchOrdersNode.name]) {
      this.workflow.connections[searchOrdersNode.name] = {};
    }
    if (!this.workflow.connections[searchOrdersNode.name].ai_tool) {
      this.workflow.connections[searchOrdersNode.name].ai_tool = [[{
        node: aiAgentNode.name,
        type: 'ai_tool',
        index: 0
      }]];
    }

    if (!this.workflow.connections[searchByNumberNode.name]) {
      this.workflow.connections[searchByNumberNode.name] = {};
    }
    if (!this.workflow.connections[searchByNumberNode.name].ai_tool) {
      this.workflow.connections[searchByNumberNode.name].ai_tool = [[{
        node: aiAgentNode.name,
        type: 'ai_tool',
        index: 0
      }]];
    }
  }

  /**
   * Atualiza o webhook path
   */
  private updateWebhook(webhookUrl: string): string {
    const webhookNode = this.workflow.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
    
    if (webhookNode && webhookNode.parameters) {
      const webhookPath = this.generateUUID();
      webhookNode.parameters.path = webhookPath;
      return `${webhookUrl}/${webhookPath}`;
    }
    
    return '';
  }

  /**
   * Atualiza a configuração da Evolution API com instance_key
   */
  private updateEvolutionApi(instanceName: string): void {
    this.workflow.nodes.forEach(node => {
      // Atualizar nó Evolution API (Evia Texto)
      if (node.type === 'n8n-nodes-evolution-api.evolutionApi' || node.name === 'Evia Texto') {
        if (node.parameters) {
          node.parameters.instanceName = instanceName;
        }
      }
    });
  }

  /**
   * Regenera IDs únicos para todos os nós MANTENDO AS CONEXÕES
   */
  private regenerateNodeIds(): void {
    const oldToNewIdMap: Record<string, string> = {};
    const oldToNewNameMap: Record<string, string> = {};

    // Mapear nomes antigos para IDs antigos
    this.workflow.nodes.forEach(node => {
      oldToNewNameMap[node.name] = node.id;
    });

    // Gerar novos IDs
    this.workflow.nodes.forEach(node => {
      const newId = this.generateUUID();
      oldToNewIdMap[node.id] = newId;
      node.id = newId;
    });

    // Atualizar referências nas conexões (usando NOMES de nó, não IDs)
    // O n8n usa nomes de nós nas conexões, então não precisa atualizar
    // Apenas garantir que a estrutura está correta
  }

  /**
   * Gera UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Retorna o workflow gerado
   */
  getWorkflow(): Workflow {
    return this.workflow;
  }
}
