import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";

export type Genero = "feminino" | "masculino";

const OPCOES: { key: Genero; label: string; icon: string }[] = [
  { key: "feminino", label: "Feminino", icon: "👩" },
  { key: "masculino", label: "Masculino", icon: "👨" },
];

export function GeneroOpcoes({ valor, onChange, cor, escuro = false }: {
  valor: Genero | null; onChange: (g: Genero) => void; cor: string; escuro?: boolean;
}) {
  return (
    <View style={st.row}>
      {OPCOES.map(o => {
        const ativo = valor === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            activeOpacity={0.8}
            style={[
              st.opcao,
              { backgroundColor: escuro ? "#1A1A1A" : "#F8FAFC", borderColor: escuro ? "#2A2A2A" : "#E2E8F0" },
              ativo && { borderColor: cor, backgroundColor: cor + "18" },
            ]}
          >
            <Text style={st.opcaoIcon}>{o.icon}</Text>
            <Text style={[st.opcaoTxt, { color: ativo ? cor : escuro ? "#AAA" : "#334155" }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function GeneroObrigatorio({ visible, onSalvar, cor = "#22C55E", escuro = false }: {
  visible: boolean;
  onSalvar: (g: Genero) => Promise<string | null>;
  cor?: string;
  escuro?: boolean;
}) {
  const [sel, setSel] = useState<Genero | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    if (!sel) { setErro("Escolha Feminino ou Masculino."); return; }
    setSalvando(true);
    setErro(null);
    const e = await onSalvar(sel);
    setSalvando(false);
    if (e) setErro(e);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={st.overlay}>
        <View style={[st.card, { backgroundColor: escuro ? "#111" : "#FFF" }]}>
          <Text style={[st.titulo, { color: escuro ? "#FFF" : "#0F172A" }]}>Atualize seu cadastro</Text>
          <Text style={[st.sub, { color: escuro ? "#999" : "#64748B" }]}>
            Para continuar, informe seu gênero. Ele é usado na opção de viagem com motorista mulher.
            Depois de salvo, só o suporte pode alterar.
          </Text>
          <GeneroOpcoes valor={sel} onChange={setSel} cor={cor} escuro={escuro} />
          {!!erro && <Text style={st.erro}>{erro}</Text>}
          <TouchableOpacity style={[st.btn, { backgroundColor: cor, opacity: sel ? 1 : 0.5 }]} onPress={salvar} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={st.btnTxt}>Salvar e continuar</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  opcao: { flex: 1, borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: "center", gap: 4 },
  opcaoIcon: { fontSize: 26 },
  opcaoTxt: { fontSize: 14, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
  card: { borderRadius: 20, padding: 22, gap: 14 },
  titulo: { fontSize: 20, fontWeight: "800" },
  sub: { fontSize: 14, lineHeight: 20 },
  erro: { color: "#EF4444", fontSize: 13 },
  btn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  btnTxt: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});
