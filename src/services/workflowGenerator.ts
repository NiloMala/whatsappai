import { AIModelProvider } from '@/types/ai-models';
import workflowTemplate from '@/assets/workflow_base.json';

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

export class WorkflowGenerator {
  private workflow: Workflow;

  constructor() {
    this.workflow = JSON.parse(JSON.stringify(workflowTemplate));
    this.updateCredentials();
    this.removeInvalidNodes();
  }

  /**
   * Remove nós que podem causar problemas quando exportados
   */
  private removeInvalidNodes(): void {
    // Remover sticky notes (notas visuais que não afetam a execução)
    this.workflow.nodes = this.workflow.nodes.filter(
      node => node.type !== 'n8n-nodes-base.stickyNote'
    );
    
    // Limpar IDs e webhookIds que são específicos do n8n de origem
    this.workflow.nodes.forEach(node => {
      // Manter apenas configurações essenciais do webhook
      if (node.type === 'n8n-nodes-base.webhook') {
        node.parameters = {
          ...node.parameters,
          responseMode: 'onReceived', // Responder imediatamente
          options: {}
        };
      }
    });
  }

  // Método estático para criar uma nova instância
  public static generate(
    model: AIModelProvider,
    instanceName: string,
    systemPrompt: string,
    credentials: Record<string, string>,
    webhookUrl: string,
    instanceApiKey?: string, // Mantido para compatibilidade, mas não usado aqui
    userId?: string
  ): { workflow: any; webhookPath: string } {
    const generator = new WorkflowGenerator();

    generator.replaceAIModel(model);
    generator.updateSystemPrompt(systemPrompt);
    generator.updateInstanceName(instanceName);
    const webhookPath = generator.updateWebhookUrl(webhookUrl);
    generator.injectCredentials(credentials);

    // NOTA: instanceApiKey é passado para a função Edge n8n-import-workflow
    // e NÃO é usado aqui no gerador. As credenciais da Evolution API são
    // criadas dinamicamente pela função Edge com base nesse parâmetro.

    // Atualizar user_id no Edit Fields se fornecido
    if (userId) {
      generator.updateUserId(userId);
    }
    
    // Validar workflow antes de retornar
    const isValid = generator.validateWorkflow();
    if (!isValid) {
      console.warn('⚠️ Workflow pode estar incompleto ou com problemas de configuração');
    }

    return {
      workflow: generator.getWorkflow(),
      webhookPath: webhookPath || generator.getWebhookPath()
    };
  }

  /**
   * Atualiza as credenciais dos serviços no workflow
   * Mantém as credenciais que já vêm do template
   */
  private updateCredentials(): void {
    this.workflow.nodes.forEach(node => {
      // Atualizar credenciais do Redis
      if (node.type === 'n8n-nodes-base.redis') {
        node.credentials = {
          redis: {
            id: 'rqMjL0iZoMNeOyxw',
            name: 'Redis account'
          }
        };
      }

      // Manter credenciais da Evolution API do template
      // As credenciais já vêm configuradas no workflow_base.json

      // Atualizar credenciais do Supabase
      if (node.type === 'n8n-nodes-base.supabase' || node.type === 'n8n-nodes-base.supabaseTool') {
        node.credentials = {
          supabaseApi: {
            id: 'sQw0N1EVFGS7nGKf',
            name: 'whatsappai'
          }
        };
      }
    });
  }

  /**
   * Encontra o nó do modelo de IA no workflow
   */
  private findAIModelNode(): WorkflowNode | null {
    return this.workflow.nodes.find(node => 
      node.type.includes('lmChat') || 
      node.name.includes('Chat Model')
    ) || null;
  }

  /**
   * Configura o modelo de IA baseado na escolha do usuário
   */
  replaceAIModel(provider: AIModelProvider): void {
    const openaiNode = this.workflow.nodes.find(n => n.type === '@n8n/n8n-nodes-langchain.lmChatOpenAi');
    const groqNode = this.workflow.nodes.find(n => n.type === '@n8n/n8n-nodes-langchain.lmChatGroq');
    
    // Resetar todas as conexões de modelos de IA
    if (this.workflow.connections['OpenAI Chat Model']) {
      delete this.workflow.connections['OpenAI Chat Model'];
    }
    if (this.workflow.connections['Groq Chat Model']) {
      delete this.workflow.connections['Groq Chat Model'];
    }

    if (!openaiNode || !groqNode) {
      throw new Error('AI model nodes not found in workflow template');
    }

    if (provider === 'openai') {
      // Configurar OpenAI
      openaiNode.credentials = {
        openAiApi: {
          id: 'gahlUfagbJRgeNsl',
          name: 'OpenAi account'
        }
      };
      // Conectar OpenAI ao AI Agent
      this.workflow.connections['OpenAI Chat Model'] = {
        ai_languageModel: [[{ node: 'AI Agent', type: 'ai_languageModel', index: 0 }]]
      };
      
    } else if (provider === 'groq') {
      // Configurar Groq
      groqNode.credentials = {
        groqApi: {
          id: 'h6NAjjnyhHL7WSVc',
          name: 'Groq WhatsappAI'
        }
      };
      // Conectar Groq ao AI Agent
      this.workflow.connections['Groq Chat Model'] = {
        ai_languageModel: [[{ node: 'AI Agent', type: 'ai_languageModel', index: 0 }]]
      };
    }
  }

  /**
   * Atualiza o system prompt no nó AI Agent
   * SEMPRE injeta o trecho de data/hora no início do prompt
   */
  updateSystemPrompt(prompt: string): void {
    const aiAgentNode = this.workflow.nodes.find(node =>
      node.name === 'AI Agent' || node.type.includes('agent')
    );

    if (aiAgentNode && aiAgentNode.parameters) {
      if (!aiAgentNode.parameters.options) {
        aiAgentNode.parameters.options = {};
      }

      // Trecho fixo de data/hora que SEMPRE será injetado
      const dateTimePrefix = `=Hoje é {{ $now.toFormat('EEEE, dd/MM/yyyy HH:mm') }} (horário de Brasília, UTC−03:00).\nSempre use essa data e horário como base para responder perguntas sobre tempo, "hoje", "amanhã", "semana que vem", etc.\n\n`;

      // Remove o trecho de data do prompt se já existir (para evitar duplicação)
      let cleanPrompt = prompt;

      // Remover variações do trecho de data que podem existir no template
      const datePatterns = [
        /=?Hoje é \{\{ \$now[^}]*\}\}[^\n]*\n[^\n]*\n\n/g,
        /Hoje é \{\{ \$now[^}]*\}\}[^\n]*\n/g,
        /Data atual: \{\{ \$now[^}]*\}\}[^\n]*\n?/g
      ];

      datePatterns.forEach(pattern => {
        cleanPrompt = cleanPrompt.replace(pattern, '');
      });

      // Remover o '=' inicial se existir no prompt limpo
      cleanPrompt = cleanPrompt.replace(/^=/, '');

      // Combinar: prefixo de data + prompt do usuário
      aiAgentNode.parameters.options.systemMessage = dateTimePrefix + cleanPrompt;
    }
  }

  /**
   * Atualiza o instanceName nos nós Evolution API
   */
  updateInstanceName(instanceName: string): void {
    this.workflow.nodes.forEach(node => {
      if (node.name.includes('Evolution API') || node.type.includes('evolution')) {
        if (node.parameters) {
          node.parameters.instanceName = instanceName;
        }
      }
    });
  }

  /**
   * REMOVIDO: updateEvolutionApiKey
   * As credenciais da Evolution API agora são criadas dinamicamente pela função Edge
   * n8n-import-workflow, que cria uma credencial dedicada para cada instância.
   * Não é mais necessário definir credenciais aqui no gerador de workflow.
   */

  /**
   * Atualiza o user_id no nó Edit Fields
   */
  updateUserId(userId: string): void {
    const editFieldsNode = this.workflow.nodes.find(node => 
      node.name === 'Edit Fields' && node.type === 'n8n-nodes-base.set'
    );

    if (editFieldsNode && editFieldsNode.parameters?.assignments?.assignments) {
      const assignments = editFieldsNode.parameters.assignments.assignments;
      const userIdAssignment = assignments.find((a: any) => a.name === 'user_id');
      
      if (userIdAssignment) {
        userIdAssignment.value = userId;
      }
    }
  }

  /**
   * Atualiza o webhook URL no nó Webhook
   */
  updateWebhookUrl(webhookUrl: string): string {
    const webhookNode = this.workflow.nodes.find(node => 
      node.name === 'Webhook' || node.type === 'n8n-nodes-base.webhook'
    );

    if (webhookNode && webhookNode.parameters) {
      const webhookPath = this.generateUUID();
      webhookNode.parameters.path = webhookPath;
      webhookNode.parameters.webhookId = webhookPath;
      
      // Retorna o webhook completo
      return `${webhookUrl}/${webhookPath}`;
    }
    return webhookUrl;
  }

  /**
   * Retorna o webhook path gerado
   */
  getWebhookPath(): string {
    const webhookNode = this.workflow.nodes.find(node => 
      node.name === 'Webhook' || node.type === 'n8n-nodes-base.webhook'
    );
    return webhookNode?.parameters?.path || '';
  }

  /**
   * Injeta credenciais do usuário nos nós
   */
  injectCredentials(credentials: Record<string, string>): void {
    this.workflow.nodes.forEach(node => {
      // Atualizar credenciais do Supabase nos nós Supabase
      if (node.type === 'n8n-nodes-base.supabase' || node.type === 'n8n-nodes-base.supabaseTool') {
        if (!node.credentials) {
          node.credentials = {};
        }
        
        // Usar credenciais do n8n
        node.credentials.supabaseApi = {
          id: 'sQw0N1EVFGS7nGKf',
          name: 'whatsappai'
        };
        
        // Corrigir o tipo do campo telefone para bigint
        this.fixPhoneFieldType(node);
      }
    });
  }

  /**
   * Corrige o campo telefone para usar bigint ao invés de text
   */
  private fixPhoneFieldType(node: WorkflowNode): void {
    if (node.type === 'n8n-nodes-base.supabaseTool' && node.parameters?.fieldsUi?.fieldValues) {
      node.parameters.fieldsUi.fieldValues.forEach((field: any) => {
        if (field.fieldId === 'telefone') {
          // Converter telefone para número removendo caracteres não numéricos
          const currentValue = field.fieldValue;
          
          // Se o valor já está tentando fazer a conversão, manter
          if (currentValue && !currentValue.includes('Number(')) {
            // Extrair a expressão que pega o telefone
            // De: ={{ $('Webhook').item.json.body.data.key.remoteJid.split('@')[0] }}
            // Para: ={{ Number($('Webhook').item.json.body.data.key.remoteJid.split('@')[0]) }}
            field.fieldValue = currentValue.replace(
              /=\{\{(.+)\}\}/,
              '={{ Number($1) }}'
            );
          }
        }
      });
    }
    
    // Corrigir filtros de busca também
    if (node.type === 'n8n-nodes-base.supabase' || node.type === 'n8n-nodes-base.supabaseTool') {
      if (node.parameters?.filters?.conditions) {
        node.parameters.filters.conditions.forEach((condition: any) => {
          if (condition.keyName === 'telefone') {
            const currentValue = condition.keyValue;
            if (currentValue && !currentValue.includes('Number(')) {
              condition.keyValue = currentValue.replace(
                /=\{\{(.+)\}\}/,
                '={{ Number($1) }}'
              );
            }
          }
        });
      }
    }
  }

  /**
   * Valida se o workflow está configurado corretamente
   */
  private validateWorkflow(): boolean {
    // Verificar se o webhook existe
    const hasWebhook = this.workflow.nodes.some(n => n.type === 'n8n-nodes-base.webhook');
    
    // Verificar se AI Agent existe
    const hasAgent = this.workflow.nodes.some(n => n.type === '@n8n/n8n-nodes-langchain.agent');
    
    // Verificar se Evolution API existe
    const hasEvolution = this.workflow.nodes.some(n => n.type === 'n8n-nodes-evolution-api.evolutionApi');
    
    console.log('Validação do workflow:', {
      hasWebhook,
      hasAgent,
      hasEvolution,
      totalNodes: this.workflow.nodes.length
    });
    
    return hasWebhook && hasAgent && hasEvolution;
  }

  /**
   * Mapeia tipo de credencial para nome do serviço
   */
  private getServiceNameFromCredType(credType: string): string {
    const mapping: Record<string, string> = {
      'openAiApi': 'openai',
      'groqApi': 'groq',
      'anthropicApi': 'claude',
      'ollamaApi': 'ollama',
      'evolutionApi': 'evolution',
      'redisApi': 'redis',
      'supabaseApi': 'supabase'
    };
    return mapping[credType] || credType;
  }

  /**
   * Gera IDs únicos para os nós se necessário
   */
  regenerateNodeIds(): void {
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
      newConnections[newId] = {
        main: connections.main.map(connectionArray =>
          connectionArray.map(conn => ({
            ...conn,
            node: oldToNewIdMap[conn.node] || conn.node
          }))
        )
      };
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

  /**
   * Método principal para gerar workflow completo
   */



}
