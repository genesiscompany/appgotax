import React, { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

type PixInfo = { chave_pix: string; tipo_chave_pix: string; beneficiario: string };

interface Props {
  empresaId: number;
  pedidoId?: number | null;
  modulo: string;
  colors: { card: string; border: string; text: string; textSecondary?: string; background: string };
  onClose: () => void;
}

export default function PixPagamento({ empresaId, pedidoId, modulo, colors, onClose }: Props) {
  const [pixInfo, setPixInfo] = useState<PixInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/public/empresa/${empresaId}/pix`)
      .then(r => r.json())
      .then(d => { if (d.chave_pix) setPixInfo(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [empresaId]);

  const copiarChave = async () => {
    if (!pixInfo) return;
    await Clipboard.setStringAsync(pixInfo.chave_pix);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const selecionarComprovante = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // Android 14+: partial access returns granted=false but accessPrivileges='limited'
    const denied = !perm.granted && (perm as any).accessPrivileges === "none";
    if (denied) {
      Alert.alert("Permissão necessária", "Permita acesso à galeria nas configurações do app para enviar o comprovante.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any,
      allowsEditing: false,
      quality: 0.7,
      base64: false,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setEnviando(true);
      try {
        const uri = result.assets[0].uri;
        const formData = new FormData();
        formData.append("file", { uri, name: "comprovante.jpg", type: "image/jpeg" } as any);
        formData.append("modulo", modulo);
        formData.append("pedido_id", String(pedidoId ?? ""));

        const res = await fetch(`${API_BASE}/public/pedido/comprovante`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          setEnviado(true);
        } else {
          const errBody = await res.text().catch(() => "");
          console.warn("[comprovante] server error", res.status, errBody);
          Alert.alert("Erro", "Não foi possível enviar o comprovante. Tente novamente.");
        }
      } catch (e) {
        console.warn("[comprovante] fetch error", e);
        Alert.alert("Erro", "Falha de conexão ao enviar comprovante.");
      } finally {
        setEnviando(false);
      }
    }
  };

  return (
    <View style={[sty.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={sty.checkCircle}>
        <Feather name="check" size={28} color="#fff" />
      </View>

      <Text style={[sty.titulo, { color: colors.text }]}>Pedido realizado!</Text>
      <Text style={[sty.sub, { color: colors.textSecondary ?? "#64748B" }]}>
        Efetue o pagamento via PIX para confirmar seu pedido.
      </Text>

      <View style={sty.pixBox}>
        <View style={sty.pixHeader}>
          <Feather name="zap" size={16} color="#16A34A" />
          <Text style={sty.pixHeaderTxt}>Chave PIX do estabelecimento</Text>
        </View>

        {loading && <ActivityIndicator color="#16A34A" style={{ marginVertical: 8 }} />}

        {!loading && pixInfo && (
          <>
            <Text style={sty.pixTipo}>
              {pixInfo.tipo_chave_pix?.toUpperCase() || "CHAVE"}
            </Text>
            <Text style={sty.pixChave} selectable>{pixInfo.chave_pix}</Text>
            <Text style={sty.pixBenef}>Beneficiário: {pixInfo.beneficiario}</Text>
            <Pressable
              style={[sty.copiarBtn, { backgroundColor: copiado ? "#16A34A" : "#22C55E" }]}
              onPress={copiarChave}
            >
              <Feather name={copiado ? "check" : "copy"} size={14} color="#fff" />
              <Text style={sty.copiarTxt}>{copiado ? "Chave copiada!" : "Copiar chave PIX"}</Text>
            </Pressable>
          </>
        )}

        {!loading && !pixInfo && (
          <Text style={sty.semPix}>
            Chave PIX não cadastrada. Entre em contato com o estabelecimento.
          </Text>
        )}
      </View>

      {!enviado ? (
        <Pressable
          style={[sty.comprovanteBtn, { borderColor: colors.border }]}
          onPress={selecionarComprovante}
          disabled={enviando}
        >
          {enviando
            ? <ActivityIndicator size="small" color="#3B82F6" />
            : <Feather name="upload" size={15} color="#3B82F6" />
          }
          <Text style={sty.comprovanteTxt}>
            {enviando ? "Enviando comprovante..." : "Enviar comprovante de pagamento"}
          </Text>
        </Pressable>
      ) : (
        <View style={sty.enviadoBox}>
          <Feather name="check-circle" size={15} color="#2563EB" />
          <Text style={sty.enviadoTxt}>Comprovante enviado com sucesso!</Text>
        </View>
      )}

      <Pressable style={[sty.fecharBtn, { borderColor: colors.border }]} onPress={onClose}>
        <Text style={{ color: colors.textSecondary ?? "#64748B", fontSize: 14 }}>Fechar</Text>
      </Pressable>
    </View>
  );
}

const sty = StyleSheet.create({
  card: {
    borderRadius: 20, borderWidth: 1, padding: 24,
    alignItems: "center", width: "100%", gap: 12,
  },
  checkCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#10B981",
    alignItems: "center", justifyContent: "center",
  },
  titulo: { fontSize: 20, fontWeight: "700" },
  sub: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  pixBox: {
    width: "100%", borderRadius: 12,
    backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#86EFAC",
    padding: 16, gap: 6,
  },
  pixHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  pixHeaderTxt: { fontWeight: "700", fontSize: 14, color: "#16A34A" },
  pixTipo: {
    fontSize: 10, color: "#64748B", fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1.2, marginTop: 4,
  },
  pixChave: { fontSize: 15, fontWeight: "700", color: "#15803D", letterSpacing: 0.3 },
  pixBenef: { fontSize: 12, color: "#64748B" },
  copiarBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 8, paddingVertical: 9, paddingHorizontal: 18,
    marginTop: 6, alignSelf: "center",
  },
  copiarTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  semPix: { fontSize: 13, color: "#64748B", textAlign: "center", marginTop: 4 },
  comprovanteBtn: {
    width: "100%", flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, padding: 13,
  },
  comprovanteTxt: { fontSize: 14, fontWeight: "600", color: "#3B82F6" },
  enviadoBox: {
    width: "100%", flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 10, padding: 13,
  },
  enviadoTxt: { color: "#2563EB", fontSize: 13, fontWeight: "600" },
  fecharBtn: {
    borderWidth: 1, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 32, marginTop: 4,
  },
});
