import React, { useMemo } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  publicKey: string;
  sandbox: boolean;
  mode?: "register" | "saved";
  cardId?: string;
  onClose: () => void;
  onToken: (token: string) => Promise<void>;
};

function tokenizerHtml(publicKey: string, sandbox: boolean, mode: "register" | "saved", cardId?: string) {
  const safeKey = JSON.stringify(publicKey).replace(/</g, "\\u003c");
  const safeCardId = JSON.stringify(cardId ?? "").replace(/</g, "\\u003c");
  const sandboxLabel = sandbox ? "Sandbox · nenhum valor real será cobrado" : "Ambiente de produção";
  if (mode === "saved") {
    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <script src="https://sdk.mercadopago.com/js/v2"></script>
  <style>
    *{box-sizing:border-box}body{margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a}
    .notice{padding:10px 12px;border-radius:10px;background:#e0f2fe;color:#0369a1;font-size:12px;margin-bottom:16px}
    label{display:block;font-size:12px;font-weight:600;margin:12px 0 6px;color:#475569}input{width:100%;height:48px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;padding:0 12px;font-size:16px;color:#0f172a}
    button{width:100%;height:52px;border:0;border-radius:14px;background:#009ee3;color:white;font-size:16px;font-weight:700;margin-top:20px}button:disabled{opacity:.55}.error{min-height:20px;margin-top:10px;color:#dc2626;font-size:13px}.secure{margin-top:14px;color:#64748b;font-size:11px;line-height:1.5;text-align:center}
  </style>
</head>
<body>
  <div class="notice">${sandboxLabel}</div>
  <form id="saved-card-form">
    <label>Código de segurança (CVV)</label>
    <input id="security-code" type="password" inputmode="numeric" autocomplete="cc-csc" maxlength="3" placeholder="•••" aria-label="CVV de 3 dígitos" />
    <button type="submit" id="submit">Continuar</button>
    <div id="error" class="error"></div>
    <div class="secure">Informe apenas os 3 dígitos do CVV. Eles são enviados diretamente ao Mercado Pago e não são salvos pela GoTaxi.</div>
  </form>
  <script>
    const send = (value) => window.ReactNativeWebView.postMessage(JSON.stringify(value));
    const errorBox = document.getElementById("error");
    const input = document.getElementById("security-code");
    const button = document.getElementById("submit");
    const cardId = ${safeCardId};
    let mp;
    try {
      mp = new MercadoPago(${safeKey}, { locale: "pt-BR" });
    } catch {
      errorBox.textContent = "Falha ao iniciar a confirmação segura.";
      send({ type: "error", message: "Falha ao iniciar a tokenização do Mercado Pago." });
    }
    document.getElementById("saved-card-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const securityCode = input.value.replace(/\\D/g, "");
      if (!cardId || securityCode.length !== 3) {
        errorBox.textContent = "Digite os 3 dígitos do CVV.";
        return;
      }
      button.disabled = true;
      button.textContent = "Tokenizando…";
      errorBox.textContent = "";
      try {
        if (!mp) throw new Error("mercado_pago_unavailable");
        const result = await mp.createCardToken({ cardId, securityCode });
        input.value = "";
        if (!result || !result.id) throw new Error("token_failed");
        send({ type: "token", token: result.id });
      } catch {
        input.value = "";
        button.disabled = false;
        button.textContent = "Continuar";
        errorBox.textContent = "Não foi possível validar o CVV. Tente novamente.";
      }
    });
  </script>
</body>
</html>`;
  }
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <script src="https://sdk.mercadopago.com/js/v2"></script>
  <style>
    *{box-sizing:border-box}body{margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a}
    .notice{padding:10px 12px;border-radius:10px;background:#e0f2fe;color:#0369a1;font-size:12px;margin-bottom:16px}
    label{display:block;font-size:12px;font-weight:600;margin:12px 0 6px;color:#475569}
    input,select,div[id^="form-checkout__"]{width:100%;height:48px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;padding:0 12px;font-size:16px;color:#0f172a}
    div[id^="form-checkout__"]{padding:13px 12px;overflow:hidden}
    div[id^="form-checkout__"] iframe{height:24px!important}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.hidden{display:none}
    button{width:100%;height:52px;border:0;border-radius:14px;background:#009ee3;color:white;font-size:16px;font-weight:700;margin-top:20px}
    button:disabled{opacity:.55}.error{min-height:20px;margin-top:10px;color:#dc2626;font-size:13px}
    .secure{margin-top:14px;color:#64748b;font-size:11px;line-height:1.5;text-align:center}
  </style>
</head>
<body>
  <div class="notice">${sandboxLabel}</div>
  <form id="form-checkout">
    <label>Número do cartão</label>
    <div id="form-checkout__cardNumber"></div>
    <div class="row">
      <div><label>Validade</label><div id="form-checkout__expirationDate"></div></div>
      <div><label>CVV</label><div id="form-checkout__securityCode"></div></div>
    </div>
    <label>Nome impresso no cartão</label>
    <input type="text" id="form-checkout__cardholderName" autocomplete="cc-name" />
    <label>E-mail</label>
    <input type="email" id="form-checkout__cardholderEmail" autocomplete="email" />
    <div class="row">
      <div><label>Documento</label><select id="form-checkout__identificationType"></select></div>
      <div><label>Número</label><input type="text" id="form-checkout__identificationNumber" inputmode="numeric" /></div>
    </div>
    <select id="form-checkout__issuer" class="hidden"></select>
    <select id="form-checkout__installments" class="hidden"></select>
    <button type="submit" id="form-checkout__submit">Salvar cartão</button>
    <div id="error" class="error"></div>
    <div class="secure">Os dados do cartão são enviados diretamente ao Mercado Pago. A GoTaxi recebe somente um token temporário e guarda apenas os identificadores seguros e os dados mascarados.</div>
  </form>
  <script>
    const send = (value) => window.ReactNativeWebView.postMessage(JSON.stringify(value));
    const errorBox = document.getElementById("error");
    try {
      const mp = new MercadoPago(${safeKey}, { locale: "pt-BR" });
      const cardForm = mp.cardForm({
        amount: "1.00",
        iframe: true,
        form: {
          id: "form-checkout",
          cardNumber: { id: "form-checkout__cardNumber", placeholder: "Número do cartão" },
          expirationDate: { id: "form-checkout__expirationDate", placeholder: "MM/AA" },
          securityCode: { id: "form-checkout__securityCode", placeholder: "CVV" },
          cardholderName: { id: "form-checkout__cardholderName" },
          issuer: { id: "form-checkout__issuer" },
          installments: { id: "form-checkout__installments" },
          identificationType: { id: "form-checkout__identificationType" },
          identificationNumber: { id: "form-checkout__identificationNumber" },
          cardholderEmail: { id: "form-checkout__cardholderEmail" }
        },
        callbacks: {
          onFormMounted: (error) => {
            if (error) {
              errorBox.textContent = "Não foi possível carregar o formulário seguro.";
              send({ type: "error", message: "Não foi possível carregar o formulário seguro do Mercado Pago." });
            }
          },
          onSubmit: (event) => {
            event.preventDefault();
            errorBox.textContent = "";
            const button = document.getElementById("form-checkout__submit");
            button.disabled = true;
            button.textContent = "Tokenizando…";
            const data = cardForm.getCardFormData();
            if (!data.token) {
              button.disabled = false;
              button.textContent = "Salvar cartão";
              errorBox.textContent = "Confira os dados do cartão e tente novamente.";
              return;
            }
            send({ type: "token", token: data.token });
          },
          onFetching: () => {
            const progress = document.createElement("progress");
            progress.setAttribute("value", "0");
            progress.setAttribute("class", "hidden");
            return () => progress.remove();
          }
        }
      });
    } catch {
      errorBox.textContent = "Falha ao iniciar o formulário seguro.";
      send({ type: "error", message: "Falha ao iniciar a tokenização do Mercado Pago." });
    }
  </script>
</body>
</html>`;
}

export default function MercadoPagoCardTokenizer({ visible, publicKey, sandbox, mode = "register", cardId, onClose, onToken }: Props) {
  const insets = useSafeAreaInsets();
  const html = useMemo(() => tokenizerHtml(publicKey, sandbox, mode, cardId), [publicKey, sandbox, mode, cardId]);

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: string; token?: string };
      if (message.type === "token" && typeof message.token === "string") {
        await onToken(message.token);
      }
    } catch {
      // Ignore malformed bridge messages. Card data is never logged.
    }
  };

  // Hiding unmounts the WebView, so its transient CVV field and token bridge are discarded.
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton} testID="close-card-tokenizer">
            <Feather name="x" size={22} color="#0F172A" />
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{mode === "saved" ? "Confirme seu cartão" : "Cartão seguro"}</Text>
            <Text style={styles.subtitle}>Powered by Mercado Pago</Text>
          </View>
          <View style={styles.closeButton} />
        </View>
        {!publicKey ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#009EE3" />
            <Text style={styles.loadingText}>Carregando formulário seguro…</Text>
          </View>
        ) : (
          <WebView
            source={{ html }}
            originWhitelist={["https://*", "about:*"]}
            javaScriptEnabled
            domStorageEnabled={false}
            thirdPartyCookiesEnabled={false}
            onMessage={handleMessage}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color="#009EE3" />
              </View>
            )}
            style={styles.webview}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  closeButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  titleWrap: { alignItems: "center" },
  title: { color: "#0F172A", fontSize: 17, fontWeight: "700" },
  subtitle: { color: "#64748B", fontSize: 11, marginTop: 2 },
  webview: { flex: 1, backgroundColor: "#F8FAFC" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: "#64748B", fontSize: 13 },
});