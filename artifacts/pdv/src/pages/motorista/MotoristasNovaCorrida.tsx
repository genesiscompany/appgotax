import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Car, MapPin, User, FileText, ChevronRight, Loader2, CheckCircle, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/pdv", "") + "/api";

function apiHeaders(token: string | null) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function AddressField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <AddressAutocomplete value={value} onChange={onChange} placeholder={placeholder ?? label} />
    </div>
  );
}

export default function MotoristasNovaCorrida() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [, nav] = useLocation();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    passageiro_nome: "", passageiro_telefone: "",
    origem: "", origem_lat: 0, origem_lng: 0,
    destino: "", destino_lat: 0, destino_lng: 0,
    motivo: "", tipo: "imediato", data_agendamento: "",
    funcionario_id: "", centro_custo_id: "",
    valor_estimado: "", observacoes: "",
  });
  const [success, setSuccess] = useState<any>(null);
  const [chamouMotorista, setChamouMotorista] = useState<{ qtd: number; raio: number } | null>(null);

  const chamarMotorista = useMutation({
    mutationFn: async (corridaId: number) => {
      const r = await fetch(`${API}/pdv/corporativo/corridas/${corridaId}/chamar-motorista`, {
        method: "POST", headers: apiHeaders(token),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || j.error || "Erro ao chamar motorista");
      return j;
    },
    onSuccess: (j) => {
      setChamouMotorista({ qtd: j.motoristas_chamados, raio: j.raio_km });
      toast({ title: `${j.motoristas_chamados} motorista(s) notificado(s)`,
        description: `Buscando dentro de ${j.raio_km} km. Aguarde o aceite.` });
      qc.invalidateQueries({ queryKey: ["corp-corridas"] });
    },
    onError: (e: any) => toast({ title: "Não foi possível chamar motorista",
      description: e.message, variant: "destructive" }),
  });


  const { data: funcionarios = [] } = useQuery({
    queryKey: ["corp-funcionarios"],
    queryFn: async () => {
      const r = await fetch(`${API}/pdv/corporativo/funcionarios`, { headers: apiHeaders(token) });
      return r.json();
    },
  });

  const { data: centros = [] } = useQuery({
    queryKey: ["corp-centros"],
    queryFn: async () => {
      const r = await fetch(`${API}/pdv/corporativo/centros-custo`, { headers: apiHeaders(token) });
      return r.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`${API}/pdv/corporativo/corridas`, {
        method: "POST", headers: apiHeaders(token), body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: (d) => {
      setSuccess(d);
      qc.invalidateQueries({ queryKey: ["corp-dashboard"] });
      qc.invalidateQueries({ queryKey: ["corp-corridas"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const funcSelecionado = funcionarios.find((f: any) => String(f.id) === form.funcionario_id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.origem || !form.destino || !form.passageiro_nome) {
      toast({ title: "Campos obrigatórios", description: "Preencha passageiro, origem e destino", variant: "destructive" });
      return;
    }
    mutation.mutate({
      ...form,
      funcionario_id: form.funcionario_id ? Number(form.funcionario_id) : null,
      centro_custo_id: form.centro_custo_id ? Number(form.centro_custo_id) : null,
      valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
      data_agendamento: form.tipo === "agendado" && form.data_agendamento ? form.data_agendamento : null,
    });
  };

  if (success) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Corrida Solicitada!</h2>
          {success.precisa_aprovacao ? (
            <p className="text-muted-foreground text-sm mb-6">Aguardando aprovação do gestor antes de acionar o motorista.</p>
          ) : (
            <p className="text-muted-foreground text-sm mb-6">Corrida aprovada. Clique abaixo para chamar todos os motoristas próximos.</p>
          )}

          {/* Botão de chamar motorista (só quando aprovada) */}
          {!success.precisa_aprovacao && !chamouMotorista && (
            <Button
              className="w-full h-14 text-base font-bold mb-4 shadow-lg shadow-primary/30"
              disabled={chamarMotorista.isPending}
              onClick={() => chamarMotorista.mutate(success.corrida?.id ?? success.id)}
            >
              {chamarMotorista.isPending
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Chamando motoristas...</>
                : <><Send className="w-5 h-5 mr-2" /> Chamar Motorista Agora</>}
            </Button>
          )}

          {chamouMotorista && (
            <div className="bg-green-500/10 text-green-700 border border-green-500/30 rounded-lg p-4 mb-4 text-sm">
              <div className="flex items-center justify-center gap-2 font-semibold mb-1">
                <Users className="w-4 h-4" />
                {chamouMotorista.qtd} motorista(s) notificado(s)
              </div>
              <p className="text-xs">Buscando dentro de {chamouMotorista.raio} km. Acompanhe pelo histórico.</p>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => { setSuccess(null); setChamouMotorista(null); setForm({ passageiro_nome:"",passageiro_telefone:"",origem:"",origem_lat:0,origem_lng:0,destino:"",destino_lat:0,destino_lng:0,motivo:"",tipo:"imediato",data_agendamento:"",funcionario_id:"",centro_custo_id:"",valor_estimado:"",observacoes:"" }); }}>
              Nova corrida
            </Button>
            <Button onClick={() => nav("/motorista/historico")}>Ver histórico</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Car className="w-5 h-5 text-primary" /> Solicitar Motorista
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Preencha os dados da corrida corporativa</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Passageiro */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <User className="w-4 h-4" /> Passageiro
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium">Nome do passageiro *</label>
              <Input value={form.passageiro_nome} onChange={e => setForm(f => ({ ...f, passageiro_nome: e.target.value }))}
                placeholder="Nome completo" className="h-11" required />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium">Telefone</label>
              <Input value={form.passageiro_telefone} onChange={e => setForm(f => ({ ...f, passageiro_telefone: e.target.value }))}
                placeholder="(00) 00000-0000" className="h-11" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Funcionário (opcional)</label>
              <select value={form.funcionario_id} onChange={e => {
                const f = funcionarios.find((f: any) => String(f.id) === e.target.value);
                setForm(prev => ({ ...prev, funcionario_id: e.target.value, passageiro_nome: f?.nome ?? prev.passageiro_nome, centro_custo_id: f?.centro_custo_id ? String(f.centro_custo_id) : prev.centro_custo_id }));
              }} className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="">Selecionar funcionário...</option>
                {funcionarios.map((f: any) => <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Centro de custo</label>
              <select value={form.centro_custo_id} onChange={e => setForm(f => ({ ...f, centro_custo_id: e.target.value }))}
                className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="">Selecionar centro...</option>
                {centros.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          {funcSelecionado && (
            <div className={`text-xs px-3 py-2 rounded-lg ${funcSelecionado.precisa_aprovacao ? "bg-amber-500/10 text-amber-600" : "bg-green-500/10 text-green-600"}`}>
              {funcSelecionado.precisa_aprovacao ? "⚠️ Este funcionário requer aprovação do gestor" : "✅ Funcionário com aprovação automática"}
              {funcSelecionado.limite_corrida && ` · Limite por corrida: R$ ${Number(funcSelecionado.limite_corrida).toFixed(2)}`}
            </div>
          )}
        </div>

        {/* Rota */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <MapPin className="w-4 h-4" /> Rota
          </div>
          <AddressField label="📍 Origem *" value={form.origem}
            onChange={(v) => setForm(f => ({ ...f, origem: v }))}
            placeholder="Endereço de embarque" />
          <AddressField label="🏁 Destino *" value={form.destino}
            onChange={(v) => setForm(f => ({ ...f, destino: v }))}
            placeholder="Endereço de chegada" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo</label>
              <div className="flex rounded-lg border border-input overflow-hidden">
                {["imediato", "agendado"].map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${form.tipo === t ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                    {t === "imediato" ? "⚡ Imediato" : "📅 Agendado"}
                  </button>
                ))}
              </div>
            </div>
            {form.tipo === "agendado" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Data e hora</label>
                <Input type="datetime-local" value={form.data_agendamento}
                  min={new Date().toISOString().slice(0, 16)}
                  max={new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 16)}
                  onChange={e => setForm(f => ({ ...f, data_agendamento: e.target.value }))} className="h-11" />
              </div>
            )}
          </div>
        </div>

        {/* Detalhes */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <FileText className="w-4 h-4" /> Detalhes
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium">Motivo da viagem</label>
              <Input value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                placeholder="Ex: Reunião com cliente" className="h-11" />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium">Valor estimado (R$)</label>
              <Input type="number" step="0.01" value={form.valor_estimado}
                onChange={e => setForm(f => ({ ...f, valor_estimado: e.target.value }))}
                placeholder="0,00" className="h-11" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Observações</label>
            <Input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              placeholder="Instruções adicionais para o motorista" className="h-11" />
          </div>
        </div>

        <Button type="submit" className="w-full h-14 text-base font-bold shadow-lg shadow-primary/20" disabled={mutation.isPending}>
          {mutation.isPending ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Solicitando...</> : <><Car className="w-5 h-5 mr-2" /> Solicitar Motorista <ChevronRight className="w-5 h-5 ml-1" /></>}
        </Button>
      </form>
    </div>
  );
}
