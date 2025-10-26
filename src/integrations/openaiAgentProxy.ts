// Lightweight client wrapper for the OpenAI Agent server proxy.
// The real project uses a Supabase Edge Function; this wrapper calls a relative
// endpoint and returns whatever JSON the proxy returns. DemoModal gracefully
// falls back to canned replies if the proxy isn't available.

import { supabase } from "@/integrations/supabase/client";

export default {
  async respond(input: string, history: Array<{ role: string; content: string }>, opts: Record<string, any> = {}) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: Record<string, string> = { 
        "Content-Type": "application/json"
      };
      
      // Adiciona token de autenticação se disponível
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      } else {
        // Usa anon key se não houver sessão
        headers["Authorization"] = `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
      }

      // Usa a URL do Supabase Edge Functions
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/openai-agent-proxy`, {
        method: "POST",
        headers,
        body: JSON.stringify({ input, history, opts }),
      });

      if (!res.ok) {
        // Let caller handle fallback
        console.warn("openaiAgentProxy responded with", res.status);
        return undefined;
      }

      const json = await res.json();
      return json;
    } catch (err) {
      console.warn("openaiAgentProxy error", err);
      return undefined;
    }
  },
};
 
