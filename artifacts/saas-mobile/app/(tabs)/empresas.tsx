import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  useColorScheme, Platform, Modal, TextInput,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

const PLANO_COLORS: Record<string, string> = {
  basico: "#64748B",
  profissional: "#3B82F6",
  enterprise: "#F59E0B",
};

type Empresa = {
  id: number;
  nome: string;
  codigo?: string;
  cor_primaria?: string;
  plano: string;
  ativo: boolean;
  modulos_ativos?: string[];
  total_usuarios?: number;
  total_pedidos?: number;
};

export default function EmpresasScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { auth } = useAuth();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formPlano, setFormPlano] = useState("basico");

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;

  const carregarEmpresas = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/empresas`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) throw new Error("Falha ao carregar");
      const data = await res.json();
      setEmpresas(Array.isArray(data) ? data : []);
    } catch (err) {
      Alert.alert("Erro", "Não foi possível carregar as empresas.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auth.token]);

  useEffect(() => { carregarEmpresas(); }, [carregarEmpresas]);

  const handleRefresh = () => {
    setRefreshing(true);
    carregarEmpresas();
  };

  const handleAddEmpresa = async () => {
    if (!formNome.trim()) {
      Alert.alert("Atenção", "Informe o nome da empresa");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/empresas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ nome: formNome.trim(), plano: formPlano }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erro ao criar empresa");
      }
      const nova = await res.json();
      setEmpresas(prev => [nova, ...prev]);
      setModalVisible(false);
      setFormNome("");
      setFormPlano("basico");
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Não foi possível criar a empresa. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPadding, paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.tint} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Empresas</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              {loading ? "Carregando..." : `${empresas.length} empresa${empresas.length !== 1 ? "s" : ""} cadastrada${empresas.length !== 1 ? "s" : ""}`}
            </Text>
          </View>
          <Pressable
            style={[styles.addBtn, { backgroundColor: colors.tint }]}
            onPress={() => setModalVisible(true)}
          >
            <Feather name="plus" size={20} color="#fff" />
          </Pressable>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={{ color: colors.textSecondary, marginTop: 12, fontFamily: "Inter_400Regular" }}>
              Carregando empresas...
            </Text>
          </View>
        ) : empresas.length === 0 ? (
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Feather name="briefcase" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", marginTop: 16, fontFamily: "Inter_700Bold" }}>
              Nenhuma empresa ainda
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8, textAlign: "center", fontFamily: "Inter_400Regular" }}>
              Toque no botão + para criar a primeira empresa
            </Text>
          </View>
        ) : (
          empresas.map(empresa => {
            const modulos: string[] = Array.isArray(empresa.modulos_ativos)
              ? empresa.modulos_ativos
              : typeof empresa.modulos_ativos === "string"
                ? (() => { try { return JSON.parse(empresa.modulos_ativos as string); } catch { return []; } })()
                : [];
            const cor = empresa.cor_primaria ?? "#1A56DB";
            return (
              <View key={empresa.id} style={[styles.empresaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.empresaHeader}>
                  <View style={[styles.empresaAvatar, { backgroundColor: cor + "20" }]}>
                    <Feather name="briefcase" size={22} color={cor} />
                  </View>
                  <View style={styles.empresaInfo}>
                    <Text style={[styles.empresaNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                      {empresa.nome}
                    </Text>
                    {empresa.codigo ? (
                      <Text style={[styles.empresaCodigo, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                        {empresa.codigo}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.planoBadge, { backgroundColor: (PLANO_COLORS[empresa.plano] ?? "#64748B") + "20" }]}>
                    <Text style={[styles.planoText, { color: PLANO_COLORS[empresa.plano] ?? "#64748B", fontFamily: "Inter_500Medium" }]}>
                      {(empresa.plano ?? "básico").charAt(0).toUpperCase() + (empresa.plano ?? "basico").slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {modulos.length > 0 ? (
                  <View style={styles.modulosRow}>
                    {modulos.slice(0, 5).map(mod => (
                      <View key={mod} style={[styles.modBadge, { backgroundColor: ((Colors.modules as Record<string, string>)[mod] ?? "#64748B") + "20" }]}>
                        <View style={[styles.modDot, { backgroundColor: (Colors.modules as Record<string, string>)[mod] ?? "#64748B" }]} />
                        <Text style={[styles.modText, { color: (Colors.modules as Record<string, string>)[mod] ?? "#64748B", fontFamily: "Inter_500Medium" }]}>
                          {mod}
                        </Text>
                      </View>
                    ))}
                    {modulos.length > 5 && (
                      <Text style={[styles.moreModulos, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                        +{modulos.length - 5}
                      </Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.modulosRow}>
                    <Text style={[styles.modText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                      Sem módulos configurados
                    </Text>
                  </View>
                )}

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Feather name="users" size={14} color={colors.textMuted} />
                    <Text style={[styles.statText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                      {empresa.total_usuarios ?? 0} usuário{empresa.total_usuarios !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: empresa.ativo ? "#10B98120" : "#EF444420" }]}>
                    <View style={[styles.statusDot, { backgroundColor: empresa.ativo ? "#10B981" : "#EF4444" }]} />
                    <Text style={[styles.statusText, { color: empresa.ativo ? "#10B981" : "#EF4444", fontFamily: "Inter_500Medium" }]}>
                      {empresa.ativo ? "Ativa" : "Inativa"}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                Nova Empresa
              </Text>
              <Pressable onPress={() => { setModalVisible(false); setFormNome(""); }}>
                <Feather name="x" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
                Nome da empresa *
              </Text>
              <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                <Feather name="briefcase" size={16} color={colors.textMuted} />
                <TextInput
                  style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                  placeholder="Ex: Loja Ana Julia"
                  placeholderTextColor={colors.textMuted}
                  value={formNome}
                  onChangeText={setFormNome}
                  autoCapitalize="words"
                />
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium", marginTop: 12 }]}>
                Plano
              </Text>
              <View style={styles.planoRow}>
                {["basico", "profissional", "enterprise"].map(p => (
                  <Pressable
                    key={p}
                    style={[
                      styles.planoBtn,
                      { borderColor: formPlano === p ? colors.tint : colors.border },
                      formPlano === p && { backgroundColor: colors.tint + "15" },
                    ]}
                    onPress={() => setFormPlano(p)}
                  >
                    <Text style={[styles.planoBtnText, { color: formPlano === p ? colors.tint : colors.textSecondary, fontFamily: "Inter_500Medium" }]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.tint, opacity: saving ? 0.7 : 1 }]}
              onPress={handleAddEmpresa}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.saveBtnText, { fontFamily: "Inter_600SemiBold" }]}>Criar Empresa</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 26, marginBottom: 2 },
  subtitle: { fontSize: 14 },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  empresaCard: { borderRadius: 16, borderWidth: 1, marginBottom: 14, overflow: "hidden" },
  empresaHeader: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  empresaAvatar: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  empresaInfo: { flex: 1 },
  empresaNome: { fontSize: 15, marginBottom: 2 },
  empresaCodigo: { fontSize: 12 },
  planoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  planoText: { fontSize: 12 },
  divider: { height: 1, marginHorizontal: 16 },
  modulosRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 14 },
  modBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  modDot: { width: 6, height: 6, borderRadius: 3 },
  modText: { fontSize: 11 },
  moreModulos: { fontSize: 12, alignSelf: "center" },
  statsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  statText: { fontSize: 13 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 20 },
  modalForm: { gap: 4 },
  fieldLabel: { fontSize: 13, marginBottom: 8 },
  inputGroup: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, height: 50, gap: 10 },
  input: { flex: 1, fontSize: 15 },
  planoRow: { flexDirection: "row", gap: 10 },
  planoBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: "center" },
  planoBtnText: { fontSize: 13 },
  saveBtn: { marginTop: 24, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#fff", fontSize: 16 },
});
