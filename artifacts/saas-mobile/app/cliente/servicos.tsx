import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, useColorScheme, Platform, ActivityIndicator, Alert } from "react-native";
import SegmentoBottomNav, { SEGMENTO_NAV_HEIGHT } from "@/components/SegmentoBottomNav";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useAuthGate } from "@/components/AuthGate";
import PaymentSelector from "@/components/PaymentSelector";
import { getWallet, checkoutPayment } from "@/api/payments";
import * as Linking from "expo-linking";

const MOD_COLOR = Colors.modules.servicos;

const PAG_META: Record<string, { label: string; emoji: string }> = {
  pix:      { label: "Pix",                emoji: "⚡" },
  dinheiro: { label: "Dinheiro",           emoji: "💵" },
  credito:  { label: "Cartão de Crédito",  emoji: "💳" },
  debito:   { label: "Cartão de Débito",   emoji: "💳" },
  vr:       { label: "Vale-Refeição",      emoji: "🍽️" },
  sodexo:   { label: "Sodexo",             emoji: "🎫" },
};

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

const HORARIOS = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];

type Prestador = {
  id: number; nome: string; especialidade?: string; bio?: string;
};
type Catalogo = {
  id: number; nome: string; descricao?: string; duracao_minutos?: number;
  preco?: number; categoria_nome?: string; categoria_cor?: string; prestador_id?: number;
};

export default function ClienteServicos() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const params = useLocalSearchParams<{ empresaId?: string; nomeEmpresa?: string; corEmpresa?: string }>();
  const empresaId = Number(params.empresaId ?? 0);
  const nomeEmpresa = params.nomeEmpresa ?? "Serviços";
  const corEmpresa = params.corEmpresa ?? MOD_COLOR;

  const { customer } = useCustomerAuth();
  const { requireAuth } = useAuthGate("/cliente/servicos");

  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [catalogo, setCatalogo] = useState<Catalogo[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [profSel, setProfSel] = useState<Prestador | null>(null);
  const [servicoSel, setServicoSel] = useState<Catalogo | null>(null);
  const [horarioSel, setHorarioSel] = useState<string | null>(null);
  const [agendado, setAgendado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agendamentoId, setAgendamentoId] = useState<number | null>(null);
  const [metodosPag, setMetodosPag] = useState<string[]>(["pix", "dinheiro", "credito", "debito"]);
  const [formaSel, setFormaSel] = useState<string | null>(null);
  const [paymentSource, setPaymentSource] = useState<"direto" | "mercado_pago" | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (customer?.token) {
      getWallet(customer.token).then(d => setWalletBalance(d.balanceCents)).catch(() => {});
    }
  }, [customer?.token]);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  useEffect(() => {
    if (!empresaId) { setLoadingData(false); return; }
    setLoadingData(true);
    fetch(`${API_BASE}/public/servicos/${empresaId}/prestadores`)
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.prestadores)) setPrestadores(data.prestadores);
        if (data && Array.isArray(data.catalogo)) setCatalogo(data.catalogo);
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
    fetch(`${API_BASE}/public/servicos/${empresaId}/formas-pagamento`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data?.metodos) && data.metodos.length) setMetodosPag(data.metodos); })
      .catch(() => {});
  }, [empresaId]);

  // Prestadores que podem realizar o serviço selecionado (ou todos se serviço é "qualquer prestador")
  const prestadoresDoServico = servicoSel
    ? (servicoSel.prestador_id
        ? prestadores.filter(p => p.id === servicoSel.prestador_id)
        : prestadores)
    : prestadores;

  const podeAgendar = !!servicoSel && !!horarioSel && !!formaSel && !loading;

  const handleAgendar = async () => {
    if (!servicoSel || !horarioSel || !formaSel || loading) return;
    setLoading(true);
    try {
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      const [hora, minuto] = horarioSel.split(":").map(Number);
      amanha.setHours(hora, minuto, 0, 0);
      const body = {
        empresa_id: empresaId,
        prestador_id: profSel?.id ?? servicoSel.prestador_id ?? null,
        catalogo_id: servicoSel.id,
        cliente_nome: customer?.nome || "Cliente App",
        cliente_telefone: customer?.whatsapp || "",
        data_hora: amanha.toISOString(),
        valor: servicoSel.preco ?? null,
        observacoes: "",
        metodo_pagamento: formaSel,
      };
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (customer?.token) headers["Authorization"] = `Bearer ${customer.token}`;
      const res = await fetch(`${API_BASE}/public/servicos/agendar`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erro ao agendar");
      
      if (paymentSource === "mercado_pago") {
        try {
          const checkout = await checkoutPayment(customer?.token || "", {
            module: "servicos",
            referenceId: data.id,
            paymentSource: "mercado_pago",
            mercadoPagoMethod: formaSel as any
          });
          if (checkout.sandboxInitPoint) {
            Linking.openURL(checkout.sandboxInitPoint);
          } else if (checkout.initPoint) {
            Linking.openURL(checkout.initPoint);
          }
        } catch (e: any) {
          Alert.alert("Aviso", "Agendamento concluído, mas houve falha ao iniciar o Mercado Pago.");
        }
      }

      setAgendamentoId(data.id);
      setAgendado(true);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível realizar o agendamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (agendado) {
    const dataExibida = (() => {
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      return `${amanha.getDate().toString().padStart(2,"0")}/${(amanha.getMonth()+1).toString().padStart(2,"0")}/${amanha.getFullYear()}`;
    })();
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <View style={[styles.sucessoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.checkCircle, { backgroundColor: corEmpresa }]}>
            <Feather name="calendar" size={32} color="#fff" />
          </View>
          <Text style={[styles.sucessoTitulo, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Agendado!</Text>
          {agendamentoId && (
            <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 12 }]}>
              Pedido #{agendamentoId}
            </Text>
          )}
          <Text style={[styles.sucessoSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            {profSel?.nome}{"\n"}
            {servicoSel ? `${servicoSel.nome} · ` : ""}{horarioSel} — {dataExibida}
          </Text>
          <Pressable
            style={[styles.voltarBtn, { backgroundColor: corEmpresa }]}
            onPress={() => { setAgendado(false); setProfSel(null); setServicoSel(null); setHorarioSel(null); }}
          >
            <Text style={[styles.voltarBtnText, { fontFamily: "Inter_600SemiBold", color: "#fff" }]}>Novo agendamento</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: corEmpresa }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={22} color="#fff" /></Pressable>
        <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold", color: "#fff" }]} numberOfLines={1}>{nomeEmpresa}</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16 }} showsVerticalScrollIndicator={false}>

        {loadingData ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator size="large" color={corEmpresa} />
            <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 12 }]}>Carregando serviços...</Text>
          </View>
        ) : catalogo.length === 0 && prestadores.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: "center", gap: 10 }}>
            <Feather name="package" size={48} color={colors.textMuted} />
            <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" }]}>
              Nenhum serviço cadastrado ainda
            </Text>
          </View>
        ) : (
          <>
            {/* SERVIÇOS — sempre que houver catálogo */}
            {catalogo.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Escolha o serviço</Text>
                <View style={{ gap: 10, marginBottom: 16 }}>
                  {catalogo.map(s => {
                    const sel = servicoSel?.id === s.id;
                    return (
                      <Pressable key={s.id} onPress={() => { setServicoSel(sel ? null : s); setProfSel(null); setHorarioSel(null); }}
                        style={[styles.servicoCard, {
                          backgroundColor: colors.card,
                          borderColor: sel ? corEmpresa : colors.border,
                          borderWidth: sel ? 2 : 1,
                        }]}>
                        <View style={{ flex: 1 }}>
                          {s.categoria_nome ? (
                            <Text style={[{ fontSize: 10, color: s.categoria_cor || colors.textMuted, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }]}>
                              {s.categoria_nome}
                            </Text>
                          ) : null}
                          <Text style={[styles.servicoCardNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{s.nome}</Text>
                          {s.descricao ? (
                            <Text style={[{ fontSize: 12, color: colors.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 }]} numberOfLines={2}>{s.descricao}</Text>
                          ) : null}
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                            {s.preco ? (
                              <Text style={[{ fontSize: 15, color: corEmpresa, fontFamily: "Inter_700Bold" }]}>R$ {Number(s.preco).toFixed(2)}</Text>
                            ) : null}
                            {s.duracao_minutos ? (
                              <Text style={[{ fontSize: 12, color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>· {s.duracao_minutos} min</Text>
                            ) : null}
                          </View>
                        </View>
                        <Feather name={sel ? "check-circle" : "chevron-right"} size={20} color={sel ? corEmpresa : colors.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {/* PROFISSIONAL — opcional, aparece se houver prestadores e serviço selecionado (ou se não houver catálogo) */}
            {prestadoresDoServico.length > 0 && (servicoSel || catalogo.length === 0) && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold", marginTop: 8 }]}>
                  Profissional {catalogo.length > 0 ? "(opcional)" : ""}
                </Text>
                {catalogo.length > 0 && (
                  <Pressable onPress={() => setProfSel(null)}
                    style={[styles.profCard, {
                      backgroundColor: colors.card,
                      borderColor: !profSel ? corEmpresa : colors.border,
                      borderWidth: !profSel ? 2 : 1,
                    }]}>
                    <View style={[styles.profAvatar, { backgroundColor: corEmpresa + "20" }]}>
                      <Feather name="users" size={22} color={corEmpresa} />
                    </View>
                    <View style={styles.profInfo}>
                      <Text style={[styles.profNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Sem preferência</Text>
                      <Text style={[styles.profEsp, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Qualquer profissional disponível</Text>
                    </View>
                    <Feather name={!profSel ? "check-circle" : "chevron-right"} size={20} color={!profSel ? corEmpresa : colors.textMuted} />
                  </Pressable>
                )}
                {prestadoresDoServico.map(prof => (
                  <Pressable key={prof.id} onPress={() => setProfSel(profSel?.id === prof.id ? null : prof)}
                    style={[styles.profCard, {
                      backgroundColor: colors.card,
                      borderColor: profSel?.id === prof.id ? corEmpresa : colors.border,
                      borderWidth: profSel?.id === prof.id ? 2 : 1,
                    }]}>
                    <View style={[styles.profAvatar, { backgroundColor: corEmpresa + "20" }]}>
                      <Text style={[styles.profIni, { color: corEmpresa, fontFamily: "Inter_700Bold" }]}>{prof.nome.charAt(0)}</Text>
                    </View>
                    <View style={styles.profInfo}>
                      <Text style={[styles.profNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{prof.nome}</Text>
                      {prof.especialidade ? (
                        <Text style={[styles.profEsp, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{prof.especialidade}</Text>
                      ) : null}
                      {prof.bio ? (
                        <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }]} numberOfLines={1}>{prof.bio}</Text>
                      ) : null}
                    </View>
                    <Feather name={profSel?.id === prof.id ? "check-circle" : "chevron-right"} size={20} color={profSel?.id === prof.id ? corEmpresa : colors.textMuted} />
                  </Pressable>
                ))}
              </>
            )}

            {/* HORÁRIO — aparece quando tem serviço selecionado (ou quando não há catálogo mas tem prestador) */}
            {(servicoSel || (catalogo.length === 0 && profSel)) && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold", marginTop: 8 }]}>Escolha o horário</Text>
                <View style={styles.horariosGrid}>
                  {HORARIOS.map(h => (
                    <Pressable key={h} onPress={() => setHorarioSel(h)}
                      style={[styles.horarioBtn, { backgroundColor: horarioSel === h ? corEmpresa : colors.card, borderColor: horarioSel === h ? corEmpresa : colors.border }]}>
                      <Text style={[styles.horarioText, { color: horarioSel === h ? "#fff" : colors.text, fontFamily: "Inter_600SemiBold" }]}>{h}</Text>
                    </Pressable>
                  ))}
                </View>

                {horarioSel && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold", marginTop: 18 }]}>Pagamento</Text>
                    <View style={{ gap: 8 }}>
                      <PaymentSelector
                        empresaId={empresaId}
                        token={customer?.token}
                        colors={colors}
                        accentColor={corEmpresa}
                        directMethods={metodosPag.map(m => ({
                          id: m,
                          label: PAG_META[m]?.label || m,
                          icon: "credit-card",
                          color: corEmpresa
                        }))}
                        selectedSource={paymentSource}
                        onSourceSelect={(src) => setPaymentSource(src)}
                        selectedMethod={formaSel}
                        onMethodSelect={(m) => setFormaSel(m)}
                        walletBalanceCents={walletBalance}
                      />
                    </View>
                  </>
                )}

                <Pressable
                  style={[styles.agendarBtn, { backgroundColor: podeAgendar ? corEmpresa : colors.backgroundSecondary }]}
                  onPress={() => requireAuth(() => handleAgendar())}
                  disabled={!podeAgendar}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : (
                    <Text style={[styles.agendarBtnText, { color: podeAgendar ? "#fff" : colors.textMuted, fontFamily: "Inter_700Bold" }]}>
                      Confirmar Agendamento
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>
      <SegmentoBottomNav
        ativo={profSel ? "carrinho" : "inicio"}
        corAtivo={corEmpresa}
        onInicio={() => { setProfSel(null); setServicoSel(null); setHorarioSel(null); }}
        onCarrinho={() => {}}
        onFinalizar={() => { if (horarioSel) requireAuth(() => handleAgendar()); }}
        empresaId={empresaId || null}
        empresaNome={nomeEmpresa}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, justifyContent: "space-between" },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, flex: 1, textAlign: "center" },
  sectionTitle: { fontSize: 17, marginBottom: 14 },
  profCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14, gap: 12, marginBottom: 12 },
  profAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  profIni: { fontSize: 22 },
  profInfo: { flex: 1 },
  profNome: { fontSize: 15, marginBottom: 2 },
  profEsp: { fontSize: 12, marginBottom: 2 },
  servicoChip: { minHeight: 64, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 8, alignItems: "center", justifyContent: "center", minWidth: 100, alignSelf: "center", flexShrink: 0 },
  servicoCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14, gap: 12 },
  servicoCardNome: { fontSize: 15 },
  servicoNome: { fontSize: 13 },
  servicoPreco: { fontSize: 12, marginTop: 2 },
  horariosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  horarioBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5 },
  horarioText: { fontSize: 14 },
  agendarBtn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  agendarBtnText: { fontSize: 17 },
  sucessoCard: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", marginHorizontal: 32, gap: 12 },
  checkCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  sucessoTitulo: { fontSize: 22 },
  sucessoSub: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  voltarBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  voltarBtnText: { fontSize: 15 },
});
