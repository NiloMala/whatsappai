import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { Phone, MapPin, Clock, ShoppingCart, Calendar as CalendarIcon, Eye, Menu, Home as HomeIcon, List as ListIcon, User as UserIcon } from "lucide-react";
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
  const [mobileCartVisible, setMobileCartVisible] = useState(false);
  
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
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem('user_profile'));
    } catch (e) {
      return false;
    }
  });
  const [checkoutData, setCheckoutData] = useState({
    name: "",
    phone: "",
    address: "",
    neighborhood: "",
    paymentMethod: "",
    observations: "",
  });
  const [phoneError, setPhoneError] = useState("");
  const navigate = useNavigate();

  const handleLogout = () => {
    try {
      localStorage.removeItem('user_profile');
    } catch (e) {}
    setIsAuthenticated(false);
    setProfileModalOpen(false);
  };

  useEffect(() => {
    loadMiniSite();
  }, [slug, resolvedSlug]);

  // Atualizar meta tags quando miniSite carregar
  useEffect(() => {
    if (!miniSite) return;

    // Atualizar título da página
    document.title = `${miniSite.name} - Faça seu pedido online`;

    // Atualizar ou criar meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', miniSite.description || `Faça seu pedido no ${miniSite.name}. Delivery rápido e fácil!`);

    // Open Graph tags para compartilhamento
    const ogTags = [
      { property: 'og:title', content: `${miniSite.name} - Cardápio Online` },
      { property: 'og:description', content: miniSite.description || `Faça seu pedido no ${miniSite.name}` },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: window.location.href },
    ];

    if (miniSite.logo) {
      ogTags.push({ property: 'og:image', content: miniSite.logo });
    }

    ogTags.forEach(({ property, content }) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    });

    // Twitter Card tags
    const twitterTags = [
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `${miniSite.name} - Cardápio Online` },
      { name: 'twitter:description', content: miniSite.description || `Faça seu pedido no ${miniSite.name}` },
    ];

    if (miniSite.logo) {
      twitterTags.push({ name: 'twitter:image', content: miniSite.logo });
    }

    twitterTags.forEach(({ name, content }) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    });
  }, [miniSite]);

  // Claim a pending anonymous profile when the user authenticates.
  const claimPendingProfile = async () => {
    try {
      const pending = typeof window !== 'undefined' ? localStorage.getItem('pending_profile_id') : null;
      if (!pending) return;
      const { data: { user } } = await supabase.auth.getUser();
      const uid = (user as any)?.id;
      if (!uid) return;

      // Only attempt to claim for the current mini site
      const updateQuery = supabase
        .from('minisite_profiles')
        .update({ user_id: uid })
        .eq('id', pending);

      if (miniSite?.id) updateQuery.eq('mini_site_id', miniSite.id);

      const { data, error } = await updateQuery.select('*').maybeSingle();
      if (error) {
        console.error('Erro ao linkar pending_profile:', error);
        // If FK missing (users row not present yet), retry a few times
        const isFK = (error as any)?.code === '23503' || (error as any)?.message?.includes('violates foreign key');
        if (isFK) {
          try {
            const key = `pending_profile_attempts_${pending}`;
            const raw = localStorage.getItem(key);
            const attempts = raw ? parseInt(raw, 10) : 0;
            if (attempts < 5) {
              localStorage.setItem(key, String(attempts + 1));
              // retry after 3 seconds
              setTimeout(() => {
                claimPendingProfile();
              }, 3000);
            }
          } catch (e) {}
        }
        return;
      }

      // On success, remove pending flag and update local user_profile
      try {
        localStorage.removeItem('pending_profile_id');
        localStorage.setItem('user_profile', JSON.stringify({ id: data?.id, mini_site_id: miniSite?.id || null, user_id: uid, name: data?.name || null, email: data?.email || null }));
      } catch (e) {}

      setIsAuthenticated(true);
      toast({ title: 'Perfil vinculado', description: 'Seu perfil foi vinculado à conta.' });
    } catch (e) {
      console.error('claimPendingProfile erro:', e);
    }
  };

  // Salvar carrinho no localStorage sempre que mudar
  useEffect(() => {
    if (resolvedSlug) {
      localStorage.setItem(`cart_${resolvedSlug}`, JSON.stringify(selectedItems));
    }
    // Keep mobile cart visible whenever there are items (and hide when empty).
    try {
      if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth < 768;
        setMobileCartVisible(selectedItems.length > 0 && isMobile);
      } else {
        setMobileCartVisible(selectedItems.length > 0);
      }
    } catch (e) {
      setMobileCartVisible(selectedItems.length > 0);
    }
  }, [selectedItems, resolvedSlug]);

  useEffect(() => {
    // Try claiming pending profile on mount if session exists
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) await claimPendingProfile();
      } catch (e) {}
    })();

    // Subscribe to auth state changes to claim when user signs in later
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        claimPendingProfile();
      }
    });

    return () => subscription.unsubscribe();
  }, [miniSite]);

  const handleOpenOrders = async () => {
    if (!miniSite) {
      toast({ title: 'Erro', description: 'Mini site não carregado.' });
      return;
    }
    setOrdersLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = (user as any)?.id || null;
      const localProfileRaw = typeof window !== 'undefined' ? localStorage.getItem('user_profile') : null;
      const localProfile = localProfileRaw ? JSON.parse(localProfileRaw) : null;

      const { data: dataOrders, error } = await supabase
        .from('minisite_orders')
        .select('*')
        .eq('mini_site_id', miniSite.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Erro ao buscar pedidos:', error);
        toast({ title: 'Erro', description: 'Não foi possível buscar pedidos.' });
        return;
      }

      const list = (dataOrders || []).filter((o: any) => {
        if (uid && o.user_id === uid) return true;
        if (localProfile && String(o.profile_id) === String(localProfile.id)) return true;
        return false;
      });

      if (!list || list.length === 0) {
        toast({ title: 'Nenhum pedido encontrado', description: 'Você não possui pedidos neste mini-site.' });
        return;
      }

      setOrders(list);
      setOrdersModalOpen(true);
    } catch (e) {
      console.error('handleOpenOrders erro:', e);
      toast({ title: 'Erro', description: 'Erro ao carregar pedidos.' });
    } finally {
      setOrdersLoading(false);
    }
  };

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

  // Show mobile cart bar when adding items on small screens
  const showMobileCartIfNeeded = () => {
    try {
      if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth < 768; // tailwind md breakpoint
        if (isMobile) setMobileCartVisible(true);
      }
    } catch (e) {
      // ignore
    }
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

  const openCheckout = async () => {
    // Auto-preencher dados do perfil se o usuário estiver logado
    try {
      const localProfileRaw = typeof window !== 'undefined' ? localStorage.getItem('user_profile') : null;
      if (localProfileRaw) {
        const localProfile = JSON.parse(localProfileRaw);

        // Buscar dados completos do perfil da tabela minisite_profiles
        if (localProfile.id) {
          try {
            const { data: profileData, error } = await supabase
              .from('minisite_profiles')
              .select('name, email, phone, address')
              .eq('id', localProfile.id)
              .maybeSingle();

            if (!error && profileData) {
              // Preencher os campos do checkout com dados completos do perfil
              setCheckoutData((prev) => ({
                ...prev,
                name: profileData.name || prev.name,
                phone: profileData.phone || prev.phone,
                address: profileData.address || prev.address,
              }));
            }
          } catch (e) {
            console.warn('Erro ao buscar perfil completo:', e);
            // Fallback: usar dados do localStorage se a busca falhar
            setCheckoutData((prev) => ({
              ...prev,
              name: localProfile.name || prev.name,
            }));
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar perfil para auto-preenchimento:', e);
    }

    setIsCheckoutOpen(true);
  };

  const sendWhatsApp = async () => {
    if (!miniSite) return;

    const subtotal = selectedItems.reduce((sum, { item, quantity, selectedOptions }) => {
      const opts = selectedOptions || [];
      return sum + (item.price + opts.reduce((s, o) => s + (o.price || 0), 0)) * quantity;
    }, 0);

    // Calcular taxa de entrega
    let deliveryFee = 0;
    if (miniSite.delivery_fee_type === "fixed" && miniSite.delivery_fee_value) {
      deliveryFee = miniSite.delivery_fee_value;
    } else if (miniSite.delivery_fee_type === "by_neighborhood" && checkoutData.neighborhood && miniSite.delivery_neighborhoods) {
      const neighborhood = miniSite.delivery_neighborhoods.find(n => n.name === checkoutData.neighborhood);
      if (neighborhood) {
        deliveryFee = neighborhood.fee;
      }
    }

    const total = subtotal + deliveryFee;

    console.log("🔍 DEBUG sendWhatsApp:");
    console.log("- miniSite.agent_id:", miniSite.agent_id);
    console.log("- Tem agente?", !!miniSite.agent_id);

    // Before sending, persist the order in the DB so we always record it
    let createdOrderId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = (userData as any)?.user?.id || null;
      const localProfileRaw = typeof window !== 'undefined' ? localStorage.getItem('user_profile') : null;
      const localProfile = localProfileRaw ? JSON.parse(localProfileRaw) : null;

      const orderRecord: any = {
        mini_site_id: miniSite.id,
        user_id: uid,
        profile_id: localProfile?.id || null,
        customer_name: checkoutData.name,
        customer_phone: checkoutData.phone,
        customer_address: checkoutData.address,
        customer_neighborhood: checkoutData.neighborhood || null,
        delivery_fee: deliveryFee,
        items: selectedItems.map(({ item, quantity, selectedOptions }) => ({
          id: item.id,
          title: item.title,
          price: item.price,
          quantity,
          options: selectedOptions || []
        })),
        total_amount: total,
        payment_method: checkoutData.paymentMethod,
        notes: checkoutData.observations || null,
        status: 'pending'
      };

      try {
        const { data: orderData, error: orderErr } = await supabase
          .from('minisite_orders')
          .insert(orderRecord)
          .select('id')
          .maybeSingle();
        if (orderErr) {
          console.warn('Não foi possível gravar pedido no DB:', orderErr);
        } else if (orderData && (orderData as any).id) {
          createdOrderId = (orderData as any).id;
          try { localStorage.setItem(`last_order_${miniSite.id}`, String(createdOrderId)); } catch (e) {}
        }
      } catch (e) {
        console.warn('Erro ao inserir pedido no DB:', e);
      }
    } catch (e) {
      console.warn('Erro ao obter usuário/localProfile antes de gravar pedido:', e);
    }

    // Se houver agente configurado, enviar via Edge Function
    if (miniSite.agent_id) {
      console.log("✅ Agente configurado! Enviando via Edge Function...");
      console.log("🆔 Created Order ID:", createdOrderId);
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
          total,
          orderId: createdOrderId // Always include orderId
        };

        console.log("📦 Order Data being sent:", orderData);

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
            neighborhood: "",
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

    message += `\n*Subtotal:* R$ ${subtotal.toFixed(2)}`;
    if (deliveryFee > 0) {
      message += `\n*Taxa de Entrega:* R$ ${deliveryFee.toFixed(2)}`;
      if (checkoutData.neighborhood) {
        message += ` (${checkoutData.neighborhood})`;
      }
    }
    message += `\n*TOTAL:* R$ ${total.toFixed(2)}`;
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
      neighborhood: "",
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
    showMobileCartIfNeeded();
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
      showMobileCartIfNeeded();
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

  
  // Profile modal inner content component (has access to closure variables)
  const ProfileModalContent = () => {
    const [mode, setMode] = useState<'login' | 'create'>('login');
    const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', password: '' });
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);

    const sanitizePhone = (p: string) => p.replace(/\D/g, '');

    const handleCreateProfile = async () => {
      if (!miniSite) return setProfileError('Mini site não carregado');
      if (!form.email || !form.password) return setProfileError('Email e senha são obrigatórios');
      setProfileError(null);
      setLoadingProfile(true);
      try {
        // Create auth user with email/password
        const { data: signData, error: signError } = await supabase.auth.signUp({ email: form.email, password: form.password });
        if (signError) {
          console.error('Erro ao criar auth user:', signError);
          setProfileError(signError.message || 'Erro ao criar usuário');
          return;
        }

        // Try to determine if the signUp produced an authenticated session.
        // In Supabase, if email confirmation is required the session may be null
        // and subsequent DB writes that rely on auth.uid() will be blocked by RLS (403).
        const { data: sessionData } = await supabase.auth.getSession();
        const hasSession = !!(sessionData && (sessionData as any).session);

        const userId = (signData && (signData.user as any)?.id) || (signData as any)?.user?.id || null;

        // Build payload. Only include user_id if we have an authenticated session.
        const payload: any = {
          mini_site_id: miniSite.id,
          parent_profile_id: null,
          name: form.name || null,
          email: form.email || null,
          phone: form.phone || null,
          address: form.address || null,
          is_active: true,
        };

        if (hasSession && userId) {
          payload.user_id = userId;
        } else {
          // ensure we don't send an empty/falsy user_id which would fail RLS
          try {
            // remove property if present
            if ((payload as any).user_id) delete (payload as any).user_id;
          } catch (e) {}
        }

        // Attempt to insert profile. If there's a 403 it's likely due to RLS and
        // missing authenticated session (email confirmation required) — handle gracefully.
        try {
          console.debug('Inserindo minisite_profiles payload (create):', payload, 'keys:', Object.keys(payload));
        } catch (e) {}
        const { data, error } = await supabase
          .from('minisite_profiles')
          .insert(payload)
          .select('*')
          .maybeSingle();

        if (error) {
          console.error('Erro ao criar perfil:', error);
          // If this is a 403 from Supabase RLS or a FK constraint (user row not present), attempt fallback: insert without user_id
          if (
            (error as any)?.status === 403 ||
            (error as any)?.code === '42501' ||
            (error as any)?.message?.includes('row-level security') ||
            (error as any)?.code === '23503' ||
            (error as any)?.message?.includes('violates foreign key')
          ) {
            try {
              console.debug('Tentando fallback: inserir minisite_profiles sem user_id');
            } catch (e) {}
              try {
                const fallbackPayload: any = { ...payload };
                try { delete fallbackPayload.user_id; } catch (e) {}
                const { data: fallback, error: fbErr } = await supabase
                  .from('minisite_profiles')
                  .insert(fallbackPayload)
                  .select('*')
                  .maybeSingle();
              if (fbErr) {
                console.error('Erro no fallback ao criar perfil:', fbErr);
                setProfileError(fbErr.message || 'Erro ao criar perfil');
                return;
              }
              try {
                localStorage.setItem('pending_profile_id', String(fallback?.id));
              } catch (e) {}
              try {
                localStorage.setItem('user_profile', JSON.stringify({ id: fallback?.id, mini_site_id: miniSite.id, user_id: null, name: fallback?.name || form.name || null, email: fallback?.email || form.email || null }));
              } catch (e) {}
              setIsAuthenticated(!!hasSession);
              setProfileModalOpen(false);
              toast({ title: 'Perfil criado', description: 'Seu perfil foi criado (aguardando confirmação).' });
              return;
            } catch (e) {
              console.error('Erro no fallback (catch):', e);
              setProfileError('Erro ao criar perfil');
              return;
            }
          }

          setProfileError(error.message || 'Erro ao criar perfil');
          return;
        }

        // Persist minimal profile info locally
        try {
          localStorage.setItem('user_profile', JSON.stringify({ id: data.id, mini_site_id: miniSite.id, user_id: userId, name: data?.name || form.name || null, email: data?.email || form.email || null }));
        } catch (e) {}
        setIsAuthenticated(true);
        setProfileModalOpen(false);
        toast({ title: 'Perfil criado', description: 'Seu perfil foi criado com sucesso.' });
      } finally {
        setLoadingProfile(false);
      }
    };

    const handleLoginProfile = async () => {
      if (!miniSite) return setProfileError('Mini site não carregado');
      if (!form.email || !form.password) return setProfileError('Email e senha são obrigatórios para entrar');
      setProfileError(null);
      setLoadingProfile(true);
      try {
        // Sign in with email/password
        const { data: signData, error: signError } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (signError) {
          console.error('Erro ao autenticar:', signError);
          setProfileError(signError.message || 'Erro ao autenticar');
          return;
        }

        const userId = (signData && (signData.user as any)?.id) || (signData as any)?.user?.id || null;

        // Ensure session is established before performing DB writes that rely on auth.uid()
        const { data: sessionData } = await supabase.auth.getSession();
        const hasSession = !!(sessionData && (sessionData as any).session);

        // Try to find an existing minisite_profiles row linked to this user and minisite
        let profileRow: any = null;
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('minisite_profiles')
            .select('*')
            .eq('mini_site_id', miniSite.id)
            .eq('user_id', userId)
            .maybeSingle();
          if (profileError) {
            console.error('Erro ao buscar perfil:', profileError);
          } else {
            profileRow = profileData;
          }
        } catch (e) {
          console.error('Erro ao buscar perfil (catch):', e);
        }

        if (!profileRow) {
          // Build payload. If we don't have a session yet, omit user_id to avoid RLS failures.
          const payload: any = { mini_site_id: miniSite.id, email: form.email || null, phone: form.phone || null, name: null };
          if (hasSession && userId) payload.user_id = userId;

          const { data: created, error: createErr } = await supabase
            .from('minisite_profiles')
            .insert(payload)
            .select('*')
            .maybeSingle();

            if (createErr) {
            console.error('Erro ao criar perfil automático:', createErr);
            // If this is an RLS-related error or FK missing (users row not ready), attempt fallback: insert without user_id
            if (
              (createErr as any)?.code === '42501' ||
              (createErr as any)?.message?.includes('row-level security') ||
              (createErr as any)?.code === '23503' ||
              (createErr as any)?.message?.includes('violates foreign key')
            ) {
              try {
                const { data: fallback, error: fbErr } = await supabase
                  .from('minisite_profiles')
                  .insert({ mini_site_id: miniSite.id, email: form.email || null, phone: form.phone || null, name: null })
                  .select('*')
                  .maybeSingle();
                if (fbErr) {
                  console.error('Erro no fallback ao criar perfil:', fbErr);
                } else {
                  profileRow = fallback;
                  try {
                    localStorage.setItem('pending_profile_id', String(fallback?.id));
                    // Save some profile info locally so we can show the name/email in the UI
                    localStorage.setItem('user_profile', JSON.stringify({ id: fallback?.id, mini_site_id: miniSite.id, user_id: null, name: fallback?.name || form.name || null, email: fallback?.email || form.email || null }));
                  } catch (e) {}
                }
              } catch (e) {
                console.error('Erro no fallback (catch):', e);
              }
            }
          } else {
            profileRow = created;
          }
        }

        try {
          localStorage.setItem('user_profile', JSON.stringify({ id: profileRow?.id || null, mini_site_id: miniSite.id, user_id: userId, name: profileRow?.name || form.name || null, email: profileRow?.email || form.email || null }));
        } catch (e) {}

        setIsAuthenticated(true);
        setProfileModalOpen(false);
        toast({ title: 'Bem vindo', description: 'Você entrou com sucesso.' });
      } finally {
        setLoadingProfile(false);
      }
    };

    // If the client is already authenticated, show a simple profile view with logout
    if (isAuthenticated) {
      // Try to read stored profile for display
      let localProfile: { id?: any; mini_site_id?: any; user_id?: any; email?: string; name?: string } | null = null;
      try {
        const raw = localStorage.getItem('user_profile');
        localProfile = raw ? JSON.parse(raw) : null;
      } catch (e) {
        localProfile = null;
      }

      const handleSignOut = async () => {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.warn('Erro ao deslogar do supabase', e);
        }
        try { localStorage.removeItem('user_profile'); } catch (e) {}
        setIsAuthenticated(false);
        setProfileModalOpen(false);
        toast({ title: 'Desconectado', description: 'Você saiu da sua conta.' });
      };

      return (
        <div className="py-4">
          <div className="mb-3">
            <p className="font-medium">Conectado</p>
            {localProfile?.name && <p className="text-sm text-muted-foreground">Perfil Nome: {localProfile.name}</p>}
            {localProfile?.email && <p className="text-sm text-muted-foreground">{localProfile.email}</p>}
          </div>
          <div>
            <Button className="w-full" variant="destructive" onClick={handleSignOut}>Desconectar</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="py-2">
        <div className="flex gap-2 mb-4">
          <button className={`flex-1 py-2 rounded ${mode === 'login' ? 'bg-primary text-white' : 'bg-transparent border'} `} onClick={() => setMode('login')}>Entrar</button>
          <button className={`flex-1 py-2 rounded ${mode === 'create' ? 'bg-primary text-white' : 'bg-transparent border'} `} onClick={() => setMode('create')}>Criar Perfil</button>
        </div>

        {profileError && <p className="text-sm text-red-500 mb-2">{profileError}</p>}

        {mode === 'login' ? (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="login_email" style={{ color: miniSite?.theme_color }}>Email</Label>
              <Input id="login_email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="login_password" style={{ color: miniSite?.theme_color }}>Senha</Label>
              <Input id="login_password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Senha" />
            </div>
            <div>
              <Button className="w-full" onClick={handleLoginProfile} disabled={loadingProfile}>{loadingProfile ? 'Entrando...' : 'Entrar'}</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="create_name" style={{ color: miniSite?.theme_color }}>Nome</Label>
              <Input id="create_name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create_email" style={{ color: miniSite?.theme_color }}>Email</Label>
              <Input id="create_email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create_password" style={{ color: miniSite?.theme_color }}>Senha</Label>
              <Input id="create_password" value={form.password} type="password" onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Senha" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create_phone" style={{ color: miniSite?.theme_color }}>Telefone (opcional)</Label>
              <Input id="create_phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: sanitizePhone(e.target.value) })} placeholder="(00) 00000-0000" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create_address" style={{ color: miniSite?.theme_color }}>Endereço</Label>
              <Input id="create_address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro, cidade" />
            </div>
            <div>
              <Button className="w-full" onClick={handleCreateProfile} disabled={loadingProfile}>{loadingProfile ? 'Criando...' : 'Criar Perfil'}</Button>
            </div>
          </div>
        )}
      </div>
    );
  };


  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: miniSite?.background_color || undefined }}>
      {/* Banner with gradient overlay and animations */}
          {miniSite ? (
        <div className="w-full relative overflow-hidden">
          {miniSite.banner ? (
            <div className="relative">
              <img
                src={miniSite.banner}
                alt={`${miniSite.name} banner`}
                loading="lazy"
                className="w-full h-32 md:h-40 lg:h-48 object-cover"
              />
              {/* Gradient overlay for better text readability */}
              <div
                className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30"
                style={{ pointerEvents: 'none' }}
              />
            </div>
          ) : (
            <div
              className="w-full h-32 md:h-40 lg:h-48 flex items-center justify-center bg-gradient-to-br"
              style={{
                backgroundImage: `linear-gradient(135deg, ${miniSite.theme_color}E6 0%, ${miniSite.theme_color} 100%)`
              }}
            >
              <div className="text-center">
                <h2 className="text-xl md:text-2xl font-bold animate-in fade-in-50 zoom-in-95" style={{ color: miniSite.text_color || readableTextColor(miniSite.theme_color) }}>
                  {miniSite.name}
                </h2>
              </div>
            </div>
          )}

          {/* Logo overlay with pulse animation */}
          {miniSite.logo && (
            <div
              className="z-40 animate-in zoom-in-95 fade-in-50"
              style={{
                position: 'absolute',
                left: '50%',
                bottom: '82px',
                transform: 'translateX(-50%)',
                animationDelay: '100ms',
                animationFillMode: 'backwards'
              }}
            >
              <div className="relative h-24 w-24 rounded-full bg-white flex items-center justify-center overflow-hidden shadow-xl ring-4 ring-white/50 transition-transform hover:scale-105 hover:shadow-2xl">
                <img src={miniSite.logo} alt={miniSite.name} loading="lazy" className="h-20 w-20 object-cover" />
                {/* Subtle pulse effect */}
                <div className="absolute inset-0 rounded-full bg-white/10 animate-pulse" style={{ animationDuration: '3s' }} />
              </div>
            </div>
          )}

          {/* Business info with animations */}
          <div className="w-full px-2 mt-0">
            <div
              className="mx-auto w-full sm:w-4/5 md:w-3/4 lg:w-2/3 xl:w-1/2 text-center py-1 px-2 animate-in fade-in-50 slide-in-from-bottom-3"
              style={{
                color: miniSite.text_color || readableTextColor(miniSite.background_color || miniSite.theme_color),
                animationDelay: '200ms',
                animationFillMode: 'backwards'
              }}
            >
              {miniSite.logo ? (
                <div className="flex items-center justify-center gap-2 mb-1 mx-auto" style={{ maxWidth: 420 }}>
                  <div className="text-center">
                    <h2 className="text-sm md:text-base font-bold leading-tight">{miniSite.name}</h2>
                    {miniSite.description ? (
                      <p className="text-xs mt-0.5 opacity-90">{miniSite.description}</p>
                    ) : (
                      <p className="text-xs mt-0.5 opacity-90">Bem vindo a {miniSite.name}</p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-sm md:text-base font-bold">{miniSite.name}</h2>
                  {miniSite.description ? (
                    <p className="text-xs mt-0.5 opacity-90">{miniSite.description}</p>
                  ) : (
                    <p className="text-xs mt-0.5 opacity-90">Bem vindo a {miniSite.name}</p>
                  )}
                </>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 mt-1.5 text-sm">
                {miniSite.whatsapp_number && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/50 backdrop-blur-sm transition-transform hover:scale-105">
                    <Phone className="h-3 w-3" />
                    <span className="text-xs font-medium">{miniSite.whatsapp_number}</span>
                  </div>
                )}
                {miniSite.address && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/50 backdrop-blur-sm transition-transform hover:scale-105">
                    <MapPin className="h-3 w-3" />
                    <span className="text-xs font-medium">{miniSite.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Desktop top-right menu: Home / Pedidos / Perfil (fixed while scrolling) */}
          <div className="hidden md:flex fixed top-2 right-6 items-center gap-2 z-50 animate-in slide-in-from-top-3 fade-in-50">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-lg hover:scale-105 active:scale-95"
              style={{
                backgroundColor: miniSite?.button_color || miniSite?.theme_color,
                color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color),
                border: '2px solid',
                borderColor: miniSite?.theme_color
              }}
            >
              <HomeIcon className="h-4 w-4" />
              <span>Home</span>
            </button>

            <button
              onClick={() => handleOpenOrders()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-lg hover:scale-105 active:scale-95 backdrop-blur-sm"
              style={{
                backgroundColor: miniSite?.card_color || 'rgba(255, 255, 255, 0.9)',
                color: miniSite?.theme_color || '#374151',
                border: '2px solid',
                borderColor: miniSite?.theme_color
              }}
            >
              <ListIcon className="h-4 w-4" />
              <span>Pedidos</span>
            </button>

            <button
              onClick={() => setProfileModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-lg hover:scale-105 active:scale-95 backdrop-blur-sm"
              style={{
                backgroundColor: miniSite?.card_color || 'rgba(255, 255, 255, 0.9)',
                color: miniSite?.theme_color || '#374151',
                border: '2px solid',
                borderColor: miniSite?.theme_color
              }}
            >
              <UserIcon className="h-4 w-4" />
              <span>Perfil</span>
            </button>
          </div>
        </div>
      ) : null}

  <main className="container mx-auto px-4 py-8 pt-8">
        <div className="grid gap-8">
          {/* Menu/Serviços */}
          <div className="space-y-6">
            {/* Filtro de Categorias - Pills horizontais */}
            {categories.length > 1 && (
              <div className="border-b pb-4 -mx-4 px-4">
                <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className="flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 whitespace-nowrap backdrop-blur-sm hover:scale-105 active:scale-95"
                      style={{
                        backgroundColor: selectedCategory === category
                          ? (miniSite?.button_color || miniSite?.theme_color)
                          : 'rgba(255, 255, 255, 0.8)',
                        color: selectedCategory === category
                          ? (miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color))
                          : (miniSite?.theme_color || '#374151'),
                        border: '2px solid',
                        borderColor: selectedCategory === category
                          ? (miniSite?.theme_color)
                          : `${miniSite?.theme_color}40` || 'rgba(0, 0, 0, 0.1)',
                        boxShadow: selectedCategory === category
                          ? `0 4px 12px ${miniSite?.theme_color}40, 0 2px 4px rgba(0, 0, 0, 0.1)`
                          : '0 2px 6px rgba(0, 0, 0, 0.08)'
                      }}
                    >
                      {category === "Todos" && "📋 "}
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Grid de Produtos */}
            {/* Grid responsivo: 1 coluna no mobile, 4 colunas no desktop */}
            <div className="px-4">
              <div className="w-full flex justify-center">
                <div className="w-full max-w-7xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 py-4 justify-items-center">
                {filteredItems.length === 0 ? (
                  <>
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={`skeleton-${i}`}
                        className="w-full max-w-xs bg-white rounded-lg shadow-md overflow-hidden animate-pulse"
                        style={{ animationDelay: `${i * 100}ms` }}
                      >
                        <div className="p-4 space-y-4">
                          <div className="space-y-2">
                            <div className="h-5 bg-gray-200 rounded w-3/4" />
                            <div className="h-4 bg-gray-200 rounded w-1/2" />
                          </div>
                          <div className="h-3 bg-gray-200 rounded w-2/3" />
                          <div className="pt-4 border-t border-gray-100">
                            <div className="h-10 bg-gray-200 rounded-lg" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  filteredItems.map((item, index) => (
                    <Card
                      key={item.id}
                      className="w-full max-w-xs overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 animate-in fade-in-50 slide-in-from-bottom-5"
                      style={{
                        backgroundColor: miniSite?.card_color || undefined,
                        animationDelay: `${index * 50}ms`,
                        animationFillMode: 'backwards'
                      }}
                    >
                      <div className="flex flex-col h-full">
                        <div className="flex-1 flex flex-col justify-between p-3">
                          <div>
                            <div className="mb-3">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <h3 className="text-base font-semibold line-clamp-2" style={{ color: miniSite?.theme_color }}>
                                    {item.title}
                                  </h3>
                                  {item.duration && (
                                    <Badge variant="outline" className="mt-1.5">
                                      <CalendarIcon className="h-3 w-3 mr-1" />
                                      {item.duration} min
                                    </Badge>
                                  )}
                                </div>
                                <div className="ml-2 flex flex-col items-end">
                                  <span className="text-lg font-bold" style={{ color: miniSite?.theme_color }}>
                                    R$ {item.price.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {item.description && (
                              <div className="mb-3">
                                <button
                                  type="button"
                                  onClick={() => openDescModal(item.description)}
                                  className="flex items-center gap-1.5 text-xs hover:underline transition-colors"
                                  style={{ color: miniSite?.theme_color }}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>Ver detalhes</span>
                                </button>
                              </div>
                            )}
                           </div>

                           <div className="mt-auto pt-3 border-t" style={{ borderColor: `${miniSite?.theme_color}20` }}>
                            <Button
                              type="button"
                              className="w-full py-2.5 text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-md active:scale-95"
                              style={{
                                backgroundColor: miniSite?.button_color || miniSite?.theme_color,
                                color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color),
                                border: '1px solid',
                                borderColor: miniSite?.theme_color,
                              }}
                              onClick={() => handleAddClick(item)}
                            >
                              {miniSite?.template === "delivery" ? "🛒 Adicionar ao Carrinho" : "📅 Agendar Serviço"}
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
              <div className="hidden md:block fixed bottom-4 right-4 md:top-20 md:right-6 md:bottom-auto z-50 animate-in slide-in-from-right-5 fade-in-50">
                <button
                  onClick={() => setCartOpen(true)}
                  className="inline-flex items-center gap-3 px-5 py-3 rounded-full shadow-xl text-sm touch-manipulation transition-all duration-300 hover:shadow-2xl hover:scale-105 active:scale-95 group"
                  style={{
                    backgroundColor: miniSite?.button_color || miniSite?.theme_color,
                    color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color),
                    border: '2px solid white'
                  }}
                  aria-label="Ver carrinho"
                >
                  <ShoppingCart className="h-5 w-5 transition-transform group-hover:scale-110" />
                  <span className="font-semibold text-sm hidden sm:inline">Ver Carrinho</span>
                  <span className="font-bold text-base">R$ {totalPrice.toFixed(2)}</span>
                  <span className="inline-flex items-center justify-center bg-white text-black rounded-full h-7 w-7 text-xs font-bold shadow-md animate-pulse" style={{ animationDuration: '2s' }}>
                    {totalItems}
                  </span>
                </button>
              </div>

          <Dialog open={cartOpen} onOpenChange={setCartOpen} modal>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col" style={{ backgroundColor: miniSite?.card_color || undefined }} closeButtonColor={miniSite?.theme_color}>
              <DialogHeader>
                <DialogTitle style={{ color: miniSite?.theme_color }}>Carrinho</DialogTitle>
                <DialogDescription style={{ color: miniSite?.theme_color }}>Revise seus itens e ajuste quantidades</DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto flex-1 py-4 pr-2 sm:pr-4">
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

                {/* Delivery Fee Section */}
                {miniSite.template === "delivery" && (miniSite.delivery_fee_type === "fixed" || miniSite.delivery_fee_type === "by_neighborhood") && (
                  <div className="border-t pt-3 pb-3 mb-3">
                    <h3 className="font-semibold text-sm mb-3" style={{ color: miniSite?.theme_color }}>Taxa de Entrega</h3>

                    {miniSite.delivery_fee_type === "by_neighborhood" && miniSite.delivery_neighborhoods && miniSite.delivery_neighborhoods.length > 0 ? (
                      <div className="grid gap-2">
                        <Label htmlFor="cart-neighborhood" style={{ color: miniSite?.theme_color }}>Selecione seu bairro *</Label>
                        <Select
                          value={checkoutData.neighborhood}
                          onValueChange={(value) => setCheckoutData({ ...checkoutData, neighborhood: value })}
                        >
                          <SelectTrigger id="cart-neighborhood">
                            <SelectValue placeholder="Selecione o bairro" />
                          </SelectTrigger>
                          <SelectContent>
                            {miniSite.delivery_neighborhoods.map((neighborhood) => (
                              <SelectItem key={neighborhood.name} value={neighborhood.name}>
                                {neighborhood.name} - R$ {neighborhood.fee.toFixed(2)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : miniSite.delivery_fee_type === "fixed" && miniSite.delivery_fee_value ? (
                      <div className="flex justify-between text-sm">
                        <span style={{ color: miniSite?.theme_color }}>Taxa fixa de entrega:</span>
                        <span style={{ color: miniSite?.theme_color }}>R$ {miniSite.delivery_fee_value.toFixed(2)}</span>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="border-t pt-3 mb-4">
                  <div className="flex justify-between text-sm mb-2" style={{ color: miniSite?.theme_color }}>
                    <span>Subtotal</span>
                    <span>R$ {totalPrice.toFixed(2)}</span>
                  </div>

                  {/* Show calculated delivery fee */}
                  {miniSite.template === "delivery" && (() => {
                    let deliveryFee = 0;
                    if (miniSite.delivery_fee_type === "fixed" && miniSite.delivery_fee_value) {
                      deliveryFee = miniSite.delivery_fee_value;
                    } else if (miniSite.delivery_fee_type === "by_neighborhood" && checkoutData.neighborhood && miniSite.delivery_neighborhoods) {
                      const neighborhood = miniSite.delivery_neighborhoods.find(n => n.name === checkoutData.neighborhood);
                      if (neighborhood) {
                        deliveryFee = neighborhood.fee;
                      }
                    }

                    if (deliveryFee > 0 || miniSite.delivery_fee_type === "by_neighborhood") {
                      return (
                        <div className="flex justify-between text-sm mb-2" style={{ color: miniSite?.theme_color }}>
                          <span>Taxa de Entrega{checkoutData.neighborhood ? ` (${checkoutData.neighborhood})` : ''}</span>
                          <span>{deliveryFee > 0 ? `R$ ${deliveryFee.toFixed(2)}` : '-'}</span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="flex justify-between font-bold text-lg" style={{ color: miniSite?.theme_color }}>
                    <span>Total</span>
                    <span>R$ {(() => {
                      let deliveryFee = 0;
                      if (miniSite.delivery_fee_type === "fixed" && miniSite.delivery_fee_value) {
                        deliveryFee = miniSite.delivery_fee_value;
                      } else if (miniSite.delivery_fee_type === "by_neighborhood" && checkoutData.neighborhood && miniSite.delivery_neighborhoods) {
                        const neighborhood = miniSite.delivery_neighborhoods.find(n => n.name === checkoutData.neighborhood);
                        if (neighborhood) {
                          deliveryFee = neighborhood.fee;
                        }
                      }
                      return (totalPrice + deliveryFee).toFixed(2);
                    })()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{totalItems} {totalItems === 1 ? "item" : "itens"}</p>
                </div>
              </div>
              <DialogFooter>
                <Button className="w-full" style={{ backgroundColor: miniSite?.button_color || miniSite?.theme_color, color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color), border: '1px solid', borderColor: miniSite?.theme_color }} onClick={() => { setCartOpen(false); openCheckout(); }}>
                  Finalizar Pedido
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Mobile cart bar (appears above footer) */}
      {selectedItems.length > 0 && mobileCartVisible && (
        <div className="fixed bottom-16 left-4 right-4 z-50 md:hidden animate-in slide-in-from-bottom-5 fade-in-50">
          <button
            onClick={() => setCartOpen(true)}
            aria-label="Ver carrinho"
            className="w-full px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between transition-all duration-300 active:scale-95 group"
            style={{
              backgroundColor: miniSite?.button_color || miniSite?.theme_color,
              color: miniSite?.text_color || readableTextColor(miniSite?.button_color || miniSite?.theme_color),
              border: '2px solid white'
            }}
          >
            <div className="flex items-center gap-3 font-semibold">
              <ShoppingCart className="h-5 w-5 transition-transform group-active:scale-110" />
              <span className="text-sm">Ver Carrinho</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-base select-none" style={{ userSelect: 'none' }}>R$ {totalPrice.toFixed(2)}</span>
              <span className="inline-flex items-center justify-center bg-white text-black rounded-full h-7 w-7 text-xs font-bold shadow-md animate-pulse" style={{ animationDuration: '2s' }}>
                {totalItems}
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Mobile fixed footer with Home / Pedidos / Perfil (compact) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="flex items-center justify-around px-4 py-2 bg-white/95 backdrop-blur-md border-t-2 shadow-lg" style={{ borderColor: `${miniSite?.theme_color}20` }}>
          <button
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-200 active:scale-95 active:bg-gray-100"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Home"
            style={{ color: miniSite?.theme_color || '#6b7280' }}
          >
            <HomeIcon className="h-5 w-5" />
            <span className="text-xs font-medium">Home</span>
          </button>
          <button
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-200 active:scale-95 active:bg-gray-100"
            onClick={() => handleOpenOrders()}
            aria-label="Pedidos"
            style={{ color: miniSite?.theme_color || '#6b7280' }}
          >
            <ListIcon className="h-5 w-5" />
            <span className="text-xs font-medium">Pedidos</span>
          </button>
          <button
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-200 active:scale-95 active:bg-gray-100"
            onClick={() => setProfileModalOpen(true)}
            aria-label="Perfil"
            style={{ color: miniSite?.theme_color || '#6b7280' }}
          >
            <UserIcon className="h-5 w-5" />
            <span className="text-xs font-medium">Perfil</span>
          </button>
        </div>
      </div>

      {/* Options Modal (when adding product with additions) */}
      <Dialog open={optionModalOpen} onOpenChange={setOptionModalOpen} modal>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col" style={{ backgroundColor: miniSite?.card_color || undefined }} closeButtonColor={miniSite?.theme_color}>
          <DialogHeader>
            <DialogTitle style={{ color: miniSite?.theme_color }}>{optionModalItem?.title}</DialogTitle>
            <DialogDescription style={{ color: miniSite?.theme_color }}>Selecione as opções adicionais</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 py-4 pr-2 sm:pr-4">
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
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col" style={{ backgroundColor: miniSite?.card_color || undefined }} closeButtonColor={miniSite?.theme_color}>
          <DialogHeader>
            <DialogTitle style={{ color: miniSite?.theme_color }}>Descrição do Produto</DialogTitle>
              </DialogHeader>
          <div className="overflow-y-auto flex-1 py-2 pr-2 sm:pr-4">
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
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col" style={{ backgroundColor: miniSite?.card_color || undefined }} closeButtonColor={miniSite?.theme_color}>
          <DialogHeader>
            <DialogTitle style={{ color: miniSite?.theme_color }}>Finalizar Pedido</DialogTitle>
            <DialogDescription style={{ color: miniSite?.theme_color }}>
              Preencha seus dados para enviar o pedido via WhatsApp
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-2 sm:pr-4">
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
                placeholder="Rua, número, complemento"
              />
            </div>

            {/* Campo de Bairro */}
            <div className="grid gap-2">
              <Label htmlFor="neighborhood" style={{ color: miniSite?.theme_color }}>
                Bairro {miniSite.delivery_fee_type === "by_neighborhood" ? "*" : ""}
              </Label>

              {/* Se tem taxa por bairro E já selecionou no carrinho: mostrar como campo fixo (readonly) */}
              {miniSite.delivery_fee_type === "by_neighborhood" && checkoutData.neighborhood ? (
                <Input
                  id="neighborhood"
                  value={checkoutData.neighborhood}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              ) : miniSite.delivery_fee_type === "by_neighborhood" && miniSite.delivery_neighborhoods && miniSite.delivery_neighborhoods.length > 0 ? (
                /* Se tem taxa por bairro mas NÃO selecionou no carrinho: mostrar select */
                <Select
                  value={checkoutData.neighborhood}
                  onValueChange={(value) =>
                    setCheckoutData({ ...checkoutData, neighborhood: value })
                  }
                >
                  <SelectTrigger id="neighborhood">
                    <SelectValue placeholder="Selecione o bairro" />
                  </SelectTrigger>
                  <SelectContent>
                    {miniSite.delivery_neighborhoods.map((neighborhood) => (
                      <SelectItem key={neighborhood.name} value={neighborhood.name}>
                        {neighborhood.name} - R$ {neighborhood.fee.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                /* Se NÃO tem taxa por bairro OU é taxa fixa: campo editável */
                <Input
                  id="neighborhood"
                  value={checkoutData.neighborhood}
                  onChange={(e) =>
                    setCheckoutData({ ...checkoutData, neighborhood: e.target.value })
                  }
                  placeholder="Digite seu bairro"
                />
              )}

              {miniSite.delivery_fee_type === "by_neighborhood" && checkoutData.neighborhood && (
                <p className="text-xs text-muted-foreground">
                  Bairro selecionado no carrinho. Para alterar, volte ao carrinho.
                </p>
              )}
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
                !!phoneError ||
                (miniSite.delivery_fee_type === "by_neighborhood" && !checkoutData.neighborhood)
              }
            >
              <Phone className="h-4 w-4 mr-2" />
              Enviar Pedido via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile modal (mobile) with login/create flows using minisite_profiles */}
      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen} modal>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col" style={{ backgroundColor: miniSite?.card_color || undefined }} closeButtonColor={miniSite?.theme_color}>
          <DialogHeader>
            <DialogTitle style={{ color: miniSite?.theme_color }}>Perfil</DialogTitle>
            <DialogDescription style={{ color: miniSite?.theme_color }}>Entre ou crie um perfil para salvar e acompanhar pedidos neste mini-site.</DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 pr-2 sm:pr-4">
            <ProfileModalContent />
          </div>

        </DialogContent>
      </Dialog>

      {/* Orders Modal */}
      <Dialog open={ordersModalOpen} onOpenChange={setOrdersModalOpen} modal>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col" style={{ backgroundColor: miniSite?.card_color || undefined }} closeButtonColor={miniSite?.theme_color}>
          <DialogHeader>
            <DialogTitle style={{ color: miniSite?.theme_color }}>Meus Pedidos</DialogTitle>
            <DialogDescription style={{ color: miniSite?.theme_color }}>Histórico de pedidos neste estabelecimento</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 py-4 pr-2 sm:pr-4">
            {ordersLoading ? (
              <p className="text-center py-4" style={{ color: miniSite?.theme_color }}>Carregando pedidos...</p>
            ) : orders.length === 0 ? (
              <p className="text-center py-4" style={{ color: miniSite?.theme_color }}>Nenhum pedido encontrado</p>
            ) : (
              <div className="space-y-4">
                {orders.map((order: any) => (
                  <div key={order.id} className="border rounded-lg p-4" style={{ borderColor: miniSite?.theme_color }}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold" style={{ color: miniSite?.theme_color }}>
                          Pedido #{order.order_number || order.id?.slice(0, 8)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('pt-BR')} às{' '}
                          {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <Badge variant={order.status === 'completed' ? 'default' : 'outline'}>
                        {order.status === 'pending' && 'Pendente'}
                        {order.status === 'processing' && 'Em processamento'}
                        {order.status === 'completed' && 'Concluído'}
                        {order.status === 'cancelled' && 'Cancelado'}
                      </Badge>
                    </div>
                    <div className="space-y-1 mb-2">
                      {order.items?.map((item: any, idx: number) => (
                        <div key={idx} className="text-sm flex justify-between">
                          <span style={{ color: miniSite?.theme_color }}>
                            {item.quantity}x {item.title}
                            {item.selectedOptions && item.selectedOptions.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {' '}({item.selectedOptions.map((o: any) => o.name).join(', ')})
                              </span>
                            )}
                          </span>
                          <span style={{ color: miniSite?.theme_color }}>
                            R$ {((item.price + (item.selectedOptions?.reduce((s: number, o: any) => s + o.price, 0) || 0)) * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-2 mt-2" style={{ borderColor: miniSite?.theme_color }}>
                      {(() => {
                        // Calcular subtotal somando os itens
                        const itemsSubtotal = order.items?.reduce((sum: number, item: any) => {
                          const itemPrice = item.price || 0;
                          const optionsPrice = item.selectedOptions?.reduce((s: number, o: any) => s + (o.price || 0), 0) || 0;
                          return sum + ((itemPrice + optionsPrice) * (item.quantity || 1));
                        }, 0) || 0;

                        const deliveryFee = order.delivery_fee || 0;
                        const total = itemsSubtotal + deliveryFee;

                        return (
                          <>
                            {/* Subtotal (soma dos itens) */}
                            {deliveryFee > 0 && (
                              <div className="flex justify-between text-sm mb-1">
                                <span style={{ color: miniSite?.theme_color }}>Subtotal:</span>
                                <span style={{ color: miniSite?.theme_color }}>
                                  R$ {itemsSubtotal.toFixed(2)}
                                </span>
                              </div>
                            )}
                            {/* Delivery fee */}
                            {deliveryFee > 0 && (
                              <div className="flex justify-between text-sm mb-1">
                                <span style={{ color: miniSite?.theme_color }}>Taxa de entrega:</span>
                                <span style={{ color: miniSite?.theme_color }}>
                                  R$ {deliveryFee.toFixed(2)}
                                </span>
                              </div>
                            )}
                            {/* Total */}
                            <div className="flex justify-between font-semibold">
                              <span style={{ color: miniSite?.theme_color }}>Total:</span>
                              <span style={{ color: miniSite?.theme_color }}>R$ {total.toFixed(2)}</span>
                            </div>
                            {order.payment_method && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Pagamento: {order.payment_method}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer (compact, padded above mobile menu) */}
      <footer className="mt-4 py-2 border-t" style={{ paddingBottom: 48 }}>
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
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
