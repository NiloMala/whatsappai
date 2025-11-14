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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Search, RefreshCw, Loader2, Paperclip, X, File, Image as ImageIcon, Edit2, Check, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EvolutionChat, EvolutionMessage } from "@/integrations/evolutionProxy";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MediaMessage } from "@/components/MediaMessage";

const MessagesEvolution = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set());
  const [deletedChatIds, setDeletedChatIds] = useState<Set<string>>(() => {
    // Load deleted chats from localStorage
    try {
      const stored = localStorage.getItem('deletedChats');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteRemoteJid, setPendingDeleteRemoteJid] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mediaCache, setMediaCache] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"contatos" | "grupos">("contatos");
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [editingContactName, setEditingContactName] = useState(false);
  const [contactName, setContactName] = useState("");
  const [customContactNames, setCustomContactNames] = useState<Record<string, string>>({});
  // export-to-leads modal state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportName, setExportName] = useState("");
  const [exportPhone, setExportPhone] = useState("");
  const [exportContent, setExportContent] = useState("");
  const [exportColumnId, setExportColumnId] = useState<number | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<boolean>(true);

  useEffect(() => {
    fetchInstances();
  }, []);

  useEffect(() => {
    if (selectedInstance) {
      fetchChats();
      loadCustomContactNames();
    }
  }, [selectedInstance]);

  // Auto-select chat when coming from Leads page with phone parameter
  useEffect(() => {
    const phoneParam = searchParams.get('phone');

    console.log('🔍 Auto-select effect running:', {
      phoneParam,
      selectedInstance,
      chatsLength: chats.length,
      hasSelectedChat: !!selectedChat
    });

    if (phoneParam && selectedInstance && chats.length > 0) {
      console.log('📱 Attempting to find chat for phone:', phoneParam);
      console.log('📋 Available chats:', chats.map(c => {
        const remoteJid = c.remoteJid || c.jid || c.id;
        return {
          name: c.name || c.pushName,
          remoteJid,
          phone: remoteJid?.replace('@s.whatsapp.net', '')
        };
      }));

      // Find chat that matches the phone number
      const targetChat = chats.find((chat) => {
        const remoteJid = chat.remoteJid || chat.jid || chat.id;
        // Remove @s.whatsapp.net and compare
        const chatPhone = remoteJid?.replace('@s.whatsapp.net', '');
        return chatPhone === phoneParam;
      });

      if (targetChat) {
        console.log('✅ Found target chat, auto-selecting:', targetChat);
        setSelectedChat(targetChat);
        // Clear the phone parameter from URL
        setSearchParams({});
      } else {
        console.warn('⚠️ Chat not found for phone:', phoneParam);
        console.warn('❌ Available phone numbers:', chats.map(c => {
          const remoteJid = c.remoteJid || c.jid || c.id;
          return remoteJid?.replace('@s.whatsapp.net', '');
        }));
        toast({
          title: 'Chat não encontrado',
          description: `Não foi possível encontrar o chat para o número ${phoneParam}`,
          variant: 'destructive'
        });
        setSearchParams({});
      }
    }
  }, [chats, searchParams, selectedInstance]);

  useEffect(() => {
    if (selectedChat && selectedInstance) {
      // Limpar mensagens ao trocar de chat
      setMessages([]);
      setShouldAutoScroll(true); // Reativar auto-scroll ao trocar de chat
      setEditingContactName(false); // Reset edit mode

      // Carregar nome personalizado se existir
      const remoteJid = selectedChat.remoteJid || selectedChat.jid || selectedChat.id;
      const customName = customContactNames[remoteJid];
      setContactName(customName || selectedChat.name || selectedChat.pushName || "");

      fetchMessages();

      // Auto-refresh: buscar novas mensagens a cada 2 segundos
      console.log("✅ Iniciando auto-refresh para o chat:", remoteJid);
      const intervalId = setInterval(() => {
        console.log("🔄 Auto-refresh: buscando novas mensagens...");
        fetchMessages();
      }, 2000); // 2 segundos (mais rápido para receber mensagens)

      // Cleanup: parar polling quando trocar de chat ou desmontar
      return () => {
        console.log("⏹️ Parando auto-refresh do chat");
        clearInterval(intervalId);
      };
    }
  }, [selectedChat, selectedInstance]);

  // fetch kanban columns (for export modal)
  const { data: kanbanColumns = [] } = useQuery({
    queryKey: ["kanban", "columns"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("kanban_columns").select("*").order("position", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!selectedInstance, // optional
  });

  useEffect(() => {
    // Auto-refresh messages every 5s when a chat is open
    if (selectedChat && selectedInstance) {
      const interval = setInterval(() => {
        fetchMessages();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedChat, selectedInstance]);

  // Poll chats list periodically so the UI reflects deletions/changes made outside the app
  useEffect(() => {
    if (!selectedInstance) return;

    let mounted = true;
    const poll = async () => {
      try {
        const updated = await fetchChats();
        if (!mounted) return;
        const remoteJid = selectedChat?.remoteJid || selectedChat?.jid || selectedChat?.id;
        if (remoteJid && updated) {
          const exists = (updated || []).some((c: any) => (c.remoteJid || c.jid || c.id) === remoteJid);
          if (!exists) {
            // Conversa foi removida externamente -> limpar seleção e mensagens
            setSelectedChat(null);
            setMessages([]);
          }
        }
      } catch (err) {
        // ignore polling errors silently
      }
    };

    // initial poll and then interval
    poll();
    const id = setInterval(poll, 15000); // every 15s
    return () => { mounted = false; clearInterval(id); };
  }, [selectedInstance, selectedChat]);

  useEffect(() => {
    // Scroll to bottom only if auto-scroll is enabled (user is at bottom)
    if (shouldAutoScroll && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, shouldAutoScroll]);

  // keep a ref in sync so handlers can read the immediate value (avoids state race)
  useEffect(() => {
    autoScrollRef.current = shouldAutoScroll;
  }, [shouldAutoScroll]);

  // Realtime subscription para mensagens novas do Supabase
  useEffect(() => {
    if (!selectedChat) return;

    const remoteJid = selectedChat.remoteJid || selectedChat.jid || selectedChat.id;
    const contactPhone = remoteJid?.replace('@s.whatsapp.net', '');

    if (!contactPhone) return;

    console.log('🔴 Iniciando Realtime subscription para contato:', contactPhone);

    // Subscribe to ALL new messages (we'll filter client-side)
    // This is simpler and more reliable than trying to filter by conversation_id
    const channel = supabase
      .channel(`messages:all`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('🔴 Nova mensagem via Realtime:', payload);

          // Check if message is for the current chat
          // We'll refresh to get the new message from Evolution API
          console.log('🔄 Atualizando mensagens via Evolution API...');
          fetchMessages();
        }
      )
      .subscribe((status) => {
        console.log('🔴 Realtime status:', status);
      });

    return () => {
      console.log('⏹️ Parando Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [selectedChat]);

  // If there are images/videos that load after render, ensure we stay at bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const onMediaLoad = () => {
      if (shouldAutoScroll) scrollToBottom();
    };

    const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
    const vids = Array.from(container.querySelectorAll('video')) as HTMLVideoElement[];

    imgs.forEach(img => img.addEventListener('load', onMediaLoad));
    vids.forEach(v => v.addEventListener('loadedmetadata', onMediaLoad));

    // If user interacts (pointer down) inside the container, disable auto-scroll so we don't fight their action
    const onPointerDown = () => {
      autoScrollRef.current = false;
      setShouldAutoScroll(false);
    };
    container.addEventListener('pointerdown', onPointerDown);

    return () => {
      imgs.forEach(img => img.removeEventListener('load', onMediaLoad));
      vids.forEach(v => v.removeEventListener('loadedmetadata', onMediaLoad));
      container.removeEventListener('pointerdown', onPointerDown);
    };
  }, [messages, shouldAutoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
    setShouldAutoScroll(isAtBottom);
  };

  const deleteConversation = async (remoteJidParam?: string) => {
    const remoteJid = remoteJidParam || pendingDeleteRemoteJid || selectedChat?.remoteJid || selectedChat?.jid || selectedChat?.id;
    if (!remoteJid || !selectedInstance) return;
    setIsDeleting(true);
    try {
      // 1) Page through all messages for this remoteJid and delete them.
      const deletedIds: string[] = [];
      try {
        let page = 1;
        const pageSize = 50;
        let totalPages = 1;
        let totalMessages = 0;
        while (true) {
          console.log('Deleting messages, fetching page', page);
          const findRes = await EvolutionChat.findMessages(selectedInstance, {
            where: { key: { remoteJid } },
            limit: pageSize,
            page,
          });
          const messagesObj = findRes?.messages || findRes;
          const records = messagesObj?.records || (Array.isArray(findRes) ? findRes : []);
          totalPages = messagesObj?.pages || totalPages;
          totalMessages = messagesObj?.total || totalMessages;
          if (!records || records.length === 0) break;
          for (const m of records) {
            const id = m.id;
            const altId = m.key && m.key.id;
            const fromMe = (m.key && m.key.fromMe) || false;
            const participant = (m.key && m.key.participant) || '';
            try {
              const delRes = await EvolutionChat.deleteMessageForEveryone(selectedInstance, { id, remoteJid, fromMe, participant });
              console.log('✅ Mensagem deletada:', id, 'Status:', delRes?.status || 'OK');
              if (id) deletedIds.push(id);
              if (altId) deletedIds.push(altId);
            } catch (e) {
              console.error('❌ ERRO ao deletar mensagem', id, ':', e);
              if (id) deletedIds.push(id);
              if (altId) deletedIds.push(altId);
            }
          }
          if (messagesObj?.currentPage && messagesObj.currentPage >= (messagesObj.pages || totalPages)) break;
          page += 1;
          if (page > 999) break;
        }
      } catch (err) {
        console.error('Erro durante paginação/exclusão de mensagens:', err);
        const isFunctionsError = err && (err.name === 'FunctionsHttpError' || String(err).includes('Edge Function'));
        if (isFunctionsError) {
          toast({ title: 'Erro no proxy', description: 'Não foi possível invocar a função de proxy (evolution-chat-proxy). Verifique se a Edge Function está implantada no Supabase.', variant: 'destructive' });
          return;
        }
      }

      if (deletedIds.length > 0) {
        setDeletedMessageIds(prev => {
          const s = new Set(prev);
          deletedIds.forEach(i => s.add(i));
          return s;
        });
        setMessages(prev => prev.filter(m => {
          const mid = m.id || m.key?.id;
          return !deletedIds.includes(mid);
        }));
      }

      // Try to archive
      try {
        await EvolutionChat.archiveChat(selectedInstance, { remoteJid, archive: true, lastMessage: { key: { remoteJid } } });
        console.log('✅ Chat arquivado com sucesso');
      } catch (e) {
        console.warn('⚠️ archiveChat failed (non-fatal)', e);
      }

      // Persist locally
      setDeletedChatIds(prev => {
        const newSet = new Set(prev);
        newSet.add(remoteJid);
        try { localStorage.setItem('deletedChats', JSON.stringify([...newSet])); } catch(e) { console.warn('Failed to save deleted chats', e); }
        return newSet;
      });

      setChats(prev => prev.filter(c => { const cid = c.remoteJid || c.jid || c.id; return cid !== remoteJid; }));
      setSelectedChat(null);
      setMessages([]);
      toast({ title: 'Conversa excluída', description: `${deletedIds.length} mensagens deletadas.` });
    } catch (err) {
      console.error('Erro ao excluir conversa:', err);
      toast({ title: 'Erro', description: 'Não foi possível excluir a conversa.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setPendingDeleteRemoteJid(null);
    }
  };

  const scrollToBottom = () => {
    // Prefer an immediate jump to bottom to avoid intermediate jank
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    } else {
      // no-op if container missing: avoid scrolling the whole document
    }
  };

  // Update messages while preserving scroll position when user is not at bottom
  const applyMessagesUpdate = (updatedMessages: any[]) => {
    const container = messagesContainerRef.current;
    if (!container) {
      setMessages(updatedMessages);
      return;
    }

    const prevScrollHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;
    const wasAtBottom = prevScrollHeight - prevScrollTop - container.clientHeight < 40;

    setMessages(updatedMessages);

    // After DOM update, adjust scroll: if user was at bottom (or auto-scroll is enabled), go to bottom.
    // Otherwise preserve the visual scroll position.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newScrollHeight = container.scrollHeight;
        if (autoScrollRef.current || wasAtBottom) {
          container.scrollTop = container.scrollHeight;
        } else {
          // preserve viewport position
          container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
        }
      });
    });
  };

  const loadCustomContactNames = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedInstance) return;

      const { data, error } = await supabase
        .from("custom_contacts")
        .select("remote_jid, custom_name")
        .eq("user_id", user.id)
        .eq("instance_key", selectedInstance);

      if (error) {
        console.error("Erro ao carregar nomes personalizados:", error);
        return;
      }

      // Converter para objeto { remoteJid: customName }
      const namesMap: Record<string, string> = {};
      data?.forEach(item => {
        namesMap[item.remote_jid] = item.custom_name;
      });
      
      setCustomContactNames(namesMap);
    } catch (err) {
      console.error("Erro ao buscar nomes personalizados:", err);
    }
  };

  // When custom names change, ensure chats list and selectedChat reflect overrides
  useEffect(() => {
    if (!customContactNames) return;
    setChats((prev) =>
      prev.map((c) => {
        const remoteJid = c.remoteJid || c.jid || c.id;
        return {
          ...c,
          name: customContactNames[remoteJid] || c.name || c.pushName || c.id,
        };
      })
    );

    if (selectedChat) {
      const remoteJid = selectedChat.remoteJid || selectedChat.jid || selectedChat.id;
      const overridden = customContactNames[remoteJid];
      if (overridden) {
        setSelectedChat({ ...selectedChat, name: overridden });
        setContactName(overridden);
      }
    }
  }, [customContactNames]);

  // Helper to determine display name with precedence: custom_contacts -> chat.name -> pushName -> remoteJid
  const getChatDisplayName = (chat: any) => {
    if (!chat) return "";
    const remoteJid = chat.remoteJid || chat.jid || chat.id || "";
    return customContactNames[remoteJid] || chat.name || chat.pushName || remoteJid;
  };

  const fetchInstances = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "connected")
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
      
      // Evolution retorna array diretamente
      const rawList = Array.isArray(result) ? result : (result?.chats || result?.data || []);

      // Apply custom contact names if available
      let chatsList = rawList.map((c: any) => {
        const remoteJid = c.remoteJid || c.jid || c.id;
        return {
          ...c,
          // prefer custom name, then existing name/pushName, then id
          name: customContactNames[remoteJid] || c.name || c.pushName || c.id,
        };
      });

      // Hide chats whose lastMessage was locally deleted (prevents reappearing immediately after delete)
      chatsList = chatsList.filter((c: any) => {
        const lmId = c.lastMessage?.id || c.lastMessage?.key?.id;
        if (!lmId) return true;
        return !deletedMessageIds.has(lmId);
      });

      // Hide archived chats
      chatsList = chatsList.filter((c: any) => !c.archived);

      // Hide chats that were deleted locally (persistent via localStorage)
      chatsList = chatsList.filter((c: any) => {
        const cid = c.remoteJid || c.jid || c.id;
        return !deletedChatIds.has(cid);
      });

      setChats(chatsList);

      // Don't auto-select first chat - let user choose or let URL parameter handle it
      // if (chatsList.length > 0 && !selectedChat) {
      //   setSelectedChat({ ...chatsList[0], name: getChatDisplayName(chatsList[0]) });
      // }

      // If the currently selected chat was deleted externally, clear selection and messages
      const currentRemote = selectedChat?.remoteJid || selectedChat?.jid || selectedChat?.id;
      if (currentRemote) {
        const stillExists = chatsList.some((c: any) => (c.remoteJid || c.jid || c.id) === currentRemote);
        if (!stillExists) {
          setSelectedChat(null);
          setMessages([]);
        }
      }
      return chatsList;
    } catch (err: any) {
      console.error("Erro ao buscar chats:", err);
      toast({
        title: "Erro",
        description: err?.message || "Não foi possível carregar os chats. Verifique a instância.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!selectedChat || !selectedInstance) return;
    try {
      // Usar remoteJid primeiro, que contém o número real
      const remoteJid = selectedChat.remoteJid || selectedChat.jid || selectedChat.id;
      console.log("Buscando mensagens para:", remoteJid);
      
      const result = await EvolutionChat.findMessages(selectedInstance, {
        where: { key: { remoteJid } },
        limit: 500, // Aumentar limite para pegar mais mensagens históricas
        sort: { messageTimestamp: -1 }, // Ordenar por mais recente primeiro (-1 = descendente)
      });
      
      console.log("Resultado findMessages:", result);
      console.log("Total de mensagens retornadas:", result?.messages?.total);
      
      // Evolution retorna { messages: { total, pages, currentPage, records: [] } }
      let messagesList = [];
      
      if (Array.isArray(result)) {
        messagesList = result;
      } else if (result?.messages?.records) {
        // O formato correto da Evolution API
        messagesList = result.messages.records;
      } else if (Array.isArray(result?.messages)) {
        messagesList = result.messages;
      } else if (result?.data) {
        messagesList = Array.isArray(result.data) ? result.data : [];
      }
      
      console.log("Mensagens processadas:", messagesList.length, "msgs");

      // DEBUG: Check for duplicate message IDs in the raw data
      const idCounts = new Map();
      const messagesWithSameId = new Map(); // Track which messages have the same ID
      messagesList.forEach((msg, idx) => {
        const msgId = msg.key?.id || msg.id;
        if (msgId) {
          idCounts.set(msgId, (idCounts.get(msgId) || 0) + 1);
          if (!messagesWithSameId.has(msgId)) {
            messagesWithSameId.set(msgId, []);
          }
          messagesWithSameId.get(msgId).push({
            idx,
            timestamp: msg.messageTimestamp,
            text: (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').substring(0, 50)
          });
        }
      });
      const duplicates = Array.from(idCounts.entries()).filter(([, count]) => count > 1);
      if (duplicates.length > 0) {
        console.warn(`⚠️ Found ${duplicates.length} duplicate message IDs from Evolution API:`);
        console.warn('Sample duplicates with details:', Array.from(messagesWithSameId.entries())
          .filter(([, msgs]) => msgs.length > 1)
          .slice(0, 3)
          .map(([id, msgs]) => ({ id, count: msgs.length, messages: msgs }))
        );
      }

      // DEDUPLICATION: Remove duplicate messages from Evolution API
      const uniqueMessagesMap = new Map();
      messagesList.forEach(msg => {
        const msgId = msg.key?.id || msg.id;
        if (msgId) {
          // Keep only the first occurrence (or you could keep the one with more data)
          if (!uniqueMessagesMap.has(msgId)) {
            uniqueMessagesMap.set(msgId, msg);
          }
        } else {
          // Messages without ID are kept (use timestamp + random as key)
          const fallbackKey = `${msg.messageTimestamp || 0}-${Math.random()}`;
          uniqueMessagesMap.set(fallbackKey, msg);
        }
      });
      const deduplicatedMessages = Array.from(uniqueMessagesMap.values());
      console.log(`✅ Deduplicated: ${messagesList.length} → ${deduplicatedMessages.length} messages`);

      // DEBUG: Log first and last message timestamps to verify ordering
      if (deduplicatedMessages.length > 0) {
        const timestamps = deduplicatedMessages.map(m => m.messageTimestamp).filter(t => t);
        if (timestamps.length > 0) {
          const minTs = Math.min(...timestamps);
          const maxTs = Math.max(...timestamps);
          console.log(`📅 Message timestamps range: ${new Date(minTs * 1000).toLocaleString()} → ${new Date(maxTs * 1000).toLocaleString()}`);

          // Log the 3 most recent message IDs and content
          const sortedByTime = [...deduplicatedMessages].sort((a, b) => (b.messageTimestamp || 0) - (a.messageTimestamp || 0));
          console.log(`🆕 3 most recent messages:`, sortedByTime.slice(0, 3).map(m => ({
            id: m.key?.id,
            timestamp: new Date((m.messageTimestamp || 0) * 1000).toLocaleString(),
            text: (m.message?.conversation || m.message?.extendedTextMessage?.text || '[media]').substring(0, 30),
            fromMe: m.key?.fromMe
          })));
        }
      }

      // Ordenar mensagens por timestamp (mais antigas primeiro)
      deduplicatedMessages.sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0));

      // Mesclar com mensagens temporárias (manter as temporárias que ainda não têm correspondente real)
      const tempMessages = messages.filter(m => m._isTemp);
      const realMessages = deduplicatedMessages;

      let updatedMessages: any[];
      if (tempMessages.length === 0) {
        updatedMessages = realMessages;
      } else {
        updatedMessages = [...realMessages];
        tempMessages.forEach(tempMsg => {
          const matchingReal = realMessages.find(realMsg => {
            if (!realMsg.messageTimestamp || !tempMsg.messageTimestamp) return false;
            const timeDiff = Math.abs(realMsg.messageTimestamp - tempMsg.messageTimestamp);
            return timeDiff < 30; // 30 segundos de tolerância
          });
          if (!matchingReal) updatedMessages.push(tempMsg);
        });
        updatedMessages = updatedMessages.sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0));
      }

      // Apply update preserving scroll position
      // Filter out any messages we've locally marked as deleted so UI hides them immediately
      updatedMessages = updatedMessages.filter(m => {
        const mid = m.id || m.key?.id;
        return !deletedMessageIds.has(mid);
      });
      applyMessagesUpdate(updatedMessages);

      // After fetching messages, also refresh chats to ensure sidebar syncs (detect deletions)
      try {
        await fetchChats();
      } catch (err) {
        // ignore - we don't want message refresh to fail because of chat sync
      }

      // Return the processed messages so callers (like delete flow) can inspect the current list
      return updatedMessages;
    } catch (err) {
      console.error("Erro ao buscar mensagens:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !selectedInstance) return;

    setSending(true);
    const messageCopy = newMessage; // Guardar cópia antes de limpar
    const tempId = `temp_${Date.now()}`;
    
    try {
      // IMPORTANTE: remoteJid tem o número real, id pode ser um hash interno
      const remoteJid = selectedChat.remoteJid || selectedChat.jid || selectedChat.id;
      
      console.log("=== DEBUG ENVIO ===");
      console.log("RemoteJid:", remoteJid);
      
      // Validar se é um chat válido para enviar mensagem
      if (!remoteJid || remoteJid.includes("@broadcast") || remoteJid.includes("@newsletter")) {
        throw new Error("Não é possível enviar mensagens para este tipo de chat.");
      }
      
      // Extrair número
      let number = "";
      
      if (remoteJid.includes("@s.whatsapp.net") || remoteJid.includes("@c.us")) {
        // Formato padrão de contato: 5512997630186@s.whatsapp.net
        number = remoteJid.split("@")[0];
      } else if (remoteJid.includes("@g.us")) {
        // É um grupo
        number = remoteJid.split("@")[0];
      } else {
        // Formato desconhecido
        throw new Error("Formato de chat não suportado. Tente outro contato.");
      }
      
      console.log("Número extraído:", number);
      
      if (!number) {
        throw new Error("Não foi possível identificar o número deste chat.");
      }
      
      // Limpar campo ANTES de enviar para UX mais fluida
      setNewMessage("");
      
      // Adicionar mensagem otimisticamente (aparece instantaneamente)
      const tempMessage = {
        key: {
          id: tempId,
          remoteJid: remoteJid,
          fromMe: true,
        },
        message: {
          conversation: messageCopy,
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        _isTemp: true, // Marcar como temporária
      };
      setMessages(prev => [...prev, tempMessage]);
      
      // Enviar para servidor
      const result = await EvolutionMessage.sendText(selectedInstance, {
        number,
        text: messageCopy,
      });
      
      console.log("=== RESPOSTA DO ENVIO ===");
      console.log("Status:", result?.status);
      console.log("Key:", result?.key);
      console.log("Resposta completa:", JSON.stringify(result, null, 2));

      // Verificar se foi enviado com sucesso
      if (result?.status === 'ERROR' || result?.error) {
        throw new Error(result?.message || "Erro ao enviar mensagem. Verifique o número.");
      }

      toast({
        title: "Mensagem enviada!",
        description: result?.status === 'PENDING' ? "Mensagem em processamento..." : "Sua mensagem foi enviada com sucesso.",
      });
      
      // Buscar mensagens reais do servidor após 5 segundos
      setTimeout(() => {
        fetchMessages();
        // Não remover temporárias - elas vão ser substituídas pelas reais
      }, 5000);
    } catch (err: any) {
      console.error("Erro ao enviar mensagem:", err);
      // Remover mensagem temporária em caso de erro
      setMessages(prev => prev.filter(m => m.key?.id !== tempId));
      // Restaurar mensagem no campo se deu erro
      setNewMessage(messageCopy);
      toast({
        title: "Erro ao enviar",
        description: err?.message || "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowAttachMenu(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSendMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedChat || !selectedInstance) return;

    setSending(true);
    const caption = newMessage.trim();
    
    try {
      // Validar tamanho (máx 16MB para WhatsApp)
      const maxSize = 16 * 1024 * 1024; // 16MB
      if (selectedFile.size > maxSize) {
        throw new Error("Arquivo muito grande. Máximo: 16MB");
      }

      const remoteJid = selectedChat.remoteJid || selectedChat.jid || selectedChat.id;
      
      if (!remoteJid || remoteJid.includes("@broadcast") || remoteJid.includes("@newsletter")) {
        throw new Error("Não é possível enviar mensagens para este tipo de chat.");
      }
      
      let number = "";
      if (remoteJid.includes("@s.whatsapp.net") || remoteJid.includes("@c.us")) {
        number = remoteJid.split("@")[0];
      } else if (remoteJid.includes("@g.us")) {
        number = remoteJid.split("@")[0];
      } else {
        throw new Error("Formato de chat não suportado.");
      }

      // Converter arquivo para base64
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      
      await new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            let base64 = reader.result as string;
            
            // Remover prefixo "data:image/jpeg;base64," se existir
            if (base64.includes(',')) {
              base64 = base64.split(',')[1];
            }
            
            // Determinar tipo de mídia
            const mimeType = selectedFile.type;
            const isImage = mimeType.startsWith('image/');
            const isVideo = mimeType.startsWith('video/');
            const isAudio = mimeType.startsWith('audio/');
            
            const mediaPayload: any = {
              number,
              mediatype: isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'document',
              media: base64,
              fileName: selectedFile.name,
            };
            
            if (caption) {
              mediaPayload.caption = caption;
            }

            console.log("Enviando mídia:", {
              type: mediaPayload.mediatype,
              fileName: selectedFile.name,
              size: selectedFile.size,
              base64Length: base64.length,
            });

            const result = await EvolutionMessage.sendMedia(selectedInstance, mediaPayload);
            
            console.log("Resposta envio mídia:", result);

            if (result?.status === 'ERROR' || result?.error) {
              throw new Error(result?.message || "Erro ao enviar mídia.");
            }

            toast({
              title: "Mídia enviada!",
              description: "Seu arquivo foi enviado com sucesso.",
            });

            // Limpar campos
            setNewMessage("");
            handleRemoveFile();
            
            // Atualizar mensagens após 3s
            setTimeout(() => {
              fetchMessages();
            }, 3000);

            resolve(result);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
      });

    } catch (err: any) {
      console.error("Erro ao enviar mídia:", err);
      toast({
        title: "Erro ao enviar mídia",
        description: err?.message || "Não foi possível enviar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleSaveContactName = async () => {
    if (!selectedChat || !selectedInstance) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const remoteJid = selectedChat.remoteJid || selectedChat.jid || selectedChat.id;
      
      // Salvar no Supabase (upsert - insert or update)
      const { error } = await supabase
        .from("custom_contacts")
        .upsert({
          user_id: user.id,
          instance_key: selectedInstance,
          remote_jid: remoteJid,
          custom_name: contactName,
        }, {
          onConflict: 'user_id,instance_key,remote_jid'
        });

      if (error) {
        console.error("Erro ao salvar nome:", error);
        toast({
          title: "Erro ao salvar",
          description: "Não foi possível salvar o nome do contato.",
          variant: "destructive",
        });
        return;
      }

      // Atualizar o estado local
      setCustomContactNames(prev => ({
        ...prev,
        [remoteJid]: contactName
      }));
      
      // Atualizar o chat selecionado
      setSelectedChat({ ...selectedChat, name: contactName });
      setEditingContactName(false);
      
      toast({
        title: "Nome salvo!",
        description: "O nome do contato foi atualizado com sucesso.",
      });
      
      // Recarregar lista de chats para garantir que o nome fique aplicado em toda a UI
      try {
        const updatedChats = await fetchChats();
        // reaplicar seleção atual (procurar por remoteJid atualizado)
        const remoteJid = selectedChat.remoteJid || selectedChat.jid || selectedChat.id;
        const updated = (updatedChats || []).find((c) => (c.remoteJid || c.jid || c.id) === remoteJid);
        if (updated) {
          // Preferir o nome personalizado garantido no mapa atual
          setSelectedChat({ ...updated, name: contactName });
        }
      } catch (err) {
        // Não bloquear o fluxo se o reload falhar
        console.warn('Falha ao recarregar chats após salvar nome:', err);
      }
    } catch (err) {
      console.error("Erro ao salvar nome personalizado:", err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar o nome.",
        variant: "destructive",
      });
    }
  };

  // --- Export to Leads handlers ---
  function extractNumberFromJid(jid: string | undefined) {
    if (!jid) return "";
    if (jid.includes("@")) return jid.split("@")[0];
    return jid;
  }

  function openExportModal() {
    if (!selectedChat) return;
    const remoteJid = selectedChat.remoteJid || selectedChat.jid || selectedChat.id;
    const num = extractNumberFromJid(remoteJid);
    const remoteKey = remoteJid || "";
    const name = getChatDisplayName(selectedChat) || "";
    // try to prefill description with the last message
    const lastMsg = selectedChat.lastMessage?.message?.conversation || selectedChat.lastMessage?.message?.extendedTextMessage?.text || "";
    setExportName(name);
    setExportPhone(num);
    setExportContent(lastMsg || "");
    // default column if available
    if (kanbanColumns && kanbanColumns.length > 0) setExportColumnId(kanbanColumns[0].id);
    setIsExportOpen(true);
  }

  async function saveExport() {
    if (!exportName) {
      toast({ title: "Nome obrigatório", description: "Preencha o nome do lead.", variant: 'destructive' });
      return;
    }
    const columnId = exportColumnId || (kanbanColumns && kanbanColumns[0] && kanbanColumns[0].id) || null;
    try {
      // Get current user to include user_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });
        return;
      }

      const contentToSave = (exportContent || "").slice(0, 200);
      const payload: any = {
        column_id: columnId,
        title: exportName,
        content: contentToSave || null,
        position: 9999,
        user_id: user.id,
        metadata: { phone: exportPhone || null },
      };
      const { data: inserted, error } = await (supabase as any).from('kanban_cards').insert(payload).select();
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Exportado', description: 'Contato exportado como lead.' });
      qc.invalidateQueries({ queryKey: ["kanban", "cards"] });
      setIsExportOpen(false);
      // navigate to leads page and highlight the created card if we have the id
      const createdId = inserted && inserted[0] && inserted[0].id;
      if (createdId) {
        navigate(`/dashboard/leads?highlight=${createdId}`);
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível exportar o lead.', variant: 'destructive' });
    }
  }

  const filteredChats = chats.filter((chat) => {
    const name = chat.name || chat.pushName || chat.id || "";
    const remoteJid = chat.remoteJid || chat.jid || chat.id;
    const isGroup = remoteJid?.includes("@g.us");
    
    // Filtrar por busca
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filtrar por aba ativa
    if (activeTab === "grupos") {
      return matchesSearch && isGroup;
    } else {
      return matchesSearch && !isGroup;
    }
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-140px)] space-y-4">
        {/* Delete confirmation modal */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar exclusão</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <p>Tem certeza que deseja excluir esta conversa? Esta ação tentará remover as mensagens no WhatsApp e ocultar a conversa.</p>
            </div>
            <DialogFooter>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>Cancelar</Button>
                <Button variant="destructive" onClick={async () => { await deleteConversation(); }} disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Excluir'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">Mensagens WhatsApp</h1>
              <p className="text-muted-foreground">
                Chat em tempo real
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
          <div className="grid grid-cols-[320px_1fr] gap-0 border rounded-lg flex-1 overflow-hidden">
            {/* Chats List - Sidebar fixa */}
            <div className="flex flex-col border-r bg-background overflow-hidden">
              <div className="p-3 border-b flex-shrink-0">
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Chat
                </h2>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar conversas..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Button variant="outline" size="icon" onClick={fetchChats} disabled={loading} className="h-9 w-9">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Tabs Contatos/Grupos */}
              <div className="flex border-b flex-shrink-0">
                <button 
                  onClick={() => setActiveTab("contatos")}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "contatos" 
                      ? "border-b-2 border-primary text-foreground" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Contatos
                </button>
                <button 
                  onClick={() => setActiveTab("grupos")}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "grupos" 
                      ? "border-b-2 border-primary text-foreground" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Grupos
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
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
                      // Usar remoteJid (número real) ao invés de id (hash interno)
                      const remoteJid = chat.remoteJid || chat.jid || chat.id;
                      
                      // Priorizar nome personalizado via helper
                      const chatName = getChatDisplayName(chat);
                      
                      const isGroup = remoteJid?.includes("@g.us");
                      const isBroadcast = remoteJid?.includes("@broadcast");
                      
                      // Formatar número para exibição (remover @s.whatsapp.net)
                      const displayNumber = remoteJid?.replace("@s.whatsapp.net", "")
                                                      .replace("@c.us", "")
                                                      .replace("@g.us", " (Grupo)");
                      
                      const rawLastMsg = chat.lastMessage?.message?.conversation || 
                                     chat.lastMessage?.message?.extendedTextMessage?.text || 
                                     "";
                      const lastMsgId = chat.lastMessage?.id || chat.lastMessage?.key?.id;
                      const lastMsg = lastMsgId && deletedMessageIds.has(lastMsgId) ? "" : rawLastMsg;
                      const lastMsgTime = chat.lastMessage?.messageTimestamp;
                      
                      return (
                        <button
                          key={chat.id || remoteJid}
                          onClick={() => setSelectedChat({ ...chat, name: getChatDisplayName(chat) })}
                          className={`w-full text-left p-3 hover:bg-muted/50 transition-colors border-b border-border/50 ${
                            (selectedChat?.remoteJid || selectedChat?.jid || selectedChat?.id) === remoteJid ? "bg-muted" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0 flex items-center justify-center">
                              <span className="text-sm font-semibold">
                                {chatName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <h3 className="font-medium text-sm truncate">{chatName}</h3>
                                  {(isGroup || isBroadcast) && (
                                    <Badge variant="outline" className="text-xs py-0 h-4">
                                      {isGroup ? "Grupo" : "Lista"}
                                    </Badge>
                                  )}
                                </div>
                                {lastMsgTime && (
                                  <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                                    {formatDistanceToNow(new Date(lastMsgTime * 1000), {
                                      addSuffix: false,
                                      locale: ptBR,
                                    }).replace("cerca de ", "")}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground truncate flex-1">
                                  {lastMsg || displayNumber}
                                </p>
                                {chat.unreadCount > 0 && (
                                  <Badge className="h-5 min-w-[20px] ml-2 text-xs">
                                    {chat.unreadCount}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex flex-col bg-background overflow-hidden">
              {selectedChat ? (
                <>
                  {/* Header do Chat - estilo Evolution */}
                  <div className="p-3 border-b flex-shrink-0 bg-background">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-semibold">
                            {getChatDisplayName(selectedChat).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {editingContactName ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={contactName}
                                onChange={(e) => setContactName(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveContactName();
                                  if (e.key === 'Escape') setEditingContactName(false);
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleSaveContactName}
                                className="h-8 w-8 flex-shrink-0"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingContactName(false)}
                                className="h-8 w-8 flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm truncate">
                                  {getChatDisplayName(selectedChat) || "Chat"}
                                </h3>
                                <p className="text-xs text-muted-foreground truncate">
                                  {(selectedChat.remoteJid || selectedChat.jid)?.replace("@s.whatsapp.net", "").replace("@c.us", "").replace("@g.us", " (Grupo)")}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingContactName(true)}
                                className="h-8 w-8 flex-shrink-0"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (!selectedChat) return;
                                  const remoteJid = selectedChat.remoteJid || selectedChat.jid || selectedChat.id;
                                  setPendingDeleteRemoteJid(remoteJid);
                                  setShowDeleteModal(true);
                                }}
                                className="h-8 w-8 flex-shrink-0 ml-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openExportModal()}
                                  className="h-8 ml-2"
                                >
                                  Exportar lead
                                </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={fetchMessages} className="h-8 w-8 flex-shrink-0 ml-2">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Área de Mensagens - flex-1 para ocupar espaço disponível */}
                  <div 
                    ref={messagesContainerRef}
                    className="flex-1 p-4 overflow-y-auto overflow-x-hidden relative"
                    onScroll={handleScroll}
                  >
                    <div className="flex flex-col gap-2 pb-4">
                      {(() => {
                        const filteredMsgs = messages.filter((msg) => {
                          const mid = msg.id || msg.key?.id;
                          // hide locally deleted ids
                          if (deletedMessageIds.has(mid)) return false;
                          // hide protocol messages (revokes) returned by Evolution
                          if (msg.message && msg.message.protocolMessage) return false;
                          return true;
                        });
                        console.log(`📱 Rendering ${filteredMsgs.length} messages (total in state: ${messages.length})`);
                        return filteredMsgs;
                      })()
                        .map((msg, idx) => {
                        const msgKey = msg.key || {};
                        const isFromMe = msgKey.fromMe || false;
                        
                        // Extrair diferentes tipos de conteúdo
                        const textContent = msg.message?.conversation || 
                                          msg.message?.extendedTextMessage?.text;
                        
                        const imageMsg = msg.message?.imageMessage;
                        const videoMsg = msg.message?.videoMessage;
                        const audioMsg = msg.message?.audioMessage;
                        const documentMsg = msg.message?.documentMessage;
                        
                        const msgTime = msg.messageTimestamp;
                        
                        // Determinar tipo de mensagem
                        const hasImage = !!imageMsg;
                        const hasVideo = !!videoMsg;
                        const hasAudio = !!audioMsg;
                        const hasDocument = !!documentMsg;
                        
                        // Create GUARANTEED unique key using index as primary identifier
                        const stableKey = `msg-${idx}-${msgKey.id || 'noid'}-${msgTime || 0}`;

                        return (
                          <div
                            key={stableKey}
                            className={`flex ${isFromMe ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`px-4 py-2 rounded-2xl shadow-sm max-w-[80%] min-w-[60px] break-words whitespace-pre-wrap overflow-x-hidden
                                ${isFromMe ? "bg-[#DCF8C6] text-black ml-8" : "bg-white text-black border border-gray-200 mr-8"}
                              `}
                              style={{ overflowWrap: 'anywhere' }}
                            >
                              {/* Renderizar mídia se existir */}
                              {hasImage && selectedInstance && msgKey.id && (
                                <MediaMessage
                                  instance={selectedInstance}
                                  messageKey={{ id: msgKey.id }}
                                  mediaType="image"
                                  caption={imageMsg.caption}
                                />
                              )}

                              {hasVideo && selectedInstance && msgKey.id && (
                                <MediaMessage
                                  instance={selectedInstance}
                                  messageKey={{ id: msgKey.id }}
                                  mediaType="video"
                                  caption={videoMsg.caption}
                                />
                              )}

                              {hasAudio && selectedInstance && msgKey.id && (
                                <MediaMessage
                                  instance={selectedInstance}
                                  messageKey={{ id: msgKey.id }}
                                  mediaType="audio"
                                  seconds={audioMsg.seconds}
                                />
                              )}

                              {hasDocument && selectedInstance && msgKey.id && (
                                <MediaMessage
                                  instance={selectedInstance}
                                  messageKey={{ id: msgKey.id }}
                                  mediaType="document"
                                  fileName={documentMsg.fileName}
                                  mimetype={documentMsg.mimetype}
                                />
                              )}
                              
                              {/* Renderizar texto se existir */}
                              {textContent && (
                                <p className="text-sm whitespace-pre-wrap break-words">{textContent}</p>
                              )}
                              
                              {/* Timestamp */}
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

                    {/* Jump to bottom button when user scrolled up */}
                    {!shouldAutoScroll && messages.length > 0 && (
                      <div className="absolute right-6 bottom-24">
                        <Button size="sm" onClick={() => { autoScrollRef.current = true; setShouldAutoScroll(true); scrollToBottom(); }} className="h-9 px-3">
                          Ir para o final
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Formulário de Envio - flex-shrink-0 para manter tamanho fixo */}
                  <div className="p-4 border-t flex-shrink-0 bg-background">
                    {(() => {
                      const remoteJid = selectedChat.id || selectedChat.remoteJid || selectedChat.jid;
                      const isBroadcast = remoteJid?.includes("@broadcast");
                      const isNewsletter = remoteJid?.includes("@newsletter");
                      const canSend = !isBroadcast && !isNewsletter;
                      
                      if (!canSend) {
                        return (
                          <div className="text-center text-sm text-muted-foreground py-2">
                            {isBroadcast && "Não é possível enviar para listas de transmissão"}
                            {isNewsletter && "Não é possível enviar para canais"}
                          </div>
                        );
                      }
                      
                      return (
                        <div className="space-y-2">
                          {/* Preview do arquivo selecionado */}
                          {selectedFile && (
                            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                              {selectedFile.type.startsWith('image/') ? (
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <File className="h-5 w-5 text-muted-foreground" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(selectedFile.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={handleRemoveFile}
                                className="h-8 w-8"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          
                          {/* Input hidden para arquivo */}
                          <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileSelect}
                            className="hidden"
                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                          />
                          
                          {/* Formulário de envio */}
                          <form onSubmit={selectedFile ? handleSendMedia : handleSendMessage} className="flex gap-2">
                            <div className="relative">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={sending}
                                className="h-10 w-10"
                              >
                                <Paperclip className="h-5 w-5" />
                              </Button>
                            </div>
                            
                            <Input
                              placeholder={selectedFile ? "Legenda (opcional)..." : "Digite sua mensagem..."}
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              disabled={sending}
                              className="flex-1"
                            />
                            
                            <Button 
                              type="submit" 
                              size="icon" 
                              disabled={sending || (!selectedFile && !newMessage.trim())}
                              className="h-10 w-10"
                            >
                              {sending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </form>
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Selecione uma conversa para começar</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Export to Leads Modal */}
      <Dialog open={isExportOpen} onOpenChange={(open) => setIsExportOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar contato para Leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <label className="block text-sm font-medium">Nome</label>
            <Input value={exportName} onChange={(e) => setExportName((e.target as HTMLInputElement).value)} />

            <label className="block text-sm font-medium">Telefone</label>
            <Input value={exportPhone} onChange={(e) => setExportPhone((e.target as HTMLInputElement).value)} />

            <label className="block text-sm font-medium">Descrição</label>
            <textarea maxLength={200} className="w-full rounded border px-2 py-1 text-sm resize-y" rows={4} value={exportContent} onChange={(e) => setExportContent((e.target as HTMLTextAreaElement).value)} />

            <label className="block text-sm font-medium">Coluna</label>
            <Select value={exportColumnId ? String(exportColumnId) : undefined} onValueChange={(v) => setExportColumnId(Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma coluna" />
              </SelectTrigger>
              <SelectContent>
                {kanbanColumns.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button onClick={() => saveExport()}>Salvar</Button>
              <Button variant="ghost" onClick={() => setIsExportOpen(false)}>Cancelar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MessagesEvolution;
