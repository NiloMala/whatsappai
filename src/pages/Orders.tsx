import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  Phone,
  CreditCard,
  ShoppingBag,
} from "lucide-react";

interface OrderItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  options?: Array<{ name: string; price: number }>;
}

interface Order {
  id: string;
  mini_site_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  customer_neighborhood?: string;
  delivery_fee?: number;
  payment_method?: string;
  items: OrderItem[];
  total_amount: number;
  status: string;
  notes?: string;
  order_number?: number;
  created_at: string;
  mini_sites?: {
    name: string;
    slug: string;
  };
}

export default function Orders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, statusFilter]);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Fetch all orders for user's mini sites
      const { data, error } = await supabase
        .from("minisite_orders")
        .select(
          `
          *,
          mini_sites!inner(name, slug, user_id)
        `
        )
        .eq("mini_sites.user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar pedidos",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    if (statusFilter === "all") {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter((order) => order.status === statusFilter));
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingStatus(true);

      const { error } = await supabase
        .from("minisite_orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      // Send notification to customer via AI agent
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        await sendStatusNotification(order, newStatus);
      }

      // Update local state
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      setSelectedOrder(null);

      toast({
        title: "Status atualizado",
        description: `Pedido marcado como ${getStatusLabel(newStatus)}`,
      });
    } catch (error: any) {
      console.error("Error updating order status:", error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar status",
        description: error.message,
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const sendStatusNotification = async (order: Order, newStatus: string) => {
    try {
      // Get the mini site to find the agent_id and name
      const { data: miniSite, error: miniSiteError } = await supabase
        .from("mini_sites")
        .select("agent_id, name")
        .eq("id", order.mini_site_id)
        .single();

      if (miniSiteError || !miniSite?.agent_id) {
        console.log("No agent configured for this mini site");
        return;
      }

      // Prepare notification message based on status
      let message = "";
      const orderNumber = order.order_number || "N/A";
      const establishmentName = miniSite.name || "nosso estabelecimento";

      switch (newStatus) {
        case "processing":
          message = `Ótima notícia! Seu pedido #${orderNumber} foi aceito e já está sendo preparado! 👨‍🍳`;
          break;
        case "out_for_delivery":
          message = `Seu pedido #${orderNumber} saiu para entrega! O entregador está a caminho. 🛵`;
          break;
        case "delivered":
          message = `Pedido #${orderNumber} entregue! Bom apetite! 😋`;
          break;
        case "completed":
          message = `Obrigado por escolher ${establishmentName}! Esperamos você novamente. ❤️`;
          break;
        case "cancelled":
          message = `Infelizmente seu pedido #${orderNumber} foi cancelado. Entre em contato para mais informações. 😔`;
          break;
        default:
          return;
      }

      // Send message via agent webhook
      const { data: agent } = await supabase
        .from("agents")
        .select("webhook_url")
        .eq("id", miniSite.agent_id)
        .single();

      if (agent?.webhook_url) {
        await fetch(agent.webhook_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: order.customer_phone,
            message: message,
          }),
        });
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      // Don't throw - notification failure shouldn't block status update
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendente",
      processing: "Em Preparo",
      out_for_delivery: "Saiu para Entrega",
      delivered: "Entregue",
      completed: "Concluído",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      processing: "bg-blue-500",
      out_for_delivery: "bg-purple-500",
      delivered: "bg-teal-500",
      completed: "bg-green-500",
      cancelled: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "processing":
        return <Package className="h-4 w-4" />;
      case "out_for_delivery":
        return <MapPin className="h-4 w-4" />;
      case "delivered":
        return <CheckCircle className="h-4 w-4" />;
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gerenciar Pedidos</h1>
        <p className="text-muted-foreground">
          Visualize e gerencie todos os pedidos recebidos em seus mini sites
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="processing">Em Preparo</SelectItem>
            <SelectItem value="out_for_delivery">Saiu para Entrega</SelectItem>
            <SelectItem value="delivered">Entregues</SelectItem>
            <SelectItem value="completed">Concluídos</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando pedidos...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {statusFilter === "all"
                ? "Nenhum pedido encontrado"
                : `Nenhum pedido ${getStatusLabel(statusFilter).toLowerCase()}`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order) => (
            <Card
              key={order.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedOrder(order)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {order.customer_name}
                      <Badge className={getStatusColor(order.status)}>
                        {getStatusIcon(order.status)}
                        <span className="ml-1">{getStatusLabel(order.status)}</span>
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {order.mini_sites?.name} • {formatDate(order.created_at)}
                      {order.order_number && (
                        <span className="ml-2 font-mono text-primary">
                          #{order.order_number}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      R$ {(order.total_amount || 0).toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {order.items?.length || 0} {(order.items?.length || 0) === 1 ? "item" : "itens"}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  {order.customer_phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {order.customer_phone}
                    </div>
                  )}
                  {order.customer_neighborhood && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {order.customer_neighborhood}
                    </div>
                  )}
                  {order.payment_method && (
                    <div className="flex items-center gap-1">
                      <CreditCard className="h-4 w-4" />
                      {order.payment_method}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Order Detail Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Detalhes do Pedido
              {selectedOrder?.order_number && (
                <span className="ml-2 font-mono text-primary">
                  #{selectedOrder.order_number}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Pedido recebido em {selectedOrder && formatDate(selectedOrder.created_at)}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="overflow-y-auto flex-1 pr-2 sm:pr-4">
              <div className="space-y-6 py-4">
                {/* Status */}
                <div>
                  <h3 className="font-semibold mb-2">Status</h3>
                  <Badge className={getStatusColor(selectedOrder.status)}>
                    {getStatusIcon(selectedOrder.status)}
                    <span className="ml-1">{getStatusLabel(selectedOrder.status)}</span>
                  </Badge>
                </div>

                {/* Customer Info */}
                <div>
                  <h3 className="font-semibold mb-2">Informações do Cliente</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Nome:</strong> {selectedOrder.customer_name}</p>
                    <p><strong>Telefone:</strong> {selectedOrder.customer_phone}</p>
                    {selectedOrder.customer_address && (
                      <p><strong>Endereço:</strong> {selectedOrder.customer_address}</p>
                    )}
                    {selectedOrder.customer_neighborhood && (
                      <p><strong>Bairro:</strong> {selectedOrder.customer_neighborhood}</p>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h3 className="font-semibold mb-2">Itens do Pedido</h3>
                  <div className="space-y-3">
                    {(selectedOrder.items || []).map((item) => (
                      <div key={item.id} className="border-b pb-2">
                        <div className="flex justify-between">
                          <span className="font-medium">
                            {item.quantity}x {item.title}
                          </span>
                          <span>R$ {((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                        </div>
                        {item.options && item.options.length > 0 && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {item.options.map((opt, idx) => (
                              <div key={idx}>
                                + {opt.name} (R$ {(opt.price || 0).toFixed(2)})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Info */}
                <div>
                  <h3 className="font-semibold mb-2">Pagamento</h3>
                  <div className="space-y-1 text-sm">
                    {selectedOrder.payment_method && (
                      <p><strong>Método:</strong> {selectedOrder.payment_method}</p>
                    )}
                    {selectedOrder.delivery_fee !== undefined && selectedOrder.delivery_fee > 0 && (
                      <p><strong>Taxa de Entrega:</strong> R$ {(selectedOrder.delivery_fee || 0).toFixed(2)}</p>
                    )}
                    <p className="text-lg font-bold mt-2">
                      Total: R$ {(selectedOrder.total_amount || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Notes */}
                {selectedOrder.notes && (
                  <div>
                    <h3 className="font-semibold mb-2">Observações</h3>
                    <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedOrder?.status === "pending" && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => updateOrderStatus(selectedOrder.id, "cancelled")}
                  disabled={updatingStatus}
                >
                  Recusar Pedido
                </Button>
                <Button
                  onClick={() => updateOrderStatus(selectedOrder.id, "processing")}
                  disabled={updatingStatus}
                >
                  Aceitar e Preparar
                </Button>
              </>
            )}
            {selectedOrder?.status === "processing" && (
              <Button
                onClick={() => updateOrderStatus(selectedOrder.id, "out_for_delivery")}
                disabled={updatingStatus}
              >
                Saiu para Entrega
              </Button>
            )}
            {selectedOrder?.status === "out_for_delivery" && (
              <Button
                onClick={() => updateOrderStatus(selectedOrder.id, "delivered")}
                disabled={updatingStatus}
              >
                Marcar como Entregue
              </Button>
            )}
            {selectedOrder?.status === "delivered" && (
              <Button
                onClick={() => updateOrderStatus(selectedOrder.id, "completed")}
                disabled={updatingStatus}
              >
                Concluir Pedido
              </Button>
            )}
            {(selectedOrder?.status === "completed" || selectedOrder?.status === "cancelled") && (
              <Button
                variant="outline"
                onClick={() => setSelectedOrder(null)}
              >
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
