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
  paymentSource: "mercado_pago" | "wallet" | "direto";
  mercadoPagoMethod?: "pix" | "cartao" | "wallet";
  /** One-time Mercado Pago token produced from the saved card CVV; never persist it. */
  paymentToken?: string;
};

export type SavedCard = {
  cardId: string;
  lastFour: string;
  paymentMethod: string;
  brand: string;
  expirationMonth: number;
  expirationYear: number;
};

export type SavedCardConfig = {
  publicKey: string;
  sandbox: boolean;
};

export type CheckoutResponse = {
  status: "approved" | "pending" | "rejected";
  sandboxInitPoint?: string;
  initPoint?: string;
  transactionId?: number;
  balanceCents?: number;
  message?: string;
  sandbox?: boolean;
};

export type ServicePaymentStatus = {
  paymentStatus: string;
  paymentSource?: string;
  serviceStatus?: string;
  pix?: {
    copyPaste?: string;
    qrCodeBase64?: string;
    ticketUrl?: string;
  };
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
    return { receber_direto: true, mercado_pago: false, carteira: false, beta: true, sandbox: true };
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
  if (!res.ok) throw await paymentApiError(res, "Não foi possível iniciar a recarga.");
  return res.json();
}

async function paymentApiError(res: Response, fallback: string): Promise<Error> {
  const data = await res.json().catch(() => ({}));
  const messages: Record<string, string> = {
    mercado_pago_not_configured: "O Mercado Pago ainda não está disponível.",
    mercado_pago_unavailable: "O Mercado Pago não conseguiu iniciar esta operação. Confira a configuração no Super Admin.",
    unauthorized: "Sua sessão expirou. Entre novamente na conta.",
    invalid_card_token: "Os dados do cartão não puderam ser validados.",
    mercado_pago_card_unavailable: "O Mercado Pago não conseguiu salvar o cartão. Confira os dados e tente novamente.",
    customer_email_required: "Adicione um e-mail válido ao seu cadastro antes de salvar o cartão.",
    saved_card_not_found: "O cartão salvo não foi encontrado.",
    saved_card_required: "Cadastre um cartão em Perfil > Pagamento antes de continuar.",
    saved_card_in_use: "Este cartão está vinculado a uma corrida ou entrega em andamento. Troque ou remova depois da conclusão.",
    card_requires_four_digit_cvv: "Este cartão usa CVV de 4 dígitos. Cadastre um cartão Visa, Mastercard ou Elo para confirmar com 3 dígitos.",
    saved_card_profile_not_ready: "O Mercado Pago não aprovou este cartão para cobranças futuras. Tente outro cartão.",
    saved_card_not_supported_for_marketplace_seller: "Este cartão salvo não pode ser usado com a conta do motorista. Cadastre um novo cartão para este pagamento.",
    marketplace_card_token_incompatible: "O Mercado Pago não aceitou este cartão para a conta do motorista. Gere um novo token e tente novamente.",
  };
  return new Error(messages[data.error] || data.message || fallback);
}

export async function getSavedCardConfig(token: string): Promise<SavedCardConfig> {
  const res = await fetch(`${getApiBase()}/payments/cards/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await paymentApiError(res, "Não foi possível carregar a configuração do cartão.");
  return res.json();
}

export async function getSavedCard(token: string): Promise<SavedCard | null> {
  const res = await fetch(`${getApiBase()}/payments/cards`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await paymentApiError(res, "Não foi possível consultar o cartão salvo.");
  const data = await res.json();
  return data.card ?? null;
}

export async function saveCard(token: string, cardToken: string): Promise<SavedCard> {
  const res = await fetch(`${getApiBase()}/payments/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ cardToken }),
  });
  if (!res.ok) throw await paymentApiError(res, "Não foi possível salvar o cartão.");
  return res.json();
}

export async function deleteSavedCard(token: string, cardId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/payments/cards/${encodeURIComponent(cardId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await paymentApiError(res, "Não foi possível remover o cartão.");
}

export async function checkoutPayment(token: string, data: CheckoutRequest): Promise<CheckoutResponse> {
  if (data.paymentSource === "direto") {
    throw new Error("Pagamento direto não utiliza o checkout Mercado Pago");
  }
  const isWallet = data.mercadoPagoMethod === "wallet" || data.paymentSource === "wallet";
  const method =
    data.mercadoPagoMethod === "cartao"
      ? "card"
      : data.mercadoPagoMethod === "wallet"
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
      ...(data.paymentToken ? { paymentToken: data.paymentToken } : {}),
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to checkout");
  }
  return res.json();
}

export async function getServicePaymentStatus(
  token: string,
  module: "motorista" | "entrega",
  referenceId: number | string,
): Promise<ServicePaymentStatus> {
  const res = await fetch(
    `${getApiBase()}/payments/services/${module}/${encodeURIComponent(String(referenceId))}/status`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Não foi possível consultar o pagamento");
  }
  const data = await res.json();
  const pix = data.pix && typeof data.pix === "object" ? data.pix : {};
  const rawStatus = String(data.paymentStatus ?? data.payment_status ?? data.status ?? "pendente");
  const paymentStatus = rawStatus === "approved"
    ? "pago"
    : ["pending", "in_process", "processing"].includes(rawStatus)
      ? "pendente"
      : ["rejected", "cancelled", "canceled"].includes(rawStatus)
        ? "rejeitado"
      : rawStatus;
  return {
    paymentStatus,
    paymentSource: data.paymentSource ?? data.payment_source,
    serviceStatus: data.serviceStatus ?? data.service_status,
    pix: {
      copyPaste: pix.qr_code ?? pix.qrCode ?? pix["copia-e-cola"] ?? pix.copia_e_cola ?? pix.copyPaste ?? pix.copy_paste,
      qrCodeBase64: pix.qr_code_base64 ?? pix.qrCodeBase64,
      ticketUrl: pix.ticket_url ?? pix.ticketUrl,
    },
  };
}
