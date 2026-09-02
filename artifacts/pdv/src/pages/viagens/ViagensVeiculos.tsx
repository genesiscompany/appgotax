import React, { useState, useEffect } from "react";
import { Bus, Plus, Pencil, Trash2, Fuel, Users, X, Check, Car } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
const fmt  = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1 });

const COMBUSTIVEIS = [
  { key: "diesel",   label: "Diesel"   },
  { key: "gasolina", label: "Gasolina" },
  { key: "etanol",   label: "Etanol"   },
  { key: "gnv",      label: "GNV"      },
];

const MODELOS_SUGERIDOS = [
  "Ônibus Marcopolo Ideale",
  "Ônibus Mercedes O500",
  "Micro-ônibus Volare",
  "Van Sprinter 415",
  "Van Transit 350",
  "Carro Sedan Confort",
  "SUV Toyota Corolla Cross",
];

interface Veiculo {
  id: number;
  modelo: string;
  placa: string;
  ano: number;
  cor: string;
  vagas: number;
  combustivel: string;
  consumo_km_l: string;
  observacoes: string;
}

const EMPTY: Omit<Veiculo, "id"> = {
  modelo: "", placa: "", ano: 0, cor: "", vagas: 4,
  combustivel: "diesel", consumo_km_l: "10", observacoes: "",
};

export default function ViagensVeiculos() {
  const { token } = useAuth();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<false | "novo" | Veiculo>(false);
  const [form, setForm]         = useState<Omit<Veiculo, "id">>(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [erro, setErro]         = useState("");
  const [delConfirm, setDelConfirm] = useState<number | null>(null);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/pdv/viagens/veiculos`, { headers });
      const d = await r.json();
      setVeiculos(Array.isArray(d) ? d : []);
    } catch { setVeiculos([]); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function abrirNovo() { setForm(EMPTY); setErro(""); setModal("novo"); }
  function abrirEditar(v: Veiculo) { setForm({ modelo: v.modelo, placa: v.placa, ano: v.ano, cor: v.cor, vagas: v.vagas, combustivel: v.combustivel, consumo_km_l: String(v.consumo_km_l), observacoes: v.observacoes || "" }); setErro(""); setModal(v); }

  async function salvar() {
    if (!form.modelo.trim()) { setErro("Informe o modelo do veículo"); return; }
    setSaving(true); setErro("");
    try {
      const body = { ...form, vagas: Number(form.vagas), ano: Number(form.ano) || undefined };
      let r;
      if (modal === "novo") {
        r = await fetch(`${API}/api/pdv/viagens/veiculos`, { method: "POST", headers, body: JSON.stringify(body) });
      } else {
        r = await fetch(`${API}/api/pdv/viagens/veiculos/${(modal as Veiculo).id}`, { method: "PUT", headers, body: JSON.stringify(body) });
      }
      if (!r.ok) { const e = await r.json(); setErro(e.error || "Erro ao salvar"); return; }
      setModal(false);
      load();
    } catch { setErro("Falha de conexão"); } finally { setSaving(false); }
  }

  async function excluir(id: number) {
    await fetch(`${API}/api/pdv/viagens/veiculos/${id}`, { method: "DELETE", headers });
    setDelConfirm(null);
    load();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bus className="w-6 h-6 text-primary" /> Veículos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie a frota utilizada nas caronas e viagens</p>
        </div>
        <button onClick={abrirNovo}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Novo Veículo
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : veiculos.length === 0 ? (
        <Card className="border-dashed border-2 border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Car className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Nenhum veículo cadastrado</p>
              <p className="text-sm text-muted-foreground">Cadastre os veículos para usar nas caronas</p>
            </div>
            <button onClick={abrirNovo}
              className="bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
              Cadastrar primeiro veículo
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {veiculos.map((v, i) => (
            <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="group relative hover:shadow-md transition-shadow border-border/50">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bus className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate text-foreground">{v.modelo}</p>
                        <p className="text-xs text-muted-foreground">{v.placa || "Sem placa"} {v.ano ? `• ${v.ano}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => abrirEditar(v)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDelConfirm(v.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      <span><strong className="text-foreground">{v.vagas}</strong> vagas</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Fuel className="w-3.5 h-3.5" />
                      <span>{COMBUSTIVEIS.find(c => c.key === v.combustivel)?.label ?? v.combustivel}</span>
                    </div>
                  </div>

                  <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs flex items-center justify-between">
                    <span className="text-muted-foreground">Consumo</span>
                    <span className="font-bold text-foreground">{fmt(Number(v.consumo_km_l))} km/L</span>
                  </div>

                  {v.cor && <p className="text-xs text-muted-foreground">Cor: {v.cor}</p>}

                  {delConfirm === v.id && (
                    <div className="absolute inset-0 bg-background/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3 z-10 p-4">
                      <p className="text-sm font-semibold text-center text-foreground">Excluir este veículo?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setDelConfirm(null)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-muted rounded-lg text-sm text-muted-foreground hover:bg-muted/70 transition-colors">
                          <X className="w-3.5 h-3.5" /> Cancelar
                        </button>
                        <button onClick={() => excluir(v.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-semibold hover:bg-destructive/90 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal !== false && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">
                {modal === "novo" ? "Novo Veículo" : "Editar Veículo"}
              </h2>
              <button onClick={() => setModal(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">

              {/* Modelo com sugestões */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Modelo *</label>
                <Input placeholder="Ex: Ônibus Marcopolo Ideale" value={form.modelo}
                  onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} />
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {MODELOS_SUGERIDOS.map(m => (
                    <button key={m} type="button" onClick={() => setForm(f => ({ ...f, modelo: m }))}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.modelo === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Placa</label>
                  <Input placeholder="ABC-1234" value={form.placa}
                    onChange={e => setForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Ano</label>
                  <Input type="number" placeholder="2024" value={form.ano || ""}
                    onChange={e => setForm(f => ({ ...f, ano: Number(e.target.value) }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Cor</label>
                  <Input placeholder="Branco" value={form.cor}
                    onChange={e => setForm(f => ({ ...f, cor: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Vagas (lugares) *</label>
                  <Input type="number" min="1" max="100" value={form.vagas}
                    onChange={e => setForm(f => ({ ...f, vagas: Number(e.target.value) }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Combustível</label>
                  <select value={form.combustivel} onChange={e => setForm(f => ({ ...f, combustivel: e.target.value }))}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                    {COMBUSTIVEIS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Consumo (km/L)</label>
                  <Input type="number" min="0.1" step="0.1" value={form.consumo_km_l}
                    onChange={e => setForm(f => ({ ...f, consumo_km_l: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Observações</label>
                <textarea rows={2} placeholder="Acessibilidade, ar-condicionado, Wi-Fi..."
                  value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>

              {erro && <p className="text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">{erro}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button onClick={salvar} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
