import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Search, RefreshCw, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EvolutionChat, EvolutionMessage } from "@/integrations/evolutionProxy";

const MessagesEvolution = () => {
  const { toast } = useToast();
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInstances();
  }, []);

  useEffect(() => {
    if (selectedInstance) {
      fetchChats();
    }
  }, [selectedInstance]);

  useEffect(() => {
    if (selectedChat && selectedInstance) {
      fetchMessages();
    }
  }, [selectedChat, selectedInstance]);

  useEffect(() => {
    // Auto-refresh messages every 5s when a chat is open
    if (selectedChat && selectedInstance) {
      const interval = setInterval(() => {
        fetchMessages();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedChat, selectedInstance]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchInstances = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar instâncias:", error);
        return;
      }

      setInstances(data || []);
      if (data && data.length > 0) {
        setSelectedInstance(data[0].instance_key);
      }
    } catch (err) {
      console.error("Erro ao buscar instâncias:", err);
    }
  };

  const fetchChats = async () => {
    if (!selectedInstance) return;
    setLoading(true);
    try {
      const result = await EvolutionChat.findChats(selectedInstance, {});
      console.log("Chats recebidos:", result);
      // Evolution retorna array ou objeto com array
      const chatsList = Array.isArray(result) ? result : (result?.chats || result?.data || []);
      setChats(chatsList);
      if (chatsList.length > 0 && !selectedChat) {
        setSelectedChat(chatsList[0]);
      }
    } catch (err) {
      console.error("Erro ao buscar chats:", err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os chats. Verifique a instância.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!selectedChat || !selectedInstance) return;
    try {
      const remoteJid = selectedChat.id || selectedChat.remoteJid || selectedChat.jid;
      const result = await EvolutionChat.findMessages(selectedInstance, {
        where: { key: { remoteJid } },
      });
      console.log("Mensagens recebidas:", result);
      const messagesList = Array.isArray(result) ? result : (result?.messages || result?.data || []);
      setMessages(messagesList);
    } catch (err) {
      console.error("Erro ao buscar mensagens:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !selectedInstance) return;

    setSending(true);
    try {
      const remoteJid = selectedChat.id || selectedChat.remoteJid || selectedChat.jid;
      const number = remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "");
      
      await EvolutionMessage.sendText(selectedInstance, {
        number,
        text: newMessage,
      });

      setNewMessage("");
      // Refresh messages after sending
      setTimeout(() => fetchMessages(), 1000);
    } catch (err: any) {
      console.error("Erro ao enviar mensagem:", err);
      toast({
        title: "Erro ao enviar",
        description: err?.message || "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const filteredChats = chats.filter((chat) => {
    const name = chat.name || chat.pushName || chat.id || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Mensagens WhatsApp</h1>
            <p className="text-muted-foreground">
              Chat em tempo rea.l
            </p>
          </div>
          {instances.length > 1 && (
            <Select value={selectedInstance} onValueChange={setSelectedInstance}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.instance_key} value={inst.instance_key}>
                    {inst.instance_name || inst.instance_key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {!selectedInstance && (
          <Card className="p-12 text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Nenhuma instância conectada</h3>
            <p className="text-muted-foreground">
              Conecte uma instância WhatsApp para começar a usar o chat.
            </p>
          </Card>
        )}

        {selectedInstance && (
          <div className="grid md:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
            {/* Chats List */}
            <Card className="md:col-span-1 flex flex-col">
              <div className="p-4 border-b">
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar conversas..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="outline" size="icon" onClick={fetchChats} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2">
                  {loading && chats.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Loader2 className="h-12 w-12 mx-auto mb-3 opacity-50 animate-spin" />
                      <p className="text-sm">Carregando conversas...</p>
                    </div>
                  ) : filteredChats.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Nenhuma conversa encontrada</p>
                    </div>
                  ) : (
                    filteredChats.map((chat) => {
                      const chatId = chat.id || chat.remoteJid || chat.jid;
                      const chatName = chat.name || chat.pushName || chatId;
                      const lastMsg = chat.lastMessage?.message?.conversation || 
                                     chat.lastMessage?.message?.extendedTextMessage?.text || 
                                     "";
                      const lastMsgTime = chat.lastMessage?.messageTimestamp;
                      
                      return (
                        <button
                          key={chatId}
                          onClick={() => setSelectedChat(chat)}
                          className={`w-full text-left p-4 rounded-lg hover:bg-muted/50 transition-colors mb-2 ${
                            selectedChat?.id === chatId || selectedChat?.remoteJid === chatId ? "bg-muted" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium truncate">{chatName}</h3>
                              <p className="text-xs text-muted-foreground truncate">{chatId}</p>
                            </div>
                            {chat.unreadCount > 0 && (
                              <Badge className="h-5 min-w-[20px] ml-2">
                                {chat.unreadCount}
                              </Badge>
                            )}
                          </div>
                          {lastMsg && (
                            <p className="text-sm text-muted-foreground truncate">{lastMsg}</p>
                          )}
                          {lastMsgTime && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(lastMsgTime * 1000), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </Card>

            {/* Messages Area */}
            <Card className="md:col-span-2 flex flex-col">
              {selectedChat ? (
                <>
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold">
                          {selectedChat.name || selectedChat.pushName || selectedChat.id || selectedChat.remoteJid || "Chat"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedChat.id || selectedChat.remoteJid || selectedChat.jid}
                        </p>
                      </div>
                      <Button variant="outline" size="icon" onClick={fetchMessages}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 p-4">
                    <div className="flex flex-col gap-2 pb-4">
                      {messages.map((msg, idx) => {
                        const msgKey = msg.key || {};
                        const isFromMe = msgKey.fromMe || false;
                        const messageContent = msg.message?.conversation || 
                                              msg.message?.extendedTextMessage?.text || 
                                              msg.message?.imageMessage?.caption ||
                                              msg.message?.videoMessage?.caption ||
                                              "[Mídia]";
                        const msgTime = msg.messageTimestamp;
                        
                        return (
                          <div
                            key={msgKey.id || idx}
                            className={`flex ${isFromMe ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`px-4 py-2 rounded-2xl shadow-sm max-w-[80%] min-w-[60px]
                                ${isFromMe ? "bg-[#DCF8C6] text-black ml-8" : "bg-white text-black border border-gray-200 mr-8"}
                              `}
                            >
                              <p className="text-sm whitespace-pre-line break-words">{messageContent}</p>
                              <p className="text-xs opacity-60 mt-1 text-right">
                                {msgTime ? formatDistanceToNow(new Date(msgTime * 1000), {
                                  addSuffix: true,
                                  locale: ptBR,
                                }) : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  <form onSubmit={handleSendMessage} className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite sua mensagem..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={sending}
                      />
                      <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Selecione uma conversa para começar</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MessagesEvolution;
