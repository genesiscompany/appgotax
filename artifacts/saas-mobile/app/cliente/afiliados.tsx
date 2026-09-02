import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Share,
  RefreshControl,
  useColorScheme,
  Dimensions,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import ClienteBottomNav from "@/components/ClienteBottomNav";

const { width } = Dimensions.get("window");

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

const GREEN = "#22C55E";
const GREEN_DARK = "#16A34A";
const EMERALD = "#10B981";

function fmt(v: number) {
  return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
}

function fmtDate(d: string) {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return `${dt.getDate().toString().padStart(2,"0")}/${(dt.getMonth()+1).toString().padStart(2,"0")}/${dt.getFullYear()}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pendente:    { label: "Pendente",    color: "#F59E0B", bg: "#FEF3C7" },
    qualificado: { label: "Qualificado", color: "#3B82F6", bg: "#DBEAFE" },
    pago:        { label: "Pago",        color: "#22C55E", bg: "#DCFCE7" },
    cancelado:   { label: "Cancelado",   color: "#EF4444", bg: "#FEE2E2" },
    processando: { label: "Processando", color: "#8B5CF6", bg: "#EDE9FE" },
  };
  const { label, color, bg } = map[status] ?? { label: status, color: "#6B7280", bg: "#F3F4F6" };
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color }}>{label.toUpperCase()}</Text>
    </View>
  );
}

interface AfiliadoPerfil {
  id: number;
  codigo: string;
  saldo: number;
  total_indicados: number;
  total_ganhos: number;
  status: string;
  nome: string;
  link_afiliado?: string;
}

interface Indicado {
  id: number;
  nome_indicado: string;
  nome_indicado_real: string | null;
  status: string;
  bonus_valor: number;
  criado_em: string;
}

interface Resgate {
  id: number;
  valor: number;
  chave_pix: string;
  status: string;
  criado_em: string;
}

export default function AfiliadosScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { customer } = useCustomerAuth();
  const token = customer?.token;

  const [perfil, setPerfil] = useState<AfiliadoPerfil | null>(null);
  const [indicados, setIndicados] = useState<Indicado[]>([]);
  const [resgates, setResgates] = useState<Resgate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [tab, setTab] = useState<"indicados" | "resgates">("indicados");

  const [modalResgate, setModalResgate] = useState(false);
  const [valorResgate, setValorResgate] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [modalCredito, setModalCredito] = useState(false);
  const [valorCredito, setValorCredito] = useState("");
  const [aplicandoCredito, setAplicandoCredito] = useState(false);

  const authHeader = { Authorization: `Bearer ${token}` };

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [pRes, iRes, rRes] = await Promise.all([
        fetch(`${API_BASE}/cliente/afiliados/perfil`, { headers: authHeader }),
        fetch(`${API_BASE}/cliente/afiliados/indicados`, { headers: authHeader }),
        fetch(`${API_BASE}/cliente/afiliados/resgates`, { headers: authHeader }),
      ]);
      if (pRes.ok) setPerfil(await pRes.json());
      if (iRes.ok) setIndicados(await iRes.json());
      if (rRes.ok) setResgates(await rRes.json());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCopiar = async () => {
    if (!perfil?.codigo) return;
    await Clipboard.setStringAsync(perfil.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const linkAfiliado = perfil?.link_afiliado
    || `https://gotaxi.com.br/afiliados/r/${perfil?.codigo ?? ""}`;

  const handleCompartilhar = async () => {
    if (!perfil?.codigo) return;
    await Share.share({
      message: `🚖 Baixe o GoTaxi pelo meu link e ganhe bônus de boas-vindas!\n\n👉 ${linkAfiliado}\n\nOu use meu código: *${perfil.codigo}* no cadastro. Corridas, entregas e muito mais! 🎁`,
      title: "Convite GoTaxi",
    });
  };

  const handleUsarCredito = async () => {
    const v = Number(valorCredito);
    if (!v || v < 1) { Alert.alert("Atenção", "Informe um valor de ao menos R$ 1,00"); return; }
    if (v > Number(perfil?.saldo ?? 0)) { Alert.alert("Atenção", "Valor maior que seu saldo"); return; }
    setAplicandoCredito(true);
    try {
      const r = await fetch(`${API_BASE}/cliente/afiliados/usar-credito`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ valor: v }),
      });
      const d = await r.json();
      if (!r.ok) { Alert.alert("Erro", d.error); return; }
      Alert.alert("✅ Crédito aplicado!", `R$ ${v.toFixed(2).replace(".", ",")} adicionados ao seu crédito no app! Será descontado automaticamente nas próximas corridas e pedidos.`);
      setModalCredito(false);
      setValorCredito("");
      loadData();
    } catch {
      Alert.alert("Erro", "Não foi possível aplicar o crédito.");
    } finally {
      setAplicandoCredito(false);
    }
  };

  const handleResgatar = async () => {
    if (!valorResgate || Number(valorResgate) < 50) {
      Alert.alert("Atenção", "Valor mínimo para resgate é R$ 50,00");
      return;
    }
    if (!chavePix.trim()) {
      Alert.alert("Atenção", "Informe sua chave Pix");
      return;
    }
    setSalvando(true);
    try {
      const r = await fetch(`${API_BASE}/cliente/afiliados/resgatar`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ valor: Number(valorResgate), chave_pix: chavePix }),
      });
      const d = await r.json();
      if (!r.ok) { Alert.alert("Erro", d.error); return; }
      Alert.alert("✅ Sucesso!", d.message);
      setModalResgate(false);
      setValorResgate("");
      setChavePix("");
      loadData();
    } catch {
      Alert.alert("Erro", "Não foi possível processar o resgate.");
    } finally {
      setSalvando(false);
    }
  };

  const bg = isDark ? "#0f172a" : "#f8fafc";
  const card = isDark ? "#1e293b" : "#ffffff";
  const border = isDark ? "#334155" : "#e2e8f0";
  const text = isDark ? "#f1f5f9" : "#1e293b";
  const sub = isDark ? "#94a3b8" : "#64748b";

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header gradient */}
      <LinearGradient colors={[GREEN_DARK, GREEN, EMERALD]} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>Programa de Afiliados</Text>
          <Text style={styles.headerSub}>Indique e ganhe dinheiro</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={GREEN} />}
      >
        {loading ? (
          <View style={{ padding: 60, alignItems: "center" }}>
            <ActivityIndicator color={GREEN} size="large" />
          </View>
        ) : (
          <>
            {/* Meu Código */}
            <View style={[styles.card, { backgroundColor: card, borderColor: border, marginTop: 20 }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: GREEN + "22" }]}>
                  <Feather name="link-2" size={18} color={GREEN} />
                </View>
                <Text style={[styles.cardTitle, { color: text }]}>Meu Código de Indicação</Text>
              </View>

              <View style={[styles.codigoBox, { backgroundColor: isDark ? "#0f172a" : "#f0fdf4", borderColor: GREEN + "44" }]}>
                <Text style={[styles.codigoText, { color: GREEN }]}>{perfil?.codigo ?? "---"}</Text>
                <Pressable onPress={handleCopiar} style={[styles.copiarBtn, { backgroundColor: copiado ? GREEN : GREEN + "22" }]}>
                  <Feather name={copiado ? "check" : "copy"} size={16} color={copiado ? "#fff" : GREEN} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: copiado ? "#fff" : GREEN, marginLeft: 4 }}>
                    {copiado ? "Copiado!" : "Copiar"}
                  </Text>
                </Pressable>
              </View>

              <Pressable onPress={handleCompartilhar} style={[styles.shareBtn, { backgroundColor: GREEN }]}>
                <Feather name="share-2" size={16} color="#fff" />
                <Text style={styles.shareBtnText}>Compartilhar meu código</Text>
              </Pressable>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: card, borderColor: border }]}>
                <Text style={[styles.statValue, { color: GREEN }]}>{fmt(Number(perfil?.saldo ?? 0))}</Text>
                <Text style={[styles.statLabel, { color: sub }]}>Saldo disponível</Text>
                {Number(perfil?.saldo ?? 0) >= 50 && (
                  <Pressable onPress={() => setModalResgate(true)} style={[styles.resgateMinBtn, { borderColor: GREEN }]}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: GREEN }}>RESGATAR</Text>
                  </Pressable>
                )}
              </View>
              <View style={[styles.statCard, { backgroundColor: card, borderColor: border }]}>
                <Text style={[styles.statValue, { color: "#3B82F6" }]}>{perfil?.total_indicados ?? 0}</Text>
                <Text style={[styles.statLabel, { color: sub }]}>Indicados</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: card, borderColor: border }]}>
                <Text style={[styles.statValue, { color: EMERALD }]}>{fmt(Number(perfil?.total_ganhos ?? 0))}</Text>
                <Text style={[styles.statLabel, { color: sub }]}>Total ganho</Text>
              </View>
            </View>

            {/* Como funciona */}
            <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: "#3B82F6" + "22" }]}>
                  <Feather name="help-circle" size={18} color="#3B82F6" />
                </View>
                <Text style={[styles.cardTitle, { color: text }]}>Como funciona</Text>
              </View>
              {[
                { icon: "share-2",   color: GREEN,    title: "1. Compartilhe seu código",      desc: "Envie seu código exclusivo para amigos e familiares." },
                { icon: "user-plus", color: "#3B82F6", title: "2. Amigo se cadastra",           desc: "Seu indicado entra no app e usa seu código no cadastro." },
                { icon: "dollar-sign", color: EMERALD, title: "3. Você ganha comissão automática", desc: "10% do lucro do GoTaxi (3% por corrida/pedido) é creditado ao seu saldo a cada transação do indicado." },
                { icon: "zap",       color: "#F59E0B", title: "4. Resgate via Pix",            desc: "Saldo mínimo de R$ 50. Processamento em até 3 dias úteis." },
              ].map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={[styles.stepIcon, { backgroundColor: step.color + "18" }]}>
                    <Feather name={step.icon as any} size={16} color={step.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepTitle, { color: text }]}>{step.title}</Text>
                    <Text style={[styles.stepDesc, { color: sub }]}>{step.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Tabs */}
            <View style={[styles.tabsRow, { borderColor: border }]}>
              {[
                { id: "indicados" as const, label: `Indicados (${indicados.length})` },
                { id: "resgates" as const,  label: `Resgates (${resgates.length})` },
              ].map(t => (
                <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tabBtn, tab === t.id && { borderBottomColor: GREEN, borderBottomWidth: 2 }]}>
                  <Text style={[styles.tabLabel, { color: tab === t.id ? GREEN : sub }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Tab: Indicados */}
            {tab === "indicados" && (
              <View style={{ paddingHorizontal: 16 }}>
                {indicados.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: card, borderColor: border }]}>
                    <Feather name="users" size={32} color={sub} />
                    <Text style={[styles.emptyTitle, { color: text }]}>Nenhum indicado ainda</Text>
                    <Text style={[styles.emptyDesc, { color: sub }]}>Compartilhe seu código e comece a ganhar!</Text>
                    <Pressable onPress={handleCompartilhar} style={[styles.shareBtn, { backgroundColor: GREEN, marginTop: 12 }]}>
                      <Feather name="share-2" size={14} color="#fff" />
                      <Text style={styles.shareBtnText}>Compartilhar agora</Text>
                    </Pressable>
                  </View>
                ) : (
                  indicados.map(i => (
                    <View key={i.id} style={[styles.listRow, { backgroundColor: card, borderColor: border }]}>
                      <View style={[styles.avatarCircle, { backgroundColor: GREEN + "22" }]}>
                        <Feather name="user" size={16} color={GREEN} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.indicadoNome, { color: text }]}>{i.nome_indicado_real ?? i.nome_indicado ?? "Usuário"}</Text>
                        <Text style={[styles.indicadoData, { color: sub }]}>{fmtDate(i.criado_em)}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <StatusBadge status={i.status} />
                        <Text style={{ fontSize: 12, fontWeight: "700", color: GREEN }}>+{fmt(Number(i.bonus_valor))}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Tab: Resgates */}
            {tab === "resgates" && (
              <View style={{ paddingHorizontal: 16 }}>
                {resgates.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: card, borderColor: border }]}>
                    <Feather name="credit-card" size={32} color={sub} />
                    <Text style={[styles.emptyTitle, { color: text }]}>Nenhum resgate ainda</Text>
                    <Text style={[styles.emptyDesc, { color: sub }]}>Quando você resgatar seu saldo, os registros aparecem aqui.</Text>
                  </View>
                ) : (
                  resgates.map(r => (
                    <View key={r.id} style={[styles.listRow, { backgroundColor: card, borderColor: border }]}>
                      <View style={[styles.avatarCircle, { backgroundColor: EMERALD + "22" }]}>
                        <Feather name="zap" size={16} color={EMERALD} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.indicadoNome, { color: text }]}>Pix · {r.chave_pix}</Text>
                        <Text style={[styles.indicadoData, { color: sub }]}>{fmtDate(r.criado_em)}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <StatusBadge status={r.status} />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: EMERALD }}>{fmt(Number(r.valor))}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Ações de saldo */}
            {Number(perfil?.saldo ?? 0) > 0 && (
              <View style={{ paddingHorizontal: 16, marginTop: 20, gap: 10 }}>
                {Number(perfil?.saldo ?? 0) >= 50 && (
                  <Pressable onPress={() => setModalResgate(true)} style={[styles.shareBtn, { backgroundColor: EMERALD, paddingVertical: 14 }]}>
                    <Feather name="zap" size={18} color="#fff" />
                    <Text style={[styles.shareBtnText, { fontSize: 15 }]}>Resgatar via Pix</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setModalCredito(true)} style={[styles.shareBtn, { backgroundColor: "#3B82F6", paddingVertical: 14 }]}>
                  <Feather name="credit-card" size={18} color="#fff" />
                  <Text style={[styles.shareBtnText, { fontSize: 15 }]}>Usar como crédito no app</Text>
                </Pressable>
              </View>
            )}

            {/* Relatório */}
            <View style={{ paddingHorizontal: 16, marginTop: 12, marginBottom: 8 }}>
              <Pressable
                onPress={() => router.push("/cliente/afiliados-relatorio" as any)}
                style={[styles.shareBtn, { backgroundColor: "transparent", borderWidth: 1.5, borderColor: sub + "66", paddingVertical: 12 }]}
              >
                <Feather name="bar-chart-2" size={16} color={sub} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: sub }}>Ver relatório completo</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal resgate */}
      <Modal visible={modalResgate} transparent animationType="slide" onRequestClose={() => setModalResgate(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setModalResgate(false)} />
          <View style={[styles.modalSheet, { backgroundColor: card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: text }]}>Resgatar Saldo</Text>
            <Text style={[styles.modalSub, { color: sub }]}>Saldo disponível: {fmt(Number(perfil?.saldo ?? 0))}</Text>

            <Text style={[styles.inputLabel, { color: text }]}>Valor a resgatar (mín. R$ 50)</Text>
            <View style={[styles.inputBox, { borderColor: border, backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}>
              <Text style={{ color: sub, fontSize: 15 }}>R$</Text>
              <TextInput
                value={valorResgate}
                onChangeText={setValorResgate}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={sub}
                style={[styles.input, { color: text }]}
              />
            </View>

            <Text style={[styles.inputLabel, { color: text, marginTop: 16 }]}>Chave Pix</Text>
            <View style={[styles.inputBox, { borderColor: border, backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}>
              <Feather name="zap" size={16} color={sub} />
              <TextInput
                value={chavePix}
                onChangeText={setChavePix}
                placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                placeholderTextColor={sub}
                style={[styles.input, { color: text }]}
                autoCapitalize="none"
              />
            </View>

            <Pressable
              onPress={handleResgatar}
              disabled={salvando}
              style={[styles.shareBtn, { backgroundColor: EMERALD, marginTop: 24, paddingVertical: 15, opacity: salvando ? 0.7 : 1 }]}
            >
              {salvando ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="check-circle" size={18} color="#fff" />
                  <Text style={[styles.shareBtnText, { fontSize: 16 }]}>Confirmar Resgate</Text>
                </>
              )}
            </Pressable>

            <Pressable onPress={() => setModalResgate(false)} style={{ marginTop: 12, alignItems: "center", padding: 8 }}>
              <Text style={{ color: sub, fontSize: 14 }}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal usar como crédito */}
      <Modal visible={modalCredito} transparent animationType="slide" onRequestClose={() => setModalCredito(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setModalCredito(false)} />
          <View style={[styles.modalSheet, { backgroundColor: card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: text }]}>Usar Saldo como Crédito</Text>
            <Text style={[styles.modalSub, { color: sub }]}>Saldo disponível: {fmt(Number(perfil?.saldo ?? 0))}</Text>

            <View style={[{ backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14, marginBottom: 16, gap: 4 }]}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#1D4ED8" }}>💳 Como funciona?</Text>
              <Text style={{ fontSize: 12, color: "#1E40AF", lineHeight: 18 }}>O valor será convertido em crédito e descontado automaticamente nas próximas corridas, pedidos de comida e entregas. Não é necessário inserir nenhum código.</Text>
            </View>

            <Text style={[styles.inputLabel, { color: text }]}>Valor a converter (mín. R$ 1,00)</Text>
            <View style={[styles.inputBox, { borderColor: border, backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}>
              <Text style={{ color: sub, fontSize: 15 }}>R$</Text>
              <TextInput
                value={valorCredito}
                onChangeText={setValorCredito}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={sub}
                style={[styles.input, { color: text }]}
              />
            </View>

            <Pressable
              onPress={() => { setValorCredito(String(Number(perfil?.saldo ?? 0).toFixed(2))); }}
              style={{ marginTop: 8, alignSelf: "flex-end" }}
            >
              <Text style={{ fontSize: 12, color: "#3B82F6", fontWeight: "600" }}>Usar todo o saldo</Text>
            </Pressable>

            <Pressable
              onPress={handleUsarCredito}
              disabled={aplicandoCredito}
              style={[styles.shareBtn, { backgroundColor: "#3B82F6", marginTop: 20, paddingVertical: 15, opacity: aplicandoCredito ? 0.7 : 1 }]}
            >
              {aplicandoCredito ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="credit-card" size={18} color="#fff" />
                  <Text style={[styles.shareBtnText, { fontSize: 16 }]}>Aplicar como Crédito</Text>
                </>
              )}
            </Pressable>

            <Pressable onPress={() => setModalCredito(false)} style={{ marginTop: 12, alignItems: "center", padding: 8 }}>
              <Text style={{ color: sub, fontSize: 14 }}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ClienteBottomNav activeTab="perfil" />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 20 },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 20, borderWidth: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  codigoBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5, borderRadius: 12, padding: 14, marginBottom: 14 },
  codigoText: { fontSize: 24, fontWeight: "900", letterSpacing: 2 },
  copiarBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },
  shareBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1 },
  statValue: { fontSize: 18, fontWeight: "900", marginBottom: 2 },
  statLabel: { fontSize: 9, fontWeight: "600", textAlign: "center" },
  resgateMinBtn: { marginTop: 8, borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  stepRow: { flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "flex-start" },
  stepIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  stepTitle: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  stepDesc: { fontSize: 12, lineHeight: 17 },
  tabsRow: { flexDirection: "row", borderBottomWidth: 1, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabLabel: { fontSize: 13, fontWeight: "700" },
  emptyBox: { borderRadius: 16, borderWidth: 1, padding: 28, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", marginTop: 4 },
  emptyDesc: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  indicadoNome: { fontSize: 13, fontWeight: "700" },
  indicadoData: { fontSize: 11, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  modalSub: { fontSize: 14, marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  inputBox: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  input: { flex: 1, fontSize: 15 },
});
