import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getSlugFromHostname, isPublicMiniSite } from "@/config/constants";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Phone, MapPin, Clock, ShoppingCart, Calendar as CalendarIcon, Eye, Menu } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { MiniSite, MenuItem, ProductOption } from "@/types/mini-site";
import { readableTextColor } from "@/lib/utils";

const PublicMiniSite = () => {
  const { slug } = useParams<{ slug: string }>();
  const resolvedSlug = slug || (typeof window !== 'undefined' && isPublicMiniSite() ? getSlugFromHostname() : null);
  const [loading, setLoading] = useState(true);
  const [miniSite, setMiniSite] = useState<MiniSite | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [categoryOpen, setCategoryOpen] = useState(false);
  
  // Carregar carrinho do localStorage na inicialização
  type CartItem = { cartId: string; item: MenuItem; quantity: number; selectedOptions?: ProductOption[] };
  const [selectedItems, setSelectedItems] = useState<CartItem[]>(() => {
    try {
      const hostSlug = (typeof window !== 'undefined' && isPublicMiniSite()) ? getSlugFromHostname() : null;
      const keySlug = slug || hostSlug;
      const saved = keySlug ? localStorage.getItem(`cart_${keySlug}`) : null;
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [optionModalItem, setOptionModalItem] = useState<MenuItem | null>(null);
  const [optionSelections, setOptionSelections] = useState<Record<string, boolean>>({});
  const [optionQuantity, setOptionQuantity] = useState(1);
  // description modal state (moved here to keep hooks order stable)
  const [descModalOpen, setDescModalOpen] = useState(false);
  const [descModalText, setDescModalText] = useState<string | null>(null);
  const openDescModal = (text: string | undefined | null) => {
    if (!text) return;
    // Normalize lines: trim, remove empties
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

    const processed: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let rawLine = lines[i];
      // Remove the line that says "Detalhes do produto" (case-insensitive)
      if (/^detalh(es)? do produto/i.test(rawLine)) continue;

      // Collapse repeated phrase patterns inside the same line like
      // "PASTEL CARNE PASTEL CARNE PASTEL CARNE" -> "PASTEL CARNE"
      const tokens = rawLine.split(/\s+/).filter(Boolean);
      let reduced = rawLine;

      if (tokens.length > 1) {
        for (let k = 1; k <= Math.floor(tokens.length / 2); k++) {
          if (tokens.length % k !== 0) continue;
          const pattern = tokens.slice(0, k).join(" ");
          let ok = true;
          for (let j = 0; j < tokens.length; j += k) {
            const chunk = tokens.slice(j, j + k).join(" ");
            if (chunk !== pattern) {
              ok = false;
              break;
            }
          }
          if (ok) {
            reduced = pattern;
            break;
          }
        }
      }

      // Only collapse consecutive identical lines — preserve non-consecutive repeats
      if (processed.length === 0 || processed[processed.length - 1] !== reduced) {
        processed.push(reduced);
      }
    }

    const finalText = processed.length ? processed.join("\n") : text.trim();
    setDescModalText(finalText);
    setDescModalOpen(true);
  };
  
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState({
    name: "",
    phone: "",
    address: "",
    paymentMethod: "",
    observations: "",
  });
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    loadMiniSite();
  }, [slug, resolvedSlug]);

  // Salvar carrinho no localStorage sempre que mudar
  useEffect(() => {
    if (resolvedSlug) {
      localStorage.setItem(`cart_${resolvedSlug}`, JSON.stringify(selectedItems));
    }
  }, [selectedItems, resolvedSlug]);

  const loadMiniSite = async () => {
    try {
      if (!resolvedSlug) return;

      // Buscar mini site pelo slug (rota ou subdomínio)
      const { data: site, error: siteError } = await supabase
        .from("mini_sites")
        .select("*")
        .eq("slug", resolvedSlug)
        .eq("is_active", true)
        .maybeSingle();

      if (siteError) throw siteError;

      if (!site) {
        setLoading(false);
        return;
      }

      console.log("Mini site carregado:", site);
      console.log("Banner URL:", site.banner);
      console.log("Logo URL:", site.logo);
      console.log("Tem logo?", !!site.logo);
      console.log("Agent ID:", site.agent_id);
      setMiniSite(site);

      // Buscar itens do menu
      const { data: items, error: itemsError } = await supabase
        .from("menu_items")
        .select("*")
        .eq("mini_site_id", site.id)
        .eq("available", true)
        .order("category", { ascending: true });

      if (itemsError) throw itemsError;
      setMenuItems(items || []);
    } catch (error) {
      console.error("Erro ao carregar mini site:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!miniSite) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Mini Site não encontrado</h1>
          <p className="text-muted-foreground">Verifique se o endereço está correto.</p>
        </div>
      </div>
    );
  }

  const addToCart = (cartItem: CartItem) => {
    setSelectedItems((prev) => {
      // try to merge same item+options
      const existingIndex = prev.findIndex((p) => {
        if (p.item.id !== cartItem.item.id) return false;
        const a = p.selectedOptions || [];
        const b = cartItem.selectedOptions || [];
        if (a.length !== b.length) return false;
        const aIds = a.map((o) => o.id).sort().join(",");
        const bIds = b.map((o) => o.id).sort().join(",");
        return aIds === bIds;
      });
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = { ...copy[existingIndex], quantity: copy[existingIndex].quantity + cartItem.quantity };
        return copy;
      }
      return [...prev, cartItem];
    });
  };

  const removeFromCart = (cartId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.cartId !== cartId));
  };

  const updateQuantity = (cartId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartId);
      return;
    }
    setSelectedItems((prev) => prev.map((i) => (i.cartId === cartId ? { ...i, quantity } : i)));
  };

  // Formatar telefone com máscara brasileira (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  const formatPhoneNumber = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');

    // Aplica a máscara conforme o usuário digita
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 6) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    } else if (numbers.length <= 10) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    } else {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  // Validar se o telefone tem DDD e número completo
  const validatePhone = (phone: string) => {
    const numbers = phone.replace(/\D/g, '');

    if (numbers.length === 0) {
      return "Telefone é obrigatório";
    } else if (numbers.length < 10) {
      return "Telefone incompleto. Inclua o DDD e o número completo";
    } else if (numbers.length === 10 || numbers.length === 11) {
      return ""; // Válido
    } else {
      return "Telefone inválido";
    }
  };

  const openCheckout = () => {
    setIsCheckoutOpen(true);
  };

  const sendWhatsApp = async () => {
    if (!miniSite) return;

    const total = selectedItems.reduce((sum, { item, quantity, selectedOptions }) => {
      const opts = selectedOptions || [];
      return sum + (item.price + opts.reduce((s, o) => s + (o.price || 0), 0)) * quantity;
    }, 0);

    console.log("🔍 DEBUG sendWhatsApp:");
    console.log("- miniSite.agent_id:", miniSite.agent_id);
    console.log("- Tem agente?", !!miniSite.agent_id);

    // Se houver agente configurado, enviar via Edge Function
    if (miniSite.agent_id) {
      console.log("✅ Agente configurado! Enviando via Edge Function...");
      try {
        const orderData = {
          miniSiteSlug: resolvedSlug,
          customerName: checkoutData.name,
          customerPhone: checkoutData.phone,
          customerAddress: checkoutData.address,
          paymentMethod: checkoutData.paymentMethod,
          observations: checkoutData.observations,
          items: selectedItems.map(({ item, quantity, selectedOptions }) => ({
            title: item.title,
            quantity,
            price: item.price,
            selectedOptions: selectedOptions || []
          })),
          total
        };

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-minisite-order`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(orderData)
          }
        );

        const result = await response.json();
        console.log('📨 Resposta da Edge Function:', result);
        console.log('- success:', result.success);
        console.log('- directWhatsApp:', result.directWhatsApp);
        console.log('- orderNumber:', result.orderNumber);

        if (result.success && !result.directWhatsApp) {
          console.log("✅ Pedido processado pelo agente!");
          // Pedido processado com sucesso pelo agente
          toast({
            title: "Pedido Enviado!",
            description: `Seu pedido #${result.orderNumber} foi enviado e está sendo processado. Você receberá uma confirmação no WhatsApp em instantes.`,
          });

          // Limpar carrinho e fechar modal
          setSelectedItems([]);
          if (resolvedSlug) {
            localStorage.removeItem(`cart_${resolvedSlug}`);
          }
          setIsCheckoutOpen(false);
          setCheckoutData({
            name: "",
            phone: "",
            address: "",
            paymentMethod: "",
            observations: "",
          });
          setPhoneError("");
          return;
        }
      } catch (error) {
        console.error('❌ Erro ao processar pedido com agente:', error);
        console.log('⚠️ Continuando para envio direto ao WhatsApp...');
        // Continua para envio direto ao WhatsApp em caso de erro
      }
    } else {
      console.log("ℹ️ Nenhum agente configurado, enviando direto ao WhatsApp");
    }

    // Envio direto ao WhatsApp (sem agente ou em caso de erro)
    console.log("📱 Abrindo WhatsApp para envio direto...");
    let message = `*Novo Pedido - ${miniSite.name}*\n\n`;
    message += `*Cliente:* ${checkoutData.name}\n`;
    message += `*Telefone:* ${checkoutData.phone}\n`;
    message += `*Endereço:* ${checkoutData.address}\n\n`;
    message += `*Pedido:*\n`;

    selectedItems.forEach(({ item, quantity, selectedOptions }) => {
      let line = `• ${quantity}x ${item.title}`;
      const opts = selectedOptions || [];
      if (opts.length) {
        line += ` (opções: ${opts.map((o) => o.name).join(", ")})`;
      }
      const itemTotal = (item.price + (opts.reduce((s, o) => s + (o.price || 0), 0))) * quantity;
      line += ` - R$ ${itemTotal.toFixed(2)}\\n`;
      message += line;
    });

    message += `\n*Subtotal:* R$ ${total.toFixed(2)}`;
    message += `\n*Forma de Pagamento:* ${checkoutData.paymentMethod}`;

    if (checkoutData.observations) {
      message += `\n\n*Observações:* ${checkoutData.observations}`;
    }

    // Formatar número do WhatsApp (remover caracteres especiais)
    let phoneNumber = miniSite.whatsapp_number.replace(/\D/g, "");

    // Se o número não começar com 55 (código do Brasil), adicionar
    if (!phoneNumber.startsWith("55")) {
      phoneNumber = "55" + phoneNumber;
    }

    console.log("Número WhatsApp formatado:", phoneNumber);
    console.log("Mensagem:", message);

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    console.log("URL WhatsApp:", whatsappUrl);

    window.open(whatsappUrl, "_blank");

    // Limpar carrinho e fechar modal
    setSelectedItems([]);
    if (resolvedSlug) {
      localStorage.removeItem(`cart_${resolvedSlug}`);
    }
    setIsCheckoutOpen(false);
    setCheckoutData({
      name: "",
      phone: "",
      address: "",
      paymentMethod: "",
      observations: "",
    });
    setPhoneError("");
  };

  // Agrupar itens por categoria
  const itemsByCategory = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  // Obter lista de categorias
  const categories = ["Todos", ...Object.keys(itemsByCategory)];

  // Filtrar itens pela categoria selecionada
  const filteredItems = selectedCategory === "Todos" 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  const handleAddClick = (item: MenuItem) => {
    // if item has options, open modal to select options
    if (item.options && item.options.length > 0) {
      const initial: Record<string, boolean> = {};
      item.options.forEach((o) => (initial[o.id] = false));
      setOptionSelections(initial);
      setOptionQuantity(1);
      setOptionModalItem(item);
      setOptionModalOpen(true);
      return;
    }
    // else add plain to cart
    const cartItem = {
      cartId: `cart-${item.id}-${Date.now()}`,
      item,
      quantity: 1,
    };
    addToCart(cartItem);
    // show a short toast for 2 seconds (toast system uses TOAST_REMOVE_DELAY)
    try {
      toast({ title: "Produto Adicionado" });
    } catch (e) {
      // fallback: no-op if toast system unavailable
      console.warn("Toast failed:", e);
    }
    return;
    };

    const confirmAddWithOptions = () => {
      if (!optionModalItem) return;
      const selectedOptionIds = Object.entries(optionSelections)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const selectedOptions = (optionModalItem.options || []).filter((o) => selectedOptionIds.includes(o.id));
      const cartItem: CartItem = {
        cartId: `cart-${optionModalItem.id}-${Date.now()}`,
        item: optionModalItem,
        quantity: optionQuantity,
        selectedOptions,
      };
      addToCart(cartItem);
      setOptionModalOpen(false);
      setOptionModalItem(null);
      setOptionSelections({});
      setOptionQuantity(1);
    };

      

  const totalItems = selectedItems.reduce((sum, { quantity }) => sum + quantity, 0);
  const totalPrice = selectedItems.reduce((sum, { item, quantity, selectedOptions }) => {
    const optsTotal = (selectedOptions || []).reduce((s, o) => s + (o.price || 0), 0);
    return sum + (item.price + optsTotal) * quantity;
  }, 0);

  

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: miniSite?.background_color || undefined }}>
      {/* Banner with overlayed company info card */}
      {miniSite ? (
        <div className="w-full relative">
          {miniSite.banner ? (
            <img
              src={miniSite.banner}
              alt={`${miniSite.name} banner`}
              loading="lazy"
              className="w-full h-44 md:h-56 lg:h-72 object-cover"
            />
          ) : (
            <div
              className="w-full h-44 md:h-56 lg:h-72 flex items-center justify-center"
              style={{ backgroundColor: miniSite.background_color || miniSite.theme_color }}
            >
              <div className="text-center">
                <h2 className="text-2xl font-bold" style={{ color: miniSite.text_color || readableTextColor(miniSite.background_color || miniSite.theme_color) }}>{miniSite.name}</h2>
              </div>
            </div>
          )}

          {/* Business info — rendered as a simple block below the banner (no card) */}
          <div className="w-full px-4 mt-0">
            <div className="mx-auto w-full sm:w-3/4 md:w-2/3 lg:w-1/2 xl:w-2/5 text-center py-4 px-4" style={{ color: miniSite.text_color || readableTextColor(miniSite.background_color || miniSite.theme_color) }}>
              {miniSite.logo ? (
                <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center overflow-hidden mb-3 mx-auto">
                  <img src={miniSite.logo} alt={miniSite.name} loading="lazy" className="h-12 w-12 object-cover" />
                </div>
              ) : null}

              <h2 className="text-2xl font-bold">{miniSite.name}</h2>
              {miniSite.description ? (
                <p className="text-sm mt-1">{miniSite.description}</p>
              ) : (
                <p className="text-sm mt-1">Bem vindo a {miniSite.name}</p>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-3 text-sm">
                {miniSite.whatsapp_number && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{miniSite.whatsapp_number}</span>
                  </div>
                )}
                {miniSite.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{miniSite.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

  <main className="container mx-auto px-4 py-8 pt-8">
        <div className="grid gap-8">
          {/* Menu/Serviços */}
          <div className="space-y-6">
            {/* Filtro de Categorias */}
            {categories.length > 2 && (
              <div className="border-b pb-4 -mx-4 px-4">
                <div className="flex items-center gap-3 overflow-hidden">
                  {/* Dropdown para mobile e muitas categorias */}
                  <div className="w-auto flex-shrink-0">
                    <Select value={selectedCategory} onValueChange={setSelectedCategory} onOpenChange={(open) => {
                      setCategoryOpen(open);
                      // when the select closes, remove focus from the trigger so it doesn't keep the focus outline
                      if (!open) {
                        setTimeout(() => {
                          try {
                            (document.activeElement as HTMLElement | null)?.blur();
                          } catch (e) {
                            // ignore
                          }
                        }, 0);
                      }
                    }}>
                      <SelectTrigger
                        className="w-[80px] sm:w-[100px] px-2 text-sm h-8 flex items-center justify-center text-center focus:outline-none focus:ring-0"
                        style={{
                          backgroundColor: categoryOpen ? (miniSite?.button_color || miniSite?.theme_color) : (miniSite?.card_color || "#f3f4f6"),
                          color: categoryOpen ? (miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color)) : (miniSite?.theme_color || "#374151"),
                          border: '1px solid',
                          borderColor: miniSite?.theme_color
                        }}
                      >
                        Menu
                      </SelectTrigger>
                      <SelectContent style={{ backgroundColor: miniSite?.card_color || undefined }}>
                        {categories.map((category) => (
                          <SelectItem
                            key={category}
                            value={category}
                            style={{ color: miniSite?.theme_color }}
                          >
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Grid de Produtos */}
            {/* Grid responsivo: 1 coluna no mobile, 4 colunas no desktop */}
            <div className="px-4">
              <div className="w-full flex justify-center">
                <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-4 gap-4 py-2 justify-items-center">
                {filteredItems.length === 0 ? (
                  <>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={`skeleton-${i}`} className="w-full max-w-xs overflow-hidden">
                        <div className="flex flex-col h-40 md:h-56 p-2">
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
                            <div className="h-3 bg-gray-200 rounded w-1/3 mb-3 animate-pulse" />
                            <div className="h-10 bg-gray-200 rounded w-full mb-2 animate-pulse" />
                          </div>
                          <div className="mt-2">
                            <div className="h-8 bg-gray-200 rounded w-full animate-pulse" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  filteredItems.map((item) => (
                    <Card key={item.id} className="w-full max-w-xs overflow-hidden" style={{ backgroundColor: miniSite?.card_color || undefined }}>
                      <div className="flex flex-col">
                        <div className="flex-1 flex flex-col justify-between p-3">
                          <div>
                            <CardHeader>
                              <div className="flex justify-between items-start">
                                <div>
                                  <CardTitle className="text-base" style={{ color: miniSite?.theme_color }}>{item.title}</CardTitle>
                                  {item.duration && (
                                    <Badge variant="outline" className="mt-1">
                                      <CalendarIcon className="h-3 w-3 mr-1" />
                                      {item.duration} min
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-lg font-bold" style={{ color: miniSite?.theme_color }}>
                                  R$ {item.price.toFixed(2)}
                                </span>
                              </div>
                            </CardHeader>

                            {item.description && (
                              <CardContent>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 text-sm overflow-hidden whitespace-nowrap truncate" style={{ color: miniSite?.theme_color }}>
                                    {item.description}
                                  </div>
                                  {item.description && item.description.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => openDescModal(item.description)}
                                      className="p-1 rounded hover:bg-accent/20 flex items-center gap-1 text-sm text-primary"
                                      aria-label="Ver descrição completa"
                                      title="Ver descrição"
                                    >
                                      <Eye className="h-4 w-4" />
                                      <span className="hidden sm:inline">Ver</span>
                                    </button>
                                  )}
                                </div>
                              </CardContent>
                            )}
                          </div>

                          <div className="mt-2">
                            <Button
                              type="button"
                              className="w-full px-3 py-2 text-sm rounded-md"
                              style={{
                                backgroundColor: miniSite?.button_color || miniSite?.theme_color,
                                color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color),
                                border: '1px solid',
                                borderColor: miniSite?.theme_color,
                              }}
                              onClick={() => handleAddClick(item)}
                            >
                              {miniSite?.template === "delivery" ? "Adicionar" : "Agendar"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
                </div>
              </div>
            </div>


          </div>

          {/* right column intentionally removed — cart is accessible via floating pill/modal */}
        </div>
      </main>

      {/* Floating cart pill + cart modal */}
      {selectedItems.length > 0 && (
        <>
          <div className="fixed bottom-4 right-4 md:top-6 md:right-6 md:bottom-auto z-50">
            <button
              onClick={() => setCartOpen(true)}
              className="inline-flex items-center gap-3 px-4 py-3 rounded-full shadow-lg text-sm touch-manipulation"
              style={{ backgroundColor: miniSite?.button_color || miniSite?.theme_color, color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color) }}
              aria-label="Ver carrinho"
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="font-medium text-sm hidden sm:inline">Ver Carrinho</span>
              <span className="ml-2 font-semibold text-sm">R$ {totalPrice.toFixed(2)}</span>
              <span className="ml-2 inline-flex items-center justify-center bg-white text-black rounded-full h-6 w-6 text-xs">{totalItems}</span>
            </button>
          </div>

          <Dialog open={cartOpen} onOpenChange={setCartOpen} modal>
            <DialogContent className="sm:max-w-[700px]" style={{ backgroundColor: miniSite?.card_color || undefined }} closeButtonColor={miniSite?.theme_color}>
              <DialogHeader>
                <DialogTitle style={{ color: miniSite?.theme_color }}>Carrinho</DialogTitle>
                <DialogDescription style={{ color: miniSite?.theme_color }}>Revise seus itens e ajuste quantidades</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="space-y-3 mb-4">
                  {selectedItems.map(({ cartId, item, quantity, selectedOptions }) => (
                    <div key={cartId} className="flex justify-between items-center border-b pb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm" style={{ color: miniSite?.theme_color }}>{item.title}</p>
                        {selectedOptions && selectedOptions.length > 0 && (
                          <div className="text-xs text-muted-foreground">Opções: {selectedOptions.map(o => o.name).join(', ')}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => updateQuantity(cartId, quantity - 1)}>-</Button>
                          <span className="text-sm" style={{ color: miniSite?.theme_color }}>{quantity}</span>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => updateQuantity(cartId, quantity + 1)}>+</Button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold" style={{ color: miniSite?.theme_color }}>R${" "}{((item.price + ((selectedOptions || []).reduce((s,o) => s + (o.price||0),0))) * quantity).toFixed(2)}</p>
                        <Button variant="ghost" size="sm" className="text-destructive h-6 text-xs" onClick={() => removeFromCart(cartId)}>Remover</Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 mb-4">
                  <div className="flex justify-between font-bold text-lg" style={{ color: miniSite?.theme_color }}>
                    <span>Total</span>
                    <span>R$ {totalPrice.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{totalItems} {totalItems === 1 ? "item" : "itens"}</p>
                </div>
              </div>
              <DialogFooter>
                <Button className="w-full" style={{ backgroundColor: miniSite?.button_color || miniSite?.theme_color, color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color), border: '1px solid', borderColor: miniSite?.theme_color }} onClick={() => { setCartOpen(false); setIsCheckoutOpen(true); }}>
                  Finalizar Pedido
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Fixed mobile CTA for cart (visible only on small screens) */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
          <div className="px-4 py-3" style={{ backgroundColor: miniSite?.button_color || miniSite?.theme_color, color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color) }}>
            <button onClick={() => setCartOpen(true)} className="w-full flex items-center justify-between font-semibold">
              <span className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Ver Carrinho</span>
              <span>R$ {totalPrice.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Options Modal (when adding product with additions) */}
      <Dialog open={optionModalOpen} onOpenChange={setOptionModalOpen} modal>
        <DialogContent className="sm:max-w-[500px]" style={{ backgroundColor: miniSite?.card_color || undefined }} closeButtonColor={miniSite?.theme_color}>
          <DialogHeader>
            <DialogTitle style={{ color: miniSite?.theme_color }}>{optionModalItem?.title}</DialogTitle>
            <DialogDescription style={{ color: miniSite?.theme_color }}>Selecione as opções adicionais</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {optionModalItem?.options && optionModalItem.options.length > 0 ? (
              <div className="space-y-3">
                {optionModalItem.options.map((opt) => (
                  <div key={opt.id} className="flex items-center justify-between">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!optionSelections[opt.id]}
                        onChange={(e) => setOptionSelections((s) => ({ ...s, [opt.id]: e.target.checked }))}
                        className="h-4 w-4"
                      />
                      <span className="capitalize" style={{ color: miniSite?.theme_color }}>{opt.name}</span>
                    </label>
                    <span className="text-sm" style={{ color: miniSite?.theme_color }}>+ R$ {opt.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p>Nenhuma opção disponível.</p>
            )}

            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: miniSite?.theme_color }}>Total:</span>
                <span className="text-lg font-bold" style={{ color: miniSite?.theme_color }}>
                  R$ {((optionModalItem?.price || 0) + (optionModalItem?.options?.filter(o => optionSelections[o.id]).reduce((s,o) => s + o.price, 0) || 0)) * optionQuantity}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setOptionQuantity(q => Math.max(1, q-1))}>-</Button>
                <span style={{ color: miniSite?.theme_color }}>{optionQuantity}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setOptionQuantity(q => q+1)}>+</Button>
              </div>

              <div className="text-right">
                <Button type="button" className="w-full" style={{ backgroundColor: miniSite?.button_color || miniSite?.theme_color, color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color), border: '1px solid', borderColor: miniSite?.theme_color }} onClick={confirmAddWithOptions}>
                  <span className="mr-2">+</span> Adicionar ao Carrinho
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Description Modal (show full product description) */}
      <Dialog open={descModalOpen} onOpenChange={setDescModalOpen} modal>
        <DialogContent className="sm:max-w-[500px]" style={{ backgroundColor: miniSite?.card_color || undefined }} closeButtonColor={miniSite?.theme_color}>
          <DialogHeader>
            <DialogTitle style={{ color: miniSite?.theme_color }}>Descrição do Produto</DialogTitle>
              </DialogHeader>
          <div className="py-2">
            <div className="text-sm whitespace-pre-wrap break-words" style={{ color: miniSite?.theme_color }}>
              {descModalText}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDescModalOpen(false)} style={{ color: miniSite?.theme_color }}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout Modal */}
      <Dialog open={isCheckoutOpen} onOpenChange={(open) => {
        setIsCheckoutOpen(open);
        if (!open) setPhoneError("");
      }} modal>
        <DialogContent className="sm:max-w-[500px]" style={{ backgroundColor: miniSite?.card_color || undefined }} closeButtonColor={miniSite?.theme_color}>
          <DialogHeader>
            <DialogTitle style={{ color: miniSite?.theme_color }}>Finalizar Pedido</DialogTitle>
            <DialogDescription style={{ color: miniSite?.theme_color }}>
              Preencha seus dados para enviar o pedido via WhatsApp
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" style={{ color: miniSite?.theme_color }}>Nome Completo *</Label>
              <Input
                id="name"
                value={checkoutData.name}
                onChange={(e) =>
                  setCheckoutData({ ...checkoutData, name: e.target.value })
                }
                placeholder="Seu nome completo"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone" style={{ color: miniSite?.theme_color }}>Telefone/WhatsApp *</Label>
              <Input
                id="phone"
                value={checkoutData.phone}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  setCheckoutData({ ...checkoutData, phone: formatted });
                  const error = validatePhone(formatted);
                  setPhoneError(error);
                }}
                placeholder="(00) 00000-0000"
                className={phoneError ? "border-red-500" : ""}
              />
              {phoneError && (
                <p className="text-sm text-red-500">{phoneError}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address" style={{ color: miniSite?.theme_color }}>Endereço de Entrega *</Label>
              <Input
                id="address"
                value={checkoutData.address}
                onChange={(e) =>
                  setCheckoutData({ ...checkoutData, address: e.target.value })
                }
                placeholder="Rua, número, bairro, cidade"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment" style={{ color: miniSite?.theme_color }}>Forma de Pagamento *</Label>
              <Select
                value={checkoutData.paymentMethod}
                onValueChange={(value) =>
                  setCheckoutData({ ...checkoutData, paymentMethod: value })
                }
              >
                <SelectTrigger id="payment">
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  {miniSite.payment_methods?.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="observations" style={{ color: miniSite?.theme_color }}>Observações (opcional)</Label>
              <Textarea
                id="observations"
                value={checkoutData.observations}
                onChange={(e) =>
                  setCheckoutData({
                    ...checkoutData,
                    observations: e.target.value,
                  })
                }
                placeholder="Alguma observação sobre o pedido?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              className="w-full"
              style={{ backgroundColor: miniSite?.button_color || miniSite?.theme_color, color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color), border: '1px solid', borderColor: miniSite?.theme_color }}
              onClick={sendWhatsApp}
              disabled={
                !checkoutData.name ||
                !checkoutData.phone ||
                !checkoutData.address ||
                !checkoutData.paymentMethod ||
                !!phoneError
              }
            >
              <Phone className="h-4 w-4 mr-2" />
              Enviar Pedido via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {miniSite.name}. Todos os direitos reservados.
          </p>
          <p className="mt-1">
            Powered by{" "}
            <a
              href="https://ia.auroratech.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              WhatsAgent AI
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PublicMiniSite;
