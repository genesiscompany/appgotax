import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TouchableOpacity,
  useColorScheme, ActivityIndicator, TextInput, Alert, Platform,
  RefreshControl, KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : "/api";
const MOD_COLOR = "#3B82F6";
const TOP_EXTRA = Platform.OS === "web" ? 67 : 0;
const EMPRESA_ID = 2;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(val: number | string | undefined): string {
  const n = Number(val || 0);
  return n.toFixed(2).replace(".", ",");
}
function fmtDataSimples(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getFullYear()}`;
}

const STATUS_CONF: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  pendente: { label: "Pendente", color: "#F59E0B", icon: "clock", desc: "Cadastro recebido. Envie seus documentos para iniciar a análise." },
  em_analise: { label: "Em Análise", color: "#8B5CF6", icon: "search", desc: "Seus documentos estão sendo analisados. Isso pode levar até 2 dias úteis." },
  aprovado: { label: "Aprovado", color: "#10B981", icon: "check-circle", desc: "Você está aprovado e pode aceitar corridas!" },
  suspenso: { label: "Suspenso", color: "#F97316", icon: "alert-triangle", desc: "Sua conta foi suspensa temporariamente. Entre em contato com o suporte." },
  bloqueado: { label: "Bloqueado", color: "#EF4444", icon: "x-circle", desc: "Acesso bloqueado. Entre em contato com o suporte." },
};

const DOC_CONF = [
  { key: "doc_cnh_status", label: "CNH (Carteira de Habilitação)", tipo: "cnh", desc: "Foto legível da frente e verso" },
  { key: "doc_veiculo_status", label: "CRLV (Documento do Veículo)", tipo: "veiculo", desc: "Documento de licenciamento atualizado" },
  { key: "doc_selfie_status", label: "Selfie com CNH", tipo: "selfie", desc: "Foto segurando a CNH ao lado do rosto" },
];

type AppTab = "inicio" | "corridas" | "ganhos" | "perfil";

type RideStatus = "aguardando" | "aceita" | "a_caminho" | "em_andamento" | "concluida" | "cancelada";
const RIDE_STATUS_LABEL: Record<RideStatus, string> = {
  aguardando: "Aguardando", aceita: "Aceita", a_caminho: "A Caminho",
  em_andamento: "Em Andamento", concluida: "Concluída", cancelada: "Cancelada",
};
const RIDE_STATUS_COLOR: Record<RideStatus, string> = {
  aguardando: "#F59E0B", aceita: "#3B82F6", a_caminho: "#8B5CF6",
  em_andamento: "#0EA5E9", concluida: "#10B981", cancelada: "#EF4444",
};
const NEXT_ACTION: Partial<Record<RideStatus, { label: string; next: RideStatus }>> = {
  aceita: { label: "A Caminho", next: "a_caminho" },
  a_caminho: { label: "Iniciar", next: "em_andamento" },
  em_andamento: { label: "Concluir", next: "concluida" },
};

// ── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onAuth, isDark, colors, insets }: { onAuth: (d: any, t: string) => void; isDark: boolean; colors: any; insets: any }) {
  const [mode, setMode] = useState<"login" | "cadastro">("login");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pin, setPin] = useState("");
  const [pinConf, setPinConf] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!telefone || !pin) return Alert.alert("Atenção", "Preencha telefone e PIN");
    if (mode === "cadastro") {
      if (!nome.trim()) return Alert.alert("Atenção", "Informe seu nome completo");
      if (pin !== pinConf) return Alert.alert("Erro", "PINs não coincidem");
      if (pin.length < 4) return Alert.alert("Erro", "PIN deve ter 4 ou mais dígitos");
    }
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/motorista-app/login" : "/motorista-app/cadastro";
      const body = mode === "login" ? { telefone, pin } : { nome, telefone, pin };
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return Alert.alert("Erro", data.error || "Falha no servidor");
      onAuth(data, data.token);
    } catch (_) { Alert.alert("Erro", "Sem conexão com o servidor"); }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={[styles.flex1, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.authContainer, { paddingTop: insets.top + TOP_EXTRA + 40 }]}>
        <View style={[styles.authLogoWrap, { backgroundColor: MOD_COLOR }]}>
          <Feather name="navigation" size={44} color="#fff" />
        </View>
        <Text style={[styles.authTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>App do Motorista</Text>
        <Text style={[styles.authSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
          {mode === "login" ? "Acesse sua conta de motorista" : "Crie sua conta e comece a trabalhar"}
        </Text>

        {/* Mode Toggle */}
        <View style={[styles.modeTabs, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
          {(["login", "cadastro"] as const).map(m => (
            <TouchableOpacity key={m} onPress={() => setMode(m)} style={[styles.modeTab, mode === m && { backgroundColor: MOD_COLOR }]}>
              <Text style={[styles.modeTabTxt, { fontFamily: "Inter_600SemiBold", color: mode === m ? "#fff" : colors.textSecondary }]}>
                {m === "login" ? "Entrar" : "Cadastrar"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Fields */}
        {mode === "cadastro" && (
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: isDark ? "#1e293b" : "#f8fafc" }]}>
            <Feather name="user" size={16} color={MOD_COLOR} />
            <TextInput style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
              placeholder="Nome completo" placeholderTextColor={colors.textMuted}
              value={nome} onChangeText={setNome} />
          </View>
        )}
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: isDark ? "#1e293b" : "#f8fafc" }]}>
          <Feather name="phone" size={16} color={MOD_COLOR} />
          <TextInput style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
            placeholder="Telefone (ex: 11999999999)" placeholderTextColor={colors.textMuted}
            value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />
        </View>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: isDark ? "#1e293b" : "#f8fafc" }]}>
          <Feather name="lock" size={16} color={MOD_COLOR} />
          <TextInput style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
            placeholder="PIN (4 dígitos)" placeholderTextColor={colors.textMuted}
            value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} />
        </View>
        {mode === "cadastro" && (
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: isDark ? "#1e293b" : "#f8fafc" }]}>
            <Feather name="lock" size={16} color={MOD_COLOR} />
            <TextInput style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
              placeholder="Confirmar PIN" placeholderTextColor={colors.textMuted}
              value={pinConf} onChangeText={setPinConf} keyboardType="number-pad" secureTextEntry maxLength={6} />
          </View>
        )}

        <TouchableOpacity onPress={handleSubmit} disabled={loading}
          style={[styles.authBtn, { backgroundColor: MOD_COLOR, opacity: loading ? 0.7 : 1 }]}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text style={[styles.authBtnTxt, { fontFamily: "Inter_700Bold" }]}>
              {mode === "login" ? "Entrar" : "Criar Conta"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 8 }}>
          <Text style={[styles.backLink, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>← Voltar</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Status / Pending Screen ───────────────────────────────────────────────────
function StatusScreen({ motorista, token, onRefresh, isDark, colors, insets, onLogout }: any) {
  const [loading, setLoading] = useState<string | null>(null);
  const [docs, setDocs] = useState({
    doc_cnh_status: motorista.doc_cnh_status || "pendente",
    doc_veiculo_status: motorista.doc_veiculo_status || "pendente",
    doc_selfie_status: motorista.doc_selfie_status || "pendente",
  });
  const statusConf = STATUS_CONF[motorista.status] || STATUS_CONF.pendente;
  const statusCol = statusConf.color;

  const handleEnviarDoc = async (tipo: string, key: string) => {
    setLoading(tipo);
    try {
      const res = await fetch(`${API_BASE}/motorista-app/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tipo }),
      });
      if (res.ok) {
        const data = await res.json();
        setDocs((prev: any) => ({ ...prev, ...data.documentos }));
        Alert.alert("Enviado!", "Documento marcado como enviado. Aguarde análise.");
        onRefresh();
      }
    } catch (_) { Alert.alert("Erro", "Não foi possível enviar o documento"); }
    setLoading(null);
  };

  const docStatusConf: Record<string, { label: string; color: string; icon: string }> = {
    pendente: { label: "Pendente", color: "#94A3B8", icon: "circle" },
    em_analise: { label: "Em análise", color: "#8B5CF6", icon: "clock" },
    aprovado: { label: "Aprovado", color: "#10B981", icon: "check-circle" },
    rejeitado: { label: "Rejeitado", color: "#EF4444", icon: "x-circle" },
  };

  return (
    <View style={[styles.flex1, { backgroundColor: colors.background }]}>
      <View style={[styles.statusHeader, { paddingTop: insets.top + TOP_EXTRA + 12, backgroundColor: statusCol }]}>
        <View style={styles.statusHeaderRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
            <Feather name="arrow-left" size={18} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusHeaderTitle, { fontFamily: "Inter_700Bold" }]}>App do Motorista</Text>
            <Text style={[styles.statusHeaderSub, { fontFamily: "Inter_400Regular" }]}>{motorista.nome}</Text>
          </View>
          <TouchableOpacity onPress={onLogout} style={styles.backCircle}>
            <Feather name="log-out" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={[styles.statusCard, { backgroundColor: "rgba(255,255,255,0.2)", borderColor: "rgba(255,255,255,0.3)" }]}>
          <Feather name={statusConf.icon as any} size={28} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusCardLabel, { fontFamily: "Inter_700Bold" }]}>{statusConf.label}</Text>
            <Text style={[styles.statusCardDesc, { fontFamily: "Inter_400Regular" }]}>{statusConf.desc}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {motorista.status === "pendente" || motorista.status === "em_analise" ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Documentos Necessários</Text>
            {DOC_CONF.map(doc => {
              const docStatus = (docs as any)[doc.key] || "pendente";
              const conf = docStatusConf[docStatus] || docStatusConf.pendente;
              const isLoading = loading === doc.tipo;
              return (
                <View key={doc.key} style={[styles.docCard, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
                  <View style={styles.docCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.docName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{doc.label}</Text>
                      <Text style={[styles.docDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{doc.desc}</Text>
                    </View>
                    <View style={[styles.docStatusBadge, { backgroundColor: conf.color + "22" }]}>
                      <Feather name={conf.icon as any} size={12} color={conf.color} />
                      <Text style={[styles.docStatusTxt, { color: conf.color, fontFamily: "Inter_500Medium" }]}>{conf.label}</Text>
                    </View>
                  </View>
                  {(docStatus === "pendente" || docStatus === "rejeitado") && (
                    <TouchableOpacity onPress={() => handleEnviarDoc(doc.tipo, doc.key)} disabled={!!loading}
                      style={[styles.sendDocBtn, { backgroundColor: MOD_COLOR, opacity: isLoading ? 0.6 : 1 }]}>
                      {isLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                        <><Feather name="upload" size={14} color="#fff" />
                          <Text style={[styles.sendDocTxt, { fontFamily: "Inter_600SemiBold" }]}>Enviar Documento</Text></>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            <View style={[styles.infoBox, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B40" }]}>
              <Feather name="info" size={16} color="#F59E0B" />
              <Text style={[styles.infoBoxTxt, { color: "#D97706", fontFamily: "Inter_400Regular" }]}>
                Todos os documentos precisam ser aprovados antes de você poder aceitar corridas.
              </Text>
            </View>
          </>
        ) : (
          <View style={[styles.blockedBox, { backgroundColor: "#EF444415", borderColor: "#EF444440" }]}>
            <Feather name="alert-triangle" size={24} color="#EF4444" />
            <Text style={[styles.blockedTxt, { color: "#EF4444", fontFamily: "Inter_600SemiBold" }]}>
              Entre em contato com o suporte para resolver sua situação.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Dashboard: Início Tab ──────────────────────────────────────────────────────
function InicioTab({ motorista, stats, refreshing, onRefresh, isDark, colors }: any) {
  const r = Number(stats?.percentual_repasse || 20);
  return (
    <ScrollView showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 14, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MOD_COLOR} />}>
      {/* Welcome */}
      <View style={[styles.welcomeCard, { backgroundColor: MOD_COLOR }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.welcomeHello, { fontFamily: "Inter_400Regular" }]}>Olá,</Text>
          <Text style={[styles.welcomeName, { fontFamily: "Inter_700Bold" }]}>{motorista.nome?.split(" ")[0]}</Text>
          <Text style={[styles.welcomeSub, { fontFamily: "Inter_400Regular" }]}>
            {motorista.veiculo_modelo ? `${motorista.veiculo_marca} ${motorista.veiculo_modelo}` : "Complete seu perfil"}
            {motorista.veiculo_placa ? ` · ${motorista.veiculo_placa}` : ""}
          </Text>
        </View>
        <View style={[styles.approvedBadge, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
          <Feather name="check-circle" size={14} color="#fff" />
          <Text style={[styles.approvedTxt, { fontFamily: "Inter_600SemiBold" }]}>Aprovado</Text>
        </View>
      </View>

      {/* Stats hoje */}
      <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Hoje</Text>
      <View style={styles.statsRow}>
        {[
          { label: "Corridas", value: String(stats?.corridas_hoje || 0), color: MOD_COLOR, icon: "navigation" },
          { label: "Ganhos brutos", value: `R$ ${fmt(stats?.ganhos_hoje)}`, color: "#10B981", icon: "trending-up" },
          { label: "Ganhos líq.", value: `R$ ${fmt(stats?.ganhos_hoje_liquido)}`, color: "#8B5CF6", icon: "dollar-sign" },
        ].map(s => (
          <View key={s.label} style={[styles.statBox, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
            <View style={[styles.statIconWrap, { backgroundColor: s.color + "20" }]}>
              <Feather name={s.icon as any} size={14} color={s.color} />
            </View>
            <Text style={[styles.statValue, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Stats mês */}
      <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Este mês</Text>
      <View style={styles.statsRow}>
        {[
          { label: "Corridas", value: String(stats?.corridas_mes || 0), color: MOD_COLOR, icon: "list" },
          { label: "Ganhos brutos", value: `R$ ${fmt(stats?.ganhos_mes)}`, color: "#10B981", icon: "trending-up" },
          { label: "Ganhos líq.", value: `R$ ${fmt(stats?.ganhos_mes_liquido)}`, color: "#8B5CF6", icon: "dollar-sign" },
        ].map(s => (
          <View key={s.label} style={[styles.statBox, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
            <View style={[styles.statIconWrap, { backgroundColor: s.color + "20" }]}>
              <Feather name={s.icon as any} size={14} color={s.color} />
            </View>
            <Text style={[styles.statValue, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Repasse info */}
      <View style={[styles.repasseCard, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
        <View style={styles.repasseRow}>
          <Feather name="percent" size={18} color={MOD_COLOR} />
          <Text style={[styles.repasseTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Seu repasse — GoTaxi</Text>
        </View>
        <View style={styles.repasseSplit}>
          <View style={[styles.repassePart, { backgroundColor: "#10B98115" }]}>
            <Text style={[styles.repassePartPct, { color: "#10B981", fontFamily: "Inter_700Bold" }]}>{100 - r}%</Text>
            <Text style={[styles.repassePartLbl, { color: "#10B981", fontFamily: "Inter_500Medium" }]}>Você recebe</Text>
          </View>
          <View style={{ width: 8 }} />
          <View style={[styles.repassePart, { backgroundColor: "#3B82F615" }]}>
            <Text style={[styles.repassePartPct, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>{r}%</Text>
            <Text style={[styles.repassePartLbl, { color: MOD_COLOR, fontFamily: "Inter_500Medium" }]}>GoTaxi recebe</Text>
          </View>
        </View>
        {stats?.avaliacao_media && Number(stats.avaliacao_media) > 0 && (
          <View style={styles.avaliacaoRow}>
            {[1,2,3,4,5].map(i => (
              <Text key={i} style={{ fontSize: 18, color: i <= Math.round(Number(stats.avaliacao_media)) ? "#F59E0B" : "#D1D5DB" }}>★</Text>
            ))}
            <Text style={[styles.avaliacaoTxt, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              {Number(stats.avaliacao_media).toFixed(1)} de média ({stats.corridas_total || 0} corridas)
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ── Dashboard: Corridas Tab ───────────────────────────────────────────────────
function CorridasTab({ motoristaNome, token, isDark, colors }: any) {
  const [tab, setTab] = useState<"disponiveis" | "minhas">("disponiveis");
  const [disponiveis, setDisponiveis] = useState<any[]>([]);
  const [minhas, setMinhas] = useState<any[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [dRes, tRes] = await Promise.all([
        fetch(`${API_BASE}/motorista/corridas/disponiveis?empresa_id=${EMPRESA_ID}`),
        fetch(`${API_BASE}/motorista/corridas?empresa_id=${EMPRESA_ID}`),
      ]);
      const [disp, todas] = await Promise.all([dRes.json(), tRes.json()]);
      if (Array.isArray(disp)) setDisponiveis(disp);
      if (Array.isArray(todas)) {
        setMinhas(todas.filter((c: any) =>
          ["aceita", "a_caminho", "em_andamento"].includes(c.status) &&
          (c.motorista_nome || "").toLowerCase().includes(motoristaNome.toLowerCase())
        ));
      }
    } catch (_) {}
    setRefreshing(false);
  }, [motoristaNome]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const aceitar = async (id: number) => {
    setLoadingId(id);
    const res = await fetch(`${API_BASE}/motorista/corridas/${id}/aceitar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motorista_nome: motoristaNome }),
    });
    if (res.ok) { await load(); setTab("minhas"); }
    else if (res.status === 409) Alert.alert("Corrida indisponível", "Já foi aceita por outro motorista.");
    setLoadingId(null);
  };

  const mudarStatus = async (id: number, status: RideStatus) => {
    setLoadingId(id);
    await fetch(`${API_BASE}/motorista/corridas/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, motorista_nome: motoristaNome }),
    });
    await load();
    if (status === "concluida") setTab("disponiveis");
    setLoadingId(null);
  };

  const list = tab === "disponiveis" ? disponiveis : minhas;

  return (
    <View style={styles.flex1}>
      <View style={[styles.innerTabs, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
        {([["disponiveis", `Disponíveis (${disponiveis.length})`], ["minhas", `Em Andamento (${minhas.length})`]] as const).map(([k, lbl]) => (
          <TouchableOpacity key={k} onPress={() => setTab(k)}
            style={[styles.innerTab, tab === k && { backgroundColor: MOD_COLOR }]}>
            <Text style={[styles.innerTabTxt, { fontFamily: "Inter_600SemiBold", color: tab === k ? "#fff" : colors.textSecondary }]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {list.length === 0 ? (
        <View style={styles.emptyCenter}>
          <Feather name={tab === "disponiveis" ? "search" : "navigation"} size={36} color={MOD_COLOR} style={{ opacity: 0.4 }} />
          <Text style={[styles.emptyTxt, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            {tab === "disponiveis" ? "Nenhuma corrida disponível" : "Sem corridas em andamento"}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={MOD_COLOR} />}>
          {list.map((c: any) => {
            const cor = RIDE_STATUS_COLOR[c.status as RideStatus] || MOD_COLOR;
            const next = NEXT_ACTION[c.status as RideStatus];
            const isMe = (c.motorista_nome || "").toLowerCase().includes(motoristaNome.toLowerCase());
            const isLoading = loadingId === c.id;
            return (
              <View key={c.id} style={[styles.rideCard, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
                <View style={[styles.rideCardAccent, { backgroundColor: cor }]} />
                <View style={{ padding: 12, gap: 8 }}>
                  <View style={styles.rideCardHead}>
                    <Text style={[styles.ridePassName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                      {c.passageiro_nome}
                    </Text>
                    <View style={[styles.rideStatusBadge, { backgroundColor: cor + "22" }]}>
                      <Text style={[styles.rideStatusTxt, { color: cor, fontFamily: "Inter_500Medium" }]}>{RIDE_STATUS_LABEL[c.status as RideStatus]}</Text>
                    </View>
                  </View>
                  <View style={[styles.routeBox, { backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}>
                    <View style={styles.routeRow}>
                      <View style={[styles.routeDot, { backgroundColor: "#10B981" }]} />
                      <Text style={[styles.routeTxt, { color: colors.text, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>{c.origem_endereco}</Text>
                    </View>
                    <View style={[styles.routeDivider, { backgroundColor: isDark ? "#334155" : "#e2e8f0" }]} />
                    <View style={styles.routeRow}>
                      <View style={[styles.routeDot, { backgroundColor: cor }]} />
                      <Text style={[styles.routeTxt, { color: colors.text, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>{c.destino_endereco}</Text>
                    </View>
                  </View>
                  <View style={styles.rideFooter}>
                    <Text style={[styles.rideValor, { color: colors.text, fontFamily: "Inter_700Bold" }]}>R$ {fmt(c.valor)}</Text>
                    <Text style={[styles.ridePgt, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>{c.forma_pagamento} · {c.tipo_veiculo}</Text>
                  </View>
                  {c.status === "aguardando" && (
                    <TouchableOpacity onPress={() => aceitar(c.id)} disabled={!!loadingId}
                      style={[styles.rideBtn, { backgroundColor: MOD_COLOR, opacity: isLoading ? 0.7 : 1 }]}>
                      {isLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                        <><Feather name="check-circle" size={15} color="#fff" />
                          <Text style={[styles.rideBtnTxt, { fontFamily: "Inter_700Bold" }]}>Aceitar</Text></>
                      )}
                    </TouchableOpacity>
                  )}
                  {next && isMe && (
                    <TouchableOpacity onPress={() => mudarStatus(c.id, next.next)} disabled={!!loadingId}
                      style={[styles.rideBtn, { backgroundColor: "#10B981", opacity: isLoading ? 0.7 : 1 }]}>
                      {isLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                        <><Feather name="arrow-right-circle" size={15} color="#fff" />
                          <Text style={[styles.rideBtnTxt, { fontFamily: "Inter_700Bold" }]}>{next.label}</Text></>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ── Dashboard: Ganhos Tab ─────────────────────────────────────────────────────
function GanhosTab({ token, isDark, colors }: any) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/motorista-app/ganhos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.emptyCenter}><ActivityIndicator color={MOD_COLOR} size="large" /></View>;

  const r = data?.resumo || {};
  const repasse = data?.motorista?.percentual_repasse || 20;

  return (
    <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={MOD_COLOR} />}>
      {/* Hoje */}
      <View style={[styles.ganhosSumCard, { backgroundColor: MOD_COLOR }]}>
        <Text style={[styles.ganhosSumTitle, { fontFamily: "Inter_700Bold" }]}>Ganhos de Hoje</Text>
        <Text style={[styles.ganhosSumVal, { fontFamily: "Inter_700Bold" }]}>R$ {fmt(r.ganhos_hoje_liquido)}</Text>
        <Text style={[styles.ganhosSumSub, { fontFamily: "Inter_400Regular" }]}>
          {r.corridas_hoje || 0} corrida{r.corridas_hoje !== 1 ? "s" : ""} · bruto R$ {fmt(r.ganhos_hoje)} · repasse R$ {fmt(r.repasse_hoje)}
        </Text>
      </View>

      {/* Semana */}
      <View style={[styles.resumoCard, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
        <Text style={[styles.resumoTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Esta Semana</Text>
        {[
          { label: "Corridas realizadas", value: String(r.corridas_semana || 0), color: MOD_COLOR },
          { label: "Ganhos brutos", value: `R$ ${fmt(r.ganhos_semana)}`, color: "#10B981" },
          { label: `Repasse GoTaxi (${repasse}%)`, value: `R$ ${fmt((r.ganhos_semana || 0) * repasse / 100)}`, color: "#F59E0B" },
          { label: "Você recebe", value: `R$ ${fmt((r.ganhos_semana || 0) * (1 - repasse / 100))}`, color: "#10B981", bold: true },
        ].map(item => (
          <View key={item.label} style={[styles.resumoRow, { borderTopColor: isDark ? "#334155" : "#f1f5f9" }]}>
            <Text style={[styles.resumoLbl, { color: colors.textSecondary, fontFamily: item.bold ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{item.label}</Text>
            <Text style={[styles.resumoVal, { color: item.color, fontFamily: item.bold ? "Inter_700Bold" : "Inter_600SemiBold" }]}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* Total */}
      <View style={[styles.resumoCard, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
        <Text style={[styles.resumoTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Total Acumulado</Text>
        {[
          { label: "Total corridas", value: String((data?.corridas || []).length), color: MOD_COLOR },
          { label: "Total bruto", value: `R$ ${fmt(r.total_bruto)}`, color: "#10B981" },
          { label: `Repasse GoTaxi (${repasse}%)`, value: `R$ ${fmt(r.total_repasse)}`, color: "#F59E0B" },
          { label: "Total líquido", value: `R$ ${fmt(r.total_liquido)}`, color: "#8B5CF6", bold: true },
        ].map(item => (
          <View key={item.label} style={[styles.resumoRow, { borderTopColor: isDark ? "#334155" : "#f1f5f9" }]}>
            <Text style={[styles.resumoLbl, { color: colors.textSecondary, fontFamily: item.bold ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{item.label}</Text>
            <Text style={[styles.resumoVal, { color: item.color, fontFamily: item.bold ? "Inter_700Bold" : "Inter_600SemiBold" }]}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* Histórico corridas */}
      {(data?.corridas || []).length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Últimas Corridas</Text>
          {(data.corridas as any[]).slice(0, 10).map((c: any) => (
            <View key={c.id} style={[styles.corridaHistCard, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.corridaHistNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{c.passageiro_nome}</Text>
                <Text style={[styles.corridaHistRoute, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                  {c.origem_endereco} → {c.destino_endereco}
                </Text>
                <Text style={[styles.corridaHistDate, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                  {fmtDataSimples(c.criado_em)}
                  {c.avaliacao ? ` · ${"★".repeat(c.avaliacao)}` : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.corridaHistBruto, { color: "#10B981", fontFamily: "Inter_700Bold" }]}>R$ {fmt(c.valor_liquido)}</Text>
                {c.is_isento_taxa ? (
                  <Text style={[styles.corridaHistRepasse, { color: "#10B981", fontFamily: "Inter_600SemiBold" }]}>Isento (Alimentação)</Text>
                ) : (
                  <Text style={[styles.corridaHistRepasse, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>- R$ {fmt(c.valor_repasse)} rep.</Text>
                )}
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

// ── Dashboard: Perfil Tab ─────────────────────────────────────────────────────
function PerfilTab({ motorista, token, onRefresh, onLogout, isDark, colors }: any) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    nome: motorista.nome || "",
    email: motorista.email || "",
    cidade: motorista.cidade || "",
    estado: motorista.estado || "",
    veiculo_marca: motorista.veiculo_marca || "",
    veiculo_modelo: motorista.veiculo_modelo || "",
    veiculo_placa: motorista.veiculo_placa || "",
    veiculo_cor: motorista.veiculo_cor || "",
    tipo_veiculo: motorista.tipo_veiculo || "economico",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/motorista-app/perfil`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (res.ok) { setEditing(false); onRefresh(); Alert.alert("Salvo!", "Perfil atualizado com sucesso."); }
      else Alert.alert("Erro", "Não foi possível salvar");
    } catch (_) { Alert.alert("Erro", "Sem conexão"); }
    setSaving(false);
  };

  const docStatusConf: Record<string, { label: string; color: string }> = {
    pendente: { label: "Pendente", color: "#94A3B8" },
    em_analise: { label: "Em análise", color: "#8B5CF6" },
    aprovado: { label: "Aprovado", color: "#10B981" },
    rejeitado: { label: "Rejeitado", color: "#EF4444" },
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }}>
      {/* Perfil Header */}
      <View style={[styles.perfilHeaderCard, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
        <View style={[styles.perfilAvatar, { backgroundColor: MOD_COLOR }]}>
          <Text style={[styles.perfilAvatarTxt, { fontFamily: "Inter_700Bold" }]}>{motorista.nome?.charAt(0)?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.perfilNome, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{motorista.nome}</Text>
          <Text style={[styles.perfilTel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{motorista.telefone}</Text>
          {motorista.email && <Text style={[styles.perfilEmail, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>{motorista.email}</Text>}
        </View>
        <TouchableOpacity onPress={() => setEditing(e => !e)}>
          <Feather name={editing ? "x" : "edit-2"} size={18} color={MOD_COLOR} />
        </TouchableOpacity>
      </View>

      {/* Edit form */}
      {editing && (
        <View style={[styles.editCard, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
          <Text style={[styles.editTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Editar Perfil</Text>
          {([
            ["nome", "Nome completo", "user"],
            ["email", "E-mail", "mail"],
            ["cidade", "Cidade", "map-pin"],
            ["estado", "Estado (UF)", "map"],
          ] as [string, string, string][]).map(([key, lbl, ico]) => (
            <View key={key} style={[styles.editInput, { borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}>
              <Feather name={ico as any} size={14} color={MOD_COLOR} />
              <TextInput style={[styles.editTextField, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                placeholder={lbl} placeholderTextColor={colors.textMuted}
                value={(form as any)[key]} onChangeText={v => setForm(f => ({ ...f, [key]: v }))} />
            </View>
          ))}
          <Text style={[styles.editSection, { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" }]}>Veículo</Text>
          {([
            ["veiculo_marca", "Marca", "truck"],
            ["veiculo_modelo", "Modelo", "truck"],
            ["veiculo_placa", "Placa", "hash"],
            ["veiculo_cor", "Cor", "droplet"],
          ] as [string, string, string][]).map(([key, lbl, ico]) => (
            <View key={key} style={[styles.editInput, { borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}>
              <Feather name={ico as any} size={14} color={MOD_COLOR} />
              <TextInput style={[styles.editTextField, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                placeholder={lbl} placeholderTextColor={colors.textMuted}
                value={(form as any)[key]} onChangeText={v => setForm(f => ({ ...f, [key]: v }))} />
            </View>
          ))}
          <TouchableOpacity onPress={handleSave} disabled={saving}
            style={[styles.saveBtn, { backgroundColor: MOD_COLOR, opacity: saving ? 0.7 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnTxt, { fontFamily: "Inter_700Bold" }]}>Salvar</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Documentos */}
      <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Documentos</Text>
      {DOC_CONF.map(doc => {
        const status = (motorista as any)[doc.key] || "pendente";
        const conf = docStatusConf[status] || docStatusConf.pendente;
        return (
          <View key={doc.key} style={[styles.docCard, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
            <Text style={[styles.docName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{doc.label}</Text>
            <View style={[styles.docStatusBadge, { backgroundColor: conf.color + "22" }]}>
              <View style={[styles.statusDotSm, { backgroundColor: conf.color }]} />
              <Text style={[styles.docStatusTxt, { color: conf.color, fontFamily: "Inter_500Medium" }]}>{conf.label}</Text>
            </View>
          </View>
        );
      })}

      {/* Dados da conta */}
      <View style={[styles.contaCard, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
        <Text style={[styles.editTitle, { color: colors.text, fontFamily: "Inter_700Bold", marginBottom: 10 }]}>Dados da Conta</Text>
        {[
          { label: "Repasse GoTaxi", value: `${motorista.percentual_repasse || 20}% por corrida` },
          { label: "Total de corridas", value: String(motorista.total_corridas || 0) },
          { label: "Avaliação média", value: motorista.avaliacao_media ? `${Number(motorista.avaliacao_media).toFixed(1)} ★` : "Sem avaliações" },
          { label: "Membro desde", value: motorista.criado_em ? fmtDataSimples(motorista.criado_em) : "-" },
        ].map(item => (
          <View key={item.label} style={[styles.contaRow, { borderTopColor: isDark ? "#334155" : "#f1f5f9" }]}>
            <Text style={[styles.contaLbl, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{item.label}</Text>
            <Text style={[styles.contaVal, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity onPress={onLogout} style={[styles.logoutBtn, { borderColor: "#EF4444" }]}>
        <Feather name="log-out" size={16} color="#EF4444" />
        <Text style={[styles.logoutTxt, { fontFamily: "Inter_600SemiBold" }]}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MotoristaApp() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const topPadding = insets.top + TOP_EXTRA;

  const [motorista, setMotorista] = useState<any>(null);
  const [token, setToken] = useState<string>("");
  const [stats, setStats] = useState<any>(null);
  const [tab, setTab] = useState<AppTab>("inicio");
  const [refreshing, setRefreshing] = useState(false);

  const handleAuth = (data: any, t: string) => { setMotorista(data); setToken(t); };
  const handleLogout = () => { setMotorista(null); setToken(""); setStats(null); };

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/motorista-app/stats`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setStats(await res.json());
    } catch (_) {}
    setRefreshing(false);
  }, [token]);

  const refreshPerfil = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/motorista-app/perfil`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMotorista(await res.json());
    } catch (_) {}
  }, [token]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadStats();
    refreshPerfil();
  }, [loadStats, refreshPerfil]);

  useEffect(() => { if (token) { loadStats(); refreshPerfil(); } }, [token]);

  // Not logged in
  if (!motorista) return <AuthScreen onAuth={handleAuth} isDark={isDark} colors={colors} insets={insets} />;

  // Pending / Review / Blocked
  if (motorista.status !== "aprovado") {
    return <StatusScreen motorista={motorista} token={token} onRefresh={refreshPerfil} onLogout={handleLogout} isDark={isDark} colors={colors} insets={insets} />;
  }

  // Approved — full dashboard
  const TABS: { key: AppTab; label: string; icon: string }[] = [
    { key: "inicio", label: "Início", icon: "home" },
    { key: "corridas", label: "Corridas", icon: "navigation" },
    { key: "ganhos", label: "Ganhos", icon: "dollar-sign" },
    { key: "perfil", label: "Perfil", icon: "user" },
  ];

  return (
    <View style={[styles.flex1, { backgroundColor: colors.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPadding + 10, backgroundColor: MOD_COLOR }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
          <Feather name="arrow-left" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.topBarTitle, { fontFamily: "Inter_700Bold" }]}>App do Motorista</Text>
          <Text style={[styles.topBarSub, { fontFamily: "Inter_400Regular" }]}>{motorista.nome}</Text>
        </View>
        <View style={[styles.onlineTag, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
          <View style={styles.onlineDot} />
          <Text style={[styles.onlineTxt, { fontFamily: "Inter_600SemiBold" }]}>Online</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.flex1}>
        {tab === "inicio" && <InicioTab motorista={motorista} stats={stats} refreshing={refreshing} onRefresh={handleRefresh} isDark={isDark} colors={colors} />}
        {tab === "corridas" && <CorridasTab motoristaNome={motorista.nome} token={token} isDark={isDark} colors={colors} />}
        {tab === "ganhos" && <GanhosTab token={token} isDark={isDark} colors={colors} />}
        {tab === "perfil" && <PerfilTab motorista={motorista} token={token} onRefresh={refreshPerfil} onLogout={handleLogout} isDark={isDark} colors={colors} />}
      </View>

      {/* Bottom Nav */}
      <View style={[styles.bottomNav, { backgroundColor: isDark ? "#0f172a" : "#fff", borderTopColor: isDark ? "#1e293b" : "#e2e8f0", paddingBottom: insets.bottom + 4 }]}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={styles.navItem}>
            <Feather name={t.icon as any} size={20} color={tab === t.key ? MOD_COLOR : colors.textMuted} />
            <Text style={[styles.navLabel, { color: tab === t.key ? MOD_COLOR : colors.textMuted, fontFamily: tab === t.key ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex1: { flex: 1 },

  // Auth
  authContainer: { alignItems: "center", gap: 14, paddingHorizontal: 28, paddingBottom: 40 },
  authLogoWrap: { width: 96, height: 96, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  authTitle: { fontSize: 26, textAlign: "center" },
  authSub: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  modeTabs: { flexDirection: "row", borderRadius: 12, padding: 4, width: "100%" },
  modeTab: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  modeTabTxt: { fontSize: 14 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 50, width: "100%" },
  input: { flex: 1, fontSize: 15 },
  authBtn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", width: "100%" },
  authBtnTxt: { color: "#fff", fontSize: 16 },
  backLink: { fontSize: 14 },

  // Status
  statusHeader: { paddingHorizontal: 16, paddingBottom: 16 },
  statusHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  statusHeaderTitle: { color: "#fff", fontSize: 16 },
  statusHeaderSub: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  backCircle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.2)" },
  statusCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  statusCardLabel: { color: "#fff", fontSize: 16, marginBottom: 4 },
  statusCardDesc: { color: "rgba(255,255,255,0.8)", fontSize: 13, lineHeight: 20 },
  sectionTitle: { fontSize: 16, marginBottom: 4 },
  docCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  docCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  docName: { fontSize: 14, marginBottom: 2 },
  docDesc: { fontSize: 12, lineHeight: 18 },
  docStatusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  docStatusTxt: { fontSize: 11 },
  sendDocBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 42, borderRadius: 10 },
  sendDocTxt: { color: "#fff", fontSize: 13 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  infoBoxTxt: { flex: 1, fontSize: 13, lineHeight: 20 },
  blockedBox: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, padding: 16 },
  blockedTxt: { flex: 1, fontSize: 14 },

  // Dashboard top
  topBar: { paddingHorizontal: 16, paddingBottom: 12 },
  topBarTitle: { color: "#fff", fontSize: 16 },
  topBarSub: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  onlineTag: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ADE80" },
  onlineTxt: { color: "#fff", fontSize: 12 },

  // Inicio
  welcomeCard: { borderRadius: 16, padding: 18, flexDirection: "row", alignItems: "center" },
  welcomeHello: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  welcomeName: { color: "#fff", fontSize: 22, marginBottom: 2 },
  welcomeSub: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  approvedBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  approvedTxt: { color: "#fff", fontSize: 12 },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center", gap: 6 },
  statIconWrap: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 15 },
  statLabel: { fontSize: 10, textAlign: "center" },
  repasseCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  repasseRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  repasseTitle: { fontSize: 15 },
  repasseSplit: { flexDirection: "row" },
  repassePart: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  repassePartPct: { fontSize: 26 },
  repassePartLbl: { fontSize: 12, marginTop: 2 },
  avaliacaoRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  avaliacaoTxt: { fontSize: 12, marginLeft: 4 },

  // Corridas tab
  innerTabs: { flexDirection: "row", margin: 12, borderRadius: 12, padding: 4 },
  innerTab: { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  innerTabTxt: { fontSize: 12 },
  emptyCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyTxt: { fontSize: 14, textAlign: "center" },
  rideCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  rideCardAccent: { height: 3 },
  rideCardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ridePassName: { fontSize: 15 },
  rideStatusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  rideStatusTxt: { fontSize: 11 },
  routeBox: { borderRadius: 10, padding: 10, gap: 6 },
  routeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  routeDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  routeTxt: { flex: 1, fontSize: 13, lineHeight: 18 },
  routeDivider: { height: 1, marginLeft: 16 },
  rideFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rideValor: { fontSize: 17 },
  ridePgt: { fontSize: 12 },
  rideBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 44, borderRadius: 10 },
  rideBtnTxt: { color: "#fff", fontSize: 14 },

  // Ganhos
  ganhosSumCard: { borderRadius: 16, padding: 20, gap: 6 },
  ganhosSumTitle: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  ganhosSumVal: { color: "#fff", fontSize: 36 },
  ganhosSumSub: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  resumoCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 0 },
  resumoTitle: { fontSize: 15, marginBottom: 12 },
  resumoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, paddingVertical: 10 },
  resumoLbl: { fontSize: 13 },
  resumoVal: { fontSize: 14 },
  corridaHistCard: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  corridaHistNome: { fontSize: 14, marginBottom: 2 },
  corridaHistRoute: { fontSize: 12 },
  corridaHistDate: { fontSize: 11, marginTop: 2 },
  corridaHistBruto: { fontSize: 15 },
  corridaHistRepasse: { fontSize: 11 },

  // Perfil
  perfilHeaderCard: { borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  perfilAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  perfilAvatarTxt: { color: "#fff", fontSize: 22 },
  perfilNome: { fontSize: 17 },
  perfilTel: { fontSize: 13 },
  perfilEmail: { fontSize: 12 },
  editCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  editTitle: { fontSize: 15 },
  editSection: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  editInput: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 46 },
  editTextField: { flex: 1, fontSize: 14 },
  saveBtn: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 4 },
  saveBtnTxt: { color: "#fff", fontSize: 15 },
  statusDotSm: { width: 6, height: 6, borderRadius: 3 },
  contaCard: { borderRadius: 14, borderWidth: 1, padding: 16 },
  contaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, paddingVertical: 10 },
  contaLbl: { fontSize: 13 },
  contaVal: { fontSize: 14 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 50, borderRadius: 14, borderWidth: 1.5, marginBottom: 20 },
  logoutTxt: { color: "#EF4444", fontSize: 15 },

  // Bottom nav
  bottomNav: { flexDirection: "row", borderTopWidth: 1, paddingTop: 8 },
  navItem: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 },
  navLabel: { fontSize: 10 },
});
