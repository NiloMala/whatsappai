import { supabase } from '@/integrations/supabase/client';

type ProxyPayload = {
  endpoint: string;
  method?: string;
  body?: any;
};

async function proxy(payload: ProxyPayload) {
  // Calls the Supabase Edge Function which in turn calls Evolution API
  // Pass the user's session token if available, otherwise use the anon key
  let authToken = import.meta.env.VITE_SUPABASE_ANON_KEY;
  let authType = 'anon_key';
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      authToken = session.access_token;
      authType = 'session_token';
    }
  } catch (e) {
    // Fallback to anon key if getSession fails
    console.warn('Failed to get session, using anon key', e);
  }
  
  console.log(`🔐 Proxy call: ${payload.endpoint} | Auth: ${authType} | Token present: ${!!authToken}`);
  
  const { data, error } = await supabase.functions.invoke('evolution-chat-proxy', { 
    body: payload,
    headers: {
      Authorization: `Bearer ${authToken}`,
    }
  });
  
  if (error) {
    console.error('Evolution API Error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
  
  return data;
}

export const EvolutionChat = {
  checkIsWhatsApp: async (instance: string, numbers: string[]) => {
    return proxy({ endpoint: `/chat/whatsappNumbers/${instance}`, method: 'POST', body: { numbers } });
  },
  markAsRead: async (instance: string, body: any) => {
    return proxy({ endpoint: `/chat/markAsRead/${instance}`, method: 'POST', body });
  },
  markAsUnread: async (instance: string, body: any) => {
    return proxy({ endpoint: `/chat/markAsUnread/${instance}`, method: 'POST', body });
  },
  archiveChat: async (instance: string, body: any) => {
    return proxy({ endpoint: `/chat/archiveChat/${instance}`, method: 'DELETE', body });
  },
  deleteChat: async (instance: string, body: any) => {
    return proxy({ endpoint: `/chat/delete/${instance}`, method: 'DELETE', body });
  },
  deleteMessageForEveryone: async (instance: string, body: any) => {
    // Evolution expects a DELETE to this endpoint with a JSON body
    return proxy({ endpoint: `/chat/deleteMessageForEveryone/${instance}`, method: 'DELETE', body });
  },
  updateMessage: async (instance: string, body: any) => {
    return proxy({ endpoint: `/chat/updateMessage/${instance}`, method: 'POST', body });
  },
  sendPresence: async (instance: string, body: any) => {
    return proxy({ endpoint: `/chat/sendPresence/${instance}`, method: 'POST', body });
  },
  updateBlockStatus: async (instance: string, body: any) => {
    return proxy({ endpoint: `/chat/updateBlockStatus/${instance}`, method: 'POST', body });
  },
  fetchProfilePictureURL: async (instance: string, body: any) => {
    return proxy({ endpoint: `/chat/fetchProfilePictureUrl/${instance}`, method: 'POST', body });
  },
  getBase64: async (instance: string, body: any) => {
    return proxy({ endpoint: `/chat/getBase64/${instance}`, method: 'POST', body });
  },
  getBase64FromMediaMessage: async (instance: string, body: { message: { key: { id: string } }, convertToMp4?: boolean }) => {
    return proxy({ endpoint: `/chat/getBase64FromMediaMessage/${instance}`, method: 'POST', body });
  },
  findContacts: async (instance: string, body: any) => {
    return proxy({ endpoint: `/chat/findContacts/${instance}`, method: 'POST', body });
  },
  findMessages: async (instance: string, body: any) => {
    return proxy({ endpoint: `/chat/findMessages/${instance}`, method: 'POST', body });
  },
  findStatusMessage: async (instance: string, body: any) => {
    return proxy({ endpoint: `/chat/findStatusMessage/${instance}`, method: 'POST', body });
  },
  findChats: async (instance: string, body: any) => {
    return proxy({ endpoint: `/chat/findChats/${instance}`, method: 'POST', body });
  },
};

// Message Controller wrappers
export const EvolutionMessage = {
  sendText: async (instance: string, body: { number: string; text: string; delay?: number }) => {
    return proxy({ endpoint: `/message/sendText/${instance}`, method: 'POST', body });
  },
  sendMedia: async (instance: string, body: any) => {
    return proxy({ endpoint: `/message/sendMedia/${instance}`, method: 'POST', body });
  },
  sendWhatsAppAudio: async (instance: string, body: any) => {
    return proxy({ endpoint: `/message/sendWhatsAppAudio/${instance}`, method: 'POST', body });
  },
  sendLocation: async (instance: string, body: any) => {
    return proxy({ endpoint: `/message/sendLocation/${instance}`, method: 'POST', body });
  },
  sendContact: async (instance: string, body: any) => {
    return proxy({ endpoint: `/message/sendContact/${instance}`, method: 'POST', body });
  },
  sendReaction: async (instance: string, body: any) => {
    return proxy({ endpoint: `/message/sendReaction/${instance}`, method: 'POST', body });
  },
  sendPoll: async (instance: string, body: any) => {
    return proxy({ endpoint: `/message/sendPoll/${instance}`, method: 'POST', body });
  },
  sendStatus: async (instance: string, body: any) => {
    return proxy({ endpoint: `/message/sendStatus/${instance}`, method: 'POST', body });
  },
  sendSticker: async (instance: string, body: any) => {
    return proxy({ endpoint: `/message/sendSticker/${instance}`, method: 'POST', body });
  },
};

export default { ...EvolutionChat, ...EvolutionMessage };
