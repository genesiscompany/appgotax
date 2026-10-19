import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

type Categoria = "combustivel" | "manutencao" | "outras";
interface Despesa { id: number; categoria: Categoria; valor: number; data: string; descricao: string | null }
interface Resumo {
  servicos: number; ganho_bruto: number; repasse: number; ganho_liquido: number; lucro: number;
  despesas: Record<Categoria | "total", number>; lista_despesas: Despesa[];
}

const CATEGORIAS: { key: Categoria; label: string; icon: string }[] = [
  { key: "combustivel", label: "Combustível", icon: "⛽" },
  { key: "manutencao", label: "Manutenção", icon: "🔧" },
  { key: "outras", label: "Outras despesas", icon: "🧾" },
];
const ERROS: Record<string, string> = {
  valor_invalido: "Informe um valor maior que zero.",
  categoria_invalida: "Escolha a categoria.",
  data_futura: "A data não pode ser no futuro.",
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const brData = (s: string) => s.split("-").reverse().join("/");
const brl = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
function isoDeBr(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getDate() === Number(m[1]) ? iso(d) : null;
}

function periodoDe(p: string): { de: string; ate: string } {
  const h = new Date();
  if (p === "hoje") return { de: iso(h), ate: iso(h) };
  if (p === "7d") { const d = new Date(h); d.setDate(d.getDate() - 6); return { de: iso(d), ate: iso(h) }; }
  if (p === "mes_passado") return { de: iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), ate: iso(new Date(h.getFullYear(), h.getMonth(), 0)) };
  return { de: iso(new Date(h.getFullYear(), h.getMonth(), 1)), ate: iso(h) };
}
const PERIODOS = [
  { key: "hoje", label: "Hoje" }, { key: "7d", label: "7 dias" },
  { key: "mes", label: "Este mês" }, { key: "mes_passado", label: "Mês passado" },
];

const VAZIO = { categoria: "combustivel" as Categoria, valor: "", data: "", descricao: "" };

export default function Financeiro({ token, cor }: { token: string; cor: string }) {
  const [periodo, setPeriodo] = useState("mes");
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(VAZIO);
  const [editId, setEditId] = useState<number | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const auth = { Authorization: `Bearer ${token}` };

  const carregar = useCallback(async () => {
    const { de, ate } = periodoDe(periodo);
    try {
      const r = await fetch(`${API_BASE}/motorista-app/financeiro?de=${de}&ate=${ate}`, { headers: auth });
      if (r.ok) setResumo(await r.json());
    } catch {}
    setCarregando(false);
  }, [periodo, token]);
  useEffect(() => { setCarregando(true); carregar(); }, [carregar]);

  const novo = () => { setForm({ ...VAZIO, data: brData(iso(new Date())) }); setEditId(null); setErro(""); setFormAberto(true); };
  const editar = (d: Despesa) => {
    setForm({ categoria: d.categoria, valor: String(d.valor).replace(".", ","), data: brData(d.data), descricao: d.descricao ?? "" });
    setEditId(d.id); setErro(""); setFormAberto(true);
  };
  const fechar = () => { setFormAberto(false); setEditId(null); setForm(VAZIO); setErro(""); };

  const salvar = async () => {
    const data = isoDeBr(form.data);
    if (!data) { setErro("Data inválida. Use DD/MM/AAAA."); return; }
    setSalvando(true); setErro("");
    try {
      const r = await fetch(`${API_BASE}/motorista-app/despesas${editId ? `/${editId}` : ""}`, {
        method: editId ? "PUT" : "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, data }),
      });
      if (r.ok) { fechar(); await carregar(); }
      else { const b = await r.json().catch(() => null); setErro(ERROS[b?.error] ?? `Não foi possível salvar (${b?.error ?? r.status}).`); }
    } catch { setErro("Sem conexão. Tente novamente."); }
    setSalvando(false);
  };

  const apagar = (d: Despesa) => {
    Alert.alert("Apagar despesa", `Apagar ${brl(d.valor)} de ${brData(d.data)}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: async () => {
        try { await fetch(`${API_BASE}/motorista-app/despesas/${d.id}`, { method: "DELETE", headers: auth }); } catch {}
        if (editId === d.id) fechar();
        await carregar();
      } },
    ]);
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={s.chips}>
        {PERIODOS.map(p => (
          <TouchableOpacity key={p.key} onPress={() => setPeriodo(p.key)} style={[s.chip, periodo === p.key && { backgroundColor: cor, borderColor: cor }]}>
            <Text style={[s.chipTxt, periodo === p.key && { color: "#fff" }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {carregando && !resumo ? <ActivityIndicator color={cor} /> : resumo && (
        <View style={s.card}>
          <Linha label={`Ganho líquido (${resumo.servicos} serviço${resumo.servicos === 1 ? "" : "s"})`} valor={brl(resumo.ganho_liquido)} />
          <Text style={s.sub}>Bruto {brl(resumo.ganho_bruto)} − repasse GoTaxi {brl(resumo.repasse)}</Text>
          {CATEGORIAS.map(c => <Linha key={c.key} label={`${c.icon} ${c.label}`} valor={`− ${brl(resumo.despesas[c.key])}`} vermelho />)}
          <View style={s.divisor} />
          <View style={s.linha}>
            <Text style={s.lucroLbl}>Lucro</Text>
            <Text style={[s.lucroVal, { color: resumo.lucro < 0 ? "#dc2626" : "#16a34a" }]}>{brl(resumo.lucro)}</Text>
          </View>
        </View>
      )}

      {formAberto ? (
        <View style={s.card}>
          <Text style={s.titulo}>{editId ? "Editar despesa" : "Nova despesa"}</Text>
          <View style={s.chips}>
            {CATEGORIAS.map(c => (
              <TouchableOpacity key={c.key} onPress={() => setForm({ ...form, categoria: c.key })} style={[s.chip, form.categoria === c.key && { backgroundColor: cor, borderColor: cor }]}>
                <Text style={[s.chipTxt, form.categoria === c.key && { color: "#fff" }]}>{c.icon} {c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={s.input} placeholder="Valor (R$)" keyboardType="decimal-pad" value={form.valor} onChangeText={v => setForm({ ...form, valor: v })} />
          <TextInput style={s.input} placeholder="Data (DD/MM/AAAA)" keyboardType="numbers-and-punctuation" value={form.data} onChangeText={v => setForm({ ...form, data: v })} />
          <TextInput style={s.input} placeholder="Observação (opcional)" value={form.descricao} maxLength={300} onChangeText={v => setForm({ ...form, descricao: v })} />
          {!!erro && <Text style={s.erro}>{erro}</Text>}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity onPress={salvar} disabled={salvando} style={[s.btn, { backgroundColor: cor, flex: 1, opacity: salvando ? 0.6 : 1 }]}>
              <Text style={s.btnTxt}>{salvando ? "Salvando..." : "Salvar"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={fechar} style={[s.btn, { backgroundColor: "#f3f4f6" }]}>
              <Text style={[s.btnTxt, { color: "#374151" }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={novo} style={[s.btn, { backgroundColor: cor }]}>
          <Text style={s.btnTxt}>+ Despesa</Text>
        </TouchableOpacity>
      )}

      <Text style={s.titulo}>Despesas do período</Text>
      {!resumo?.lista_despesas.length ? <Text style={s.sub}>Nenhuma despesa lançada.</Text> : resumo.lista_despesas.map(d => {
        const c = CATEGORIAS.find(x => x.key === d.categoria);
        return (
          <View key={d.id} style={s.item}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => editar(d)}>
              <Text style={s.itemTit}>{c?.icon} {c?.label} · {brl(d.valor)}</Text>
              <Text style={s.sub}>{brData(d.data)}{d.descricao ? ` · ${d.descricao}` : ""}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => apagar(d)} hitSlop={10}><Text style={{ fontSize: 18 }}>🗑</Text></TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

function Linha({ label, valor, vermelho }: { label: string; valor: string; vermelho?: boolean }) {
  return (
    <View style={s.linha}>
      <Text style={s.lbl}>{label}</Text>
      <Text style={[s.val, vermelho && { color: "#dc2626" }]}>{valor}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fff" },
  chipTxt: { fontSize: 13, color: "#374151", fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: "#f1f5f9" },
  linha: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lbl: { fontSize: 14, color: "#374151", flex: 1 },
  val: { fontSize: 14, fontWeight: "700", color: "#111827" },
  sub: { fontSize: 12, color: "#6b7280" },
  divisor: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 4 },
  lucroLbl: { fontSize: 17, fontWeight: "800", color: "#111827" },
  lucroVal: { fontSize: 20, fontWeight: "800" },
  titulo: { fontSize: 15, fontWeight: "700", color: "#111827" },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: "#fff" },
  erro: { color: "#dc2626", fontSize: 13 },
  btn: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center" },
  btnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  item: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 12, gap: 10, borderWidth: 1, borderColor: "#f1f5f9" },
  itemTit: { fontSize: 14, fontWeight: "600", color: "#111827" },
});
