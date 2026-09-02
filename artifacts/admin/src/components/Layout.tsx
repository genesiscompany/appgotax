import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

const IconDashboard = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
const IconEmpresas = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IconUsuarios = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconPedidos = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
const IconRepasses = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const IconMercadoPago = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8.5C3 6.57 4.57 5 6.5 5h11C19.43 5 21 6.57 21 8.5v7c0 1.93-1.57 3.5-3.5 3.5h-11C4.57 19 3 17.43 3 15.5v-7Z"/><path d="M3 9h18M7 14h3"/></svg>;
const IconMotoristas = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 7.76a6 6 0 0 0 0 8.49"/></svg>;
const IconCorridas = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>;
const IconEntregadores = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a7.5 7.5 0 0 1 13 0"/><path d="M15 14l3 3-3 3"/></svg>;
const IconEntregas = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="M16.5 9.4L7.55 4.24"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27L22 19"/></svg>;
const IconAlimentos = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>;
const IconEcommerce = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>;
const IconTurViagens = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 15.92z"/></svg>;
const IconPassagem = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><line x1="12" y1="7" x2="12" y2="17"/></svg>;
const IconCategorias = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>;
const IconLoja = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IconDelivery = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>;
const IconFoodDelivery = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>;
const IconModulos = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
const IconConfig = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
const IconPush = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IconChevron = ({ open }: { open: boolean }) => (
  <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
);
const IconDocumentos = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;

const NAV_TOP = [
  { path: "/", label: "Dashboard", icon: <IconDashboard /> },
];

const IconAgenda = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/></svg>;

const NAV_BOTTOM = [
  { path: "/modulos", label: "Módulos", icon: <IconModulos /> },
  { path: "/configuracoes", label: "Configurações", icon: <IconConfig /> },
];

const IconServicos = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;

const MOTORISTAS_SUBMENU = [
  { path: "/corridas", label: "Corridas", icon: <IconCorridas /> },
  { path: "/agendamentos", label: "Agendamentos", icon: <IconAgenda /> },
  { path: "/categorias-corrida", label: "Categorias", icon: <IconCategorias /> },
  { path: "/motivos-cancelamento", label: "Mot. Cancelamento", icon: <span className="text-xs">🚫</span> },
  { path: "/motoristas-docs", label: "Documentos", icon: <IconDocumentos /> },
];


const ENTREGADORES_SUBMENU = [
  { path: "/entregas", label: "Entregas", icon: <IconEntregas /> },
  { path: "/valores-entrega", label: "Valores de Entrega", icon: <span className="text-xs">💰</span> },
  { path: "/entregadores-docs", label: "Documentos", icon: <IconDocumentos /> },
];

const DELIVERY_SUBMENU = [
  { path: "/delivery-docs", label: "Documentos", icon: <IconDocumentos /> },
];

const ALIMENTOS_SUBMENU = [
  { path: "/pedidos", label: "Pedidos", icon: <IconPedidos /> },
  { path: "/food-delivery", label: "Pedidos Delivery", icon: <IconFoodDelivery /> },
  { path: "/subcategorias-alimentacao", label: "Subcategorias", icon: <IconCategorias /> },
  { path: "/alimentos-docs", label: "Documentos", icon: <IconDocumentos /> },
];

const ECOMMERCE_SUBMENU = [
  { path: "/ecommerce-empresas", label: "Empresas", icon: <IconLoja /> },
  { path: "/ecommerce-pedidos", label: "Pedidos", icon: <IconPedidos /> },
  { path: "/ecommerce-docs", label: "Documentos", icon: <IconDocumentos /> },
];

const TUR_SUBMENU = [
  { path: "/tur-passagens", label: "Passagens", icon: <IconPassagem /> },
  { path: "/tur-viagens-docs", label: "Documentos", icon: <IconDocumentos /> },
];

function getPageLabel(location: string): string {
  if (location === "/") return "Dashboard";
  if (location.startsWith("/empresas")) return "Parceiros";
  if (location.startsWith("/alimentos-docs")) return "Alimentação — Documentos";
  if (location.startsWith("/subcategorias-alimentacao")) return "Alimentação — Subcategorias";
  if (location.startsWith("/alimentos")) return "Alimentação";
  if (location.startsWith("/usuarios")) return "Usuários";
  if (location.startsWith("/pedidos")) return "Pedidos";
  if (location.startsWith("/repasses")) return "Repasses";
  if (location.startsWith("/corridas")) return "Corridas";
  if (location.startsWith("/motoristas-docs")) return "Motoristas — Documentos";
  if (location.startsWith("/motoristas")) return "Motoristas";
  if (location.startsWith("/food-delivery")) return "Alimentação — Pedidos Delivery";
  if (location.startsWith("/delivery-docs")) return "Boy Delivery — Documentos";
  if (location === "/delivery") return "Boy Delivery";
  if (location.startsWith("/entregas")) return "Entregas";
  if (location.startsWith("/entregadores-docs")) return "Entregas — Documentos";
  if (location.startsWith("/entregadores")) return "Entregas";
  if (location.startsWith("/ecommerce-empresas")) return "E-commerce — Empresas";
  if (location.startsWith("/ecommerce-pedidos")) return "E-commerce — Pedidos";
  if (location.startsWith("/ecommerce-docs")) return "E-commerce — Documentos";
  if (location.startsWith("/ecommerce")) return "E-commerce";
  if (location.startsWith("/tur-passagens")) return "Tur Viagens — Passagens";
  if (location.startsWith("/tur-viagens-docs")) return "Tur Viagens — Documentos";
  if (location.startsWith("/tur-viagens")) return "Tur Viagens";
  if (location.startsWith("/agendamentos")) return "Motoristas — Agendamentos";
  if (location.startsWith("/motivos-cancelamento")) return "Motoristas — Mot. Cancelamento";
  if (location.startsWith("/servicos")) return "Serviços";
  if (location.startsWith("/push")) return "Push Notifications";
  if (location.startsWith("/destaques")) return "Destaques no App";
  if (location.startsWith("/modulos")) return "Módulos";
  if (location.startsWith("/caronas-config")) return "Viagens Compartilhadas";
  if (location.startsWith("/configuracoes-sistema")) return "Financeiro — Mercado Pago";
  if (location.startsWith("/configuracoes")) return "Configurações";
  return "Admin";
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const alimentosSectionActive = location.startsWith("/alimentos") || location.startsWith("/pedidos") || location.startsWith("/food-delivery") || location.startsWith("/subcategorias-alimentacao");
  const [alimentosOpen, setAlimentosOpen] = useState(alimentosSectionActive);

  const motoristasSectionActive = location.startsWith("/motoristas") || location.startsWith("/corridas") || location.startsWith("/categorias-corrida") || location.startsWith("/agendamentos") || location.startsWith("/motivos-cancelamento");
  const [motoristaOpen, setMotoristaOpen] = useState(motoristasSectionActive);

  const entregadoresSectionActive = location.startsWith("/entregadores") || location.startsWith("/entregas");
  const [entregadoresOpen, setEntregadoresOpen] = useState(entregadoresSectionActive);

  const deliverySectionActive = location === "/delivery" || location.startsWith("/delivery-docs");
  const [deliveryOpen, setDeliveryOpen] = useState(deliverySectionActive);

  const ecommerceSectionActive = location.startsWith("/ecommerce");
  const [ecommerceOpen, setEcommerceOpen] = useState(ecommerceSectionActive);

  const turSectionActive = location.startsWith("/tur-viagens") || location.startsWith("/tur-passagens");
  const [turOpen, setTurOpen] = useState(turSectionActive);

  React.useEffect(() => {
    if (location.startsWith("/motoristas") || location.startsWith("/corridas") || location.startsWith("/categorias-corrida") || location.startsWith("/agendamentos") || location.startsWith("/motivos-cancelamento")) setMotoristaOpen(true);
    if (location.startsWith("/entregadores") || location.startsWith("/entregas")) setEntregadoresOpen(true);
    if (location === "/delivery" || location.startsWith("/delivery-docs")) setDeliveryOpen(true);
    if (location.startsWith("/alimentos") || location.startsWith("/pedidos") || location.startsWith("/food-delivery") || location.startsWith("/subcategorias-alimentacao")) setAlimentosOpen(true);
    if (location.startsWith("/ecommerce")) setEcommerceOpen(true);
    if (location.startsWith("/tur")) setTurOpen(true);
  }, [location]);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={closeSidebar} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-60 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
          <div className="flex-1 min-w-0">
            <img src="/admin/logo.png" alt="Go Taxi" className="h-8 object-contain object-left" />
            <p className="text-[10px] text-primary font-semibold uppercase tracking-wider mt-0.5">Super Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {/* Top items: Dashboard + Usuários */}
          {NAV_TOP.map(item => {
            const active = item.path === "/" ? location === "/" : location.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path}>
                <a onClick={closeSidebar}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}>
                  <span className={active ? "text-primary" : "text-muted-foreground"}>{item.icon}</span>
                  {item.label}
                </a>
              </Link>
            );
          })}

          {/* ── Clientes ────────────────────── */}
          <div className="pt-3 pb-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-2">Clientes</p>
          </div>
          <Link href="/usuarios">
            <a onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.startsWith("/usuarios") ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
              <span className={location.startsWith("/usuarios") ? "text-primary" : "text-muted-foreground"}><IconUsuarios /></span>
              Usuários
            </a>
          </Link>

          {/* ── Parceiros ────────────────────── */}
          <div className="pt-3 pb-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-2">Parceiros</p>
          </div>
          <Link href="/empresas">
            <a onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location === "/empresas" ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
              <span className={location === "/empresas" ? "text-primary" : "text-muted-foreground"}><IconEmpresas /></span>
              Parceiros
            </a>
          </Link>
          <Link href="/empresas-corporativas">
            <a onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.startsWith("/empresas-corporativas") ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
              <span className={location.startsWith("/empresas-corporativas") ? "text-primary" : "text-muted-foreground"}><IconEmpresas /></span>
              E. Corporativas
            </a>
          </Link>

          {/* Alimentos com submenu */}
          <div>
            <div className="flex items-center">
              <Link href="/alimentos" className="flex-1">
                <a onClick={closeSidebar}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 ${
                    alimentosSectionActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}>
                  <span className={alimentosSectionActive ? "text-primary" : "text-muted-foreground"}><IconAlimentos /></span>
                  Alimentação
                </a>
              </Link>
              <button
                onClick={() => setAlimentosOpen(v => !v)}
                className={`p-2 rounded-lg transition-colors mr-1 ${
                  alimentosSectionActive ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
                title={alimentosOpen ? "Recolher" : "Expandir"}
              >
                <IconChevron open={alimentosOpen} />
              </button>
            </div>
            {alimentosOpen && (
              <div className="ml-3 mt-0.5 border-l-2 border-sidebar-border pl-3 space-y-0.5">
                {ALIMENTOS_SUBMENU.map(sub => {
                  const active = location.startsWith(sub.path);
                  return (
                    <Link key={sub.path} href={sub.path}>
                      <a onClick={closeSidebar}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          active ? "bg-primary/15 text-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        }`}>
                        <span className={active ? "text-primary" : "text-muted-foreground"}>{sub.icon}</span>
                        {sub.label}
                      </a>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Motoristas com submenu */}
          <div>
            <div className="flex items-center">
              <Link href="/motoristas" className="flex-1">
                <a onClick={closeSidebar}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 ${
                    motoristasSectionActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}>
                  <span className={motoristasSectionActive ? "text-primary" : "text-muted-foreground"}><IconMotoristas /></span>
                  Motoristas
                </a>
              </Link>
              <button
                onClick={() => setMotoristaOpen(v => !v)}
                className={`p-2 rounded-lg transition-colors mr-1 ${
                  motoristasSectionActive ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
                title={motoristaOpen ? "Recolher" : "Expandir"}
              >
                <IconChevron open={motoristaOpen} />
              </button>
            </div>

            {/* Submenu */}
            {motoristaOpen && (
              <div className="ml-3 mt-0.5 border-l-2 border-sidebar-border pl-3 space-y-0.5">
                {MOTORISTAS_SUBMENU.map(sub => {
                  const active = location.startsWith(sub.path);
                  return (
                    <Link key={sub.path} href={sub.path}>
                      <a onClick={closeSidebar}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          active ? "bg-primary/15 text-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        }`}>
                        <span className={active ? "text-primary" : "text-muted-foreground"}>{sub.icon}</span>
                        {sub.label}
                      </a>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Entregas com submenu */}
          <div>
            <div className="flex items-center">
              <Link href="/entregadores" className="flex-1">
                <a onClick={closeSidebar}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 ${
                    entregadoresSectionActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}>
                  <span className={entregadoresSectionActive ? "text-primary" : "text-muted-foreground"}><IconEntregas /></span>
                  Entregas
                </a>
              </Link>
              <button
                onClick={() => setEntregadoresOpen(v => !v)}
                className={`p-2 rounded-lg transition-colors mr-1 ${
                  entregadoresSectionActive ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
                title={entregadoresOpen ? "Recolher" : "Expandir"}
              >
                <IconChevron open={entregadoresOpen} />
              </button>
            </div>

            {/* Submenu Entregadores */}
            {entregadoresOpen && (
              <div className="ml-3 mt-0.5 border-l-2 border-sidebar-border pl-3 space-y-0.5">
                {ENTREGADORES_SUBMENU.map(sub => {
                  const active = location.startsWith(sub.path);
                  return (
                    <Link key={sub.path} href={sub.path}>
                      <a onClick={closeSidebar}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          active ? "bg-primary/15 text-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        }`}>
                        <span className={active ? "text-primary" : "text-muted-foreground"}>{sub.icon}</span>
                        {sub.label}
                      </a>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Boy Delivery com submenu */}
          <div>
            <div className="flex items-center">
              <Link href="/delivery" className="flex-1">
                <a onClick={closeSidebar}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 ${
                    deliverySectionActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}>
                  <span className={deliverySectionActive ? "text-primary" : "text-muted-foreground"}><IconDelivery /></span>
                  Boy Delivery
                </a>
              </Link>
              <button
                onClick={() => setDeliveryOpen(v => !v)}
                className={`p-2 rounded-lg transition-colors mr-1 ${
                  deliverySectionActive ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
                title={deliveryOpen ? "Recolher" : "Expandir"}
              >
                <IconChevron open={deliveryOpen} />
              </button>
            </div>

            {deliveryOpen && (
              <div className="ml-3 mt-0.5 border-l-2 border-sidebar-border pl-3 space-y-0.5">
                {DELIVERY_SUBMENU.map(sub => {
                  const active = location.startsWith(sub.path);
                  return (
                    <Link key={sub.path} href={sub.path}>
                      <a onClick={closeSidebar}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          active ? "bg-primary/15 text-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        }`}>
                        <span className={active ? "text-primary" : "text-muted-foreground"}>{sub.icon}</span>
                        {sub.label}
                      </a>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* E-commerce com submenu */}
          <div>
            <div className="flex items-center">
              <Link href="/ecommerce" className="flex-1">
                <a onClick={closeSidebar}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 ${
                    ecommerceSectionActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}>
                  <span className={ecommerceSectionActive ? "text-primary" : "text-muted-foreground"}><IconEcommerce /></span>
                  E-commerce
                </a>
              </Link>
              <button
                onClick={() => setEcommerceOpen(v => !v)}
                className={`p-2 rounded-lg transition-colors mr-1 ${
                  ecommerceSectionActive ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
                title={ecommerceOpen ? "Recolher" : "Expandir"}
              >
                <IconChevron open={ecommerceOpen} />
              </button>
            </div>

            {/* Submenu E-commerce */}
            {ecommerceOpen && (
              <div className="ml-3 mt-0.5 border-l-2 border-sidebar-border pl-3 space-y-0.5">
                {ECOMMERCE_SUBMENU.map(sub => {
                  const active = location.startsWith(sub.path);
                  return (
                    <Link key={sub.path} href={sub.path}>
                      <a onClick={closeSidebar}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          active ? "bg-primary/15 text-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        }`}>
                        <span className={active ? "text-primary" : "text-muted-foreground"}>{sub.icon}</span>
                        {sub.label}
                      </a>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tur Viagens com submenu */}
          <div>
            <div className="flex items-center">
              <Link href="/tur-viagens" className="flex-1">
                <a onClick={closeSidebar}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 ${
                    turSectionActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}>
                  <span className={turSectionActive ? "text-primary" : "text-muted-foreground"}><IconTurViagens /></span>
                  Tur Viagens
                </a>
              </Link>
              <button
                onClick={() => setTurOpen(v => !v)}
                className={`p-2 rounded-lg transition-colors mr-1 ${
                  turSectionActive ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
                title={turOpen ? "Recolher" : "Expandir"}
              >
                <IconChevron open={turOpen} />
              </button>
            </div>

            {/* Submenu Tur Viagens */}
            {turOpen && (
              <div className="ml-3 mt-0.5 border-l-2 border-sidebar-border pl-3 space-y-0.5">
                {TUR_SUBMENU.map(sub => {
                  const active = location.startsWith(sub.path);
                  return (
                    <Link key={sub.path} href={sub.path}>
                      <a onClick={closeSidebar}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          active ? "bg-primary/15 text-primary" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        }`}>
                        <span className={active ? "text-primary" : "text-muted-foreground"}>{sub.icon}</span>
                        {sub.label}
                      </a>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Serviços */}
          <Link href="/servicos">
            <a onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.startsWith("/servicos") ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
              <span className={location.startsWith("/servicos") ? "text-primary" : "text-muted-foreground"}><IconServicos /></span>
              Serviços
            </a>
          </Link>

          {/* ── Financeiro ────────────────────── */}
          <div className="pt-3 pb-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-2">Financeiro</p>
          </div>
          <Link href="/repasses">
            <a onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.startsWith("/repasses") ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
              <span className={location.startsWith("/repasses") ? "text-primary" : "text-muted-foreground"}><IconRepasses /></span>
              Repasses
            </a>
          </Link>
          <Link href="/configuracoes-sistema?tab=mercadopago">
            <a onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.startsWith("/configuracoes-sistema") ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
              <span className={location.startsWith("/configuracoes-sistema") ? "text-primary" : "text-muted-foreground"}><IconMercadoPago /></span>
              Mercado Pago
            </a>
          </Link>
          <Link href="/afiliados-admin">
            <a onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.startsWith("/afiliados-admin") ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
              <span className={location.startsWith("/afiliados-admin") ? "text-primary" : "text-muted-foreground"}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </span>
              Afiliados
            </a>
          </Link>

          {/* ── Sistema ────────────────────── */}
          <div className="pt-3 pb-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-2">Sistema</p>
          </div>

          <Link href="/configuracoes-sistema">
            <a onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.startsWith("/configuracoes-sistema") ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
              <span className={location.startsWith("/configuracoes-sistema") ? "text-primary" : "text-muted-foreground"}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </span>
              Regras do App
            </a>
          </Link>

          <Link href="/caronas-config">
            <a onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.startsWith("/caronas-config") ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
              <span className={location.startsWith("/caronas-config") ? "text-primary" : "text-muted-foreground"}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>
              </span>
              V. Compartilhadas
            </a>
          </Link>

          {/* Push Notifications */}
          <Link href="/push">
            <a onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.startsWith("/push") ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
              <span className={location.startsWith("/push") ? "text-primary" : "text-muted-foreground"}><IconPush /></span>
              Push Notifications
            </a>
          </Link>

          {/* Suporte */}
          <div className="pt-3 pb-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-2">Suporte</p>
          </div>
          <Link href="/suporte">
            <a onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.startsWith("/suporte") ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
              <span className={location.startsWith("/suporte") ? "text-primary" : "text-muted-foreground"}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </span>
              Tickets de Suporte
            </a>
          </Link>

          {/* Destaques */}
          <Link href="/destaques">
            <a onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.startsWith("/destaques") ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
              <span className={location.startsWith("/destaques") ? "text-primary" : "text-muted-foreground"}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill={location.startsWith("/destaques") ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </span>
              Destaques no App
            </a>
          </Link>

          {/* Bottom items */}
          {NAV_BOTTOM.map(item => {
            const active = location.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path}>
                <a onClick={closeSidebar}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}>
                  <span className={active ? "text-primary" : "text-muted-foreground"}>{item.icon}</span>
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-sm">{user?.nome?.charAt(0) ?? "A"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.nome}</p>
              <p className="text-xs text-muted-foreground">Super Admin</p>
            </div>
            <button onClick={logout} className="text-muted-foreground hover:text-destructive transition-colors" title="Sair">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center px-4 lg:px-6 gap-4 shrink-0">
          <button onClick={() => setSidebarOpen(v => !v)} className="lg:hidden text-muted-foreground hover:text-foreground transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{getPageLabel(location)}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
            Sistema operacional
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
