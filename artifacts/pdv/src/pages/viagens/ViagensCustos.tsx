import React, { useState } from "react";
import { Calculator, Fuel, MapPin, Receipt, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COMBUSTIVEIS = [
  { key: "diesel",    label: "Diesel",    emoji: "⛽", precoRef: 6.20 },
  { key: "gasolina",  label: "Gasolina",  emoji: "⛽", precoRef: 5.80 },
  { key: "etanol",    label: "Etanol",    emoji: "🌿", precoRef: 3.80 },
  { key: "gnv",       label: "GNV (m³)",  emoji: "💨", precoRef: 4.00 },
];

const DEFAULT = {
  distancia: 300,
  combustivel: "diesel" as "diesel"|"gasolina"|"etanol"|"gnv",
  unidade: "km_l" as "km_l"|"l_100km",
  consumo: 5,
  preco_litro: 6.20,
  pedagios: 0,
  passageiros: 1,
};

export default function ViagensCustos() {
  const [calc, setCalc] = useState(DEFAULT);
  const set = (k: string, v: number | string) => setCalc(c => ({ ...c, [k]: v }));

  const kmPorLitro = calc.unidade === "km_l"
    ? calc.consumo
    : (calc.consumo > 0 ? 100 / calc.consumo : 0);
  const litros       = kmPorLitro > 0 ? calc.distancia / kmPorLitro : 0;
  const custoComb    = litros * calc.preco_litro;
  const custoTotal   = custoComb + calc.pedagios;
  const custoPorKm   = calc.distancia > 0 ? custoTotal / calc.distancia : 0;
  const custoPorPax  = calc.passageiros > 0 ? custoTotal / calc.passageiros : 0;

  const temResultado = calc.distancia > 0 && calc.consumo > 0 && calc.preco_litro > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calculator className="w-6 h-6 text-primary" /> Custos de Viagem
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Calcule o custo real de uma viagem — combustível + pedágios</p>
      </div>

      <Card className="shadow-sm border-border/50">
        <CardContent className="p-6 space-y-6">

          {/* Distância + Pedágios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" /> Distância da viagem (km)
              </label>
              <Input type="number" min="1" step="1" placeholder="Ex: 1250"
                value={calc.distancia} onChange={e => set("distancia", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-primary" /> Pedágios da rota (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">R$</span>
                <Input type="number" min="0" step="1" placeholder="0,00"
                  value={calc.pedagios} onChange={e => set("pedagios", Number(e.target.value))}
                  className="pl-9" />
              </div>
            </div>
          </div>

          {/* Combustível */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Fuel className="w-3.5 h-3.5 text-primary" /> Tipo de combustível
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {COMBUSTIVEIS.map(c => (
                <button key={c.key} type="button"
                  onClick={() => { set("combustivel", c.key); set("preco_litro", c.precoRef); }}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all text-xs font-semibold
                    ${calc.combustivel === c.key
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-muted/20 text-muted-foreground hover:border-primary/30"}`}
                >
                  <span className="text-lg">{c.emoji}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Consumo + Preço */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Consumo do veículo</label>
              <div className="flex gap-2">
                <Input type="number" min="0.1" step="0.1"
                  value={calc.consumo} onChange={e => set("consumo", Number(e.target.value))}
                  className="flex-1" />
                <select value={calc.unidade} onChange={e => set("unidade", e.target.value)}
                  className="bg-secondary border border-border rounded-md px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="km_l">km/L</option>
                  <option value="l_100km">L/100km</option>
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                = {kmPorLitro.toFixed(1)} km por litro
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Preço do {COMBUSTIVEIS.find(c => c.key === calc.combustivel)?.label ?? "combustível"} (R$/L)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">R$</span>
                <Input type="number" min="0" step="0.01"
                  value={calc.preco_litro} onChange={e => set("preco_litro", Number(e.target.value))}
                  className="pl-9" />
              </div>
            </div>
          </div>

          {/* Passageiros */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Número de passageiros</label>
            <Input type="number" min="1" step="1"
              value={calc.passageiros}
              onChange={e => set("passageiros", Math.max(1, Number(e.target.value)))}
              className="max-w-[160px]" />
            <p className="text-xs text-muted-foreground">Para calcular o valor por pessoa.</p>
          </div>

          {/* Resultado */}
          {temResultado && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-5 space-y-4"
            >
              <p className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" /> Resultado da simulação
              </p>

              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                {[
                  ["Distância", `${calc.distancia.toLocaleString("pt-BR")} km`],
                  ["Litros necessários", `${litros.toFixed(1)} L`],
                  ["Custo combustível", fmt(custoComb)],
                  ["Pedágios", fmt(calc.pedagios)],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between">
                    <span className="text-muted-foreground">{l}</span>
                    <span className="font-semibold text-foreground">{v}</span>
                  </div>
                ))}
              </div>

              <div className="h-px bg-primary/20" />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "Custo total",      value: fmt(custoTotal),    highlight: true },
                  { label: "Por km rodado",     value: fmt(custoPorKm),   highlight: false },
                  { label: "Por passageiro",    value: fmt(custoPorPax),  highlight: false },
                ].map(item => (
                  <div key={item.label} className="bg-white/50 dark:bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p className={`text-xl font-black ${item.highlight ? "text-primary" : "text-foreground"}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <button onClick={() => setCalc(DEFAULT)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Limpar / reiniciar
          </button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
