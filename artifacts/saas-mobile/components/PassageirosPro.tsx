import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

type Opcao = "todos" | "somente_mulheres";
const OPCOES: { key: Opcao; titulo: string; sub: string }[] = [
  { key: "todos", titulo: "Todos", sub: "Recebo corridas de passageiros homens e mulheres." },
  { key: "somente_mulheres", titulo: "Somente mulheres", sub: "Recebo corridas apenas de passageiras mulheres." },
];

export default function PassageirosPro({ token, valor, cor, onSalvo }: {
  token: string; valor?: string | null; cor: string; onSalvo: (v: Opcao) => void;
}) {
  const atual: Opcao = valor === "somente_mulheres" ? "somente_mulheres" : "todos";
  const [salvando, setSalvando] = useState<Opcao | null>(null);

  const salvar = async (v: Opcao) => {
    if (v === atual) return;
    setSalvando(v);
    try {
      const res = await fetch(`${API_BASE}/motorista-app/preferencias`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ aceita_passageiros: v }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { Alert.alert("Erro", data.message || "Não foi possível salvar."); return; }
      onSalvo(data.aceita_passageiros === "somente_mulheres" ? "somente_mulheres" : "todos");
    } catch {
      Alert.alert("Erro", "Sem conexão.");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <View style={st.card}>
      <Text style={st.titulo}>Aceitar passageiros</Text>
      {OPCOES.map(o => {
        const ativo = atual === o.key;
        return (
          <TouchableOpacity key={o.key} style={[st.opcao, ativo && { borderColor: cor, backgroundColor: cor + "18" }]} onPress={() => salvar(o.key)} activeOpacity={0.8}>
            <View style={{ flex: 1 }}>
              <Text style={[st.opTitulo, ativo && { color: cor }]}>{o.titulo}</Text>
              <Text style={st.opSub}>{o.sub}</Text>
            </View>
            {salvando === o.key ? <ActivityIndicator color={cor} /> : (
              <View style={[st.radio, ativo && { borderColor: cor }]}>{ativo && <View style={[st.radioIn, { backgroundColor: cor }]} />}</View>
            )}
          </TouchableOpacity>
        );
      })}
      <Text style={st.nota}>Passageiras que escolhem "viajar com motorista mulher" só são enviadas para motoristas mulheres.</Text>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: "#1A1A1A", borderRadius: 16, padding: 16, gap: 10 },
  titulo: { fontSize: 14, fontWeight: "800", color: "#FFF", marginBottom: 4 },
  opcao: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "#2A2A2A", borderRadius: 14, padding: 14 },
  opTitulo: { fontSize: 15, fontWeight: "700", color: "#FFF" },
  opSub: { fontSize: 12, color: "#888", marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#444", justifyContent: "center", alignItems: "center" },
  radioIn: { width: 10, height: 10, borderRadius: 5 },
  nota: { fontSize: 12, color: "#666", marginTop: 4, lineHeight: 17 },
});
