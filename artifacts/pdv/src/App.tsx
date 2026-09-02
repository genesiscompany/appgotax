import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppProvider } from "@/lib/store";
import { AuthProvider, useAuth } from "@/lib/auth";

import { Layout } from "@/components/layout/Layout";
import { BloqueadoScreen } from "@/components/BloqueadoScreen";
import { useBloqueioCheck } from "@/hooks/useBloqueioCheck";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Pdv from "@/pages/Pdv";
import Pedidos from "@/pages/Pedidos";
import Produtos from "@/pages/Produtos";
import Relatorios from "@/pages/Relatorios";
import Configuracoes from "@/pages/Configuracoes";
import Promocoes from "@/pages/Promocoes";
import Track from "@/pages/Track";
import TimeLine from "@/pages/TimeLine";
import LojaConfig from "@/pages/LojaConfig";
import ViagensDashboard from "@/pages/viagens/ViagensDashboard";
import ViagensNovaVenda from "@/pages/viagens/ViagensNovaVenda";
import ViagensVendas from "@/pages/viagens/ViagensVendas";
import ViagensClientes from "@/pages/viagens/ViagensClientes";
import ViagensRotas from "@/pages/viagens/ViagensRotas";
import ViagensCustos from "@/pages/viagens/ViagensCustos";
import ViagensVeiculos from "@/pages/viagens/ViagensVeiculos";
import ViagensCaronas from "@/pages/viagens/ViagensCaronas";
import EncomendaDashboard from "@/pages/encomendas/EncomendaDashboard";
import EncomendaNova from "@/pages/encomendas/EncomendaNova";
import EncomendaRastreamento from "@/pages/encomendas/EncomendaRastreamento";
import EncomendaSaidas from "@/pages/encomendas/EncomendaSaidas";
import EncomendaRecebimentos from "@/pages/encomendas/EncomendaRecebimentos";
import EncomendaClientes from "@/pages/encomendas/EncomendaClientes";
import EncomendaFinanceiro from "@/pages/encomendas/EncomendaFinanceiro";
import EncomendaRelatorios from "@/pages/encomendas/EncomendaRelatorios";
import EncomendaConfig from "@/pages/encomendas/EncomendaConfig";
import MotoristasDashboard from "@/pages/motorista/MotoristasDashboard";
import MotoristasNovaCorrida from "@/pages/motorista/MotoristasNovaCorrida";
import MotoristasHistorico from "@/pages/motorista/MotoristasHistorico";
import MotoristasAprovacoes from "@/pages/motorista/MotoristasAprovacoes";
import MotoristasFinanceiro from "@/pages/motorista/MotoristasFinanceiro";
import MotoristasRastreamento from "@/pages/motorista/MotoristasRastreamento";
import MotoristasConfig from "@/pages/motorista/MotoristasConfig";
import MotoristasRaturas from "@/pages/motorista/MotoristasRaturas";
import MotoristasRepasses from "@/pages/motorista/MotoristasRepasses";
import Chat from "@/pages/Chat";
import Financeiro from "@/pages/Financeiro";
import Suporte from "@/pages/Suporte";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } },
});

function SmartHome() {
  const { empresa } = useAuth();
  const mods: string[] = empresa?.modulosAtivos ?? [];
  const hasMotoristaOnly = mods.includes("motorista") && !mods.some(m => ["food","ecommerce","servicos","passagens","entrega","encomendas"].includes(m));
  if (hasMotoristaOnly) return <Redirect to="/motorista" />;
  const hasEncomendas = mods.some(m => ["entrega","encomendas"].includes(m)) && !mods.some(m => ["food","ecommerce"].includes(m));
  if (hasEncomendas && !mods.includes("motorista")) return <Redirect to="/encomendas" />;
  return <Dashboard />;
}

function ProtectedRouter() {
  const { isLoggedIn, isLoading, token } = useAuth();
  const { status: bloqueioStatus, loading: bloqueioLoading, recheck } = useBloqueioCheck(isLoggedIn ? token : null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route><Redirect to="/login" /></Route>
      </Switch>
    );
  }

  // Show block screen while checking (only if previously logged in, not first load)
  if (isLoggedIn && !bloqueioLoading && bloqueioStatus?.bloqueado) {
    return <BloqueadoScreen token={token} onDesbloqueado={recheck} />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={SmartHome} />
        <Route path="/pdv" component={Pdv} />
        <Route path="/pedidos" component={Pedidos} />
        <Route path="/produtos" component={Produtos} />
        <Route path="/relatorios" component={Relatorios} />
        <Route path="/configuracoes" component={Configuracoes} />
        <Route path="/promocoes" component={Promocoes} />
        <Route path="/timeline" component={TimeLine} />
        <Route path="/loja" component={LojaConfig} />
        <Route path="/viagens" component={ViagensDashboard} />
        <Route path="/viagens/nova-venda" component={ViagensNovaVenda} />
        <Route path="/viagens/vendas" component={ViagensVendas} />
        <Route path="/viagens/clientes" component={ViagensClientes} />
        <Route path="/viagens/rotas" component={ViagensRotas} />
        <Route path="/viagens/custos" component={ViagensCustos} />
        <Route path="/viagens/veiculos" component={ViagensVeiculos} />
        <Route path="/viagens/caronas" component={ViagensCaronas} />
        <Route path="/encomendas" component={EncomendaDashboard} />
        <Route path="/encomendas/nova" component={EncomendaNova} />
        <Route path="/encomendas/rastreamento" component={EncomendaRastreamento} />
        <Route path="/encomendas/saidas" component={EncomendaSaidas} />
        <Route path="/encomendas/recebimentos" component={EncomendaRecebimentos} />
        <Route path="/encomendas/clientes" component={EncomendaClientes} />
        <Route path="/encomendas/financeiro" component={EncomendaFinanceiro} />
        <Route path="/encomendas/relatorios" component={EncomendaRelatorios} />
        <Route path="/encomendas/config" component={EncomendaConfig} />
        <Route path="/motorista" component={MotoristasDashboard} />
        <Route path="/motorista/nova-corrida" component={MotoristasNovaCorrida} />
        <Route path="/motorista/historico" component={MotoristasHistorico} />
        <Route path="/motorista/aprovacoes" component={MotoristasAprovacoes} />
        <Route path="/motorista/financeiro" component={MotoristasFinanceiro} />
        <Route path="/motorista/rastreamento" component={MotoristasRastreamento} />
        <Route path="/motorista/config" component={MotoristasConfig} />
        <Route path="/motorista/faturas" component={MotoristasRaturas} />
        <Route path="/motorista/repasses" component={MotoristasRepasses} />
        <Route path="/chat" component={Chat} />
        <Route path="/financeiro" component={Financeiro} />
        <Route path="/suporte" component={Suporte} />
        <Route path="/login"><Redirect to="/" /></Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppProvider>
          <TooltipProvider delayDuration={300}>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Switch>
                <Route path="/track/:id" component={Track} />
                <Route>
                  <ProtectedRouter />
                </Route>
              </Switch>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
