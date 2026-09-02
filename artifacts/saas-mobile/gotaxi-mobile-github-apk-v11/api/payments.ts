export type PaymentOptions = {
  receber_direto: boolean;
  mercado_pago: boolean;
  carteira: boolean;
  beta: boolean;
  sandbox: boolean;
};

export type WalletData = {
  balanceCents: number;
  currency: string;
};

export type WalletLedgerItem = {
  id: number;
  amountCents: number;
  type: "topup" | "payment";
  description: string;
  createdAt: string;
};

export type CheckoutRequest = {
  module: "food" | "ecommerce" | "motorista" | "entrega" | "servicos" | "passagens";
  referenceId: number | string;
  paymentSource: "mercado_pago" | "carteira" | "direto";
  mercadoPagoMethod?: "pix" | "cartao" | "carteira";
};

export type CheckoutResponse = {
  status: "approved" | "pending" | "rejected";
  sandboxInitPoint?: string;
  initPoint?: string;
  transactionId?: number;
  balanceCents?: number;
  message?: string;
};

const getApiBase = () => {
  return process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
    : "http://localhost:8080/api";
};

export async function getPaymentOptions(empresaId: number | string, token?: string): Promise<PaymentOptions> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getApiBase()}/payments/options/${empresaId}`, { headers });
  if (!res.ok) {
    return { receber_direto: true, mercado_pago: false, carteira: true, beta: true, sandbox: true };
  }
  const data = await res.json();
  return {
    receber_direto: data.directPayment !== false,
    mercado_pago: data.mercadoPago === true,
    carteira: data.wallet !== false,
    beta: data.beta === true,
    sandbox: data.sandbox !== false,
  };
}

export async function getWallet(token: string): Promise<WalletData> {
  const res = await fetch(`${getApiBase()}/payments/wallet`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch wallet");
  const data = await res.json();
  return { balanceCents: Number(data.balanceCents ?? 0), currency: "BRL" };
}

export async function getWalletLedger(token: string): Promise<WalletLedgerItem[]> {
  const res = await fetch(`${getApiBase()}/payments/wallet/ledger`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch ledger");
  const data = await res.json();
  return (Array.isArray(data.entries) ? data.entries : []).map((entry: any) => ({
    id: Number(entry.id),
    amountCents: Number(entry.amount_cents ?? 0),
    type: entry.direction === "credit" ? "topup" : "payment",
    description: String(entry.description ?? "Movimentação da carteira"),
    createdAt: String(entry.created_at ?? new Date().toISOString()),
  }));
}

export async function topupWallet(token: string, amountCents: number): Promise<CheckoutResponse> {
  const res = await fetch(`${getApiBase()}/payments/wallet/topup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ amountCents })
  });
  if (!res.ok) throw new Error("Failed to topup wallet");
  return res.json();
}

export async function checkoutPayment(token: string, data: CheckoutRequest): Promise<CheckoutResponse> {
  if (data.paymentSource === "direto") {
    throw new Error("Pagamento direto não utiliza o checkout Mercado Pago");
  }
  const isWallet = data.mercadoPagoMethod === "carteira" || data.paymentSource === "carteira";
  const method =
    data.mercadoPagoMethod === "cartao"
      ? "card"
      : data.mercadoPagoMethod === "carteira"
        ? "wallet"
        : "pix";
  const res = await fetch(`${getApiBase()}/payments/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      module: data.module,
      referenceId: String(data.referenceId),
      paymentSource: isWallet ? "wallet" : "mercado_pago",
      mercadoPagoMethod: method,
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to checkout");
  }
  return res.json();
}
