import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, useColorScheme, Platform, Modal, TextInput, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";

const MOD_COLOR = Colors.modules.passagens;

const DEMO_ROTAS = [
  { id: 1, origem: "São Paulo (SP)", destino: "Rio de Janeiro (RJ)", horarioPartida: "06:00", horarioChegada: "11:00", preco: 120.00, assentosDisponiveis: 15, totalAssentos: 44, empresa: "Viação Nacional" },
  { id: 2, origem: "Belo Horizonte (MG)", destino: "Brasília (DF)", horarioPartida: "08:30", horarioChegada: "18:30", preco: 95.00, assentosDisponiveis: 8, totalAssentos: 44, empresa: "Trans BH" },
  { id: 3, origem: "Curitiba (PR)", destino: "Florianópolis (SC)", horarioPartida: "14:00", horarioChegada: "17:30", preco: 68.50, assentosDisponiveis: 22, totalAssentos: 44, empresa: "Sul Express" },
];

export default function PassagensScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const [rotas] = useState(DEMO_ROTAS);
  const [selectedRota, setSelectedRota] = useState<typeof DEMO_ROTAS[0] | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passageiro, setPassageiro] = useState("");
  const [documento, setDocumento] = useState("");

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const handleReservar = async () => {
    if (!passageiro || !documento) { Alert.alert("Atenção", "Preencha todos os campos"); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    setModalVisible(false);
    setSelectedRota(null);
    setPassageiro(""); setDocumento("");
    Alert.alert("Sucesso", "Reserva realizada com sucesso!");
  };

  const ocupacao = (rota: typeof DEMO_ROTAS[0]) => Math.round((1 - rota.assentosDisponiveis / rota.totalAssentos) * 100);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.text} /></Pressable>
        <View style={styles.headerTitle}>
          <View style={[styles.headerIcon, { backgroundColor: MOD_COLOR + "20" }]}><Feather name="map-pin" size={18} color={MOD_COLOR} /></View>
          <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Passagens</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Rotas Disponíveis</Text>
        {rotas.map(rota => {
          const ocp = ocupacao(rota);
          const disponivel = rota.assentosDisponiveis > 0;
          return (
            <View key={rota.id} style={[styles.rotaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.routeHeader}>
                <View style={styles.routeMain}>
                  <View style={styles.routePoints}>
                    <View style={styles.routePoint}>
                      <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
                      <Text style={[styles.cidade, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{rota.origem}</Text>
                    </View>
                    <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
                    <View style={styles.routePoint}>
                      <View style={[styles.dot, { backgroundColor: MOD_COLOR }]} />
                      <Text style={[styles.cidade, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{rota.destino}</Text>
                    </View>
                  </View>
                  <View style={styles.timeRow}>
                    <Text style={[styles.horario, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                      {rota.horarioPartida} → {rota.horarioChegada}
                    </Text>
                    {rota.empresa && (
                      <Text style={[styles.empresa, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>{rota.empresa}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.precoSection}>
                  <Text style={[styles.preco, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>R$ {rota.preco.toFixed(2)}</Text>
                  <Text style={[styles.porPessoa, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>por pessoa</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.ocupacaoSection}>
                <View style={styles.ocupacaoInfo}>
                  <Text style={[styles.assentoText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                    {rota.assentosDisponiveis} assentos disponíveis
                  </Text>
                  <Text style={[styles.ocupacaoPercent, { color: ocp > 80 ? "#EF4444" : "#10B981", fontFamily: "Inter_500Medium" }]}>
                    {ocp}% ocupado
                  </Text>
                </View>
                <View style={[styles.barBg, { backgroundColor: colors.border }]}>
                  <View style={[styles.barFill, { width: `${ocp}%` as any, backgroundColor: ocp > 80 ? "#EF4444" : MOD_COLOR }]} />
                </View>
              </View>

              <Pressable
                style={[styles.reservarBtn, { backgroundColor: disponivel ? MOD_COLOR : colors.backgroundSecondary }]}
                onPress={() => { if (disponivel) { setSelectedRota(rota); setModalVisible(true); } }}
                disabled={!disponivel}
              >
                <Text style={[styles.reservarBtnText, { color: disponivel ? "#fff" : colors.textMuted, fontFamily: "Inter_600SemiBold" }]}>
                  {disponivel ? "Reservar Passagem" : "Esgotado"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Dados do Passageiro</Text>
              <Pressable onPress={() => setModalVisible(false)}><Feather name="x" size={22} color={colors.textSecondary} /></Pressable>
            </View>
            {selectedRota && (
              <View style={[styles.rotaResume, { backgroundColor: MOD_COLOR + "15" }]}>
                <Text style={[styles.rotaResumeText, { color: MOD_COLOR, fontFamily: "Inter_600SemiBold" }]}>
                  {selectedRota.origem} → {selectedRota.destino}
                </Text>
                <Text style={[styles.rotaResumePrice, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>R$ {selectedRota.preco.toFixed(2)}</Text>
              </View>
            )}
            {[
              { p: "Nome completo", v: passageiro, s: setPassageiro, i: "user" as const },
              { p: "CPF ou RG", v: documento, s: setDocumento, i: "credit-card" as const },
            ].map(f => (
              <View key={f.p} style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                <Feather name={f.i} size={16} color={colors.textMuted} />
                <TextInput style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]} placeholder={f.p} placeholderTextColor={colors.textMuted} value={f.v} onChangeText={f.s} />
              </View>
            ))}
            <Pressable style={[styles.saveBtn, { backgroundColor: MOD_COLOR }]} onPress={handleReservar} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnText, { fontFamily: "Inter_600SemiBold" }]}>Confirmar Reserva</Text>}
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
  sectionTitle: { fontSize: 17, marginBottom: 14 },
  rotaCard: { borderRadius: 16, borderWidth: 1, marginBottom: 14, overflow: "hidden" },
  routeHeader: { flexDirection: "row", padding: 16, gap: 12 },
  routeMain: { flex: 1 },
  routePoints: { gap: 6, marginBottom: 8 },
  routePoint: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cidade: { fontSize: 14 },
  routeLine: { width: 1, height: 12, marginLeft: 4 },
  timeRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  horario: { fontSize: 12 },
  empresa: { fontSize: 12 },
  precoSection: { alignItems: "flex-end" },
  preco: { fontSize: 18 },
  porPessoa: { fontSize: 11 },
  divider: { height: 1, marginHorizontal: 16 },
  ocupacaoSection: { padding: 14, paddingTop: 12, gap: 8 },
  ocupacaoInfo: { flexDirection: "row", justifyContent: "space-between" },
  assentoText: { fontSize: 13 },
  ocupacaoPercent: { fontSize: 13 },
  barBg: { height: 4, borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2 },
  reservarBtn: { margin: 14, marginTop: 4, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  reservarBtnText: { fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 12 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { fontSize: 20 },
  rotaResume: { flexDirection: "row", justifyContent: "space-between", padding: 12, borderRadius: 10 },
  rotaResumeText: { fontSize: 14 },
  rotaResumePrice: { fontSize: 16 },
  inputGroup: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, height: 48, gap: 10 },
  input: { flex: 1, fontSize: 15 },
  saveBtn: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontSize: 16 },
});
