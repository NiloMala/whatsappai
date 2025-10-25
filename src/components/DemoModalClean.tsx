import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import OpenAIAgent from "@/integrations/openaiAgentProxy";

type DemoModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const cannedResponses = [
  "Posso ajudar com vendas, suporte e agendamentos. Como posso ajudar você hoje?",
  "Claro — posso buscar horários disponíveis ou passar para um atendente humano.",
  "Este é apenas um demo. Respostas reais virão do agente treinado com seu fluxo.",
];

const DemoModalClean: React.FC<DemoModalProps> = ({ open, onOpenChange }) => {
  const [tab, setTab] = useState<"video" | "chat">("video");
  const [messages, setMessages] = useState<Array<{ id: number; sender: "bot" | "user"; text: string }>>([
    { id: 1, sender: "bot", text: "Olá! Bem-vindo à demonstração interativa. Digite algo para testar o agente." },
  ]);
  const [input, setInput] = useState("");
  const nextId = useRef(2);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) setTab("video");
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, tab]);

  async function sendMessage() {
    const text = (input || "").trim();
    if (!text) return;
    const id = nextId.current++;
    setMessages((m) => [...m, { id, sender: "user", text }]);
    setInput("");

    try {
      const agentResp = await OpenAIAgent.respond(
        text,
        messages.map((m) => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text })),
        {}
      );

      let replyText = "";
      if (!agentResp) replyText = cannedResponses[Math.floor(Math.random() * cannedResponses.length)];
      else if (typeof agentResp === "string") replyText = agentResp;
      else if (Array.isArray(agentResp) && agentResp.length > 0 && typeof agentResp[0] === "string") replyText = agentResp[0];
      else if ((agentResp as any).output?.text) replyText = (agentResp as any).output.text;
      else if ((agentResp as any).choices && (agentResp as any).choices[0]) replyText = (agentResp as any).choices[0].message?.content || JSON.stringify((agentResp as any).choices[0]);
      else if ((agentResp as any).replies && (agentResp as any).replies[0]) replyText = (agentResp as any).replies[0].text || JSON.stringify((agentResp as any).replies[0]);
      else if (typeof agentResp === "object") replyText = JSON.stringify(agentResp);
      else replyText = String(agentResp);

      const bid = nextId.current++;
      setMessages((m) => [...m, { id: bid, sender: "bot", text: replyText }]);
    } catch (err) {
      console.error("Agent demo error, falling back to canned reply", err);
      const reply = cannedResponses[Math.floor(Math.random() * cannedResponses.length)];
      const bid = nextId.current++;
      setMessages((m) => [...m, { id: bid, sender: "bot", text: reply }]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demonstração — Vídeo e Chat</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <div className="flex gap-2 mb-4">
            <Button variant={tab === "video" ? undefined : "ghost"} onClick={() => setTab("video")}>Vídeo</Button>
            <Button variant={tab === "chat" ? undefined : "ghost"} onClick={() => setTab("chat")}>Chat de Demonstração</Button>
          </div>

          {tab === "video" ? (
            <div className="w-full aspect-video bg-black rounded overflow-hidden">
              <iframe title="Demo video" className="w-full h-full" src="https://www.youtube.com/embed/ysz5S6PUM-U" frameBorder={0} allowFullScreen />
            </div>
          ) : (
            <div className="flex flex-col h-96">
              <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3 bg-muted/40 rounded">
                {messages.map((m) => (
                  <div key={m.id} className={`max-w-[80%] p-2 rounded ${m.sender === "bot" ? "bg-slate-700 text-white self-start" : "bg-emerald-600 text-white self-end"}`}>{m.text}</div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input value={input} onChange={(e) => setInput((e.target as HTMLInputElement).value)} placeholder="Digite uma mensagem..." />
                <Button onClick={sendMessage}>Enviar</Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button onClick={() => onOpenChange(false)}>Pronto</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DemoModalClean;
