import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  const [miniSite, setMiniSite] = useState<MiniSite | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [activeTab, setActiveTab] = useState("config");

  // Form data
  const [formData, setFormData] = useState<MiniSiteFormData>({
    name: "",
    slug: "",
    logo: "",
    banner: "",
    whatsapp_number: "",
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
          theme_color: sites.theme_color,
          description: sites.description,
          template: sites.template,
          operating_hours: sites.operating_hours,
          available_days: sites.available_days,
          delivery_fees: sites.delivery_fees,
          payment_methods: sites.payment_methods,
          delivery_info: sites.delivery_info,
        });

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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Mini Site</h1>
          <p className="text-muted-foreground">
            Crie um site personalizado para agendamentos ou catálogo de produtos
          </p>
        </div>

        {miniSite && (
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Link Público do seu Mini Site
              </CardTitle>
              <CardDescription>
                Compartilhe este link com seus clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={publicUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button onClick={copyToClipboard} variant="outline">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => window.open(publicUrl, "_blank")}
                  variant="default"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Visualizar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-2" disabled={!miniSite}>
              <Package className="h-4 w-4" />
              {formData.template === "delivery" ? "Produtos" : "Serviços"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Tipo de Negócio</CardTitle>
            <CardDescription>Escolha o template ideal para seu negócio</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={formData.template}
              onValueChange={(value) =>
                setFormData({ ...formData, template: value as "booking" | "delivery" })
              }
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="booking" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Agendamento (Serviços)
                </TabsTrigger>
                <TabsTrigger value="delivery" className="gap-2">
                  <Store className="h-4 w-4" />
                  Cardápio/Delivery
                </TabsTrigger>
              </TabsList>
              <TabsContent value="booking" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Ideal para: Salões, barbearias, clínicas, consultorias, serviços agendados
                </p>
              </TabsContent>
              <TabsContent value="delivery" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Ideal para: Lanchonetes, pizzarias, restaurantes, lojas, e-commerce
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-3 gap-4">
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
                    <div className="grid grid-cols-2 gap-3">
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
                            className="h-4 w-4"
                          />
                          <Label htmlFor={`payment-${method}`} className="font-normal cursor-pointer">
                            {method}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="delivery-info">Informações de Entrega</Label>
                    <Textarea
                      id="delivery-info"
                      value={formData.delivery_info || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, delivery_info: e.target.value })
                      }
                      placeholder="Ex: Entrega grátis acima de R$ 30"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Informações sobre entrega, tempo estimado, etc.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSaveMiniSite} disabled={saving} size="lg">
                <Save className="h-4 w-4 mr-2" />
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
                  >
                    <Plus className="h-4 w-4 mr-2" />
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
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal para adicionar/editar item */}
        <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? `Editar ${itemType}` : `Adicionar ${itemType}`}
              </DialogTitle>
              <DialogDescription>
                Preencha as informações do {itemType}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="space-y-2">
                <Label htmlFor="item-image">URL da Imagem</Label>
                <Input
                  id="item-image"
                  value={itemFormData.image_url || ""}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, image_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              {/* Opções Adicionais */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Opções Adicionais</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
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
                          className="flex-1"
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
                          className="w-24"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
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

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsItemModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveItem}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default MiniSitePage;
