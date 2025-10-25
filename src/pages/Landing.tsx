import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import DemoModal from "@/components/DemoModal";
import { Card } from "@/components/ui/card";
import { MessageSquare, Zap, TrendingUp, Shield, Users, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">WhatsApp AI</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
            <Button 
              className="bg-gradient-to-r from-primary to-primary/90 hover:opacity-90 shadow-lg"
              onClick={() => navigate("/auth?mode=signup")}
            >
              Começar Agora
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Automatize seu atendimento no{" "}
            <span className="text-primary">WhatsApp</span> com IA
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Crie agentes inteligentes que respondem automaticamente seus clientes 24/7.
            Aumente vendas, reduza custos e melhore a satisfação.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-primary to-primary/90 hover:opacity-90 shadow-lg text-lg px-8"
              onClick={() => navigate("/auth?mode=signup")}
            >
              Começar Gratuitamente
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8" onClick={() => setIsDemoOpen(true)}>
              Ver Demonstração
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Tudo que você precisa em uma plataforma
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <Bot className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Agentes IA Personalizados</h3>
            <p className="text-muted-foreground">
              Crie múltiplos agentes com personalidades diferentes para cada tipo de atendimento.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <MessageSquare className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Integração WhatsApp</h3>
            <p className="text-muted-foreground">
              Conecte seu número via Evolution API e comece a atender em minutos.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <Zap className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Respostas Instantâneas</h3>
            <p className="text-muted-foreground">
              Seus clientes recebem respostas em segundos, 24 horas por dia.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <TrendingUp className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Analytics Completo</h3>
            <p className="text-muted-foreground">
              Acompanhe métricas de atendimento, tempo de resposta e satisfação.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <Users className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Multi-Agente</h3>
            <p className="text-muted-foreground">
              Gerencie diversos agentes para vendas, suporte e agendamentos.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <Shield className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Seguro e Confiável</h3>
            <p className="text-muted-foreground">
              Seus dados protegidos com criptografia de ponta a ponta.
            </p>
          </Card>
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Como Funciona
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto">
                1
              </div>
              <h3 className="text-xl font-bold">Cadastre-se</h3>
              <p className="text-muted-foreground">
                Crie sua conta em menos de 1 minuto
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto">
                2
              </div>
              <h3 className="text-xl font-bold">CONECTE E AUTOMATIZE</h3>
              <p className="text-muted-foreground">
                Escaneie o QR Code e comece a atender
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto">
                3
              </div>
              <h3 className="text-xl font-bold">CONFIGURE SEU AGENTE</h3>
              <p className="text-muted-foreground">
                Escolha um template ou crie do zero
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-4xl md:text-5xl font-bold">
            Pronto para revolucionar seu atendimento?
          </h2>
          <p className="text-xl text-muted-foreground">
            Junte-se a centenas de empresas que já automatizaram seu WhatsApp
          </p>
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-primary to-primary/90 hover:opacity-90 shadow-lg text-lg px-8"
            onClick={() => navigate("/auth?mode=signup")}
          >
            Começar Agora - É Grátis
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-muted/30">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 WhatsApp AI. Todos os direitos reservados.</p>
        </div>
      </footer>
      <DemoModal open={isDemoOpen} onOpenChange={(o) => setIsDemoOpen(o)} />
    </div>
  );
};

export default Landing;