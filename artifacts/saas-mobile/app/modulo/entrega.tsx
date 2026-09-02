import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, useColorScheme, Platform, Modal, TextInput, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";

const MOD_COLOR = Colors.modules.entrega;

const DEMO_ENTREGAS = [
  { id: 1, remetenteNome: "Loja Alfa", destinatarioNome: "Carlos Mendes", enderecoColeta: "Av. Industrial 100", enderecoEntrega: "Rua das Flores 45", status: "em_transito", entregadorNome: "Marcos", valor: 25.00 },
  { id: 2, remetenteNome: "Tech Store", destinatarioNome: "Ana Paula", enderecoColeta: "Shopping Mega, Loja 42", enderecoEntrega: "Rua Nova 200", status: "aguardando", entregadorNome: null, valor: 15.00 },
  { id: 3, remetenteNome: "Farmácia Saúde", destinatarioNome: "João Pedro", enderecoColeta: "Rua Central 1", enderecoEntrega: "Av. B 300", status: "entregue", entregadorNome: "Lucas", valor: 8.50 },
];

const STATUS_ENT: Record<string, { label: string; color: string; icone: keyof typeof Feather.glyphMap }> = {
  aguardando: { label: "Aguardando", color: "#F59E0B", icone: "clock" },
  coletado: { label: "Coletado", color: "#3B82F6", icone: "package" },
  em_transito: { label: "Em trânsito", color: "#8B5CF6", icone: "truck" },
  entregue: { label: "Entregue", color: "#10B981", icone: "check-circle" },
  devolvido: { label: "Devolvido", color: "#F97316", icone: "corner-up-left" },
  cancelado: { label: "Cancelado", color: "#EF4444", icone: "x-circle" },
};

export default function EntregaScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const [entregas, setEntregas] = useState(DEMO_ENTREGAS);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remetente, setRemetente] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [endColeta, setEndColeta] = useState("");
  const [endEntrega, setEndEntrega] = useState("");
  const [valor, setValor] = useState("");

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const handleAdd = async () => {
    if (!remetente || !destinatario || !endColeta || !endEntrega) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios"); return;
    }
    setLoading(true);
    const nova = { id: Date.now(), remetenteNome: remetente, destinatarioNome: destinatario, enderecoColeta: endColeta, enderecoEntrega: endEntrega, status: "aguardando", entregadorNome: null, valor: valor ? parseFloat(valor) : 0 };
    setEntregas(prev => [nova, ...prev]);
    setLoading(false);
    setModalVisible(false);
    setRemetente(""); setDestinatario(""); setEndColeta(""); setEndEntrega(""); setValor("");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.text} /></Pressable>
        <View style={styles.headerTitle}>
          <View style={[styles.headerIcon, { backgroundColor: MOD_COLOR + "20" }]}><Feather name="package" size={18} color={MOD_COLOR} /></View>
          <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Entrega</Text>
        </View>
        <Pressable style={[styles.addBtn, { backgroundColor: MOD_COLOR }]} onPress={() => setModalVisible(true)}>
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 10 }}>
          {Object.entries(STATUS_ENT).map(([key, s]) => {
            const count = entregas.filter(e => e.status === key).length;
            return (
              <View key={key} style={[styles.statusChip, { backgroundColor: s.color + "20", borderColor: s.color + "40" }]}>
                <Feather name={s.icone} size={13} color={s.color} />
                <Text style={[styles.statusChipText, { color: s.color, fontFamily: "Inter_500Medium" }]}>{s.label}: {count}</Text>
              </View>
            );
          })}
        </ScrollView>

        {entregas.map(entrega => {
          const s = STATUS_ENT[entrega.status] || { label: entrega.status, color: "#64748B", icone: "package" as const };
          return (
            <View key={entrega.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.trackIcon, { backgroundColor: s.color + "20" }]}>
                  <Feather name={s.icone} size={18} color={s.color} />
                </View>
                <View style={styles.cardHeaderInfo}>
                  <Text style={[styles.entregaId, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>#{entrega.id}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: s.color + "20" }]}>
                    <Text style={[styles.statusText, { color: s.color, fontFamily: "Inter_500Medium" }]}>{s.label}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.addresses}>
                <View style={styles.addrRow}>
                  <View style={[styles.addrDot, { backgroundColor: "#10B981" }]} />
                  <View style={styles.addrInfo}>
                    <Text style={[styles.addrLabel, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Remetente</Text>
                    <Text style={[styles.addrName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{entrega.remetenteNome}</Text>
                    <Text style={[styles.addrText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{entrega.enderecoColeta}</Text>
                  </View>
                </View>
                <View style={[styles.addrLine, { backgroundColor: colors.border }]} />
                <View style={styles.addrRow}>
                  <View style={[styles.addrDot, { backgroundColor: MOD_COLOR }]} />
                  <View style={styles.addrInfo}>
                    <Text style={[styles.addrLabel, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Destinatário</Text>
                    <Text style={[styles.addrName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{entrega.destinatarioNome}</Text>
                    <Text style={[styles.addrText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{entrega.enderecoEntrega}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                {entrega.entregadorNome && (
                  <View style={styles.entregadorRow}>
                    <Feather name="user" size={13} color={colors.textMuted} />
                    <Text style={[styles.entregadorText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{entrega.entregadorNome}</Text>
                  </View>
                )}
                <Text style={[styles.valor, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>R$ {entrega.valor.toFixed(2)}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Nova Entrega</Text>
              <Pressable onPress={() => setModalVisible(false)}><Feather name="x" size={22} color={colors.textSecondary} /></Pressable>
            </View>
            {[
              { p: "Remetente", v: remetente, s: setRemetente, i: "send" as const },
              { p: "Destinatário", v: destinatario, s: setDestinatario, i: "user" as const },
              { p: "Endereço de coleta", v: endColeta, s: setEndColeta, i: "circle" as const },
              { p: "Endereço de entrega", v: endEntrega, s: setEndEntrega, i: "map-pin" as const },
              { p: "Valor do frete (R$)", v: valor, s: setValor, i: "dollar-sign" as const, k: "decimal-pad" as const },
            ].map(f => (
              <View key={f.p} style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                <Feather name={f.i} size={16} color={colors.textMuted} />
                <TextInput style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]} placeholder={f.p} placeholderTextColor={colors.textMuted} value={f.v} onChangeText={f.s} keyboardType={(f as any).k || "default"} />
              </View>
            ))}
            <Pressable style={[styles.saveBtn, { backgroundColor: MOD_COLOR }]} onPress={handleAdd} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnText, { fontFamily: "Inter_600SemiBold" }]}>Criar Entrega</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20 },
  addBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  statusChipText: { fontSize: 12 },
  card: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  trackIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardHeaderInfo: { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  entregaId: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12 },
  addresses: { paddingHorizontal: 14, paddingBottom: 4, gap: 4 },
  addrRow: { flexDirection: "row", gap: 12 },
  addrDot: { width: 10, height: 10, borderRadius: 5, marginTop: 14 },
  addrLine: { width: 1, height: 10, marginLeft: 4, marginVertical: 2 },
  addrInfo: { flex: 1, paddingBottom: 8 },
  addrLabel: { fontSize: 11, marginBottom: 1 },
  addrName: { fontSize: 14, marginBottom: 1 },
  addrText: { fontSize: 12 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1 },
  entregadorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  entregadorText: { fontSize: 13 },
  valor: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 12 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { fontSize: 20 },
  inputGroup: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, height: 48, gap: 10 },
  input: { flex: 1, fontSize: 15 },
  saveBtn: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontSize: 16 },
});
