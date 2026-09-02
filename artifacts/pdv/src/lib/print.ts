export interface PrintItem {
  nome: string;
  quantidade: number;
  precoUnitario: number;
  total: number;
}

export interface PrintData {
  empresaNome: string;
  pedidoId: number | string;
  tipo: string;
  clienteNome: string;
  clienteEndereco?: string;
  mesa?: string;
  itens: PrintItem[];
  total: number;
  taxaEntrega?: number;
  formaPagamento: string;
  observacoes?: string;
  criadoEm: string;
}

export function printCupom(data: PrintData) {
  const tipo = { delivery: "Delivery", retirar: "Retirada", local: "Consumo Local", mesa: `Mesa ${data.mesa || ""}` }[data.tipo] ?? data.tipo;

  const itensHTML = data.itens.map(item => `
    <tr>
      <td>${item.quantidade}x ${item.nome}</td>
      <td style="text-align:right">R$ ${item.total.toFixed(2)}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Cupom #${data.pedidoId}</title>
<style>
  @page { size: 80mm auto; margin: 4mm 3mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; width: 72mm; margin: 0 auto; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .large { font-size: 14px; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .total-row td { font-weight: bold; font-size: 13px; padding-top: 3px; }
  .header { margin-bottom: 6px; }
  .footer { margin-top: 8px; font-size: 10px; }
</style>
</head>
<body>
  <div class="header center">
    <div class="bold large">${data.empresaNome.toUpperCase()}</div>
    <div>─────────────────────</div>
    <div class="bold">PEDIDO #${data.pedidoId}</div>
    <div>${new Date(data.criadoEm).toLocaleString("pt-BR")}</div>
    <div class="bold" style="margin-top:2px">${tipo}</div>
  </div>

  <div class="divider"></div>
  <div><b>Cliente:</b> ${data.clienteNome}</div>
  ${data.clienteEndereco ? `<div><b>Endereço:</b> ${data.clienteEndereco}</div>` : ""}
  ${data.mesa ? `<div><b>Mesa:</b> ${data.mesa}</div>` : ""}
  <div class="divider"></div>

  <table>
    <tr><td colspan="2" class="bold">ITENS DO PEDIDO</td></tr>
    ${itensHTML}
    <tr><td colspan="2"><div class="divider" style="margin:3px 0"></div></td></tr>
    ${data.taxaEntrega != null && data.taxaEntrega > 0 ? `
    <tr>
      <td>Subtotal</td>
      <td style="text-align:right">R$ ${(data.total - data.taxaEntrega).toFixed(2)}</td>
    </tr>
    <tr>
      <td>Taxa de entrega</td>
      <td style="text-align:right">R$ ${data.taxaEntrega.toFixed(2)}</td>
    </tr>` : ""}
    <tr class="total-row">
      <td>TOTAL</td>
      <td style="text-align:right">R$ ${data.total.toFixed(2)}</td>
    </tr>
  </table>

  <div class="divider"></div>
  <div><b>Pagamento:</b> ${data.formaPagamento}</div>
  ${data.observacoes ? `<div><b>Obs:</b> ${data.observacoes}</div>` : ""}

  <div class="footer center">
    <div class="divider"></div>
    <div>Obrigado pela preferência!</div>
    <div>Powered by GoTaxi</div>
  </div>
<script>window.onload = () => { window.print(); setTimeout(() => window.close(), 800); }</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=320,height=600,toolbar=0,menubar=0");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
