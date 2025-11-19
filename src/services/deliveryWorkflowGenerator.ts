import workflowDeliveryClean from '@/assets/workflow_delivery_clean.json';
import { DELIVERY_SYSTEM_PROMPT_TEMPLATE } from './deliveryWorkflowInstructions';

interface DeliveryWorkflowConfig {
  miniSiteId: string;
  miniSiteName: string;
  instanceName: string;
  whatsappNumber: string;
  webhookUrl: string;
  userId: string;
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
    this.workflow = JSON.parse(JSON.stringify(workflowDeliveryClean));
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
      // Substituir placeholders no template
      let prompt = DELIVERY_SYSTEM_PROMPT_TEMPLATE
        .replace(/{{MINI_SITE_NAME}}/g, this.config.miniSiteName)
        .replace(/{{WHATSAPP_NUMBER}}/g, this.config.whatsappNumber);
      
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
                keyValue: "={{ $('Edit Fields').item.json.Telefone }}"
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
      // Atualizar mini_site_id
      if (searchOrdersNode.parameters?.filters?.conditions) {
        const miniSiteCondition = searchOrdersNode.parameters.filters.conditions.find(
          (c: any) => c.keyName === 'mini_site_id'
        );
        if (miniSiteCondition) {
          miniSiteCondition.keyValue = this.config.miniSiteId;
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
