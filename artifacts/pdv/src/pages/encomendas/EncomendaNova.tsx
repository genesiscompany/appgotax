import React, { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, ArrowLeft, User, MapPin, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const BASE = "/api";

const TIPOS_PACOTE = [
  { value: "documento", label: "📄 Documento" },
  { value: "pequeno", label: "📦 Pacote Pequeno (até 1kg)" },
  { value: "medio", label: "📦 Pacote Médio (1–5kg)" },
  { value: "grande", label: "📦 Pacote Grande (5–20kg)" },
  { value: "fragil", label: "🥚 Frágil" },
  { value: "volumoso", label: "🏗️ Volumoso" },
];
const TIPOS_SERVICO = [
  { value: "normal", label: "Normal" },
  { value: "expresso", label: "Expresso" },
  { value: "agendado", label: "Agendado" },
  { value: "moto", label: "Motoboy" },
];
const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "💵 Dinheiro" },
  { value: "pix", label: "🔑 PIX" },
  { value: "credito", label: "💳 Cartão Crédito" },
  { value: "debito", label: "💳 Cartão Débito" },
  { value: "faturado", label: "📋 Faturado" },
];

export default function EncomendaNova() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    cliente_nome: "", cliente_telefone: "", cliente_documento: "",
    origem_endereco: "", destino_endereco: "", destino_bairro: "", destino_cidade: "",
    tipo_pacote: "pequeno", peso_kg: "", valor_declarado: "", valor_frete: "",
    tipo_servico: "normal", data_previsao: "", forma_pagamento: "dinheiro",
    observacoes: "", cliente_id: "",
  });

  const { data: clientes } = useQuery({
    queryKey: ["enc-clientes"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/pdv/encomendas/clientes`, { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (body: any) => {
      const r = await fetch(`${BASE}/pdv/encomendas`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: "✅ Encomenda registrada!", description: `Código: ${data.codigo}` });
      qc.invalidateQueries({ queryKey: ["enc-dashboard"] });
      qc.invalidateQueries({ queryKey: ["enc-list"] });
      setLocation("/encomendas");
    },
    onError: () => toast({ title: "Erro ao registrar", variant: "destructive" }),
  });

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleClienteSelect = (id: string) => {
    if (!id) return setForm(p => ({ ...p, cliente_id: "" }));
    const c = clientes?.find((x: any) => String(x.id) === id);
    if (c) setForm(p => ({ ...p, cliente_id: id, cliente_nome: c.nome, cliente_telefone: c.telefone || "", cliente_documento: c.documento || "" }));
  };

  const handleSubmit = (): void => {
    if (!form.valor_frete || Number(form.valor_frete) <= 0) {
      toast({ title: "Informe o valor do frete", variant: "destructive" }); return;
    }
    if (!form.destino_cidade?.trim()) {
      toast({ title: "Informe a cidade de destino", variant: "destructive" }); return;
    }
    mutation.mutate({
      ...form,
      peso_kg: form.peso_kg ? Number(form.peso_kg) : undefined,
      valor_declarado: form.valor_declarado ? Number(form.valor_declarado) : 0,
      valor_frete: Number(form.valor_frete),
      cliente_id: form.cliente_id ? Number(form.cliente_id) : undefined,
      operador_nome: "Operador PDV",
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/encomendas")}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Package className="w-5 h-5 text-orange-500" />Nova Encomenda</h1>
          <p className="text-xs text-muted-foreground">Registrar novo envio</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" />Remetente / Destinatário</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Cliente Cadastrado (opcional)</Label>
            <Select onValueChange={handleClienteSelect}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar cliente existente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">— Novo cliente —</SelectItem>
                {clientes?.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.nome} {c.telefone ? `· ${c.telefone}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Nome *</Label><Input className="h-9" placeholder="Nome do cliente" value={form.cliente_nome} onChange={f("cliente_nome")} /></div>
            <div><Label className="text-xs">Telefone</Label><Input className="h-9" placeholder="(00) 00000-0000" value={form.cliente_telefone} onChange={f("cliente_telefone")} /></div>
          </div>
          <div><Label className="text-xs">CPF / CNPJ</Label><Input className="h-9" placeholder="000.000.000-00" value={form.cliente_documento} onChange={f("cliente_documento")} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4" />Endereços</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">Origem (endereço coleta)</Label><Input className="h-9" placeholder="Rua, número, bairro — cidade origem" value={form.origem_endereco} onChange={f("origem_endereco")} /></div>
          <div><Label className="text-xs">Destino *</Label><Input className="h-9" placeholder="Rua, número, bairro — cidade destino" value={form.destino_endereco} onChange={f("destino_endereco")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Bairro destino</Label><Input className="h-9" placeholder="Bairro" value={form.destino_bairro} onChange={f("destino_bairro")} /></div>
            <div><Label className="text-xs">Cidade destino *</Label><Input className="h-9" placeholder="Ex: Belo Horizonte" value={form.destino_cidade} onChange={f("destino_cidade")} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4" />Detalhes da Encomenda</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo de Pacote</Label>
              <Select value={form.tipo_pacote} onValueChange={v => setForm(p => ({ ...p, tipo_pacote: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_PACOTE.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo de Serviço</Label>
              <Select value={form.tipo_servico} onValueChange={v => setForm(p => ({ ...p, tipo_servico: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_SERVICO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Peso (kg)</Label><Input className="h-9" type="number" placeholder="0.5" value={form.peso_kg} onChange={f("peso_kg")} /></div>
            <div><Label className="text-xs">Valor Declarado R$</Label><Input className="h-9" type="number" placeholder="0,00" value={form.valor_declarado} onChange={f("valor_declarado")} /></div>
            <div><Label className="text-xs">Previsão Entrega</Label><Input className="h-9" type="date" value={form.data_previsao} onChange={f("data_previsao")} /></div>
          </div>
          <div><Label className="text-xs">Observações</Label><Textarea className="h-16 text-sm" placeholder="Instruções especiais, ponto de referência…" value={form.observacoes} onChange={f("observacoes")} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" />Pagamento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={v => setForm(p => ({ ...p, forma_pagamento: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS_PAGAMENTO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor do Frete R$ *</Label>
              <Input className="h-9 text-lg font-bold" type="number" placeholder="0,00" value={form.valor_frete} onChange={f("valor_frete")} />
            </div>
          </div>
          {form.valor_frete && Number(form.valor_frete) > 0 && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800">
              <p>Frete: <strong>R$ {Number(form.valor_frete).toFixed(2).replace(".", ",")}</strong></p>
              <p className="text-xs text-orange-600">Repasse GoTaxi (3%): R$ {(Number(form.valor_frete) * 0.03).toFixed(2).replace(".", ",")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3 pb-6">
        <Button variant="outline" className="flex-1" onClick={() => setLocation("/encomendas")}>Cancelar</Button>
        <Button className="flex-1 bg-orange-500 hover:bg-orange-600 text-white" onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? "Registrando…" : "✅ Registrar Encomenda"}
        </Button>
      </div>
    </div>
  );
}
