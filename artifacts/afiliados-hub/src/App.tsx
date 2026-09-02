import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getToken, clearToken, api } from "@/lib/api";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Indicados from "@/pages/Indicados";
import Corporativo from "@/pages/Corporativo";
import Comissoes from "@/pages/Comissoes";
import Resgates from "@/pages/Resgates";
import Relatorios from "@/pages/Relatorios";
import Landing from "@/pages/Landing";
import BaixarApp from "@/pages/BaixarApp";
import Layout from "@/components/Layout";
import { Toaster } from "sonner";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const token = getToken();

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token]);

  if (!token) return null;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/r/:codigo" component={Landing} />
      <Route path="/baixar-app" component={BaixarApp} />
      <Route path="/">
        {() => (
          <AuthGuard>
            <Layout>
              <Dashboard />
            </Layout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/indicados">
        {() => (
          <AuthGuard>
            <Layout>
              <Indicados />
            </Layout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/corporativo">
        {() => (
          <AuthGuard>
            <Layout>
              <Corporativo />
            </Layout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/comissoes">
        {() => (
          <AuthGuard>
            <Layout>
              <Comissoes />
            </Layout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/resgates">
        {() => (
          <AuthGuard>
            <Layout>
              <Resgates />
            </Layout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/relatorios">
        {() => (
          <AuthGuard>
            <Layout>
              <Relatorios />
            </Layout>
          </AuthGuard>
        )}
      </Route>
    </Switch>
  );
}

export default function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={base}>
        <AppRoutes />
      </WouterRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
