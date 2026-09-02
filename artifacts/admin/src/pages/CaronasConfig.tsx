import { useState, useEffect } from "react";
import { useAuth, API, authHeaders } from "@/lib/auth";
import { Save, CheckCircle, Car, Info } from "lucide-react";

export default function CaronasConfig() {
  const { token } = useAuth();
  const hdrs = { ...authHeaders(token), "Content-Type": "application/json" };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sistema, setSistema] = useState<Record<string, string>>({
    caronas_valor_por_km: "0.80",
    caronas_taxa_plataforma: "5",
  });

  useEffect(() => {
    fetch(`${API}/configuracoes/admin`, { headers: hdrs })
      .then(r => r.json())
      .then(d => {
        if (d.sistema) {
          setSistema(prev => ({
            ...prev,
            caronas_valor_por_km: d.sistema.caronas_valor_por_km ?? prev.caronas_valor_por_km,
            caronas_taxa_plataforma: d.sistema.caronas_taxa_plataforma ?? prev.caronas_taxa_plataforma,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`${API}/configuracoes/admin`, {
        method: "PATCH",
        headers: hdrs,
        body: JSON.stringify({
          sistema: {
            caronas_valor_por_km: sistema.caronas_valor_por_km,
            caronas_taxa_plataforma: sistema.caronas_taxa_plataforma,
          },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
      Carregando configurações...
    </div>
  );

  const valor = Number(sistema.caronas_valor_por_km || 0);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Car className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Viagens Compartilhadas</h1>
            <p className="text-sm text-muted-foreground">Configuração global do tipo BlaBlaCar</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Salvo!" : saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Tarifa sugerida por quilômetro</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Define o valor sugerido (R$/km) que o app calcula automaticamente para o motorista quando ele cadastra uma viagem compartilhada. O motorista pode ajustar o valor final.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">Valor por km (R$)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
              <input
                type="number" step="0.01" min="0"
                value={sistema.caronas_valor_por_km}
                onChange={e => setSistema(s => ({ ...s, caronas_valor_por_km: e.target.value }))}
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="0.80"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ex.: viagem de 100 km → R$ {(valor * 100).toFixed(2)} por passageiro.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Taxa da plataforma (%)</label>
            <input
              type="number" step="0.1" min="0" max="100"
              value={sistema.caronas_taxa_plataforma}
              onChange={e => setSistema(s => ({ ...s, caronas_taxa_plataforma: e.target.value }))}
              className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="5"
            />
            <p className="text-xs text-muted-foreground mt-1">% que a plataforma fica em cada reserva (informativo).</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 flex gap-3">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <strong>Como funciona:</strong> o parceiro informa origem e destino no app, o sistema calcula a distância (Google Maps ou OpenStreetMap) e sugere o valor por vaga (km × tarifa definida aqui).
        </div>
      </div>
    </div>
  );
}
