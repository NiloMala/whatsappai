import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import Plans from "./pages/Plans";
import Templates from "./pages/Templates";
import WhatsAppIntegration from "./pages/WhatsAppIntegration";
import Messages from "./pages/Messages";
import React, { Suspense, lazy } from "react";
const LeadsDnd = lazy(() => import("./pages/LeadsDnd"));
import Statistics from "./pages/Statistics";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import FAQ from "./pages/FAQ";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/agents" element={<Agents />} />
            <Route path="/dashboard/plans" element={<Plans />} />
            <Route path="/dashboard/templates" element={<Templates />} />
            <Route path="/dashboard/whatsapp" element={<WhatsAppIntegration />} />
            <Route path="/dashboard/messages" element={<Messages />} />
            <Route
              path="/dashboard/leads"
              element={
                <Suspense fallback={<div>Loading...</div>}>
                  <LeadsDnd />
                </Suspense>
              }
            />
            <Route path="/dashboard/statistics" element={<Statistics />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;