import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { getPaymentOptions, type PaymentOptions } from "@/api/payments";

type Props = {
  empresaId: number | string | null;
  token?: string;
  colors: any;
  accentColor: string;
  // For 'direto'
  directMethods: { id: string; label: string; icon: string; color: string; desc?: string }[];
  
  selectedSource: "direto" | "mercado_pago" | null;
  onSourceSelect: (source: "direto" | "mercado_pago") => void;
  
  selectedMethod: string | null;
  onMethodSelect: (method: string) => void;

  walletBalanceCents?: number;
  hideDisabledBeta?: boolean;
};

const MP_METHODS = [
  { id: "pix", label: "Pix", icon: "zap", color: "#00B1EA" },
  { id: "cartao", label: "Cartão", icon: "credit-card", color: "#00B1EA" },
  { id: "carteira", label: "Carteira GoTaxi", icon: "briefcase", color: "#00B1EA" },
];

export default function PaymentSelector({
  empresaId, token, colors, accentColor, directMethods,
  selectedSource, onSourceSelect, selectedMethod, onMethodSelect,
  walletBalanceCents = 0, hideDisabledBeta = false
}: Props) {
  const [options, setOptions] = useState<PaymentOptions | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    setLoading(true);
    getPaymentOptions(empresaId, token).then(opts => {
      setOptions(opts);
      if (!selectedSource) {
        if (opts.receber_direto) onSourceSelect("direto");
        else if (opts.mercado_pago) onSourceSelect("mercado_pago");
      }
    }).catch(() => {
      // fallback
      setOptions({ receber_direto: true, mercado_pago: false, carteira: true, beta: true, sandbox: true });
      if (!selectedSource) onSourceSelect("direto");
    }).finally(() => setLoading(false));
  }, [empresaId]);

  if (loading || !options) {
    return (
      <View style={{ padding: 20, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={accentColor} />
      </View>
    );
  }

  const handleSource = (src: "direto" | "mercado_pago") => {
    onSourceSelect(src);
    onMethodSelect(""); // reset method
  };

  const renderMethod = (m: any, isMP: boolean) => {
    const isSelected = selectedMethod === m.id;
    let label = m.label;
    if (m.id === "carteira" && isMP) {
      label += ` (R$ ${(walletBalanceCents / 100).toFixed(2)})`;
    }
    
    return (
      <Pressable
        key={m.id}
        testID={`payment-method-${m.id}`}
        onPress={() => onMethodSelect(m.id)}
        style={[
          styles.methodOption,
          {
            backgroundColor: isSelected ? m.color + "15" : colors.card,
            borderColor: isSelected ? m.color : colors.border,
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
      >
        <View style={[styles.methodIconBox, { backgroundColor: m.color + "20" }]}>
          <Feather name={m.icon as any} size={18} color={m.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontFamily: isSelected ? "Inter_700Bold" : "Inter_500Medium", fontSize: 14 }}>
            {label}
          </Text>
          {m.desc && <Text style={{ color: colors.textMuted, fontSize: 12 }}>{m.desc}</Text>}
        </View>
        {isSelected && (
          <View style={[styles.methodCheck, { backgroundColor: m.color }]}>
            <Feather name="check" size={12} color="#fff" />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 16 }}>
      {/* Top level choices */}
      <View style={{ gap: 10 }}>
        {options.receber_direto && (
          <Pressable
            testID="source-direto"
            onPress={() => handleSource("direto")}
            style={[
              styles.sourceCard,
              { borderColor: selectedSource === "direto" ? accentColor : colors.border, backgroundColor: selectedSource === "direto" ? accentColor + "10" : colors.card }
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Pagamento Direto</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Pague diretamente ao estabelecimento ou motorista</Text>
            </View>
            <View style={[styles.radio, { borderColor: selectedSource === "direto" ? accentColor : colors.border }]}>
              {selectedSource === "direto" && <View style={[styles.radioDot, { backgroundColor: accentColor }]} />}
            </View>
          </Pressable>
        )}

        {(options.mercado_pago || !hideDisabledBeta) && (
          <Pressable
            testID="source-mp"
            onPress={() => options.mercado_pago && handleSource("mercado_pago")}
            style={[
              styles.sourceCard,
              { 
                borderColor: selectedSource === "mercado_pago" ? "#00B1EA" : colors.border, 
                backgroundColor: selectedSource === "mercado_pago" ? "#00B1EA10" : colors.card,
                opacity: options.mercado_pago ? 1 : 0.5 
              }
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Mercado Pago</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {options.mercado_pago ? "Pague pelo app de forma segura" : "Beta indisponível para esta modalidade/parceiro"}
              </Text>
            </View>
            <View style={[styles.radio, { borderColor: selectedSource === "mercado_pago" ? "#00B1EA" : colors.border }]}>
              {selectedSource === "mercado_pago" && <View style={[styles.radioDot, { backgroundColor: "#00B1EA" }]} />}
            </View>
          </Pressable>
        )}
      </View>

      {/* Method choices based on source */}
      {selectedSource === "direto" && directMethods.length > 0 && (
        <View style={{ gap: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border }}>
          {directMethods.map(m => renderMethod(m, false))}
        </View>
      )}

      {selectedSource === "mercado_pago" && (
        <View style={{ gap: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border }}>
          {MP_METHODS.map(m => renderMethod(m, true))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sourceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  methodOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    gap: 12,
  },
  methodIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  methodCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
