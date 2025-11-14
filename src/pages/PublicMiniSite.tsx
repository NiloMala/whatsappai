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
import { Phone, MapPin, Clock, ShoppingCart, Calendar as CalendarIcon, Eye } from "lucide-react";
import type { MiniSite, MenuItem, ProductOption } from "@/types/mini-site";
import { readableTextColor } from "@/lib/utils";

const PublicMiniSite = () => {
  const { slug } = useParams<{ slug: string }>();
  const resolvedSlug = slug || (typeof window !== 'undefined' && isPublicMiniSite() ? getSlugFromHostname() : null);
  const [loading, setLoading] = useState(true);
  const [miniSite, setMiniSite] = useState<MiniSite | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  
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

  const openCheckout = () => {
    setIsCheckoutOpen(true);
  };

  const sendWhatsApp = () => {
    if (!miniSite) return;

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

    const total = selectedItems.reduce((sum, { item, quantity, selectedOptions }) => {
      const opts = selectedOptions || [];
      return sum + (item.price + opts.reduce((s, o) => s + (o.price || 0), 0)) * quantity;
    }, 0);

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
    <div className="min-h-screen" style={{ backgroundColor: miniSite?.background_color || undefined }}>
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

          <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-3 md:-bottom-6 lg:-bottom-10 w-full px-4">
            <div
              className="mx-auto w-full sm:w-3/4 md:w-2/3 lg:w-1/2 xl:w-2/5 rounded-md shadow-lg overflow-hidden"
              style={{ backgroundColor: miniSite.background_color || miniSite.theme_color }}
            >
              <div className="flex flex-col items-center text-center py-6 px-6" style={{ color: miniSite.text_color || '#ffffff' }}>
                {miniSite.logo ? (
                  <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center overflow-hidden mb-3">
                    <img src={miniSite.logo} alt={miniSite.name} loading="lazy" className="h-12 w-12 object-cover" />
                  </div>
                ) : null}

                <h2 className="text-2xl font-bold">{miniSite.name}</h2>
                {miniSite.description ? (
                  <p className="text-sm mt-1" style={{ color: miniSite.text_color || 'rgba(255,255,255,0.9)' }}>{miniSite.description}</p>
                ) : (
                  <p className="text-sm mt-1" style={{ color: miniSite.text_color || 'rgba(255,255,255,0.9)' }}>Bem vindo a {miniSite.name}</p>
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
        </div>
      ) : null}

  <main className="container mx-auto px-4 py-8 pt-16">
        <div className="grid gap-8">
          {/* Menu/Serviços */}
          <div className="space-y-6">
            {/* Filtro de Categorias */}
            {categories.length > 2 && (
              <div className="overflow-x-auto pb-4 border-b -mx-4 px-4">
                <div className="inline-flex space-x-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                        selectedCategory === category
                          ? "text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                      style={
                        selectedCategory === category
                          ? { backgroundColor: miniSite?.button_color || miniSite?.theme_color, color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color) }
                          : {}
                      }
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Grid de Produtos */}
            {/* Product cards sized like leads (w-80) with horizontal scroll for easy mobile browsing */}
            <div className="-mx-4 px-4">
              <div className="flex flex-col items-center md:flex-row md:items-start gap-4 md:overflow-x-auto py-2">
                {filteredItems.map((item) => (
                <Card key={item.id} className="w-full max-w-xs mx-auto md:w-80 flex-shrink-0 overflow-hidden">
                    <div className="flex flex-col">
                        <div className="flex-1 flex flex-col justify-between p-3">
                        <div>
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-base">{item.title}</CardTitle>
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
                                <div className="flex-1 text-sm text-muted-foreground overflow-hidden whitespace-nowrap truncate">
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
                            }}
                            onClick={() => handleAddClick(item)}
                          >
                            {miniSite?.template === "delivery" ? "Adicionar" : "Agendar"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nenhum item disponível nesta categoria.</p>
              </div>
            )}
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
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>Carrinho</DialogTitle>
                <DialogDescription>Revise seus itens e ajuste quantidades</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="space-y-3 mb-4">
                  {selectedItems.map(({ cartId, item, quantity, selectedOptions }) => (
                    <div key={cartId} className="flex justify-between items-center border-b pb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.title}</p>
                        {selectedOptions && selectedOptions.length > 0 && (
                          <div className="text-xs text-muted-foreground">Opções: {selectedOptions.map(o => o.name).join(', ')}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => updateQuantity(cartId, quantity - 1)}>-</Button>
                          <span className="text-sm">{quantity}</span>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => updateQuantity(cartId, quantity + 1)}>+</Button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">R${" "}{((item.price + ((selectedOptions || []).reduce((s,o) => s + (o.price||0),0))) * quantity).toFixed(2)}</p>
                        <Button variant="ghost" size="sm" className="text-destructive h-6 text-xs" onClick={() => removeFromCart(cartId)}>Remover</Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 mb-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>R$ {totalPrice.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{totalItems} {totalItems === 1 ? "item" : "itens"}</p>
                </div>
              </div>
              <DialogFooter>
                <Button className="w-full" style={{ backgroundColor: miniSite?.button_color || miniSite?.theme_color, color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color) }} onClick={() => { setCartOpen(false); setIsCheckoutOpen(true); }}>
                  Finalizar Pedido
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Options Modal (when adding product with additions) */}
      <Dialog open={optionModalOpen} onOpenChange={setOptionModalOpen} modal>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{optionModalItem?.title}</DialogTitle>
            <DialogDescription>Selecione as opções adicionais</DialogDescription>
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
                      <span className="capitalize">{opt.name}</span>
                    </label>
                    <span className="text-sm">+ R$ {opt.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p>Nenhuma opção disponível.</p>
            )}

            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <span>Total:</span>
                <span className="text-lg font-bold text-green-600">
                  R$ {((optionModalItem?.price || 0) + (optionModalItem?.options?.filter(o => optionSelections[o.id]).reduce((s,o) => s + o.price, 0) || 0)) * optionQuantity}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setOptionQuantity(q => Math.max(1, q-1))}>-</Button>
                <span>{optionQuantity}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setOptionQuantity(q => q+1)}>+</Button>
              </div>

              <div className="text-right">
                <Button type="button" className="w-full" style={{ backgroundColor: miniSite?.button_color || miniSite?.theme_color, color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color) }} onClick={confirmAddWithOptions}>
                  <span className="mr-2">+</span> Adicionar ao Carrinho
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Description Modal (show full product description) */}
      <Dialog open={descModalOpen} onOpenChange={setDescModalOpen} modal>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Descrição do Produto</DialogTitle>
              </DialogHeader>
          <div className="py-2">
            <div className="text-sm whitespace-pre-wrap break-words text-muted-foreground">
              {descModalText}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDescModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout Modal */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen} modal>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Finalizar Pedido</DialogTitle>
            <DialogDescription>
              Preencha seus dados para enviar o pedido via WhatsApp
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome Completo *</Label>
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
              <Label htmlFor="phone">Telefone/WhatsApp *</Label>
              <Input
                id="phone"
                value={checkoutData.phone}
                onChange={(e) =>
                  setCheckoutData({ ...checkoutData, phone: e.target.value })
                }
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Endereço de Entrega *</Label>
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
              <Label htmlFor="payment">Forma de Pagamento *</Label>
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
              <Label htmlFor="observations">Observações (opcional)</Label>
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
              style={{ backgroundColor: miniSite?.button_color || miniSite?.theme_color, color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color) }}
              onClick={sendWhatsApp}
              disabled={
                !checkoutData.name ||
                !checkoutData.phone ||
                !checkoutData.address ||
                !checkoutData.paymentMethod
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
