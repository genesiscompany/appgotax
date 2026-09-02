import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

type CategoriaKey = "padrao" | "expressa" | "grande";

interface CategoriaValores {
  taxa_minima: string;
  distancia_km: string;
  taxa_km: string;
}

type ValoresState = Record<CategoriaKey, CategoriaValores>;

const CATEGORIAS: { key: CategoriaKey; label: string; defaults: CategoriaValores }[] = [
  { key: "padrao", label: "Entrega Padrão", defaults: { taxa_minima: "10.00", distancia_km: "3", taxa_km: "2.00" } },
  { key: "expressa", label: "Entrega Expressa", defaults: { taxa_minima: "15.00", distancia_km: "3", taxa_km: "3.00" } },
  { key: "grande", label: "Entrega Grande", defaults: { taxa_minima: "20.00", distancia_km: "3", taxa_km: "4.00" } },
];

const buildDefaults = (): ValoresState =>
  CATEGORIAS.reduce((acc, c) => ({ ...acc, [c.key]: { ...c.defaults } }), {} as ValoresState);

const cfgKey = (cat: CategoriaKey, field: keyof CategoriaValores) => `entrega_${cat}_${field}`;

export default function ValoresEntrega() {
  const { token } = useAuth();
  const [valores, setValores] = useState<ValoresState>(buildDefaults());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/configuracoes/admin`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const s = data?.sistema || {};
          setValores(prev => {
            const next = buildDefaults();
            for (const c of CATEGORIAS) {
              (Object.keys(next[c.key]) as (keyof CategoriaValores)[]).forEach(f => {
                const v = s[cfgKey(c.key, f)];
                if (v !== undefined && v !== null && v !== "") next[c.key][f] = String(v);
              });
            }
            return next;
          });
        }
      } catch (_) {}
      setLoaded(true);
    })();
  }, [token]);

  const setField = (cat: CategoriaKey, field: keyof CategoriaValores, v: string) =>
    setValores(s => ({ ...s, [cat]: { ...s[cat], [field]: v } }));

  const parseNum = (v: string) => {
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const payload: Record<string, string> = {};
    for (const c of CATEGORIAS) {
      const tm = parseNum(valores[c.key].taxa_minima);
      const dk = parseNum(valores[c.key].distancia_km);
      const tk = parseNum(valores[c.key].taxa_km);
      if (tm === null || dk === null || tk === null) {
        setMsg({ ok: false, text: `Verifique os valores em "${c.label}".` });
        setSaving(false);
        return;
      }
      payload[cfgKey(c.key, "taxa_minima")] = tm.toFixed(2);
      payload[cfgKey(c.key, "distancia_km")] = String(dk);
      payload[cfgKey(c.key, "taxa_km")] = tk.toFixed(2);
    }
    try {
      const res = await fetch(`/api/configuracoes/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sistema: payload }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Valores salvos com sucesso!" });
      } else {
        let detail = `${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) detail += ` — ${body.error}`;
        } catch (_) {
          try { detail += ` — ${(await res.text()).slice(0, 120)}`; } catch (_) {}
        }
        setMsg({ ok: false, text: `Erro ao salvar (${detail})` });
      }
    } catch (e: any) {
      setMsg({ ok: false, text: `Falha de conexão: ${e?.message || "erro"}` });
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 8000);
  };

  const inp = "w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm font-medium outline-none focus:ring-2 ring-primary/30";
  const lbl = "block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Valores de Entrega</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define a tarifa por categoria nas chamadas de <strong>Entregas</strong> e <strong>Encomendas</strong>.
          A <strong>Taxa mínima</strong> cobre a distância indicada; cada km adicional é cobrado pela <strong>Taxa por km</strong>.
        </p>
      </div>

      <div className="space-y-4">
        {CATEGORIAS.map(c => (
          <div key={c.key} className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-base font-bold text-foreground mb-4">{c.label}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Taxa mínima</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <input
                    type="number" min={0} step={0.5}
                    value={valores[c.key].taxa_minima} disabled={!loaded}
                    onChange={e => setField(c.key, "taxa_minima", e.target.value)}
                    className={inp}
                  />
                </div>
              </div>
              <div>
                <label className={lbl}>Distância (km) inclusa</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">km</span>
                  <input
                    type="number" min={0} step={0.5}
                    value={valores[c.key].distancia_km} disabled={!loaded}
                    onChange={e => setField(c.key, "distancia_km", e.target.value)}
                    className={inp}
                  />
                </div>
              </div>
              <div>
                <label className={lbl}>Taxa por km adicional</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <input
                    type="number" min={0} step={0.1}
                    value={valores[c.key].taxa_km} disabled={!loaded}
                    onChange={e => setField(c.key, "taxa_km", e.target.value)}
                    className={inp}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !loaded}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar valores"}
        </button>
        {msg && (
          <span className={`text-sm font-semibold ${msg.ok ? "text-green-500" : "text-red-500"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
