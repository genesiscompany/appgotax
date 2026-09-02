import React, { useState } from "react";
import { Settings, Package, DollarSign, Truck, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function EncomendaConfig() {
  const { toast } = useToast();
  const [config, setConfig] = useState({
    nome_empresa_envio: "GoTaxi Encomendas",
    telefone_contato: "",
    dias_prazo_normal: "3",
    dias_prazo_expresso: "1",
    preco_base_doc: "10",
    preco_base_pequeno: "20",
    preco_base_medio: "40",
    preco_base_grande: "80",
    preco_base_fragil: "50",
    exibir_taxa_gotaxi: true,
    notificar_whatsapp: false,
    mensagem_coleta: "Sua encomenda foi coletada! Código: {codigo}",
    mensagem_entrega: "Sua encomenda {codigo} foi entregue com sucesso!",
  });

  const handleSave = () => {
    toast({ title: "✅ Configurações salvas!", description: "As configurações do módulo foram atualizadas." });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6 text-orange-500" />Configurações de Encomendas</h1>
        <p className="text-muted-foreground text-sm">Personalize o módulo de encomendas</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4" />Informações do Serviço</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">Nome do Serviço / Empresa</Label>
            <Input className="h-9" value={config.nome_empresa_envio} onChange={e => setConfig(p => ({ ...p, nome_empresa_envio: e.target.value }))} />
          </div>
          <div><Label className="text-xs">Telefone de Contato</Label>
            <Input className="h-9" placeholder="(00) 00000-0000" value={config.telefone_contato} onChange={e => setConfig(p => ({ ...p, telefone_contato: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Prazo Normal (dias)</Label>
              <Input className="h-9" type="number" value={config.dias_prazo_normal} onChange={e => setConfig(p => ({ ...p, dias_prazo_normal: e.target.value }))} />
            </div>
            <div><Label className="text-xs">Prazo Expresso (dias)</Label>
              <Input className="h-9" type="number" value={config.dias_prazo_expresso} onChange={e => setConfig(p => ({ ...p, dias_prazo_expresso: e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" />Tabela de Preços Base (R$)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Configure os preços iniciais sugeridos para cada tipo de pacote</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">📄 Documento</Label>
              <Input className="h-9" type="number" value={config.preco_base_doc} onChange={e => setConfig(p => ({ ...p, preco_base_doc: e.target.value }))} />
            </div>
            <div><Label className="text-xs">📦 Pacote Pequeno</Label>
              <Input className="h-9" type="number" value={config.preco_base_pequeno} onChange={e => setConfig(p => ({ ...p, preco_base_pequeno: e.target.value }))} />
            </div>
            <div><Label className="text-xs">📦 Pacote Médio</Label>
              <Input className="h-9" type="number" value={config.preco_base_medio} onChange={e => setConfig(p => ({ ...p, preco_base_medio: e.target.value }))} />
            </div>
            <div><Label className="text-xs">📦 Pacote Grande</Label>
              <Input className="h-9" type="number" value={config.preco_base_grande} onChange={e => setConfig(p => ({ ...p, preco_base_grande: e.target.value }))} />
            </div>
            <div><Label className="text-xs">🥚 Frágil</Label>
              <Input className="h-9" type="number" value={config.preco_base_fragil} onChange={e => setConfig(p => ({ ...p, preco_base_fragil: e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Truck className="w-4 h-4" />Repasse GoTaxi</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-orange-800">
              <p className="font-semibold mb-1">Comissão de 3% sobre faturamento de encomendas entregues</p>
              <p>O repasse é calculado semanalmente e deve ser efetuado via PIX até segunda-feira às 18h. O não pagamento bloqueia automaticamente o acesso ao sistema.</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Exibir taxa GoTaxi no cupom</p>
              <p className="text-xs text-muted-foreground">Mostra a comissão no comprovante do cliente</p>
            </div>
            <Switch checked={config.exibir_taxa_gotaxi} onCheckedChange={v => setConfig(p => ({ ...p, exibir_taxa_gotaxi: v }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Mensagens de Notificação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium">Notificar via WhatsApp</p>
              <p className="text-xs text-muted-foreground">Enviar SMS/WhatsApp ao atualizar status (em breve)</p>
            </div>
            <Switch checked={config.notificar_whatsapp} onCheckedChange={v => setConfig(p => ({ ...p, notificar_whatsapp: v }))} disabled />
          </div>
          <div><Label className="text-xs">Mensagem de Coleta</Label>
            <Input className="h-9 text-sm" value={config.mensagem_coleta} onChange={e => setConfig(p => ({ ...p, mensagem_coleta: e.target.value }))} />
            <p className="text-xs text-muted-foreground mt-1">Use {"{codigo}"} para inserir o código da encomenda</p>
          </div>
          <div><Label className="text-xs">Mensagem de Entrega</Label>
            <Input className="h-9 text-sm" value={config.mensagem_entrega} onChange={e => setConfig(p => ({ ...p, mensagem_entrega: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white" onClick={handleSave}>
        💾 Salvar Configurações
      </Button>
    </div>
  );
}
