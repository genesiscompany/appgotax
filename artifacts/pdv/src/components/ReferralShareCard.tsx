import React, { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

const PUBLIC_DOMAIN = "https://gotaxi.com.br";

/**
 * Card de compartilhamento do link de afiliado.
 * Aparece em todos os dashboards de módulo (food, encomendas, motorista, viagens)
 * para que o parceiro possa indicar o GoTaxi facilmente.
 *
 * Mensagem padrão (definida pelo cliente):
 *   🚖 Cadastre-se no GoTaxi usando meu link e ganhe benefícios!
 *   https://gotaxi.com.br/afiliados/r/<codigo>
 */
export function ReferralShareCard() {
  const { user } = useAuth();
  const codigo = user?.codigo_referral ?? null;
  const [copiado, setCopiado] = useState(false);

  if (!codigo) return null;

  const link = `${PUBLIC_DOMAIN}/afiliados/r/${codigo}`;
  const mensagem = `🚖 Cadastre-se no GoTaxi usando meu link e ganhe benefícios!\n\n${link}`;

  const copiarMensagem = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* ignore */ }
  };

  const compartilhar = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ text: mensagem });
        return;
      } catch { /* user cancelled */ }
    }
    copiarMensagem();
  };

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
      <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
          <Share2 className="w-5 h-5 text-emerald-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Compartilhe e ganhe comissão</p>
          <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line break-all">{mensagem}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={copiarMensagem}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium transition-colors"
          >
            {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiado ? "Copiado!" : "Copiar"}
          </button>
          <button
            onClick={compartilhar}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Compartilhar
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
