import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, useColorScheme,
  Platform, Modal, TextInput, Alert, ActivityIndicator, RefreshControl, FlatList
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

const MOD_COLOR = Colors.modules.servicos;
const API = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  agendado:     { label: "Agendado",     color: "#F59E0B", icon: "clock" },
  confirmado:   { label: "Confirmado",   color: "#3B82F6", icon: "check-circle" },
  em_andamento: { label: "Em andamento", color: "#8B5CF6", icon: "loader" },
  concluido:    { label: "Concluído",    color: "#10B981", icon: "check-square" },
  cancelado:    { label: "Cancelado",    color: "#EF4444", icon: "x-circle" },
};

const METODOS = [
  { id: "pix",     label: "PIX",            icon: "zap" },
  { id: "dinheiro", label: "Dinheiro",       icon: "dollar-sign" },
  { id: "credito", label: "Cartão Crédito",  icon: "credit-card" },
  { id: "debito",  label: "Cartão Débito",   icon: "credit-card" },
];

type Agendamento = {
  id: number; status: string; servicoNome: string; clienteNome: string;
  clienteTelefone?: string; prestadorNome?: string; dataHora: string;
  valor?: number; valorPago?: number; metodoPagamento?: string;
  comissaoGotaxi?: number; observacoes?: string; prestadorId?: number;
};

type Prestador = {
  id: number; nome: string; especialidade?: string; telefone?: string;
  email?: string; bio?: string; ativo: boolean;
  total_concluidos?: number; receita_total?: number;
};

type Dashboard = {
  agendamentos_hoje: number; total_agendamentos: number;
  prestadores_ativos: number; receita_total: number;
  repasse_pendente: number; repasse_status?: string;
};

type Financeiro = {
  repasse_atual: any; historico_repasses: any[];
  receita_mes: number; concluidos_mes: number; pagamentos_por_metodo: any[];
};

type Categoria = { id: number; nome: string; icone?: string; cor?: string };

type ServicoCatalogo = {
  id: number; nome: string; descricao?: string; preco?: number | string;
  duracao_minutos?: number; ativo: boolean;
  prestador_id?: number | null; categoria_id?: number | null;
  prestador_nome?: string; categoria_nome?: string; categoria_cor?: string;
};

type Promocao = {
  id: number; nome: string; descricao?: string;
  tipo: "percentual" | "valor"; valor: number | string;
  valido_de?: string | null; valido_ate?: string | null; ativo: boolean;
};

type Pacote = {
  id: number; nome: string; descricao?: string;
  preco_total: number | string; sessoes: number;
  validade_dias?: number | null; catalogo_ids?: string | null; ativo: boolean;
};

type TabKey = "dashboard" | "agenda" | "catalogo" | "promocoes" | "pacotes" | "prestadores" | "financeiro";

const TAB_LABELS: Record<TabKey, string> = {
  dashboard: "Dashboard", agenda: "Agenda", catalogo: "Catálogo",
  promocoes: "Promoções", pacotes: "Pacotes", prestadores: "Equipe", financeiro: "Financeiro",
};

export default function ServicosScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { auth } = useAuth();
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const [tab, setTab] = useState<TabKey>("dashboard");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [financeiro, setFinanceiro] = useState<Financeiro | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [catalogo, setCatalogo] = useState<ServicoCatalogo[]>([]);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [metodosPag, setMetodosPag] = useState<string[]>(["pix", "dinheiro", "credito", "debito"]);
  const [paymentConfig, setPaymentConfig] = useState({
    receber_direto: true,
    mercado_pago: false,
    mp_public_key: "",
    mp_user_id: "",
    mp_access_token: "",
  });
  const [savingPag, setSavingPag] = useState(false);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.token || ""}`,
    "x-empresa-id": String(auth.empresa?.id || 1),
  };

  const apiGet = useCallback(async (path: string) => {
    const r = await fetch(`${API}${path}`, { headers });
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  }, [auth.token, auth.empresa?.id]);

  const apiPost = useCallback(async (path: string, body: any) => {
    const r = await fetch(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `${r.status}`); }
    return r.json();
  }, [auth.token, auth.empresa?.id]);

  const apiPut = useCallback(async (path: string, body: any) => {
    const r = await fetch(`${API}${path}`, { method: "PUT", headers, body: JSON.stringify(body) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `${r.status}`); }
    return r.json();
  }, [auth.token, auth.empresa?.id]);

  const apiDelete = useCallback(async (path: string) => {
    const r = await fetch(`${API}${path}`, { method: "DELETE", headers });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `${r.status}`); }
    return r.json();
  }, [auth.token, auth.empresa?.id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [d, a, p, f, c, cat, pr, pa, pag] = await Promise.all([
        apiGet("/servicos/dashboard"),
        apiGet("/servicos/agendamentos"),
        apiGet("/servicos/prestadores"),
        apiGet("/servicos/financeiro"),
        apiGet("/servicos/categorias"),
        apiGet("/servicos/catalogo"),
        apiGet("/servicos/promocoes"),
        apiGet("/servicos/pacotes"),
        apiGet("/pdv/config-pagamento").catch(() => null),
      ]);
      setDashboard(d); setAgendamentos(a); setPrestadores(p); setFinanceiro(f);
      setCategorias(c); setCatalogo(cat); setPromocoes(pr); setPacotes(pa);
      if (pag) {
        if (Array.isArray(pag.metodos)) setMetodosPag(pag.metodos);
        setPaymentConfig(prev => ({
          ...prev,
          receber_direto: pag.receber_direto ?? true,
          mercado_pago: pag.mercado_pago ?? false,
          mp_public_key: pag.mp_public_key || "",
          mp_user_id: pag.mp_user_id || "",
          mp_access_token: "", // Never prefill from server
        }));
      }
    } catch (e) {
      console.error("Erro ao carregar dados de serviços:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiGet]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = () => { setRefreshing(true); loadAll(); };

  // ── AGENDA ─────────────────────────────────────────────────────────────────
  const [modalAgen, setModalAgen] = useState(false);
  const [modalPagar, setModalPagar] = useState<Agendamento | null>(null);
  const [modalStatus, setModalStatus] = useState<Agendamento | null>(null);
  const [agenForm, setAgenForm] = useState({ clienteNome: "", clienteTelefone: "", servicoNome: "", prestadorId: "", dataHora: "", valor: "", observacoes: "" });
  const [agenLoading, setAgenLoading] = useState(false);
  const [pagarValor, setPagarValor] = useState("");
  const [pagarMetodo, setPagarMetodo] = useState("pix");
  const [pagarLoading, setPagarLoading] = useState(false);

  const handleCriarAgendamento = async () => {
    if (!agenForm.clienteNome || !agenForm.dataHora) {
      Alert.alert("Atenção", "Preencha nome do cliente e data/hora");
      return;
    }
    setAgenLoading(true);
    try {
      const dt = new Date(agenForm.dataHora + (agenForm.dataHora.length === 16 ? ":00" : "")).toISOString();
      await apiPost("/servicos/agendamentos", {
        clienteNome: agenForm.clienteNome,
        clienteTelefone: agenForm.clienteTelefone,
        servicoNome: agenForm.servicoNome || "Serviço",
        prestadorId: agenForm.prestadorId ? Number(agenForm.prestadorId) : undefined,
        dataHora: dt,
        valor: agenForm.valor ? Number(agenForm.valor) : undefined,
        observacoes: agenForm.observacoes,
      });
      setModalAgen(false);
      setAgenForm({ clienteNome: "", clienteTelefone: "", servicoNome: "", prestadorId: "", dataHora: "", valor: "", observacoes: "" });
      await loadAll();
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Erro ao criar agendamento");
    } finally {
      setAgenLoading(false);
    }
  };

  const handleAlterarStatus = async (agen: Agendamento, novoStatus: string) => {
    try {
      await apiPut(`/servicos/agendamentos/${agen.id}/status`, { status: novoStatus });
      setModalStatus(null);
      await loadAll();
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Erro ao alterar status");
    }
  };

  const handlePagar = async () => {
    if (!pagarValor || Number(pagarValor) <= 0) {
      Alert.alert("Atenção", "Informe o valor pago");
      return;
    }
    if (!modalPagar) return;
    setPagarLoading(true);
    try {
      const resp = await apiPost(`/servicos/agendamentos/${modalPagar.id}/pagar`, {
        valor_pago: Number(pagarValor),
        metodo_pagamento: pagarMetodo,
      });
      setModalPagar(null);
      setPagarValor("");
      Alert.alert("✅ Pagamento Registrado", resp.mensagem || "Pagamento registrado com sucesso!");
      await loadAll();
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Erro ao registrar pagamento");
    } finally {
      setPagarLoading(false);
    }
  };

  // ── PRESTADORES ────────────────────────────────────────────────────────────
  const [modalPrest, setModalPrest] = useState(false);
  const [editPrest, setEditPrest] = useState<Prestador | null>(null);
  const [prestForm, setPrestForm] = useState({ nome: "", especialidade: "", telefone: "", email: "", bio: "" });
  const [prestLoading, setPrestLoading] = useState(false);

  const openNovoPrest = () => { setEditPrest(null); setPrestForm({ nome: "", especialidade: "", telefone: "", email: "", bio: "" }); setModalPrest(true); };
  const openEditPrest = (p: Prestador) => { setEditPrest(p); setPrestForm({ nome: p.nome, especialidade: p.especialidade || "", telefone: p.telefone || "", email: p.email || "", bio: p.bio || "" }); setModalPrest(true); };

  const handleSalvarPrest = async () => {
    if (!prestForm.nome) { Alert.alert("Atenção", "Informe o nome"); return; }
    setPrestLoading(true);
    try {
      if (editPrest) {
        await apiPut(`/servicos/prestadores/${editPrest.id}`, prestForm);
      } else {
        await apiPost("/servicos/prestadores", prestForm);
      }
      setModalPrest(false);
      await loadAll();
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Erro ao salvar");
    } finally {
      setPrestLoading(false);
    }
  };

  const handleDesativarPrest = (p: Prestador) => {
    Alert.alert("Desativar prestador", `Deseja desativar ${p.nome}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Desativar", style: "destructive", onPress: async () => {
        await apiDelete(`/servicos/prestadores/${p.id}`);
        loadAll();
      }},
    ]);
  };

  // ── CATEGORIAS / CATÁLOGO ──────────────────────────────────────────────────
  const [modalCat, setModalCat] = useState(false);
  const [editCat, setEditCat] = useState<Categoria | null>(null);
  const [catForm, setCatForm] = useState({ nome: "", icone: "tool", cor: "#45B7D1" });
  const [catSaving, setCatSaving] = useState(false);

  const openNovaCat = () => { setEditCat(null); setCatForm({ nome: "", icone: "tool", cor: "#45B7D1" }); setModalCat(true); };
  const openEditCat = (c: Categoria) => { setEditCat(c); setCatForm({ nome: c.nome, icone: c.icone || "tool", cor: c.cor || "#45B7D1" }); setModalCat(true); };

  const handleSalvarCategoria = async () => {
    if (!catForm.nome) { Alert.alert("Atenção", "Informe o nome"); return; }
    setCatSaving(true);
    try {
      if (editCat) await apiPut(`/servicos/categorias/${editCat.id}`, catForm);
      else await apiPost("/servicos/categorias", catForm);
      setModalCat(false);
      setEditCat(null);
      setCatForm({ nome: "", icone: "tool", cor: "#45B7D1" });
      await loadAll();
    } catch (e: any) { Alert.alert("Erro", e.message || "Erro ao salvar"); }
    finally { setCatSaving(false); }
  };

  const handleRemoverCategoria = (c: Categoria) => {
    Alert.alert("Remover categoria", `Remover "${c.nome}"? Os serviços vinculados ficarão sem categoria.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: async () => {
        try { await apiDelete(`/servicos/categorias/${c.id}`); await loadAll(); }
        catch (e: any) { Alert.alert("Erro", e.message || "Erro ao remover"); }
      }},
    ]);
  };

  const [modalSrv, setModalSrv] = useState(false);
  const [editSrv, setEditSrv] = useState<ServicoCatalogo | null>(null);
  const [srvForm, setSrvForm] = useState({ nome: "", descricao: "", preco: "", duracao_minutos: "60", categoria_id: "", prestador_id: "" });
  const [srvSaving, setSrvSaving] = useState(false);

  const openNovoSrv = () => { setEditSrv(null); setSrvForm({ nome: "", descricao: "", preco: "", duracao_minutos: "60", categoria_id: "", prestador_id: "" }); setModalSrv(true); };
  const openEditSrv = (s: ServicoCatalogo) => {
    setEditSrv(s);
    setSrvForm({
      nome: s.nome, descricao: s.descricao || "",
      preco: String(s.preco ?? ""), duracao_minutos: String(s.duracao_minutos ?? 60),
      categoria_id: s.categoria_id ? String(s.categoria_id) : "",
      prestador_id: s.prestador_id ? String(s.prestador_id) : "",
    });
    setModalSrv(true);
  };

  const handleSalvarServico = async () => {
    if (!srvForm.nome || !srvForm.preco) { Alert.alert("Atenção", "Informe nome e preço"); return; }
    setSrvSaving(true);
    try {
      const body = {
        nome: srvForm.nome, descricao: srvForm.descricao,
        preco: Number(srvForm.preco), duracao_minutos: Number(srvForm.duracao_minutos) || 60,
        categoria_id: srvForm.categoria_id ? Number(srvForm.categoria_id) : null,
        prestador_id: srvForm.prestador_id ? Number(srvForm.prestador_id) : null,
      };
      if (editSrv) await apiPut(`/servicos/catalogo/${editSrv.id}`, body);
      else await apiPost("/servicos/catalogo", body);
      setModalSrv(false);
      await loadAll();
    } catch (e: any) { Alert.alert("Erro", e.message || "Erro ao salvar"); }
    finally { setSrvSaving(false); }
  };

  const handleRemoverServico = (s: ServicoCatalogo) => {
    Alert.alert("Remover serviço", `Remover "${s.nome}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: async () => { await apiDelete(`/servicos/catalogo/${s.id}`); loadAll(); }},
    ]);
  };

  // ── PROMOÇÕES ──────────────────────────────────────────────────────────────
  const [modalProm, setModalProm] = useState(false);
  const [editProm, setEditProm] = useState<Promocao | null>(null);
  const [promForm, setPromForm] = useState({ nome: "", descricao: "", tipo: "percentual" as "percentual" | "valor", valor: "", valido_de: "", valido_ate: "" });
  const [promSaving, setPromSaving] = useState(false);

  const openNovaProm = () => { setEditProm(null); setPromForm({ nome: "", descricao: "", tipo: "percentual", valor: "", valido_de: "", valido_ate: "" }); setModalProm(true); };
  const openEditProm = (p: Promocao) => {
    setEditProm(p);
    setPromForm({
      nome: p.nome, descricao: p.descricao || "", tipo: p.tipo, valor: String(p.valor ?? ""),
      valido_de: p.valido_de ? String(p.valido_de).substring(0, 10) : "",
      valido_ate: p.valido_ate ? String(p.valido_ate).substring(0, 10) : "",
    });
    setModalProm(true);
  };

  const handleSalvarPromocao = async () => {
    if (!promForm.nome || !promForm.valor) { Alert.alert("Atenção", "Informe nome e valor"); return; }
    setPromSaving(true);
    try {
      const body = { ...promForm, valor: Number(promForm.valor) };
      if (editProm) await apiPut(`/servicos/promocoes/${editProm.id}`, body);
      else await apiPost("/servicos/promocoes", body);
      setModalProm(false);
      await loadAll();
    } catch (e: any) { Alert.alert("Erro", e.message || "Erro ao salvar"); }
    finally { setPromSaving(false); }
  };

  const handleRemoverPromocao = (p: Promocao) => {
    Alert.alert("Remover promoção", `Remover "${p.nome}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: async () => { await apiDelete(`/servicos/promocoes/${p.id}`); loadAll(); }},
    ]);
  };

  const togglePromocaoAtivo = async (p: Promocao) => {
    try { await apiPut(`/servicos/promocoes/${p.id}`, { ativo: !p.ativo }); await loadAll(); }
    catch (e: any) { Alert.alert("Erro", e.message || "Erro"); }
  };

  // ── PACOTES ────────────────────────────────────────────────────────────────
  const [modalPac, setModalPac] = useState(false);
  const [editPac, setEditPac] = useState<Pacote | null>(null);
  const [pacForm, setPacForm] = useState({ nome: "", descricao: "", preco_total: "", sessoes: "1", validade_dias: "", catalogo_ids: [] as number[] });
  const [pacSaving, setPacSaving] = useState(false);

  const openNovoPac = () => { setEditPac(null); setPacForm({ nome: "", descricao: "", preco_total: "", sessoes: "1", validade_dias: "", catalogo_ids: [] }); setModalPac(true); };
  const openEditPac = (p: Pacote) => {
    setEditPac(p);
    const ids = p.catalogo_ids ? String(p.catalogo_ids).split(",").map(n => Number(n)).filter(Boolean) : [];
    setPacForm({
      nome: p.nome, descricao: p.descricao || "",
      preco_total: String(p.preco_total ?? ""), sessoes: String(p.sessoes ?? 1),
      validade_dias: p.validade_dias ? String(p.validade_dias) : "",
      catalogo_ids: ids,
    });
    setModalPac(true);
  };

  const togglePacoteServico = (id: number) => {
    setPacForm(prev => ({
      ...prev,
      catalogo_ids: prev.catalogo_ids.includes(id) ? prev.catalogo_ids.filter(x => x !== id) : [...prev.catalogo_ids, id],
    }));
  };

  const handleSalvarPacote = async () => {
    if (!pacForm.nome || !pacForm.preco_total) { Alert.alert("Atenção", "Informe nome e preço total"); return; }
    setPacSaving(true);
    try {
      const body = {
        nome: pacForm.nome, descricao: pacForm.descricao,
        preco_total: Number(pacForm.preco_total),
        sessoes: Number(pacForm.sessoes) || 1,
        validade_dias: pacForm.validade_dias ? Number(pacForm.validade_dias) : null,
        catalogo_ids: pacForm.catalogo_ids,
      };
      if (editPac) await apiPut(`/servicos/pacotes/${editPac.id}`, body);
      else await apiPost("/servicos/pacotes", body);
      setModalPac(false);
      await loadAll();
    } catch (e: any) { Alert.alert("Erro", e.message || "Erro ao salvar"); }
    finally { setPacSaving(false); }
  };

  const handleRemoverPacote = (p: Pacote) => {
    Alert.alert("Remover pacote", `Remover "${p.nome}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: async () => { await apiDelete(`/servicos/pacotes/${p.id}`); loadAll(); }},
    ]);
  };

  const togglePacoteAtivo = async (p: Pacote) => {
    try { await apiPut(`/servicos/pacotes/${p.id}`, { ativo: !p.ativo }); await loadAll(); }
    catch (e: any) { Alert.alert("Erro", e.message || "Erro"); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // UI helpers
  // ─────────────────────────────────────────────────────────────────────────
  const fmtMoeda = (v?: number | null) =>
    v != null ? `R$ ${Number(v).toFixed(2).replace(".", ",")}` : "—";
  const fmtData = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const dd = d.getDate().toString().padStart(2,"0");
    const mm = (d.getMonth()+1).toString().padStart(2,"0");
    const hh = d.getHours().toString().padStart(2,"0");
    const min = d.getMinutes().toString().padStart(2,"0");
    return `${dd}/${mm} ${hh}:${min}`;
  };

  // ─── Alerta de repasse ────────────────────────────────────────────────────
  const repasePendente = (dashboard?.repasse_pendente ?? 0) > 0;
  const RepaseAlert = () => repasePendente ? (
    <View style={[styles.alertBanner, { backgroundColor: "#EF4444" + "18", borderColor: "#EF4444" + "40" }]}>
      <Feather name="alert-triangle" size={15} color="#EF4444" />
      <Text style={[styles.alertText, { color: "#EF4444", fontFamily: "Inter_500Medium" }]}>
        Repasse GoTaxi pendente: {fmtMoeda(dashboard?.repasse_pendente)} (3%) — pague para evitar bloqueio
      </Text>
    </View>
  ) : null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDERS
  // ─────────────────────────────────────────────────────────────────────────
  const renderDashboard = () => (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MOD_COLOR} />}
      showsVerticalScrollIndicator={false}
    >
      <RepaseAlert />

      <View style={styles.statsGrid}>
        {[
          { label: "Hoje",         value: dashboard?.agendamentos_hoje ?? 0,   icon: "calendar",  color: MOD_COLOR },
          { label: "Total",        value: dashboard?.total_agendamentos ?? 0,   icon: "list",      color: "#3B82F6" },
          { label: "Prestadores",  value: dashboard?.prestadores_ativos ?? 0,   icon: "users",     color: "#8B5CF6" },
          { label: "Receita Total",value: fmtMoeda(dashboard?.receita_total),   icon: "dollar-sign",color: "#10B981" },
        ].map(s => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: s.color + "20" }]}>
              <Feather name={s.icon as any} size={18} color={s.color} />
            </View>
            <Text style={[styles.statVal, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{s.value}</Text>
            <Text style={[styles.statLbl, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Próximos agendamentos</Text>
      {agendamentos.filter(a => a.status !== "cancelado" && a.status !== "concluido").slice(0, 5).map(a => (
        <AgendamentoCard key={a.id} a={a} colors={colors} onPagar={() => { setModalPagar(a); setPagarValor(String(a.valor || "")); }} onStatus={() => setModalStatus(a)} fmtData={fmtData} fmtMoeda={fmtMoeda} />
      ))}
      {agendamentos.filter(a => a.status !== "cancelado" && a.status !== "concluido").length === 0 && (
        <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="calendar" size={32} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Nenhum agendamento pendente</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderAgenda = () => (
    <>
      <View style={[styles.actionBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.actionBarTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{agendamentos.length} agendamentos</Text>
        <Pressable style={[styles.addBtn, { backgroundColor: MOD_COLOR }]} onPress={() => setModalAgen(true)}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={[styles.addBtnText, { fontFamily: "Inter_600SemiBold" }]}>Novo</Text>
        </Pressable>
      </View>
      <FlatList
        data={agendamentos}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MOD_COLOR} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="calendar" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Nenhum agendamento encontrado</Text>
          </View>
        )}
        renderItem={({ item: a }) => (
          <AgendamentoCard
            key={a.id} a={a} colors={colors}
            onPagar={() => { setModalPagar(a); setPagarValor(String(a.valor || "")); }}
            onStatus={() => setModalStatus(a)}
            fmtData={fmtData} fmtMoeda={fmtMoeda}
          />
        )}
      />
    </>
  );

  const renderPrestadores = () => (
    <>
      <View style={[styles.actionBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.actionBarTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{prestadores.filter(p => p.ativo).length} ativos</Text>
        <Pressable style={[styles.addBtn, { backgroundColor: MOD_COLOR }]} onPress={openNovoPrest}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={[styles.addBtnText, { fontFamily: "Inter_600SemiBold" }]}>Novo</Text>
        </Pressable>
      </View>
      <FlatList
        data={prestadores}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MOD_COLOR} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="users" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Nenhum prestador cadastrado</Text>
          </View>
        )}
        renderItem={({ item: p }) => (
          <View key={p.id} style={[styles.prestCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: p.ativo ? 1 : 0.5 }]}>
            <View style={[styles.prestAvatar, { backgroundColor: MOD_COLOR + "20" }]}>
              <Text style={[styles.prestIni, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>{p.nome[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prestNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{p.nome}</Text>
              {p.especialidade ? <Text style={[styles.prestEsp, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{p.especialidade}</Text> : null}
              <View style={styles.prestMeta}>
                <Text style={[styles.prestMetaText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>{p.total_concluidos ?? 0} serviços</Text>
                <Text style={[styles.prestMetaDot, { color: colors.textMuted }]}> · </Text>
                <Text style={[styles.prestMetaText, { color: "#10B981", fontFamily: "Inter_500Medium" }]}>{fmtMoeda(p.receita_total)}</Text>
              </View>
            </View>
            <View style={styles.prestActions}>
              <Pressable onPress={() => openEditPrest(p)} style={[styles.iconBtn, { backgroundColor: colors.border + "80" }]}>
                <Feather name="edit-2" size={15} color={colors.textSecondary} />
              </Pressable>
              {p.ativo && (
                <Pressable onPress={() => handleDesativarPrest(p)} style={[styles.iconBtn, { backgroundColor: "#EF444420" }]}>
                  <Feather name="trash-2" size={15} color="#EF4444" />
                </Pressable>
              )}
            </View>
          </View>
        )}
      />
    </>
  );

  // ─── CATÁLOGO (Categorias + Serviços) ─────────────────────────────────────
  const renderCatalogo = () => (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MOD_COLOR} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Categorias */}
      <View style={styles.catalogoHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold", marginTop: 0 }]}>Categorias</Text>
        <Pressable style={[styles.smallAddBtn, { backgroundColor: MOD_COLOR }]} onPress={openNovaCat}>
          <Feather name="plus" size={14} color="#fff" />
          <Text style={[styles.smallAddText, { fontFamily: "Inter_600SemiBold" }]}>Categoria</Text>
        </Pressable>
      </View>
      {categorias.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 20 }]}>
          <Feather name="tag" size={28} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Cadastre categorias para organizar seus serviços</Text>
        </View>
      ) : (
        <View style={styles.catChipsWrap}>
          {categorias.map(c => (
            <View key={c.id} style={[styles.catChip, { backgroundColor: (c.cor || MOD_COLOR) + "20", borderColor: (c.cor || MOD_COLOR) + "40" }]}>
              <Pressable onPress={() => openEditCat(c)} hitSlop={4}>
                <Text style={[styles.catChipText, { color: c.cor || MOD_COLOR, fontFamily: "Inter_600SemiBold" }]}>{c.nome}</Text>
              </Pressable>
              <Pressable onPress={() => handleRemoverCategoria(c)} hitSlop={8}>
                <Feather name="x" size={13} color={c.cor || MOD_COLOR} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Serviços */}
      <View style={[styles.catalogoHeaderRow, { marginTop: 20 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold", marginTop: 0 }]}>Serviços ({catalogo.length})</Text>
        <Pressable style={[styles.smallAddBtn, { backgroundColor: MOD_COLOR }]} onPress={openNovoSrv}>
          <Feather name="plus" size={14} color="#fff" />
          <Text style={[styles.smallAddText, { fontFamily: "Inter_600SemiBold" }]}>Serviço</Text>
        </Pressable>
      </View>
      {catalogo.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="tool" size={32} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Nenhum serviço cadastrado</Text>
        </View>
      ) : catalogo.map(s => (
        <View key={s.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <View style={styles.itemTopRow}>
              <Text style={[styles.itemNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{s.nome}</Text>
              {s.categoria_nome && (
                <View style={[styles.miniBadge, { backgroundColor: (s.categoria_cor || MOD_COLOR) + "20" }]}>
                  <Text style={[styles.miniBadgeText, { color: s.categoria_cor || MOD_COLOR, fontFamily: "Inter_500Medium" }]}>{s.categoria_nome}</Text>
                </View>
              )}
            </View>
            {s.descricao ? <Text style={[styles.itemDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>{s.descricao}</Text> : null}
            <View style={styles.itemMetaRow}>
              <Text style={[styles.itemPreco, { color: "#10B981", fontFamily: "Inter_700Bold" }]}>{fmtMoeda(Number(s.preco))}</Text>
              <Text style={[styles.itemMetaText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}> · {s.duracao_minutos} min</Text>
              {s.prestador_nome ? <Text style={[styles.itemMetaText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]} numberOfLines={1}> · {s.prestador_nome}</Text> : null}
            </View>
          </View>
          <View style={styles.prestActions}>
            <Pressable onPress={() => openEditSrv(s)} style={[styles.iconBtn, { backgroundColor: colors.border + "80" }]}>
              <Feather name="edit-2" size={15} color={colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => handleRemoverServico(s)} style={[styles.iconBtn, { backgroundColor: "#EF444420" }]}>
              <Feather name="trash-2" size={15} color="#EF4444" />
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  // ─── PROMOÇÕES ────────────────────────────────────────────────────────────
  const renderPromocoes = () => (
    <>
      <View style={[styles.actionBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.actionBarTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{promocoes.filter(p => p.ativo).length} ativas · {promocoes.length} total</Text>
        <Pressable style={[styles.addBtn, { backgroundColor: MOD_COLOR }]} onPress={openNovaProm}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={[styles.addBtnText, { fontFamily: "Inter_600SemiBold" }]}>Nova</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MOD_COLOR} />}
        showsVerticalScrollIndicator={false}
      >
        {promocoes.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="percent" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Nenhuma promoção cadastrada</Text>
          </View>
        ) : promocoes.map(p => (
          <View key={p.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: p.ativo ? 1 : 0.5 }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.itemTopRow}>
                <Text style={[styles.itemNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{p.nome}</Text>
                <View style={[styles.miniBadge, { backgroundColor: p.ativo ? "#10B98120" : "#64748B20" }]}>
                  <Text style={[styles.miniBadgeText, { color: p.ativo ? "#10B981" : "#64748B", fontFamily: "Inter_500Medium" }]}>{p.ativo ? "Ativa" : "Inativa"}</Text>
                </View>
              </View>
              {p.descricao ? <Text style={[styles.itemDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>{p.descricao}</Text> : null}
              <View style={styles.itemMetaRow}>
                <Text style={[styles.itemPreco, { color: "#F59E0B", fontFamily: "Inter_700Bold" }]}>
                  {p.tipo === "percentual" ? `${Number(p.valor)}% OFF` : `- ${fmtMoeda(Number(p.valor))}`}
                </Text>
                {(p.valido_de || p.valido_ate) && (
                  <Text style={[styles.itemMetaText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                    {" · "}{p.valido_de ? fmtData(p.valido_de)?.slice(0,5) : "—"} → {p.valido_ate ? fmtData(p.valido_ate)?.slice(0,5) : "—"}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.prestActions}>
              <Pressable onPress={() => togglePromocaoAtivo(p)} style={[styles.iconBtn, { backgroundColor: (p.ativo ? "#10B981" : "#64748B") + "20" }]}>
                <Feather name={p.ativo ? "pause" : "play"} size={15} color={p.ativo ? "#10B981" : "#64748B"} />
              </Pressable>
              <Pressable onPress={() => openEditProm(p)} style={[styles.iconBtn, { backgroundColor: colors.border + "80" }]}>
                <Feather name="edit-2" size={15} color={colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => handleRemoverPromocao(p)} style={[styles.iconBtn, { backgroundColor: "#EF444420" }]}>
                <Feather name="trash-2" size={15} color="#EF4444" />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );

  // ─── PACOTES ──────────────────────────────────────────────────────────────
  const renderPacotes = () => (
    <>
      <View style={[styles.actionBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.actionBarTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{pacotes.filter(p => p.ativo).length} ativos · {pacotes.length} total</Text>
        <Pressable style={[styles.addBtn, { backgroundColor: MOD_COLOR }]} onPress={openNovoPac}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={[styles.addBtnText, { fontFamily: "Inter_600SemiBold" }]}>Novo</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MOD_COLOR} />}
        showsVerticalScrollIndicator={false}
      >
        {pacotes.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="package" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Nenhum pacote cadastrado</Text>
          </View>
        ) : pacotes.map(p => {
          const ids = p.catalogo_ids ? String(p.catalogo_ids).split(",").map(n => Number(n)).filter(Boolean) : [];
          const inclusos = catalogo.filter(s => ids.includes(s.id));
          return (
            <View key={p.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: p.ativo ? 1 : 0.5 }]}>
              <View style={{ flex: 1 }}>
                <View style={styles.itemTopRow}>
                  <Text style={[styles.itemNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{p.nome}</Text>
                  <View style={[styles.miniBadge, { backgroundColor: p.ativo ? "#10B98120" : "#64748B20" }]}>
                    <Text style={[styles.miniBadgeText, { color: p.ativo ? "#10B981" : "#64748B", fontFamily: "Inter_500Medium" }]}>{p.ativo ? "Ativo" : "Inativo"}</Text>
                  </View>
                </View>
                {p.descricao ? <Text style={[styles.itemDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>{p.descricao}</Text> : null}
                <View style={styles.itemMetaRow}>
                  <Text style={[styles.itemPreco, { color: "#10B981", fontFamily: "Inter_700Bold" }]}>{fmtMoeda(Number(p.preco_total))}</Text>
                  <Text style={[styles.itemMetaText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}> · {p.sessoes} sessões{p.validade_dias ? ` · ${p.validade_dias} dias` : ""}</Text>
                </View>
                {inclusos.length > 0 && (
                  <Text style={[styles.itemDesc, { color: colors.textMuted, fontFamily: "Inter_400Regular", marginTop: 4 }]} numberOfLines={2}>
                    Inclui: {inclusos.map(i => i.nome).join(", ")}
                  </Text>
                )}
              </View>
              <View style={styles.prestActions}>
                <Pressable onPress={() => togglePacoteAtivo(p)} style={[styles.iconBtn, { backgroundColor: (p.ativo ? "#10B981" : "#64748B") + "20" }]}>
                  <Feather name={p.ativo ? "pause" : "play"} size={15} color={p.ativo ? "#10B981" : "#64748B"} />
                </Pressable>
                <Pressable onPress={() => openEditPac(p)} style={[styles.iconBtn, { backgroundColor: colors.border + "80" }]}>
                  <Feather name="edit-2" size={15} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => handleRemoverPacote(p)} style={[styles.iconBtn, { backgroundColor: "#EF444420" }]}>
                  <Feather name="trash-2" size={15} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </>
  );

  const PAG_OPCOES: Array<{ key: string; label: string; emoji: string }> = [
    { key: "pix", label: "PIX", emoji: "💠" },
    { key: "dinheiro", label: "Dinheiro", emoji: "💵" },
    { key: "credito", label: "Crédito", emoji: "💳" },
    { key: "debito", label: "Débito", emoji: "🏦" },
    { key: "vr", label: "VR", emoji: "🍽️" },
    { key: "sodexo", label: "Sodexo", emoji: "🎫" },
  ];

  const togglePagamento = (key: string) => {
    setMetodosPag(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleSavePagamento = async () => {
    if (metodosPag.length === 0) {
      Alert.alert("Atenção", "Habilite ao menos uma forma de pagamento.");
      return;
    }
    setSavingPag(true);
    try {
      const payload: any = { 
        metodos: metodosPag,
        receber_direto: paymentConfig.receber_direto,
        mercado_pago: paymentConfig.mercado_pago,
        mp_public_key: paymentConfig.mp_public_key,
        mp_user_id: paymentConfig.mp_user_id,
      };
      if (paymentConfig.mp_access_token) {
        payload.mp_access_token = paymentConfig.mp_access_token;
      }
      await apiPut("/pdv/config-pagamento", payload);
      setPaymentConfig(prev => ({ ...prev, mp_access_token: "" })); // Clear after saving
      Alert.alert("Pronto", "Configurações de pagamento atualizadas.");
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível salvar.");
    } finally {
      setSavingPag(false);
    }
  };

  const renderFinanceiro = () => {
    const rep = financeiro?.repasse_atual;
    const repPendente = rep && rep.status === "pendente" && Number(rep.valor_repasse) > 0;
    return (
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MOD_COLOR} />}
        showsVerticalScrollIndicator={false}
      >
        {repPendente && (
          <View style={[styles.repaseBanner, { backgroundColor: "#EF444410", borderColor: "#EF444440" }]}>
            <Feather name="alert-triangle" size={22} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.repaseBannerTitle, { color: "#EF4444", fontFamily: "Inter_700Bold" }]}>
                ⚠️ Repasse Pendente
              </Text>
              <Text style={[styles.repaseBannerSub, { color: "#EF4444", fontFamily: "Inter_400Regular" }]}>
                Pague R$ {Number(rep.valor_repasse).toFixed(2)} via PIX GoTaxi para evitar bloqueio da conta na segunda-feira após 18h.
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.repaseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.repaseCardTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Configurações de Pagamento</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, marginBottom: 10 }}>
            Configurações e métodos que o cliente verá no app ao agendar.
          </Text>

          <View style={{ gap: 14, marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, fontFamily: "Inter_500Medium" }}>Receber direto (Dinheiro, Pix chave...)</Text>
              <Pressable
                onPress={() => setPaymentConfig(prev => ({ ...prev, receber_direto: !prev.receber_direto }))}
                style={{
                  width: 44, height: 24, borderRadius: 12, padding: 2,
                  backgroundColor: paymentConfig.receber_direto ? "#10B981" : colors.border
                }}
              >
                <View style={{
                  width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff",
                  transform: [{ translateX: paymentConfig.receber_direto ? 20 : 0 }]
                }} />
              </Pressable>
            </View>

            {paymentConfig.receber_direto && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.border }}>
                {PAG_OPCOES.map(opt => {
                  const enabled = metodosPag.includes(opt.key);
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => togglePagamento(opt.key)}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: 6,
                        paddingHorizontal: 12, paddingVertical: 8,
                        borderRadius: 999, borderWidth: 1.5,
                        borderColor: enabled ? MOD_COLOR : colors.border,
                        backgroundColor: enabled ? MOD_COLOR + "15" : colors.background,
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>{opt.emoji}</Text>
                      <Text style={{ color: enabled ? MOD_COLOR : colors.textSecondary, fontFamily: enabled ? "Inter_600SemiBold" : "Inter_400Regular", fontSize: 13 }}>
                        {opt.label}
                      </Text>
                      {enabled && <Feather name="check" size={13} color={MOD_COLOR} />}
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ color: colors.text, fontFamily: "Inter_500Medium" }}>Mercado Pago (Integração)</Text>
              <Pressable
                onPress={() => setPaymentConfig(prev => ({ ...prev, mercado_pago: !prev.mercado_pago }))}
                style={{
                  width: 44, height: 24, borderRadius: 12, padding: 2,
                  backgroundColor: paymentConfig.mercado_pago ? "#00B1EA" : colors.border
                }}
              >
                <View style={{
                  width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff",
                  transform: [{ translateX: paymentConfig.mercado_pago ? 20 : 0 }]
                }} />
              </Pressable>
            </View>

            {paymentConfig.mercado_pago && (
              <View style={{ gap: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.border }}>
                <TextInput
                  style={{
                    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
                    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, fontFamily: "Inter_400Regular"
                  }}
                  placeholder="Public Key"
                  placeholderTextColor={colors.textMuted}
                  value={paymentConfig.mp_public_key}
                  onChangeText={(val) => setPaymentConfig(p => ({ ...p, mp_public_key: val }))}
                />
                <TextInput
                  style={{
                    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
                    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, fontFamily: "Inter_400Regular"
                  }}
                  placeholder="User ID (Opcional)"
                  placeholderTextColor={colors.textMuted}
                  value={paymentConfig.mp_user_id}
                  onChangeText={(val) => setPaymentConfig(p => ({ ...p, mp_user_id: val }))}
                />
                <TextInput
                  style={{
                    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
                    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, fontFamily: "Inter_400Regular"
                  }}
                  placeholder="Access Token (Deixe em branco para não alterar)"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  value={paymentConfig.mp_access_token}
                  onChangeText={(val) => setPaymentConfig(p => ({ ...p, mp_access_token: val }))}
                />
              </View>
            )}
          </View>

          <Pressable
            onPress={handleSavePagamento}
            disabled={savingPag}
            style={{
              backgroundColor: MOD_COLOR,
              paddingVertical: 11,
              borderRadius: 10,
              alignItems: "center",
              opacity: savingPag ? 0.6 : 1,
            }}
          >
            {savingPag
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Salvar formas de pagamento</Text>}
          </Pressable>
        </View>

        <View style={[styles.repaseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.repaseCardTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Repasse da Semana Atual</Text>
          {rep ? (
            <>
              <View style={styles.repaseRow}>
                <Text style={[styles.repaseLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Receita registrada</Text>
                <Text style={[styles.repaseVal, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{fmtMoeda(rep.receita_total)}</Text>
              </View>
              <View style={styles.repaseRow}>
                <Text style={[styles.repaseLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Comissão GoTaxi (3%)</Text>
                <Text style={[styles.repaseVal, { color: repPendente ? "#EF4444" : "#10B981", fontFamily: "Inter_700Bold" }]}>{fmtMoeda(rep.valor_repasse)}</Text>
              </View>
              <View style={styles.repaseRow}>
                <Text style={[styles.repaseLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Status</Text>
                <View style={[styles.repaseStatus, { backgroundColor: rep.status === "pago" ? "#10B98120" : "#EF444420" }]}>
                  <Text style={[styles.repaseStatusText, { color: rep.status === "pago" ? "#10B981" : "#EF4444", fontFamily: "Inter_500Medium" }]}>
                    {rep.status === "pago" ? "✅ Pago" : "⏳ Pendente"}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={[styles.repaseEmpty, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
              Nenhum serviço pago nesta semana ainda.
            </Text>
          )}
        </View>

        <View style={[styles.repaseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.repaseCardTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Este Mês</Text>
          <View style={styles.repaseRow}>
            <Text style={[styles.repaseLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Serviços concluídos</Text>
            <Text style={[styles.repaseVal, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{financeiro?.concluidos_mes ?? 0}</Text>
          </View>
          <View style={styles.repaseRow}>
            <Text style={[styles.repaseLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Receita total</Text>
            <Text style={[styles.repaseVal, { color: "#10B981", fontFamily: "Inter_700Bold" }]}>{fmtMoeda(financeiro?.receita_mes)}</Text>
          </View>
        </View>

        {(financeiro?.pagamentos_por_metodo?.length ?? 0) > 0 && (
          <View style={[styles.repaseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.repaseCardTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Métodos de Pagamento (semana)</Text>
            {financeiro?.pagamentos_por_metodo.map(m => (
              <View key={m.metodo_pagamento} style={styles.repaseRow}>
                <Text style={[styles.repaseLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                  {m.metodo_pagamento?.toUpperCase() || "—"}
                </Text>
                <Text style={[styles.repaseVal, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
                  {m.qtd}x · {fmtMoeda(m.total)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Histórico de Repasses</Text>
        {(financeiro?.historico_repasses?.length ?? 0) === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Nenhum repasse ainda</Text>
          </View>
        ) : financeiro?.historico_repasses.map((r, i) => (
          <View key={i} style={[styles.repaseHistCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View>
              <Text style={[styles.repaseHistSem, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
                {fmtData(r.semana_inicio)?.slice(0,5)} – {fmtData(r.semana_fim)?.slice(0,5)}
              </Text>
              <Text style={[styles.repaseHistSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                Receita: {fmtMoeda(r.receita_total)}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.repaseHistVal, { color: r.status === "pago" ? "#10B981" : "#EF4444", fontFamily: "Inter_700Bold" }]}>
                {fmtMoeda(r.valor_repasse)}
              </Text>
              <Text style={[styles.repaseHistStatus, { color: r.status === "pago" ? "#10B981" : "#EF4444", fontFamily: "Inter_400Regular" }]}>
                {r.status === "pago" ? "Pago" : "Pendente"}
              </Text>
            </View>
          </View>
        ))}

        <View style={[styles.infoBox, { backgroundColor: MOD_COLOR + "10", borderColor: MOD_COLOR + "30" }]}>
          <Feather name="info" size={14} color={MOD_COLOR} />
          <Text style={[styles.infoText, { color: MOD_COLOR, fontFamily: "Inter_400Regular" }]}>
            O pagamento do serviço é feito diretamente ao prestador. A GoTaxi retém 3% da receita semanal como comissão de plataforma.
          </Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <View style={[styles.headerIcon, { backgroundColor: MOD_COLOR + "20" }]}>
            <Feather name="tool" size={18} color={MOD_COLOR} />
          </View>
          <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Serviços</Text>
        </View>
        {loading && !refreshing ? <ActivityIndicator size="small" color={MOD_COLOR} /> : <View style={{ width: 24 }} />}
      </View>

      {/* Tabs */}
      <View style={[styles.tabBarWrap, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
          {(["dashboard", "agenda", "catalogo", "promocoes", "pacotes", "prestadores", "financeiro"] as TabKey[]).map(t => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtnScroll, tab === t && { borderBottomColor: MOD_COLOR, borderBottomWidth: 2 }]}>
              <Text style={[styles.tabText, { color: tab === t ? MOD_COLOR : colors.textSecondary, fontFamily: tab === t ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                {TAB_LABELS[t]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {tab === "dashboard"   && renderDashboard()}
      {tab === "agenda"      && renderAgenda()}
      {tab === "catalogo"    && renderCatalogo()}
      {tab === "promocoes"   && renderPromocoes()}
      {tab === "pacotes"     && renderPacotes()}
      {tab === "prestadores" && renderPrestadores()}
      {tab === "financeiro"  && renderFinanceiro()}

      {/* Modal: Novo Agendamento */}
      <Modal visible={modalAgen} animationType="slide" transparent onRequestClose={() => setModalAgen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Novo Agendamento</Text>
              <Pressable onPress={() => setModalAgen(false)}><Feather name="x" size={22} color={colors.textSecondary} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: "Cliente *", key: "clienteNome", placeholder: "Nome do cliente" },
                { label: "Telefone", key: "clienteTelefone", placeholder: "(11) 99999-9999" },
                { label: "Serviço *", key: "servicoNome", placeholder: "Ex: Corte de cabelo" },
                { label: "Data/Hora *", key: "dataHora", placeholder: "2024-01-15T14:00" },
                { label: "Valor (R$)", key: "valor", placeholder: "80.00" },
                { label: "Observações", key: "observacoes", placeholder: "Detalhes adicionais" },
              ].map(f => (
                <View key={f.key} style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>{f.label}</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={(agenForm as any)[f.key]}
                    onChangeText={v => setAgenForm(prev => ({ ...prev, [f.key]: v }))}
                    keyboardType={f.key === "valor" ? "decimal-pad" : "default"}
                  />
                </View>
              ))}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Prestador</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {prestadores.filter(p => p.ativo).map(p => (
                    <Pressable key={p.id} onPress={() => setAgenForm(prev => ({ ...prev, prestadorId: String(p.id) }))}
                      style={[styles.prestChip, { borderColor: agenForm.prestadorId === String(p.id) ? MOD_COLOR : colors.border, backgroundColor: agenForm.prestadorId === String(p.id) ? MOD_COLOR + "20" : colors.background }]}>
                      <Text style={[styles.prestChipText, { color: agenForm.prestadorId === String(p.id) ? MOD_COLOR : colors.textSecondary, fontFamily: "Inter_500Medium" }]}>{p.nome}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>
            <Pressable style={[styles.modalBtn, { backgroundColor: MOD_COLOR }]} onPress={handleCriarAgendamento} disabled={agenLoading}>
              {agenLoading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.modalBtnText, { fontFamily: "Inter_600SemiBold" }]}>Criar Agendamento</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal: Registrar Pagamento */}
      <Modal visible={!!modalPagar} animationType="slide" transparent onRequestClose={() => setModalPagar(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Registrar Pagamento</Text>
              <Pressable onPress={() => setModalPagar(null)}><Feather name="x" size={22} color={colors.textSecondary} /></Pressable>
            </View>
            {modalPagar && (
              <>
                <View style={[styles.pagarInfo, { backgroundColor: MOD_COLOR + "10", borderColor: MOD_COLOR + "30" }]}>
                  <Text style={[styles.pagarInfoTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{modalPagar.servicoNome}</Text>
                  <Text style={[styles.pagarInfoSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{modalPagar.clienteNome}</Text>
                </View>
                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Valor Pago (R$) *</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    value={pagarValor}
                    onChangeText={setPagarValor}
                  />
                </View>
                {pagarValor && Number(pagarValor) > 0 && (
                  <View style={[styles.comissaoInfo, { backgroundColor: "#10B98110", borderColor: "#10B98130" }]}>
                    <Feather name="info" size={13} color="#10B981" />
                    <Text style={[styles.comissaoText, { color: "#10B981", fontFamily: "Inter_400Regular" }]}>
                      Comissão GoTaxi (3%): R$ {(Number(pagarValor) * 0.03).toFixed(2)} · Pagamento direto ao prestador
                    </Text>
                  </View>
                )}
                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Método de Pagamento</Text>
                  <View style={styles.metodosRow}>
                    {METODOS.map(m => (
                      <Pressable key={m.id} onPress={() => setPagarMetodo(m.id)}
                        style={[styles.metodoBtn, { borderColor: pagarMetodo === m.id ? MOD_COLOR : colors.border, backgroundColor: pagarMetodo === m.id ? MOD_COLOR + "20" : colors.background }]}>
                        <Feather name={m.icon as any} size={14} color={pagarMetodo === m.id ? MOD_COLOR : colors.textSecondary} />
                        <Text style={[styles.metodoBtnText, { color: pagarMetodo === m.id ? MOD_COLOR : colors.textSecondary, fontFamily: "Inter_500Medium" }]}>{m.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Pressable style={[styles.modalBtn, { backgroundColor: "#10B981" }]} onPress={handlePagar} disabled={pagarLoading}>
                  {pagarLoading ? <ActivityIndicator color="#fff" /> : (
                    <><Feather name="check-circle" size={18} color="#fff" /><Text style={[styles.modalBtnText, { fontFamily: "Inter_600SemiBold" }]}>  Confirmar Pagamento</Text></>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: Alterar Status */}
      <Modal visible={!!modalStatus} animationType="slide" transparent onRequestClose={() => setModalStatus(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Alterar Status</Text>
              <Pressable onPress={() => setModalStatus(null)}><Feather name="x" size={22} color={colors.textSecondary} /></Pressable>
            </View>
            {modalStatus && (
              <View style={{ gap: 8 }}>
                {Object.entries(STATUS_MAP).map(([key, val]) => (
                  <Pressable key={key} onPress={() => handleAlterarStatus(modalStatus, key)}
                    style={[styles.statusOption, { backgroundColor: val.color + "15", borderColor: val.color + "40" }]}>
                    <Feather name={val.icon as any} size={16} color={val.color} />
                    <Text style={[styles.statusOptionText, { color: val.color, fontFamily: "Inter_500Medium" }]}>{val.label}</Text>
                    {modalStatus.status === key && <Feather name="check" size={16} color={val.color} style={{ marginLeft: "auto" }} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: Nova Categoria */}
      <Modal visible={modalCat} animationType="slide" transparent onRequestClose={() => setModalCat(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{editCat ? "Editar Categoria" : "Nova Categoria"}</Text>
              <Pressable onPress={() => { setModalCat(false); setEditCat(null); }}><Feather name="x" size={22} color={colors.textSecondary} /></Pressable>
            </View>
            <View style={styles.formField}>
              <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Nome *</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                placeholder="Ex: Cabelo, Estética, Manutenção"
                placeholderTextColor={colors.textMuted}
                value={catForm.nome}
                onChangeText={v => setCatForm(prev => ({ ...prev, nome: v }))}
              />
            </View>
            <View style={styles.formField}>
              <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Cor</Text>
              <View style={styles.metodosRow}>
                {["#45B7D1","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#3B82F6","#64748B"].map(c => (
                  <Pressable key={c} onPress={() => setCatForm(prev => ({ ...prev, cor: c }))}
                    style={[styles.colorDot, { backgroundColor: c, borderWidth: catForm.cor === c ? 3 : 0, borderColor: colors.text }]} />
                ))}
              </View>
            </View>
            <Pressable style={[styles.modalBtn, { backgroundColor: MOD_COLOR }]} onPress={handleSalvarCategoria} disabled={catSaving}>
              {catSaving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.modalBtnText, { fontFamily: "Inter_600SemiBold" }]}>Cadastrar Categoria</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal: Serviço */}
      <Modal visible={modalSrv} animationType="slide" transparent onRequestClose={() => setModalSrv(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{editSrv ? "Editar Serviço" : "Novo Serviço"}</Text>
              <Pressable onPress={() => setModalSrv(false)}><Feather name="x" size={22} color={colors.textSecondary} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: "Nome *", key: "nome", placeholder: "Ex: Corte de cabelo masculino", kb: "default" },
                { label: "Descrição", key: "descricao", placeholder: "O que está incluso", kb: "default" },
                { label: "Preço (R$) *", key: "preco", placeholder: "80.00", kb: "decimal-pad" },
                { label: "Duração (minutos)", key: "duracao_minutos", placeholder: "60", kb: "number-pad" },
              ].map(f => (
                <View key={f.key} style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>{f.label}</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.textMuted}
                    keyboardType={f.kb as any}
                    value={(srvForm as any)[f.key]}
                    onChangeText={v => setSrvForm(prev => ({ ...prev, [f.key]: v }))}
                  />
                </View>
              ))}
              {categorias.length > 0 && (
                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Categoria</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Pressable onPress={() => setSrvForm(prev => ({ ...prev, categoria_id: "" }))}
                      style={[styles.prestChip, { borderColor: !srvForm.categoria_id ? MOD_COLOR : colors.border, backgroundColor: !srvForm.categoria_id ? MOD_COLOR + "20" : colors.background }]}>
                      <Text style={[styles.prestChipText, { color: !srvForm.categoria_id ? MOD_COLOR : colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Sem categoria</Text>
                    </Pressable>
                    {categorias.map(c => (
                      <Pressable key={c.id} onPress={() => setSrvForm(prev => ({ ...prev, categoria_id: String(c.id) }))}
                        style={[styles.prestChip, { borderColor: srvForm.categoria_id === String(c.id) ? (c.cor || MOD_COLOR) : colors.border, backgroundColor: srvForm.categoria_id === String(c.id) ? (c.cor || MOD_COLOR) + "20" : colors.background }]}>
                        <Text style={[styles.prestChipText, { color: srvForm.categoria_id === String(c.id) ? (c.cor || MOD_COLOR) : colors.textSecondary, fontFamily: "Inter_500Medium" }]}>{c.nome}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
              {prestadores.filter(p => p.ativo).length > 0 && (
                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Prestador (opcional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Pressable onPress={() => setSrvForm(prev => ({ ...prev, prestador_id: "" }))}
                      style={[styles.prestChip, { borderColor: !srvForm.prestador_id ? MOD_COLOR : colors.border, backgroundColor: !srvForm.prestador_id ? MOD_COLOR + "20" : colors.background }]}>
                      <Text style={[styles.prestChipText, { color: !srvForm.prestador_id ? MOD_COLOR : colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Qualquer</Text>
                    </Pressable>
                    {prestadores.filter(p => p.ativo).map(p => (
                      <Pressable key={p.id} onPress={() => setSrvForm(prev => ({ ...prev, prestador_id: String(p.id) }))}
                        style={[styles.prestChip, { borderColor: srvForm.prestador_id === String(p.id) ? MOD_COLOR : colors.border, backgroundColor: srvForm.prestador_id === String(p.id) ? MOD_COLOR + "20" : colors.background }]}>
                        <Text style={[styles.prestChipText, { color: srvForm.prestador_id === String(p.id) ? MOD_COLOR : colors.textSecondary, fontFamily: "Inter_500Medium" }]}>{p.nome}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
            <Pressable style={[styles.modalBtn, { backgroundColor: MOD_COLOR }]} onPress={handleSalvarServico} disabled={srvSaving}>
              {srvSaving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.modalBtnText, { fontFamily: "Inter_600SemiBold" }]}>{editSrv ? "Salvar Alterações" : "Cadastrar Serviço"}</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal: Promoção */}
      <Modal visible={modalProm} animationType="slide" transparent onRequestClose={() => setModalProm(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{editProm ? "Editar Promoção" : "Nova Promoção"}</Text>
              <Pressable onPress={() => setModalProm(false)}><Feather name="x" size={22} color={colors.textSecondary} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Nome *</Text>
                <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                  placeholder="Ex: Black Friday" placeholderTextColor={colors.textMuted}
                  value={promForm.nome} onChangeText={v => setPromForm(prev => ({ ...prev, nome: v }))} />
              </View>
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Descrição</Text>
                <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                  placeholder="Detalhes da promoção" placeholderTextColor={colors.textMuted}
                  value={promForm.descricao} onChangeText={v => setPromForm(prev => ({ ...prev, descricao: v }))} />
              </View>
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Tipo de Desconto</Text>
                <View style={styles.metodosRow}>
                  {[{ id: "percentual", label: "% Percentual" }, { id: "valor", label: "R$ Valor fixo" }].map(t => (
                    <Pressable key={t.id} onPress={() => setPromForm(prev => ({ ...prev, tipo: t.id as any }))}
                      style={[styles.metodoBtn, { borderColor: promForm.tipo === t.id ? MOD_COLOR : colors.border, backgroundColor: promForm.tipo === t.id ? MOD_COLOR + "20" : colors.background }]}>
                      <Text style={[styles.metodoBtnText, { color: promForm.tipo === t.id ? MOD_COLOR : colors.textSecondary, fontFamily: "Inter_500Medium" }]}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Valor * {promForm.tipo === "percentual" ? "(%)" : "(R$)"}</Text>
                <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                  placeholder={promForm.tipo === "percentual" ? "10" : "20.00"} placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={promForm.valor} onChangeText={v => setPromForm(prev => ({ ...prev, valor: v }))} />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={[styles.formField, { flex: 1 }]}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Válido de</Text>
                  <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                    placeholder="2026-04-20" placeholderTextColor={colors.textMuted}
                    value={promForm.valido_de} onChangeText={v => setPromForm(prev => ({ ...prev, valido_de: v }))} />
                </View>
                <View style={[styles.formField, { flex: 1 }]}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Válido até</Text>
                  <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                    placeholder="2026-05-20" placeholderTextColor={colors.textMuted}
                    value={promForm.valido_ate} onChangeText={v => setPromForm(prev => ({ ...prev, valido_ate: v }))} />
                </View>
              </View>
            </ScrollView>
            <Pressable style={[styles.modalBtn, { backgroundColor: MOD_COLOR }]} onPress={handleSalvarPromocao} disabled={promSaving}>
              {promSaving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.modalBtnText, { fontFamily: "Inter_600SemiBold" }]}>{editProm ? "Salvar Alterações" : "Cadastrar Promoção"}</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal: Pacote */}
      <Modal visible={modalPac} animationType="slide" transparent onRequestClose={() => setModalPac(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{editPac ? "Editar Pacote" : "Novo Pacote"}</Text>
              <Pressable onPress={() => setModalPac(false)}><Feather name="x" size={22} color={colors.textSecondary} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Nome *</Text>
                <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                  placeholder="Ex: Pacote 5 cortes" placeholderTextColor={colors.textMuted}
                  value={pacForm.nome} onChangeText={v => setPacForm(prev => ({ ...prev, nome: v }))} />
              </View>
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Descrição</Text>
                <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                  placeholder="O que o pacote inclui" placeholderTextColor={colors.textMuted}
                  value={pacForm.descricao} onChangeText={v => setPacForm(prev => ({ ...prev, descricao: v }))} />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={[styles.formField, { flex: 1 }]}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Preço Total (R$) *</Text>
                  <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                    placeholder="200.00" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad"
                    value={pacForm.preco_total} onChangeText={v => setPacForm(prev => ({ ...prev, preco_total: v }))} />
                </View>
                <View style={[styles.formField, { flex: 1 }]}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Sessões *</Text>
                  <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                    placeholder="5" placeholderTextColor={colors.textMuted} keyboardType="number-pad"
                    value={pacForm.sessoes} onChangeText={v => setPacForm(prev => ({ ...prev, sessoes: v }))} />
                </View>
              </View>
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Validade (dias) — opcional</Text>
                <TextInput style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                  placeholder="90" placeholderTextColor={colors.textMuted} keyboardType="number-pad"
                  value={pacForm.validade_dias} onChangeText={v => setPacForm(prev => ({ ...prev, validade_dias: v }))} />
              </View>
              {catalogo.length > 0 && (
                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Serviços inclusos ({pacForm.catalogo_ids.length} selecionados)</Text>
                  <View style={{ gap: 6 }}>
                    {catalogo.map(s => {
                      const sel = pacForm.catalogo_ids.includes(s.id);
                      return (
                        <Pressable key={s.id} onPress={() => togglePacoteServico(s.id)}
                          style={[styles.pacoteServicoRow, { borderColor: sel ? MOD_COLOR : colors.border, backgroundColor: sel ? MOD_COLOR + "15" : colors.background }]}>
                          <Feather name={sel ? "check-square" : "square"} size={18} color={sel ? MOD_COLOR : colors.textMuted} />
                          <Text style={[{ flex: 1, color: colors.text, fontFamily: "Inter_500Medium", fontSize: 13 }]} numberOfLines={1}>{s.nome}</Text>
                          <Text style={[{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 12 }]}>{fmtMoeda(Number(s.preco))}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
            <Pressable style={[styles.modalBtn, { backgroundColor: MOD_COLOR }]} onPress={handleSalvarPacote} disabled={pacSaving}>
              {pacSaving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.modalBtnText, { fontFamily: "Inter_600SemiBold" }]}>{editPac ? "Salvar Alterações" : "Cadastrar Pacote"}</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal: Prestador */}
      <Modal visible={modalPrest} animationType="slide" transparent onRequestClose={() => setModalPrest(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{editPrest ? "Editar Prestador" : "Novo Prestador"}</Text>
              <Pressable onPress={() => setModalPrest(false)}><Feather name="x" size={22} color={colors.textSecondary} /></Pressable>
            </View>
            {[
              { label: "Nome *", key: "nome", placeholder: "Nome completo" },
              { label: "Especialidade", key: "especialidade", placeholder: "Ex: Cabeleireiro, Encanador" },
              { label: "Telefone", key: "telefone", placeholder: "(11) 99999-9999" },
              { label: "E-mail", key: "email", placeholder: "email@exemplo.com" },
              { label: "Bio", key: "bio", placeholder: "Descrição curta" },
            ].map(f => (
              <View key={f.key} style={styles.formField}>
                <Text style={[styles.formLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>{f.label}</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontFamily: "Inter_400Regular" }]}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.textMuted}
                  value={(prestForm as any)[f.key]}
                  onChangeText={v => setPrestForm(prev => ({ ...prev, [f.key]: v }))}
                />
              </View>
            ))}
            <Pressable style={[styles.modalBtn, { backgroundColor: MOD_COLOR }]} onPress={handleSalvarPrest} disabled={prestLoading}>
              {prestLoading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.modalBtnText, { fontFamily: "Inter_600SemiBold" }]}>{editPrest ? "Salvar Alterações" : "Cadastrar Prestador"}</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Agendamento Card ────────────────────────────────────────────────────────
function AgendamentoCard({ a, colors, onPagar, onStatus, fmtData, fmtMoeda }: any) {
  const s = STATUS_MAP[a.status] || { label: a.status, color: "#64748B", icon: "clock" };
  const pago = a.status === "concluido" && a.valorPago != null;
  return (
    <View style={[styles.agenCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.agenHeader}>
        <View style={styles.agenDateRow}>
          <Feather name="calendar" size={13} color={MOD_COLOR} />
          <Text style={[styles.agenDate, { color: MOD_COLOR, fontFamily: "Inter_500Medium" }]}>{fmtData(a.dataHora)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: s.color + "20" }]}>
          <Text style={[styles.statusText, { color: s.color, fontFamily: "Inter_500Medium" }]}>{s.label}</Text>
        </View>
      </View>
      <Text style={[styles.agenServico, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{a.servicoNome}</Text>
      <View style={styles.agenMeta}>
        <View style={styles.agenMetaItem}>
          <Feather name="user" size={12} color={colors.textMuted} />
          <Text style={[styles.agenMetaText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{a.clienteNome}</Text>
        </View>
        {a.prestadorNome && (
          <View style={styles.agenMetaItem}>
            <Feather name="briefcase" size={12} color={colors.textMuted} />
            <Text style={[styles.agenMetaText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{a.prestadorNome}</Text>
          </View>
        )}
      </View>
      {pago ? (
        <View style={[styles.pagoRow, { backgroundColor: "#10B98110", borderColor: "#10B98130" }]}>
          <Feather name="check-circle" size={14} color="#10B981" />
          <Text style={[styles.pagoText, { color: "#10B981", fontFamily: "Inter_500Medium" }]}>
            Pago {fmtMoeda(a.valorPago)} via {a.metodoPagamento?.toUpperCase()} · Comissão: {fmtMoeda(a.comissaoGotaxi)}
          </Text>
        </View>
      ) : (
        <View style={styles.agenActions}>
          <Pressable onPress={onStatus} style={[styles.agenActionBtn, { backgroundColor: colors.border + "60" }]}>
            <Feather name="refresh-cw" size={13} color={colors.textSecondary} />
            <Text style={[styles.agenActionText, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Status</Text>
          </Pressable>
          {a.status !== "cancelado" && (
            <Pressable onPress={onPagar} style={[styles.agenActionBtn, { backgroundColor: "#10B98120" }]}>
              <Feather name="dollar-sign" size={13} color="#10B981" />
              <Text style={[styles.agenActionText, { color: "#10B981", fontFamily: "Inter_600SemiBold" }]}>Registrar Pagamento</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, justifyContent: "space-between", borderBottomWidth: 1 },
  backBtn: { padding: 4, width: 32 },
  headerTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBarWrap: { borderBottomWidth: 1 },
  tabBtnScroll: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 12 },
  catalogoHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  smallAddBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallAddText: { color: "#fff", fontSize: 12 },
  catChipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  catChipText: { fontSize: 12 },
  itemCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  itemTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  itemNome: { fontSize: 15 },
  itemDesc: { fontSize: 12, marginTop: 2 },
  itemMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 6, flexWrap: "wrap" },
  itemPreco: { fontSize: 14 },
  itemMetaText: { fontSize: 12 },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  miniBadgeText: { fontSize: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  pacoteServicoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  actionBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  actionBarTitle: { fontSize: 14 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: "#fff", fontSize: 14 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: { width: "47%", padding: 14, borderRadius: 14, borderWidth: 1, gap: 6 },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statVal: { fontSize: 20 },
  statLbl: { fontSize: 12 },
  sectionTitle: { fontSize: 16, marginBottom: 12, marginTop: 8 },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 14 },
  alertText: { fontSize: 12, flex: 1 },
  emptyBox: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14 },
  agenCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  agenHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  agenDateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  agenDate: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11 },
  agenServico: { fontSize: 15, marginBottom: 6 },
  agenMeta: { gap: 4, marginBottom: 10 },
  agenMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  agenMetaText: { fontSize: 12 },
  agenActions: { flexDirection: "row", gap: 8 },
  agenActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 8 },
  agenActionText: { fontSize: 12 },
  pagoRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 8, borderWidth: 1 },
  pagoText: { fontSize: 11, flex: 1 },
  prestCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  prestAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  prestIni: { fontSize: 20 },
  prestNome: { fontSize: 15 },
  prestEsp: { fontSize: 12, marginTop: 2 },
  prestMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  prestMetaText: { fontSize: 12 },
  prestMetaDot: { fontSize: 12 },
  prestActions: { gap: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  repaseBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  repaseBannerTitle: { fontSize: 15, marginBottom: 4 },
  repaseBannerSub: { fontSize: 12, lineHeight: 18 },
  repaseCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14 },
  repaseCardTitle: { fontSize: 15, marginBottom: 12 },
  repaseRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  repaseLabel: { fontSize: 13 },
  repaseVal: { fontSize: 15 },
  repaseStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  repaseStatusText: { fontSize: 12 },
  repaseEmpty: { fontSize: 13, textAlign: "center", paddingVertical: 8 },
  repaseHistCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  repaseHistSem: { fontSize: 13 },
  repaseHistSub: { fontSize: 11, marginTop: 2 },
  repaseHistVal: { fontSize: 15 },
  repaseHistStatus: { fontSize: 11, marginTop: 2 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 8 },
  infoText: { fontSize: 12, flex: 1, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%", gap: 0 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18 },
  modalBtn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 16 },
  modalBtnText: { color: "#fff", fontSize: 16 },
  formField: { marginBottom: 14 },
  formLabel: { fontSize: 13, marginBottom: 6 },
  formInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  prestChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, marginRight: 8 },
  prestChipText: { fontSize: 13 },
  pagarInfo: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 16 },
  pagarInfoTitle: { fontSize: 15 },
  pagarInfoSub: { fontSize: 12, marginTop: 2 },
  comissaoInfo: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 14 },
  comissaoText: { fontSize: 12, flex: 1 },
  metodosRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metodoBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5 },
  metodoBtnText: { fontSize: 12 },
  statusOption: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  statusOptionText: { fontSize: 15 },
});
