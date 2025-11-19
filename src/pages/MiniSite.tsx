import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DeliveryWorkflowGenerator } from "@/services/deliveryWorkflowGenerator";
import {
  Calendar,
  Store,
  ExternalLink,
  Copy,
  Save,
  Plus,
  Trash2,
  Pencil,
  Package,
  Settings,
  Truck,
  X,
} from "lucide-react";
import type { MiniSite, MiniSiteFormData, MenuItem, MenuItemFormData } from "@/types/mini-site";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMiniSiteUrl } from "@/config/constants";

const MiniSitePage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [miniSite, setMiniSite] = useState<MiniSite | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [activeTab, setActiveTab] = useState("config");
  const [isDeliveryFeeModalOpen, setIsDeliveryFeeModalOpen] = useState(false);
  const [deliveryFeeType, setDeliveryFeeType] = useState<"fixed" | "by_neighborhood">("fixed");
  const [fixedDeliveryFee, setFixedDeliveryFee] = useState<number>(0);
  const [neighborhoodFees, setNeighborhoodFees] = useState<Array<{ name: string; fee: number }>>([]);

  // Form data
  const [formData, setFormData] = useState<MiniSiteFormData>({
    name: "",
    slug: "",
    logo: "",
    banner: "",
    whatsapp_number: "",
    agent_id: null,
    theme_color: "#10B981",
    background_color: "#ffffff",
    button_color: "#1d4ed8",
    text_color: "#000000",
    template: "booking",
    description: "",
    available_days: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"],
    operating_hours: {
      start: "09:00",
      end: "18:00",
    },
    payment_methods: ["Dinheiro", "PIX", "Cartão"],
    delivery_fees: [],
  });

  const [itemFormData, setItemFormData] = useState<MenuItemFormData>({
    title: "",
    description: "",
    price: 0,
    category: "",
    available: true,
  });

  // preview validation state for images
  const [logoValid, setLogoValid] = useState(true);
  const [bannerValid, setBannerValid] = useState(true);

  useEffect(() => {
    loadMiniSite();
  }, []);

  const loadMiniSite = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      // Buscar agentes do usuário
      const { data: agentsData, error: agentsError } = await supabase
        .from("agents")
        .select("id, name")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (agentsError) {
        console.error("Erro ao carregar agentes:", agentsError);
      } else {
        setAgents(agentsData || []);
      }

      // Buscar mini site do usuário
      const { data: sites, error: siteError } = await supabase
        .from("mini_sites")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (siteError && siteError.code !== "PGRST116") {
        throw siteError;
      }

      if (sites) {
        setMiniSite(sites);
        setFormData({
          name: sites.name,
          slug: sites.slug,
          logo: sites.logo,
          banner: sites.banner,
          address: sites.address,
          phone: sites.phone,
          whatsapp_number: sites.whatsapp_number,
          agent_id: sites.agent_id,
          theme_color: sites.theme_color,
          background_color: sites.background_color || formData.background_color,
          button_color: sites.button_color || formData.button_color,
          text_color: sites.text_color || formData.text_color,
          card_color: sites.card_color || formData.card_color,
          description: sites.description,
          template: sites.template,
          operating_hours: sites.operating_hours,
          available_days: sites.available_days,
          delivery_fees: sites.delivery_fees,
          payment_methods: sites.payment_methods,
          delivery_info: sites.delivery_info,
          delivery_fee_type: sites.delivery_fee_type || "fixed",
          delivery_fee_value: sites.delivery_fee_value || 0,
          delivery_neighborhoods: sites.delivery_neighborhoods || [],
        });

        // Preencher estados de taxa de entrega
        if (sites.delivery_fee_type) {
          setDeliveryFeeType(sites.delivery_fee_type);
        }
        if (sites.delivery_fee_value !== undefined) {
          setFixedDeliveryFee(sites.delivery_fee_value);
        }
        if (sites.delivery_neighborhoods) {
          setNeighborhoodFees(sites.delivery_neighborhoods);
        }

        // Buscar itens do menu
        const { data: items, error: itemsError } = await supabase
          .from("menu_items")
          .select("*")
          .eq("mini_site_id", sites.id)
          .order("created_at", { ascending: false });

        if (itemsError) throw itemsError;
        setMenuItems(items || []);
      }
    } catch (error) {
      console.error("Erro ao carregar mini site:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do mini site.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMiniSite = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Validar slug (apenas letras, números e hífens)
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(formData.slug)) {
        toast({
          title: "Slug inválido",
          description: "Use apenas letras minúsculas, números e hífens.",
          variant: "destructive",
        });
        return;
      }

      if (miniSite) {
        // Atualizar
        const { error } = await supabase
          .from("mini_sites")
          .update(formData)
          .eq("id", miniSite.id);

        if (error) throw error;

        toast({
          title: "Sucesso!",
          description: "Mini site atualizado com sucesso.",
        });
      } else {
        // Criar novo
        const { data, error } = await supabase
          .from("mini_sites")
          .insert([{ ...formData, user_id: user.id }])
          .select()
          .single();

        if (error) throw error;

        setMiniSite(data);
        toast({
          title: "Sucesso!",
          description: "Mini site criado com sucesso.",
        });
      }

      loadMiniSite();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      if (error.code === "23505") {
        toast({
          title: "Erro",
          description: "Este slug já está em uso. Escolha outro.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível salvar o mini site.",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDeliveryAgent = async () => {
    if (!miniSite) {
      toast({
        title: "Erro",
        description: "Mini site não encontrado. Salve o mini site primeiro.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.whatsapp_number) {
      toast({
        title: "Erro",
        description: "Configure o número do WhatsApp antes de criar o agente.",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreatingAgent(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar instance_key da tabela whatsapp_connections
      const { data: whatsappConnection, error: connectionError } = await supabase
        .from("whatsapp_connections")
        .select("instance_key, phone_number")
        .eq("status", "connected")
        .maybeSingle();

      if (connectionError || !whatsappConnection) {
        toast({
          title: "Erro",
          description: "Nenhuma instância do WhatsApp conectada encontrada. Conecte o WhatsApp primeiro na página /whatsapp.",
          variant: "destructive",
        });
        return;
      }

      const instanceKey = whatsappConnection.instance_key;

      // Gerar workflow de delivery
      const { workflow, webhookPath } = DeliveryWorkflowGenerator.generate({
        miniSiteId: miniSite.id,
        miniSiteName: formData.name,
        instanceName: instanceKey, // Usar instance_key
        whatsappNumber: formData.whatsapp_number,
        webhookUrl: import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://webhook.auroratech.tech/webhook',
        userId: user.id
      });

      // Chamar Edge Function para criar agente
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-delivery-agent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            miniSiteId: miniSite.id,
            miniSiteName: formData.name,
            whatsappNumber: formData.whatsapp_number,
            userId: user.id,
            instanceName: instanceKey, // Enviar instance_key
            workflow, // Enviar workflow gerado
            webhookUrl: webhookPath // Enviar webhook path
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar agente');
      }

      toast({
        title: "Agente Criado!",
        description: "Agente de delivery criado e vinculado ao mini site com sucesso. 🤖",
      });

      // Recarregar dados
      await loadMiniSite();
      
      // Recarregar lista de agentes
      const { data: agentsList } = await supabase
        .from("agents")
        .select("id, name")
        .eq("user_id", user.id);
      
      if (agentsList) {
        setAgents(agentsList);
      }

    } catch (error: any) {
      console.error("Erro ao criar agente:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar o agente.",
        variant: "destructive",
      });
    } finally {
      setCreatingAgent(false);
    }
  };

  const handleSaveItem = async () => {
    try {
      if (!miniSite) return;
      const categoryToSave = isNewCategory ? newCategory : itemFormData.category;

      if (editingItem) {
        // Atualizar
        const { error } = await supabase
          .from("menu_items")
          .update({ ...itemFormData, category: categoryToSave })
          .eq("id", editingItem.id);

        if (error) throw error;

        toast({
          title: "Item atualizado!",
          description: "O item foi atualizado com sucesso.",
        });
      } else {
        // Criar novo
        const { error } = await supabase
          .from("menu_items")
          .insert([{ ...itemFormData, category: categoryToSave, mini_site_id: miniSite.id }]);

        if (error) throw error;

        toast({
          title: "Item adicionado!",
          description: "O novo item foi criado com sucesso.",
        });
      }

      setIsItemModalOpen(false);
      setEditingItem(null);
      resetItemForm();
      loadMiniSite();
    } catch (error) {
      console.error("Erro ao salvar item:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o item.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este item?")) return;

    try {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Item excluído!",
        description: "O item foi removido com sucesso.",
      });

      loadMiniSite();
    } catch (error) {
      console.error("Erro ao excluir item:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o item.",
        variant: "destructive",
      });
    }
  };

  const openEditItemModal = (item: MenuItem) => {
    setEditingItem(item);
    setItemFormData({
      title: item.title,
      description: item.description,
      price: item.price,
      category: item.category,
      duration: item.duration,
      image_url: item.image_url,
      options: item.options,
      available: item.available ?? true,
    });
    // If the category isn't in the existing list, treat it as a new category
    const categories = Array.from(new Set(menuItems.map((m) => m.category).filter(Boolean)));
    if (item.category && !categories.includes(item.category)) {
      setIsNewCategory(true);
      setNewCategory(item.category);
    } else {
      setIsNewCategory(false);
      setNewCategory("");
    }
    setIsItemModalOpen(true);
  };

  const resetItemForm = () => {
    setItemFormData({
      title: "",
      description: "",
      price: 0,
      category: "",
      available: true,
    });
    setIsNewCategory(false);
    setNewCategory("");
  };

  const publicUrl = miniSite ? getMiniSiteUrl(miniSite.slug) : "";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicUrl);
    toast({
      title: "Link copiado!",
      description: "O link do seu mini site foi copiado para a área de transferência.",
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const itemType = formData.template === "delivery" ? "produto" : "serviço";

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Mini Site</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Crie um site personalizado para agendamentos ou catálogo de produtos
          </p>
        </div>

        {/* public link moved to bottom for layout preference */}

        {/* Tipo de Negócio shown first so user selects business type before tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Tipo de Negócio</CardTitle>
            <CardDescription>Escolha entre serviço (agendamentos) ou delivery (produtos)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button
                size="lg"
                className="w-full sm:w-auto min-h-[48px]"
                variant={formData.template === "booking" ? "default" : "outline"}
                onClick={() => setFormData({ ...formData, template: "booking" })}
              >
                <Calendar className="h-5 w-5 mr-2" />
                Serviço (agendamentos)
              </Button>

              <Button
                size="lg"
                className="w-full sm:w-auto min-h-[48px]"
                variant={formData.template === "delivery" ? "default" : "outline"}
                onClick={() => setFormData({ ...formData, template: "delivery" })}
              >
                <Store className="h-5 w-5 mr-2" />
                Delivery / Produtos
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Now place the page-level tabs below Tipo de Negócio */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mt-6 h-auto">
            <TabsTrigger value="config" className="gap-2 py-3 text-sm sm:text-base">
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Configurações</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-2 py-3 text-sm sm:text-base" disabled={!miniSite}>
              <Package className="h-4 w-4 sm:h-5 sm:w-5" />
              {formData.template === "delivery" ? "Produtos" : "Serviços"}
            </TabsTrigger>
          </TabsList>

        <TabsContent value="config" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Negócio *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Minha Loja"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Personalizada (slug) *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
                  }
                  placeholder="minha-loja"
                  disabled={!!miniSite}
                />
                <p className="text-xs text-muted-foreground">
                  Será: {formData.slug || "seu-slug"}.teatende.online
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Bem-vindo ao nosso catálogo..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="logo">URL da Logo</Label>
                <Input
                  id="logo"
                  value={formData.logo || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, logo: e.target.value });
                    setLogoValid(true);
                  }}
                  placeholder="https://.../logo.png"
                />
                <p className="text-xs text-muted-foreground">URL pública da imagem do logo (usada no card sobre o banner)</p>
                {formData.logo && logoValid && (
                  <div className="mt-2 flex justify-center">
                    <img
                      src={formData.logo}
                      alt="Logo preview"
                      className="h-20 w-20 rounded-full object-cover border"
                      onError={() => setLogoValid(false)}
                      onLoad={() => setLogoValid(true)}
                    />
                  </div>
                )}
                {formData.logo && !logoValid && (
                  <p className="text-xs text-destructive mt-2">Não foi possível carregar a imagem da logo. Verifique a URL.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="banner">URL do Banner</Label>
                <Input
                  id="banner"
                  value={formData.banner || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, banner: e.target.value });
                    setBannerValid(true);
                  }}
                  placeholder="https://.../banner.jpg"
                />
                <p className="text-xs text-muted-foreground">URL pública do banner (imagem de topo)</p>
                {formData.banner && bannerValid && (
                  <div className="mt-2">
                    <img
                      src={formData.banner}
                      alt="Banner preview"
                      className="w-full h-28 object-cover rounded"
                      onError={() => setBannerValid(false)}
                      onLoad={() => setBannerValid(true)}
                    />
                  </div>
                )}
                {formData.banner && !bannerValid && (
                  <p className="text-xs text-destructive mt-2">Não foi possível carregar o banner. Verifique a URL.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp *</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp_number}
                  onChange={(e) =>
                    setFormData({ ...formData, whatsapp_number: e.target.value })
                  }
                  placeholder="5511999999999"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="(11) 9999-9999"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address || ""}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Rua Exemplo, 123"
              />
            </div>

            {formData.template === "delivery" && (
              <div className="space-y-2">
                <Label htmlFor="agent">Agente IA para Pedidos</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.agent_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, agent_id: value === "none" ? null : value })
                    }
                    disabled={creatingAgent}
                  >
                    <SelectTrigger id="agent" className="flex-1">
                      <SelectValue placeholder="Selecione um agente (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (envio direto ao WhatsApp)</SelectItem>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button
                    type="button"
                    onClick={handleCreateDeliveryAgent}
                    disabled={!miniSite || creatingAgent || !formData.whatsapp_number}
                    variant="outline"
                    className="whitespace-nowrap"
                  >
                    {creatingAgent ? (
                      <>⏳ Criando...</>
                    ) : (
                      <>🤖 Criar Agente</>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {miniSite 
                    ? "Cria um agente IA completo com workflow de delivery automaticamente. Inclui: confirmação de pedidos, consulta de status, intervenção humana e bloqueio temporário."
                    : "Salve o mini site primeiro para criar um agente automático."}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="theme">Cor do Tema</Label>
              <div className="flex gap-2">
                <Input
                  id="theme"
                  type="color"
                  value={formData.theme_color}
                  onChange={(e) =>
                    setFormData({ ...formData, theme_color: e.target.value })
                  }
                  className="w-20 h-10"
                />
                <Input
                  value={formData.theme_color}
                  onChange={(e) =>
                    setFormData({ ...formData, theme_color: e.target.value })
                  }
                  placeholder="#10B981"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="background_color">Cor de Fundo</Label>
                <div className="flex gap-2">
                  <Input
                    id="background_color"
                    type="color"
                    value={formData.background_color}
                    onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                    className="w-16 h-10"
                  />
                  <Input
                    value={formData.background_color}
                    onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                    placeholder="#ffffff"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="button_color">Cor do Botão</Label>
                <div className="flex gap-2">
                  <Input
                    id="button_color"
                    type="color"
                    value={formData.button_color}
                    onChange={(e) => setFormData({ ...formData, button_color: e.target.value })}
                    className="w-16 h-10"
                  />
                  <Input
                    value={formData.button_color}
                    onChange={(e) => setFormData({ ...formData, button_color: e.target.value })}
                    placeholder="#1d4ed8"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="text_color">Cor do Texto</Label>
                <div className="flex gap-2">
                  <Input
                    id="text_color"
                    type="color"
                    value={formData.text_color}
                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                    className="w-16 h-10"
                  />
                  <Input
                    value={formData.text_color}
                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="card_color">Cor dos Cards</Label>
                <div className="flex gap-2">
                  <Input
                    id="card_color"
                    type="color"
                    value={formData.card_color || "#ffffff"}
                    onChange={(e) => setFormData({ ...formData, card_color: e.target.value })}
                    className="w-16 h-10"
                  />
                  <Input
                    value={formData.card_color || "#ffffff"}
                    onChange={(e) => setFormData({ ...formData, card_color: e.target.value })}
                    placeholder="#ffffff"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

            {formData.template === "delivery" && (
              <Card>
                <CardHeader>
                  <CardTitle>Configurações de Delivery</CardTitle>
                  <CardDescription>Configure formas de pagamento e taxas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Formas de Pagamento Aceitas</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {["Dinheiro", "PIX", "Cartão de Crédito", "Cartão de Débito", "Vale Refeição"].map((method) => (
                        <div key={method} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`payment-${method}`}
                            checked={formData.payment_methods?.includes(method) || false}
                            onChange={(e) => {
                              const current = formData.payment_methods || [];
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  payment_methods: [...current, method],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  payment_methods: current.filter((m) => m !== method),
                                });
                              }
                            }}
                            className="h-5 w-5"
                          />
                          <Label htmlFor={`payment-${method}`} className="font-normal cursor-pointer text-sm">
                            {method}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Taxa de Entrega</Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDeliveryFeeModalOpen(true)}
                      className="w-full min-h-[44px] justify-start"
                    >
                      <Truck className="mr-2 h-4 w-4" />
                      {deliveryFeeType === "fixed"
                        ? `Taxa Fixa: R$ ${fixedDeliveryFee.toFixed(2)}`
                        : `Taxa por Bairro (${neighborhoodFees.length} bairros)`
                      }
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Configure a taxa de entrega para seus pedidos
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSaveMiniSite} disabled={saving} size="lg" className="w-full sm:w-auto min-h-[48px]">
                <Save className="h-5 w-5 mr-2" />
                {saving ? "Salvando..." : miniSite ? "Atualizar Mini Site" : "Criar Mini Site"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="items" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {formData.template === "delivery" ? "Produtos" : "Serviços"}
                    </CardTitle>
                    <CardDescription>
                      Gerencie os itens do seu catálogo
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      resetItemForm();
                      setEditingItem(null);
                      setIsItemModalOpen(true);
                    }}
                    className="w-full sm:w-auto min-h-[48px]"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Adicionar {itemType}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {menuItems.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum {itemType} cadastrado ainda.</p>
                    <p className="text-sm">Clique em "Adicionar {itemType}" para começar.</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile view: Cards */}
                    <div className="md:hidden space-y-3">
                      {menuItems.map((item) => (
                        <div key={item.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-semibold text-base">{item.title}</h3>
                              <p className="text-sm text-muted-foreground">{item.category}</p>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ml-2 ${
                                item.available
                                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                              }`}
                            >
                              {item.available ? "Disponível" : "Indisponível"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <div className="space-y-1">
                              <p className="font-medium text-lg">R$ {item.price.toFixed(2)}</p>
                              {formData.template === "booking" && item.duration && (
                                <p className="text-muted-foreground">{item.duration}min</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-h-[44px] min-w-[44px]"
                                onClick={() => openEditItemModal(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-h-[44px] min-w-[44px]"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop view: Table */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Preço</TableHead>
                            {formData.template === "booking" && <TableHead>Duração</TableHead>}
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {menuItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.title}</TableCell>
                              <TableCell>{item.category}</TableCell>
                              <TableCell>R$ {item.price.toFixed(2)}</TableCell>
                              {formData.template === "booking" && (
                                <TableCell>{item.duration ? `${item.duration}min` : "-"}</TableCell>
                              )}
                              <TableCell>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs ${
                                    item.available
                                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                      : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                  }`}
                                >
                                  {item.available ? "Disponível" : "Indisponível"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditItemModal(item)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteItem(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Moved: Link Público do seu Mini Site (mostrar ao final da página) */}
        {miniSite && (
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Link Público do seu Site
              </CardTitle>
              <CardDescription>
                Compartilhe este link com seus clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={publicUrl}
                  readOnly
                  className="font-mono text-sm flex-1"
                />
                <div className="flex gap-2">
                  <Button onClick={copyToClipboard} variant="outline" className="flex-1 sm:flex-none min-h-[44px]">
                    <Copy className="h-4 w-4 sm:mr-0" />
                    <span className="ml-2 sm:hidden">Copiar</span>
                  </Button>
                  <Button
                    onClick={() => window.open(publicUrl, "_blank")}
                    variant="default"
                    className="flex-1 sm:flex-none min-h-[44px]"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Visualizar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal para adicionar/editar item */}
        <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                {editingItem ? `Editar ${itemType}` : `Adicionar ${itemType}`}
              </DialogTitle>
              <DialogDescription className="text-sm">
                Preencha as informações do {itemType}
              </DialogDescription>
            </DialogHeader>
              {/* Scrollable area: keep the footer visible while allowing the form to scroll vertically when long (hide horizontal scroll) */}
              <div
                className="pr-2 sm:pr-6 overflow-x-hidden overflow-y-auto flex-1"
                style={{
                  maxHeight: (itemFormData.options && itemFormData.options.length >= 1) ? '60vh' : '70vh'
                }}
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="item-title">Nome *</Label>
                  <Input
                    id="item-title"
                    value={itemFormData.title}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, title: e.target.value })
                    }
                    placeholder="Nome do item"
                  />
                </div>
                  <div className="space-y-2">
                    <Label htmlFor="item-category">Categoria *</Label>
                    {(() => {
                      const categories = Array.from(new Set(menuItems.map((m) => m.category).filter(Boolean)));
                      if (!isNewCategory) {
                        return (
                          <div className="flex gap-2">
                            <select
                              id="item-category"
                              value={itemFormData.category || ""}
                              onChange={(e) => {
                                if (e.target.value === "__new__") {
                                  setIsNewCategory(true);
                                  setNewCategory("");
                                  setItemFormData({ ...itemFormData, category: "" });
                                } else {
                                  setItemFormData({ ...itemFormData, category: e.target.value });
                                }
                              }}
                              className="flex-1 p-2 border rounded"
                              style={{ width: 'calc(100% - 20px)' }}
                            >
                              <option value="">Selecione</option>
                              {categories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                              <option value="__new__">Adicionar nova categoria...</option>
                            </select>
                            <Button variant="outline" size="sm" onClick={() => { setIsNewCategory(true); setNewCategory(""); }}>
                              <Plus className="h-4 w-4 mr-1" />
                              Nova
                            </Button>
                          </div>
                        );
                      }

                      return (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Nova categoria"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            className="flex-1"
                          />
                          <Button variant="ghost" size="icon" onClick={() => { setIsNewCategory(false); setNewCategory(""); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-description">Descrição</Label>
                <Textarea
                  id="item-description"
                  value={itemFormData.description}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, description: e.target.value })
                  }
                  placeholder="Descrição do item"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="item-price">Preço (R$) *</Label>
                  <Input
                    id="item-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemFormData.price}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                {formData.template === "booking" && (
                  <div className="space-y-2">
                    <Label htmlFor="item-duration">Duração (minutos)</Label>
                    <Input
                      id="item-duration"
                      type="number"
                      min="0"
                      value={itemFormData.duration || ""}
                      onChange={(e) =>
                        setItemFormData({
                          ...itemFormData,
                          duration: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                )}
              </div>

              {/* Image URL removed from modal per request */}

              {/* Opções Adicionais */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Opções Adicionais</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[40px]"
                    onClick={() => {
                      const newOptions = [...(itemFormData.options || []), {
                        id: `temp-${Date.now()}`,
                        name: "",
                        price: 0
                      }];
                      setItemFormData({ ...itemFormData, options: newOptions });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Opção
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ex: Borda recheada, molho extra, etc.
                </p>
                
                {itemFormData.options && itemFormData.options.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {itemFormData.options.map((option, index) => (
                      <div key={option.id || index} className="flex gap-2 items-center">
                        <Input
                          placeholder="Nome da opção"
                          value={option.name}
                          onChange={(e) => {
                            const newOptions = [...(itemFormData.options || [])];
                            newOptions[index] = { ...newOptions[index], name: e.target.value };
                            setItemFormData({ ...itemFormData, options: newOptions });
                          }}
                          className="flex-1 min-h-[44px]"
                        />
                        <Input
                          type="number"
                          placeholder="Preço"
                          step="0.01"
                          min="0"
                          value={option.price}
                          onChange={(e) => {
                            const newOptions = [...(itemFormData.options || [])];
                            newOptions[index] = { ...newOptions[index], price: parseFloat(e.target.value) || 0 };
                            setItemFormData({ ...itemFormData, options: newOptions });
                          }}
                          className="w-20 sm:w-24 min-h-[44px]"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="min-h-[44px] min-w-[44px]"
                          onClick={() => {
                            const newOptions = (itemFormData.options || []).filter((_, i) => i !== index);
                            setItemFormData({ ...itemFormData, options: newOptions });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="item-available"
                  checked={itemFormData.available}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, available: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="item-available">Disponível para venda</Label>
              </div>
            </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsItemModalOpen(false)}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveItem}
                className="w-full sm:w-auto min-h-[44px]"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Configuração de Taxa de Entrega */}
        <Dialog open={isDeliveryFeeModalOpen} onOpenChange={setIsDeliveryFeeModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Configurar Taxa de Entrega</DialogTitle>
              <DialogDescription className="text-sm">
                Defina como cobrar pela entrega dos seus produtos
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 pr-2 sm:pr-4 space-y-4">
              {/* Tipo de Taxa */}
              <div className="space-y-2">
                <Label>Tipo de Taxa</Label>
                <Select value={deliveryFeeType} onValueChange={(value: "fixed" | "by_neighborhood") => setDeliveryFeeType(value)}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Selecione o tipo de taxa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Taxa Fixa (mesmo valor para todos)</SelectItem>
                    <SelectItem value="by_neighborhood">Taxa por Bairro (valores diferentes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Taxa Fixa */}
              {deliveryFeeType === "fixed" && (
                <div className="space-y-2">
                  <Label htmlFor="fixed-fee">Valor da Taxa de Entrega</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">R$</span>
                    <Input
                      id="fixed-fee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={fixedDeliveryFee}
                      onChange={(e) => setFixedDeliveryFee(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="min-h-[44px]"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Este valor será aplicado a todos os pedidos
                  </p>
                </div>
              )}

              {/* Taxa por Bairro */}
              {deliveryFeeType === "by_neighborhood" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Bairros e Valores</Label>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setNeighborhoodFees([...neighborhoodFees, { name: "", fee: 0 }])}
                      className="min-h-[40px]"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Bairro
                    </Button>
                  </div>

                  {neighborhoodFees.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum bairro cadastrado</p>
                      <p className="text-xs">Clique em "Adicionar Bairro" para começar</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {neighborhoodFees.map((neighborhood, index) => (
                        <div key={index} className="flex gap-2 items-center p-3 border rounded-lg">
                          <Input
                            placeholder="Nome do bairro"
                            value={neighborhood.name}
                            onChange={(e) => {
                              const newFees = [...neighborhoodFees];
                              newFees[index].name = e.target.value;
                              setNeighborhoodFees(newFees);
                            }}
                            className="flex-1 min-h-[44px]"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-muted-foreground">R$</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={neighborhood.fee}
                              onChange={(e) => {
                                const newFees = [...neighborhoodFees];
                                newFees[index].fee = parseFloat(e.target.value) || 0;
                                setNeighborhoodFees(newFees);
                              }}
                              className="w-24 sm:w-28 min-h-[44px]"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setNeighborhoodFees(neighborhoodFees.filter((_, i) => i !== index));
                            }}
                            className="min-h-[44px] min-w-[44px]"
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    O cliente precisará selecionar o bairro no checkout
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDeliveryFeeModalOpen(false)}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  // Salvar configurações no formData
                  setFormData({
                    ...formData,
                    delivery_fee_type: deliveryFeeType,
                    delivery_fee_value: deliveryFeeType === "fixed" ? fixedDeliveryFee : 0,
                    delivery_neighborhoods: deliveryFeeType === "by_neighborhood" ? neighborhoodFees : [],
                  });
                  setIsDeliveryFeeModalOpen(false);
                  toast({
                    title: "Configuração salva",
                    description: "A taxa de entrega foi configurada. Lembre-se de salvar o Mini Site.",
                  });
                }}
                className="w-full sm:w-auto min-h-[44px]"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Configuração
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default MiniSitePage;
