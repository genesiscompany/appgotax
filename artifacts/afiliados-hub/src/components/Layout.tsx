import { useState } from "react";
import { useLocation, Link } from "wouter";
import { clearToken } from "@/lib/api";
import {
  LayoutDashboard, Users, DollarSign, Wallet, BarChart3,
  LogOut, Menu, X, ChevronRight, Building2,
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/indicados", label: "Meus Indicados", icon: Users },
  { href: "/corporativo", label: "Plataforma Corporativa", icon: Building2 },
  { href: "/comissoes", label: "Comissões", icon: DollarSign },
  { href: "/resgates", label: "Saques", icon: Wallet },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [loc, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  const usuario = (() => {
    try { return JSON.parse(localStorage.getItem("afiliado_usuario") || "{}"); } catch { return {}; }
  })();

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <div className="px-6 py-5 border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center text-white font-bold text-sm">G</div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">GoTaxi</p>
            <p className="text-xs text-gray-400 leading-tight">Hub de Afiliados</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? loc === "/" : loc.startsWith(href);
          return (
            <Link key={href} href={href}>
              <a
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-[hsl(var(--primary))] text-white"
                    : "text-gray-300 hover:bg-[hsl(var(--sidebar-accent))] hover:text-white"
                }`}
              >
                <Icon size={18} />
                {label}
                {active && <ChevronRight size={14} className="ml-auto opacity-70" />}
              </a>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white text-xs font-bold">
            {(usuario.nome || "?")[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{usuario.nome || "Afiliado"}</p>
            <p className="text-xs text-gray-400 truncate">{usuario.email || ""}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-red-500/20 hover:text-red-400 transition-colors"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-72 h-full">
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setOpen(true)} className="text-gray-600">
            <Menu size={22} />
          </button>
          <span className="font-semibold text-gray-900">Hub de Afiliados</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
