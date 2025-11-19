import deliveryWorkflowTemplate from '@/assets/workflow_delivery_base.json';

interface DeliveryWorkflowConfig {
  miniSiteId: string;
  miniSiteName: string;
  instanceName: string;
  webhookUrl: string;
  openaiApiKey?: string;
  evolutionApiKey?: string;
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

  constructor() {
    this.workflow = JSON.parse(JSON.stringify(deliveryWorkflowTemplate));
  }

  /**
   * Gera um workflow completo para delivery
   */
  public static generate(config: DeliveryWorkflowConfig): { workflow: any; webhookPath: string } {
    const generator = new DeliveryWorkflowGenerator();

    // Configurar webhook
    const webhookPath = generator.updateWebhook(config.webhookUrl);

    // Configurar AI Model
    generator.updateAIModel(config.miniSiteName);

    // Configurar Evolution API
    generator.updateEvolutionApi(config.instanceName);

    // Configurar Supabase para buscar pedidos
    generator.updateSupabaseQueries(config.miniSiteId);

    // Gerar IDs únicos
    generator.regenerateNodeIds();

    return {
      workflow: generator.getWorkflow(),
      webhookPath
    };
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
   * Atualiza o modelo de IA com o nome do mini site
   */
  private updateAIModel(miniSiteName: string): void {
    const aiModelNode = this.workflow.nodes.find(n => n.name === 'OpenAI Chat Model');
    
    if (aiModelNode && aiModelNode.parameters?.options) {
      // O systemMessage já tem placeholders que serão substituídos em runtime
      // Apenas garantimos que está configurado corretamente
      aiModelNode.parameters.options.temperature = 0.7;
    }
  }

  /**
   * Atualiza a configuração da Evolution API
   */
  private updateEvolutionApi(instanceName: string): void {
    const evolutionNode = this.workflow.nodes.find(n => n.type === 'n8n-nodes-evolution-api.evolutionApi');
    
    if (evolutionNode && evolutionNode.parameters) {
      evolutionNode.parameters.instanceName = instanceName;
    }
  }

  /**
   * Atualiza queries do Supabase para filtrar por mini_site_id
   */
  private updateSupabaseQueries(miniSiteId: string): void {
    const supabaseNode = this.workflow.nodes.find(n => 
      n.name === 'Get Order' && n.type === 'n8n-nodes-base.supabase'
    );
    
    if (supabaseNode && supabaseNode.parameters) {
      // Adicionar filtro por mini_site_id
      if (!supabaseNode.parameters.filters) {
        supabaseNode.parameters.filters = { conditions: [] };
      }
      
      if (!supabaseNode.parameters.filters.conditions) {
        supabaseNode.parameters.filters.conditions = [];
      }
      
      // Adicionar condição de mini_site_id
      supabaseNode.parameters.filters.conditions.push({
        keyName: 'mini_site_id',
        condition: 'eq',
        keyValue: miniSiteId
      });
    }
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
