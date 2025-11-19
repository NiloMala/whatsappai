import workflowBaseTemplate from '@/assets/workflow_base.json';
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
}

interface WorkflowConnection {
  [key: string]: {
    main?: Array<Array<{ node: string; type: string; index: number }>>;
    ai_languageModel?: Array<Array<{ node: string; type: string; index: number }>>;
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
    // Usa workflow_base como template (já tem Redis, bloqueio, etc)
    this.workflow = JSON.parse(JSON.stringify(workflowBaseTemplate));
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

    // Adicionar queries de pedidos
    generator.addOrderQueries();

    // Gerar IDs únicos
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
   * Adiciona Tools de consulta de pedidos ao workflow
   */
  private addOrderQueries(): void {
    // Buscar nó AI Agent para conectar as tools
    const aiAgentNode = this.workflow.nodes.find(n => n.name === 'AI Agent');
    if (!aiAgentNode) return;

    // Adicionar Supabase Tool: Buscar Pedidos do Cliente
    const searchOrdersTool: WorkflowNode = {
      id: this.generateUUID(),
      name: 'Buscar Pedidos do Cliente',
      type: 'n8n-nodes-base.supabaseTool',
      typeVersion: 1,
      position: [aiAgentNode.position[0] + 200, aiAgentNode.position[1] - 200] as [number, number],
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

    // Adicionar Supabase Tool: Buscar Pedido por Número
    const searchByNumberTool: WorkflowNode = {
      id: this.generateUUID(),
      name: 'Buscar Pedido por Número',
      type: 'n8n-nodes-base.supabaseTool',
      typeVersion: 1,
      position: [aiAgentNode.position[0] + 200, aiAgentNode.position[1]] as [number, number],
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

    this.workflow.nodes.push(searchOrdersTool, searchByNumberTool);

    // Conectar tools ao AI Agent
    if (!this.workflow.connections[searchOrdersTool.name]) {
      this.workflow.connections[searchOrdersTool.name] = {};
    }
    if (!this.workflow.connections[searchByNumberTool.name]) {
      this.workflow.connections[searchByNumberTool.name] = {};
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
   * Atualiza a configuração da Evolution API
   */
  private updateEvolutionApi(instanceName: string): void {
    this.workflow.nodes.forEach(node => {
      if (node.type === 'n8n-nodes-evolution-api.evolutionApi' || node.name.includes('Evolution API')) {
        if (node.parameters) {
          node.parameters.instanceName = instanceName;
        }
      }
    });
  }

  /**
   * Regenera IDs únicos para todos os nós
   */
  private regenerateNodeIds(): void {
    const oldToNewIdMap: Record<string, string> = {};

    // Gerar novos IDs
    this.workflow.nodes.forEach(node => {
      const newId = this.generateUUID();
      oldToNewIdMap[node.id] = newId;
      node.id = newId;
    });

    // Atualizar referências nas conexões
    const newConnections: WorkflowConnection = {};
    Object.entries(this.workflow.connections).forEach(([oldId, connections]) => {
      const newId = oldToNewIdMap[oldId];
      
      if (connections.main) {
        newConnections[newId] = {
          main: connections.main.map(connectionArray =>
            connectionArray.map(conn => ({
              ...conn,
              node: oldToNewIdMap[conn.node] || conn.node
            }))
          )
        };
      }
      
      if (connections.ai_languageModel) {
        if (!newConnections[newId]) newConnections[newId] = {};
        newConnections[newId].ai_languageModel = connections.ai_languageModel.map(connectionArray =>
          connectionArray.map(conn => ({
            ...conn,
            node: oldToNewIdMap[conn.node] || conn.node
          }))
        );
      }
    });

    this.workflow.connections = newConnections;
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
