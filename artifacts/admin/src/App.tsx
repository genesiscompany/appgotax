import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Empresas from "@/pages/Empresas";
import EmpresasCorporativas from "@/pages/EmpresasCorporativas";
import Usuarios from "@/pages/Usuarios";
import Pedidos from "@/pages/Pedidos";
import Modulos from "@/pages/Modulos";
import Repasses from "@/pages/Repasses";
import Configuracoes from "@/pages/Configuracoes";
import Corridas from "@/pages/Corridas";
import Motoristas from "@/pages/Motoristas";
import Delivery from "@/pages/Delivery";
import FoodDelivery from "@/pages/FoodDelivery";
import Entregadores from "@/pages/Entregadores";
import Entregas from "@/pages/Entregas";
import ValoresEntrega from "@/pages/ValoresEntrega";
import Alimentos from "@/pages/Alimentos";
import Ecommerce from "@/pages/Ecommerce";
import EcommerceEmpresas from "@/pages/EcommerceEmpresas";
import EcommercePedidos from "@/pages/EcommercePedidos";
import TurViagens from "@/pages/TurViagens";
import TurPassagens from "@/pages/TurPassagens";
import MotoristasDocs from "@/pages/MotoristasDocs";
import CategoriasMotorista from "@/pages/CategoriasMotorista";
import DeliveryDocs from "@/pages/DeliveryDocs";
import AlimentacaoDocs from "@/pages/AlimentacaoDocs";
import SubcategoriasAlimentacao from "@/pages/SubcategoriasAlimentacao";
import EntregadoresDocs from "@/pages/EntregadoresDocs";
import EcommerceDocs from "@/pages/EcommerceDocs";
import TurViagensDocs from "@/pages/TurViagensDocs";
import Agendamentos from "@/pages/Agendamentos";
import Servicos from "@/pages/Servicos";
import PushNotifications from "@/pages/PushNotifications";
import MotivosCancelamento from "@/pages/MotivosCancelamento";
import Destaques from "@/pages/Destaques";
import AfiliadosAdmin from "@/pages/AfiliadosAdmin";
import ConfiguracoesSistema from "@/pages/ConfiguracoesSistema";
import CaronasConfig from "@/pages/CaronasConfig";
import Suporte from "@/pages/Suporte";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Carregando...
      </div>
    </div>
  );

  if (!user) return <Login />;

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/empresas" component={Empresas} />
        <Route path="/empresas-corporativas" component={EmpresasCorporativas} />
        <Route path="/usuarios" component={Usuarios} />
        <Route path="/pedidos" component={Pedidos} />
        <Route path="/repasses" component={Repasses} />
        <Route path="/corridas" component={Corridas} />
        <Route path="/motoristas" component={Motoristas} />
        <Route path="/delivery" component={Delivery} />
        <Route path="/food-delivery" component={FoodDelivery} />
        <Route path="/entregadores" component={Entregadores} />
        <Route path="/entregas" component={Entregas} />
        <Route path="/valores-entrega" component={ValoresEntrega} />
        <Route path="/alimentos" component={Alimentos} />
        <Route path="/ecommerce" component={Ecommerce} />
        <Route path="/ecommerce-empresas" component={EcommerceEmpresas} />
        <Route path="/ecommerce-pedidos" component={EcommercePedidos} />
        <Route path="/tur-viagens" component={TurViagens} />
        <Route path="/tur-passagens" component={TurPassagens} />
        <Route path="/motoristas-docs" component={MotoristasDocs} />
        <Route path="/categorias-corrida" component={CategoriasMotorista} />
        <Route path="/delivery-docs" component={DeliveryDocs} />
        <Route path="/alimentos-docs" component={AlimentacaoDocs} />
        <Route path="/subcategorias-alimentacao" component={SubcategoriasAlimentacao} />
        <Route path="/entregadores-docs" component={EntregadoresDocs} />
        <Route path="/ecommerce-docs" component={EcommerceDocs} />
        <Route path="/tur-viagens-docs" component={TurViagensDocs} />
        <Route path="/agendamentos" component={Agendamentos} />
        <Route path="/motivos-cancelamento" component={MotivosCancelamento} />
        <Route path="/servicos" component={Servicos} />
        <Route path="/push" component={PushNotifications} />
        <Route path="/destaques" component={Destaques} />
        <Route path="/afiliados-admin" component={AfiliadosAdmin} />
        <Route path="/configuracoes-sistema" component={ConfiguracoesSistema} />
        <Route path="/caronas-config" component={CaronasConfig} />
        <Route path="/suporte" component={Suporte} />
        <Route path="/modulos" component={Modulos} />
        <Route path="/configuracoes" component={Configuracoes} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={BASE}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}
