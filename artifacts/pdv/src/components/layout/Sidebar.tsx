import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Home, 
  ShoppingCart, 
  ClipboardList, 
  UtensilsCrossed, 
  BarChart3, 
  Settings,
  LogOut,
  Tag,
  Bike,
  Store,
  Plane,
  Users,
  Ticket,
  MapPin,
  Package,
  PackageCheck,
  Truck,
  DollarSign,
  Search,
  Car,
  CheckCircle,
  FileText,
  Building2,
  Calculator,
  Bus,
  CarFront,
  MessageSquare,
  LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

type NavDef = {
  href: string;
  label: string;
  icon: React.ElementType;
  modules?: string[];
  moduleLabel?: Record<string, string>;
};

const NAV_ITEMS: NavDef[] = [
  { href: "/", label: "Dashboard", icon: Home, modules: ["food", "ecommerce", "servicos", "passagens", "entrega", "encomendas"] },
  {
    href: "/pdv",
    label: "PDV / Caixa",
    icon: ShoppingCart,
    modules: ["food", "ecommerce"],
  },
  {
    href: "/pedidos",
    label: "Pedidos",
    icon: ClipboardList,
    modules: ["food", "ecommerce"],
  },
  {
    href: "/timeline",
    label: "Time Line",
    icon: Bike,
    modules: ["food"],
  },
  {
    href: "/produtos",
    label: "Catálogo",
    icon: UtensilsCrossed,
    modules: ["food", "ecommerce"],
    moduleLabel: { food: "Cardápio", ecommerce: "Produtos" },
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    icon: DollarSign,
    modules: ["food", "ecommerce"],
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    icon: BarChart3,
    modules: ["food", "ecommerce"],
  },
  {
    href: "/loja",
    label: "Minha Loja",
    icon: Store,
    modules: ["ecommerce"],
  },
  {
    href: "/viagens",
    label: "Painel Viagens",
    icon: Plane,
    modules: ["passagens"],
  },
  {
    href: "/viagens/nova-venda",
    label: "Nova Venda",
    icon: Ticket,
    modules: ["passagens"],
  },
  {
    href: "/viagens/vendas",
    label: "Passagens",
    icon: ClipboardList,
    modules: ["passagens"],
  },
  {
    href: "/viagens/clientes",
    label: "Passageiros",
    icon: Users,
    modules: ["passagens"],
  },
  {
    href: "/viagens/rotas",
    label: "Rotas e Horários",
    icon: MapPin,
    modules: ["passagens"],
  },
  {
    href: "/viagens/custos",
    label: "Custos de Viagem",
    icon: Calculator,
    modules: ["passagens"],
  },
  {
    href: "/viagens/veiculos",
    label: "Veículos",
    icon: Bus,
    modules: ["passagens"],
  },
  {
    href: "/viagens/caronas",
    label: "Caronas",
    icon: CarFront,
    modules: ["passagens"],
  },
];

const NAV_SECONDARY: NavDef[] = [
  {
    href: "/promocoes",
    label: "Promoções",
    icon: Tag,
    modules: ["food", "ecommerce"],
  },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

function useEnabledModules(): string[] {
  const { empresa } = useAuth();
  const raw = empresa?.modulosAtivos;
  if (!raw || raw.length === 0) return ["food", "ecommerce", "motorista", "servicos", "entrega", "encomendas", "passagens"];
  return raw.filter(m => !m.startsWith("destaque:"));
}

function useChatBadge() {
  const { token } = useAuth();
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!token) return;
    const apiBase = "/api";
    const fetch_ = () =>
      fetch(`${apiBase}/chat/total-nao-lidas`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { total: 0 })
        .then(d => setTotal(Number(d.total ?? 0)))
        .catch(() => {});
    fetch_();
    const t = setInterval(fetch_, 8000);
    return () => clearInterval(t);
  }, [token]);
  return total;
}

function useNewOrdersBadge() {
  const { token, user } = useAuth();
  const empresaId = user?.empresaId;
  const [count, setCount] = useState(0);
  const [location] = useLocation();

  useEffect(() => {
    if (!token) return;
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "x-empresa-id": String(empresaId ?? "") };
    const fetchCount = async () => {
      try {
        const r = await fetch("/api/pdv/pedidos", { headers });
        if (r.ok) {
          const data: any[] = await r.json();
          setCount(data.filter((o: any) => o.status === "novo" || o.status === "pendente").length);
        }
      } catch {}
    };
    fetchCount();
    const t = setInterval(fetchCount, 20000);
    return () => clearInterval(t);
  }, [token, empresaId]);

  useEffect(() => {
    const handler = () => setCount(c => c + 1);
    window.addEventListener("gotaxi:novo-pedido", handler);
    return () => window.removeEventListener("gotaxi:novo-pedido", handler);
  }, []);

  useEffect(() => {
    if (location === "/pedidos") setCount(0);
  }, [location]);

  return count;
}

function NavItem({ href, label, icon: Icon, modules, moduleLabel }: NavDef) {
  const [location] = useLocation();
  const enabled = useEnabledModules();
  const isActive = location === href;

  if (modules && modules.length > 0 && !modules.some(m => enabled.includes(m))) return null;

  let displayLabel = label;
  if (moduleLabel) {
    const activeModule = modules?.find(m => enabled.includes(m));
    if (activeModule && moduleLabel[activeModule]) displayLabel = moduleLabel[activeModule];
  }

  return (
    <Link href={href} className="block">
      <span className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}>
        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />}
        <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        {displayLabel}
      </span>
    </Link>
  );
}

const ENCOMENDAS_NAV: NavDef[] = [
  { href: "/encomendas", label: "Painel Encomendas", icon: Package, modules: ["encomendas", "entrega"] },
  { href: "/encomendas/nova", label: "Nova Encomenda", icon: PackageCheck, modules: ["encomendas", "entrega"] },
  { href: "/encomendas/rastreamento", label: "Rastrear", icon: Search, modules: ["encomendas", "entrega"] },
  { href: "/encomendas/saidas", label: "Saídas / Entregas", icon: Truck, modules: ["encomendas", "entrega"] },
  { href: "/encomendas/recebimentos", label: "Recebimentos", icon: ClipboardList, modules: ["encomendas", "entrega"] },
  { href: "/encomendas/clientes", label: "Clientes", icon: Users, modules: ["encomendas", "entrega"] },
  { href: "/encomendas/financeiro", label: "Financeiro", icon: DollarSign, modules: ["encomendas", "entrega"] },
  { href: "/encomendas/relatorios", label: "Relatórios", icon: BarChart3, modules: ["encomendas", "entrega"] },
  { href: "/encomendas/config", label: "Configurações", icon: Settings, modules: ["encomendas", "entrega"] },
];

const MOTORISTA_NAV: NavDef[] = [
  { href: "/motorista", label: "Painel Corporativo", icon: Car, modules: ["motorista"] },
  { href: "/motorista/nova-corrida", label: "Solicitar Corrida", icon: MapPin, modules: ["motorista"] },
  { href: "/motorista/aprovacoes", label: "Aprovações", icon: CheckCircle, modules: ["motorista"] },
  { href: "/motorista/historico", label: "Histórico", icon: ClipboardList, modules: ["motorista"] },
  { href: "/motorista/rastreamento", label: "Rastreamento", icon: Bike, modules: ["motorista"] },
  { href: "/motorista/financeiro", label: "Financeiro", icon: DollarSign, modules: ["motorista"] },
  { href: "/motorista/faturas", label: "Faturas", icon: FileText, modules: ["motorista"] },
  { href: "/motorista/repasses", label: "Repasses GoTaxi", icon: DollarSign, modules: ["motorista"] },
  { href: "/motorista/config", label: "Equipe / Centros", icon: Building2, modules: ["motorista"] },
];

const VIAGENS_HREFS = ["/viagens", "/viagens/nova-venda", "/viagens/vendas", "/viagens/clientes", "/viagens/rotas", "/viagens/custos", "/viagens/veiculos", "/viagens/caronas"];
const NAV_ITEMS_MAIN = NAV_ITEMS.filter(i => !VIAGENS_HREFS.includes(i.href));
const NAV_ITEMS_VIAGENS = NAV_ITEMS.filter(i => VIAGENS_HREFS.includes(i.href));

function PedidosNavItem({ badge }: { badge: number }) {
  const [location] = useLocation();
  const isActive = location === "/pedidos";
  return (
    <Link href="/pedidos" className="block">
      <span className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}>
        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />}
        <ClipboardList className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        Pedidos
        {badge > 0 && (
          <span className={cn(
            "ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
            "bg-destructive text-white animate-pulse"
          )}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
    </Link>
  );
}

function ChatNavItem({ badge }: { badge: number }) {
  const [location] = useLocation();
  const isActive = location === "/chat";
  return (
    <Link href="/chat" className="block">
      <span className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}>
        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />}
        <MessageSquare className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        Chat com Clientes
        {badge > 0 && (
          <span className="ml-auto bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {badge}
          </span>
        )}
      </span>
    </Link>
  );
}

function SuporteNavItem() {
  const [location] = useLocation();
  const isActive = location === "/suporte";
  return (
    <Link href="/suporte" className="block">
      <span className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}>
        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />}
        <LifeBuoy className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        Suporte GoTaxi
      </span>
    </Link>
  );
}

export function Sidebar() {
  const { logout, empresa } = useAuth();
  const enabled = useEnabledModules();
  const chatBadge = useChatBadge();
  const ordersBadge = useNewOrdersBadge();

  const hasFood = enabled.includes("food");
  const hasEcommerce = enabled.includes("ecommerce");
  const hasViagens = enabled.includes("passagens");
  const hasEncomendas = enabled.includes("encomendas") || enabled.includes("entrega");
  const hasMotorista = enabled.includes("motorista");
  const hasMainItems = hasFood || hasEcommerce || hasViagens || hasEncomendas;

  return (
    <aside className="fixed inset-y-0 left-0 w-[220px] bg-card border-r border-border/60 flex flex-col z-20 shadow-sm">
      <div className="h-16 flex items-center px-5 border-b border-border/60">
        <div className="flex-1 min-w-0">
          <img src="/logo.png" alt="Go Taxi" className="h-9 object-contain object-left" />
          <p className="text-[10px] text-primary font-semibold uppercase tracking-wider mt-0.5">PDV Parceiro</p>
        </div>
      </div>

      {empresa && (
        <div className="px-4 py-3 border-b border-border/40">
          <p className="text-xs font-semibold text-foreground truncate">{empresa.nome}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {hasFood       && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400">🍔 Food</span>}
            {hasEcommerce  && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400">🛍️ Loja</span>}
            {hasViagens    && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400">✈️ Viagens</span>}
            {hasEncomendas && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-600/15 text-orange-500">📦 Entregas</span>}
            {hasMotorista  && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">🚗 Pro</span>}
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-0.5">
        {/* Main nav (food / ecommerce / always-show) */}
        {hasMainItems && (
          <>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
              Menu Principal
            </div>
            {NAV_ITEMS_MAIN.map(item =>
              item.href === "/pedidos"
                ? <PedidosNavItem key="/pedidos" badge={ordersBadge} />
                : <NavItem key={item.href} {...item} />
            )}
          </>
        )}

        {/* Viagens section */}
        {hasViagens && (
          <>
            <div className="h-px bg-border/60 my-3" />
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
              ✈️ Tur Viagens
            </div>
            {NAV_ITEMS_VIAGENS.map(item => <NavItem key={item.href} {...item} />)}
          </>
        )}

        {/* Encomendas section */}
        {hasEncomendas && (
          <>
            <div className="h-px bg-border/60 my-3" />
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
              📦 Entregas e Encomendas
            </div>
            {ENCOMENDAS_NAV.map(item => <NavItem key={item.href} {...item} />)}
          </>
        )}

        {/* GoTaxi Pro / Motorista Corporativo */}
        {hasMotorista && (
          <>
            <div className="h-px bg-border/60 my-3" />
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
              🚗 GoTaxi Pro
            </div>
            {MOTORISTA_NAV.map(item => <NavItem key={item.href} {...item} />)}
          </>
        )}

        {/* Comunicação */}
        <div className="h-px bg-border/60 my-3" />
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
          Comunicação
        </div>
        <ChatNavItem badge={chatBadge} />
        <SuporteNavItem />

        {/* Ferramentas */}
        <div className="h-px bg-border/60 my-3" />
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
          Ferramentas
        </div>
        {NAV_SECONDARY.map(item => <NavItem key={item.href} {...item} />)}
      </nav>

      <div className="p-4 border-t border-border/60">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          Sair da conta
        </button>
      </div>
    </aside>
  );
}
