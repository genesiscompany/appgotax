import React, { useEffect, useState, useCallback } from "react";
import { Plus, MapPin, Clock, Bus, Plane, Truck, Edit2, Trash2, ChevronDown, ChevronRight, Calendar, Users, DollarSign } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const API = "/api/pdv/viagens";
const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Rota = { id: number; origem: string; destino: string; duracao_minutos: number | null; tipo: string; ativo: boolean };
type Horario = {
  id: number; rota_id: number; data_partida: string; hora_partida: string; hora_chegada: string | null;
  vagas_total: number; vagas_ocupadas: number; vagas_livres: number; preco: number; veiculo: string | null; ativo: boolean;
};

const TIPO_ICON: Record<string, React.ElementType> = { onibus: Bus, voo: Plane, van: Truck };
const TIPO_COR: Record<string, string> = { onibus: "#3B82F6", voo: "#8B5CF6", van: "#F97316" };

function formatDuracao(min: number | null) {
  if (!min) return "—";
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

function fmtData(d: string) { return d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—"; }
function fmtHora(h: string) { return h ? h.slice(0, 5) : "—"; }

function RotaModal({ rota, onClose, onSaved, token }: {
  rota: Rota | null; onClose: () => void; onSaved: () => void; token: string | null;
}) {
  const [form, setForm] = useState({
    origem: rota?.origem ?? "",
    destino: rota?.destino ?? "",
    duracao_minutos: rota?.duracao_minutos ? String(rota.duracao_minutos) : "",
    tipo: rota?.tipo ?? "onibus",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.origem || !form.destino) { setError("Origem e destino obrigatórios"); return; }
    setSaving(true); setError(null);
    try {
      const url = rota ? `${API}/rotas/${rota.id}` : `${API}/rotas`;
      const res = await fetch(url, {
        method: rota ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ origem: form.origem, destino: form.destino, duracao_minutos: form.duracao_minutos ? Number(form.duracao_minutos) : null, tipo: form.tipo }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      onSaved(); onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-border/60">
          <h3 className="font-bold text-foreground">{rota ? "Editar Rota" : "Nova Rota"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Origem *</label>
              <AddressAutocomplete
                value={form.origem}
                onChange={v => set("origem", v)}
                placeholder="Ex: São Paulo"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Destino *</label>
              <AddressAutocomplete
                value={form.destino}
                onChange={v => set("destino", v)}
                placeholder="Ex: Rio de Janeiro"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Duração (minutos)</label>
              <input type="number" placeholder="Ex: 240" value={form.duracao_minutos} onChange={e => set("duracao_minutos", e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Tipo</label>
              <select value={form.tipo} onChange={e => set("tipo", e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="onibus">Ônibus</option>
                <option value="voo">Voo</option>
                <option value="van">Van</option>
              </select>
            </div>
          </div>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button onClick={onClose} className="flex-1 bg-secondary text-muted-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-secondary/80 transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function HorarioModal({ rotaId, horario, onClose, onSaved, token }: {
  rotaId: number; horario: Horario | null; onClose: () => void; onSaved: () => void; token: string | null;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    data_partida: horario?.data_partida ?? today,
    hora_partida: horario?.hora_partida ? horario.hora_partida.slice(0,5) : "08:00",
    hora_chegada: horario?.hora_chegada ? horario.hora_chegada.slice(0,5) : "",
    vagas_total: horario?.vagas_total ? String(horario.vagas_total) : "40",
    preco: horario?.preco ? String(horario.preco) : "",
    veiculo: horario?.veiculo ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.preco) { setError("Preço obrigatório"); return; }
    setSaving(true); setError(null);
    try {
      const url = horario ? `${API}/horarios/${horario.id}` : `${API}/horarios`;
      const body = horario
        ? { preco: Number(form.preco), vagas_total: Number(form.vagas_total), veiculo: form.veiculo || null }
        : { rota_id: rotaId, data_partida: form.data_partida, hora_partida: form.hora_partida, hora_chegada: form.hora_chegada || null, vagas_total: Number(form.vagas_total), preco: Number(form.preco), veiculo: form.veiculo || null };
      const res = await fetch(url, {
        method: horario ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      onSaved(); onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-border/60">
          <h3 className="font-bold text-foreground">{horario ? "Editar Horário" : "Novo Horário"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">{error}</div>}
          {!horario && (
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Data de partida *</label>
              <input type="date" value={form.data_partida} onChange={e => set("data_partida", e.target.value)} min={today}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Hora partida *</label>
              <input type="time" value={form.hora_partida} onChange={e => set("hora_partida", e.target.value)} disabled={!!horario}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Hora chegada</label>
              <input type="time" value={form.hora_chegada} onChange={e => set("hora_chegada", e.target.value)} disabled={!!horario}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Vagas totais</label>
              <input type="number" min="1" value={form.vagas_total} onChange={e => set("vagas_total", e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Preço (R$) *</label>
              <input type="number" min="0" step="0.01" placeholder="0,00" value={form.preco} onChange={e => set("preco", e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Veículo / Placa</label>
            <input type="text" placeholder="Ex: ABC-1234" value={form.veiculo} onChange={e => set("veiculo", e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button onClick={onClose} className="flex-1 bg-secondary text-muted-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-secondary/80 transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function RotaCard({ rota, token, onEdit, onDelete }: {
  rota: Rota; token: string | null; onEdit: (r: Rota) => void; onDelete: (r: Rota) => void;
}) {
  const [open, setOpen] = useState(false);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loadingH, setLoadingH] = useState(false);
  const [addHorario, setAddHorario] = useState(false);
  const Icon = TIPO_ICON[rota.tipo] ?? Bus;
  const cor = TIPO_COR[rota.tipo] ?? "#3B82F6";

  const loadHorarios = useCallback(() => {
    setLoadingH(true);
    const today = new Date().toISOString().split("T")[0];
    fetch(`${API}/horarios?rota_id=${rota.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setHorarios(Array.isArray(d) ? d : []); setLoadingH(false); })
      .catch(() => setLoadingH(false));
  }, [rota.id, token]);

  const toggleOpen = () => {
    if (!open) loadHorarios();
    setOpen(o => !o);
  };

  const toggleAtivo = async (h: Horario) => {
    await fetch(`${API}/horarios/${h.id}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !h.ativo }),
    });
    loadHorarios();
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: cor + "20" }}>
          <Icon className="w-5 h-5" style={{ color: cor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">{rota.origem}</p>
            <span className="text-muted-foreground">→</span>
            <p className="font-semibold text-foreground">{rota.destino}</p>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span className="capitalize">{rota.tipo}</span>
            {rota.duracao_minutos && <><Clock className="w-3 h-3" />{formatDuracao(rota.duracao_minutos)}</>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(rota)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(rota)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={toggleOpen} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors ml-1">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 p-4 space-y-3 bg-secondary/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Horários / Viagens</p>
            <button
              onClick={() => setAddHorario(true)}
              className="flex items-center gap-1.5 text-xs text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar horário
            </button>
          </div>

          {loadingH ? (
            <div className="text-xs text-muted-foreground text-center py-3">Carregando...</div>
          ) : !horarios.length ? (
            <div className="text-xs text-muted-foreground text-center py-4">Nenhum horário cadastrado para esta rota.</div>
          ) : (
            <div className="space-y-2">
              {horarios.map(h => (
                <div key={h.id} className={cn("flex items-center gap-3 p-3 rounded-xl border bg-card text-sm", h.ativo ? "border-border/50" : "border-border/20 opacity-50")}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium text-foreground">{fmtData(h.data_partida)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">{fmtHora(h.hora_partida)}{h.hora_chegada && ` → ${fmtHora(h.hora_chegada)}`}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{h.vagas_livres}/{h.vagas_total} vagas</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{fmt(h.preco)}</span>
                      {h.veiculo && <span>{h.veiculo}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {h.vagas_livres === 0 && <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/20 rounded-full px-2 py-0.5 font-semibold">Lotado</span>}
                    <button
                      onClick={() => toggleAtivo(h)}
                      className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors", h.ativo ? "bg-green-500/15 text-green-400 border-green-500/20 hover:bg-green-500/25" : "bg-muted text-muted-foreground border-border hover:bg-secondary")}
                    >
                      {h.ativo ? "Ativo" : "Inativo"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {addHorario && (
        <HorarioModal rotaId={rota.id} horario={null} onClose={() => setAddHorario(false)} onSaved={() => { setAddHorario(false); loadHorarios(); }} token={token} />
      )}
    </div>
  );
}

export default function ViagensRotas() {
  const { token } = useAuth();
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"new" | "edit" | null>(null);
  const [editing, setEditing] = useState<Rota | null>(null);
  const [deleting, setDeleting] = useState<Rota | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/rotas`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setRotas(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(load, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    await fetch(`${API}/rotas/${deleting.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setDeleteLoading(false);
    setDeleting(null);
    load();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rotas e Horários</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie destinos e horários de viagem</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModal("new"); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Rota
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground gap-2 text-sm">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Carregando...
        </div>
      ) : !rotas.length ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2 bg-card border border-border rounded-2xl">
          <MapPin className="w-8 h-8 opacity-30" />
          <p className="text-sm">Nenhuma rota cadastrada</p>
          <button onClick={() => setModal("new")} className="text-primary text-xs hover:underline">Cadastrar primeira rota</button>
        </div>
      ) : (
        <div className="space-y-3">
          {rotas.map(r => (
            <RotaCard
              key={r.id}
              rota={r}
              token={token}
              onEdit={r => { setEditing(r); setModal("edit"); }}
              onDelete={r => setDeleting(r)}
            />
          ))}
        </div>
      )}

      {(modal === "new" || modal === "edit") && (
        <RotaModal rota={modal === "edit" ? editing : null} onClose={() => { setModal(null); setEditing(null); }} onSaved={load} token={token} />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
            <h3 className="font-bold text-foreground">Confirmar exclusão?</h3>
            <p className="text-sm text-muted-foreground">Excluir rota <strong className="text-foreground">{deleting.origem} → {deleting.destino}</strong>? Todos os horários serão removidos.</p>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 bg-destructive text-white rounded-xl py-2 text-sm font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50">
                {deleteLoading ? "Excluindo..." : "Excluir"}
              </button>
              <button onClick={() => setDeleting(null)} className="flex-1 bg-secondary text-muted-foreground rounded-xl py-2 text-sm font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
