import React, { useEffect, useState, useCallback } from "react";
import { Bell, Store as StoreIcon, Utensils, ShoppingBag, Wrench } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type ModuleType = "alimentacao" | "ecommerce" | "servicos";

const MODULE_TO_KEY: Record<ModuleType, string> = {
  alimentacao: "food",
  ecommerce: "ecommerce",
  servicos: "servicos",
};

const ALL_MODULES = [
  { id: "alimentacao" as ModuleType, label: "Alimentação", icon: Utensils },
  { id: "ecommerce" as ModuleType, label: "E-commerce", icon: ShoppingBag },
  { id: "servicos" as ModuleType, label: "Serviços", icon: Wrench },
];

export function Topbar() {
  const { activeModule, setActiveModule, storeStatus, setStoreStatus } = useAppStore();
  const { empresa } = useAuth();
  const [isRinging, setIsRinging] = useState(false);
  const [bellCount, setBellCount] = useState(0);

  const isStoreOpen = storeStatus === "aberta";

  const modulosAtivos: string[] = Array.isArray(empresa?.modulosAtivos) ? empresa.modulosAtivos : [];
  const visibleModules = ALL_MODULES.filter((m) => modulosAtivos.includes(MODULE_TO_KEY[m.id]));

  useEffect(() => {
    if (visibleModules.length === 0) return;
    const activeIsVisible = visibleModules.some((m) => m.id === activeModule);
    if (!activeIsVisible) setActiveModule(visibleModules[0].id);
  }, [visibleModules, activeModule, setActiveModule]);

  useEffect(() => {
    const handler = () => {
      setBellCount(c => c + 1);
      setIsRinging(true);
      setTimeout(() => setIsRinging(false), 4000);
    };
    window.addEventListener("gotaxi:novo-pedido", handler);
    return () => window.removeEventListener("gotaxi:novo-pedido", handler);
  }, []);

  const handleBellClick = useCallback(() => {
    setBellCount(0);
    setIsRinging(false);
  }, []);

  const nomeEmpresa = empresa?.nome ?? "Parceiro";
  const iniciais = nomeEmpresa
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <header className="h-16 bg-card border-b border-border/60 flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm shadow-black/[0.02]">
      <div className="flex items-center gap-6">
        {visibleModules.length > 1 && (
          <div className="bg-secondary/50 p-1 rounded-xl flex items-center">
            {visibleModules.map((mod) => {
              const isActive = activeModule === mod.id;
              return (
                <button
                  key={mod.id}
                  onClick={() => setActiveModule(mod.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-background text-foreground shadow-sm ring-1 ring-black/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                >
                  <mod.icon className="w-4 h-4" />
                  {mod.label}
                </button>
              );
            })}
          </div>
        )}
        {visibleModules.length === 1 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-foreground">
            {React.createElement(visibleModules[0].icon, { className: "w-4 h-4" })}
            {visibleModules[0].label}
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 bg-secondary/30 px-4 py-1.5 rounded-full border border-border/50">
          <span className="text-sm font-medium text-foreground hidden sm:inline-block">
            Status da Loja:
          </span>
          <Badge
            variant={isStoreOpen ? "default" : "destructive"}
            className="pointer-events-none h-6 uppercase text-[10px] tracking-wider"
          >
            {isStoreOpen ? "Aberta" : "Fechada"}
          </Badge>
          <Switch
            checked={isStoreOpen}
            onCheckedChange={(checked) => setStoreStatus(checked ? "aberta" : "fechada")}
            className="ml-1"
          />
        </div>

        <div className="flex items-center gap-4 border-l border-border/60 pl-6">
          <button
            onClick={handleBellClick}
            className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-secondary"
            title={bellCount > 0 ? `${bellCount} novo(s) pedido(s)` : "Notificações"}
          >
            <Bell
              className={cn(
                "w-5 h-5 transition-colors",
                isRinging ? "text-primary" : "",
              )}
              style={isRinging ? {
                animation: "bell-ring 0.5s ease-in-out infinite",
                transformOrigin: "top center",
              } : {}}
            />
            {bellCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-card">
                {bellCount > 9 ? "9+" : bellCount}
              </span>
            ) : (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-card" />
            )}
          </button>

          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-foreground leading-none">{nomeEmpresa}</p>
              <p className="text-xs text-muted-foreground mt-1">Lojista Parceiro</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {iniciais}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bell-ring {
          0%   { transform: rotate(0deg); }
          10%  { transform: rotate(14deg); }
          20%  { transform: rotate(-12deg); }
          30%  { transform: rotate(10deg); }
          40%  { transform: rotate(-8deg); }
          50%  { transform: rotate(6deg); }
          60%  { transform: rotate(-4deg); }
          70%  { transform: rotate(2deg); }
          80%  { transform: rotate(-2deg); }
          90%  { transform: rotate(1deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </header>
  );
}
