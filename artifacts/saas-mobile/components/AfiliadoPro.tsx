import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

interface Indicado { nome: string; tipo: string; criado_em: string }
interface Saque { id: number; valor: number | string; status: string; criado_em: string }
interface DadosAfiliado {
  saldo: number; total_comissoes: number; saques_pendentes: number; valor_minimo_saque: number;
  chave_pix: string | null; ultimos_indicados: Indicado[]; ultimos_saques: Saque[];
}

const TIPOS: Record<string, string> = {
  cliente: "Cliente", motorista: "Motorista", entregador: "Entregador", delivery: "Boy Delivery", empresa: "Empresa",
};
const STATUS: Record<string, string> = { pendente: "Pendente", processando: "Processando", pago: "Pago", aprovado: "Pago", recusado: "Recusado" };
const brl = (v: number | string) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
function brData(s: string) {
  const d = new Date(s);
  return isNaN(d.getTime()) ? "–" : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function AfiliadoPro({ token, cor }: { token: string; cor: string }) {
  const [dados, setDados] = useState<DadosAfiliado | null>(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [sacando, setSacando] = useState(false);
  const [valor, setValor] = useState("");
  const [chave, setChave] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true); setErro("");
    try {
      const res = await fetch(`${API_BASE}/motorista-app/afiliado`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error === "sem_codigo" ? "Seu código de indicação ainda não está disponível." : `Não foi possível carregar (${body?.error || res.status}).`);
      setDados(body);
    } catch (e: any) {
      setErro(e?.message || "Falha de conexão.");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirSaque = () => {
    if (!dados) return;
    setValor(dados.saldo.toFixed(2).replace(".", ","));
    setChave(dados.chave_pix || "");
    setSacando(true);
  };

  const enviarSaque = async () => {
    const v = Number(valor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) { Alert.alert("Saque", "Informe um valor válido."); return; }
    if (!chave.trim()) { Alert.alert("Saque", "Informe a chave PIX."); return; }
    setEnviando(true);
    try {
      const res = await fetch(`${API_BASE}/motorista-app/afiliado/saque`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ valor: v, chave_pix: chave.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) { Alert.alert("Saque", body?.error || `Erro ${res.status}`); return; }
      Alert.alert("Saque", body?.message || "Saque solicitado!");
      setSacando(false);
      carregar();
    } catch {
      Alert.alert("Saque", "Falha de conexão.");
    } finally { setEnviando(false); }
  };

  if (loading && !dados) return <ActivityIndicator color={cor} style={{ marginVertical: 20 }} />;
  if (erro && !dados) {
    return (
      <View style={s.card}>
        <Text style={s.erro}>{erro}</Text>
        <TouchableOpacity onPress={carregar}><Text style={[s.link, { color: cor }]}>Tentar de novo</Text></TouchableOpacity>
      </View>
    );
  }
  if (!dados) return null;

  const podeSacar = dados.saldo >= dados.valor_minimo_saque;

  return (
    <>
      <View style={s.card}>
        <Text style={s.titulo}>💰 Saldo de afiliado</Text>
        <Text style={[s.saldo, { color: cor }]}>{brl(dados.saldo)}</Text>
        <View style={s.linha}>
          <Text style={s.rotulo}>Comissões recebidas</Text>
          <Text style={s.val}>{brl(dados.total_comissoes)}</Text>
        </View>
        <View style={s.linha}>
          <Text style={s.rotulo}>Saques pendentes</Text>
          <Text style={s.val}>{brl(dados.saques_pendentes)}</Text>
        </View>

        {!sacando ? (
          <>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: podeSacar ? cor : "#252525" }]}
              onPress={abrirSaque} disabled={!podeSacar} activeOpacity={0.8}
            >
              <Text style={[s.btnTxt, { color: podeSacar ? "#000" : "#666" }]}>🏦 Sacar via PIX</Text>
            </TouchableOpacity>
            {!podeSacar && <Text style={s.dica}>Saque mínimo: {brl(dados.valor_minimo_saque)}</Text>}
          </>
        ) : (
          <View style={{ marginTop: 12 }}>
            <Text style={s.rotulo}>Valor</Text>
            <TextInput style={s.input} value={valor} onChangeText={setValor} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor="#555" />
            <Text style={[s.rotulo, { marginTop: 10 }]}>Chave PIX</Text>
            <TextInput style={s.input} value={chave} onChangeText={setChave} autoCapitalize="none" placeholder="Sua chave PIX" placeholderTextColor="#555" />
            {!!dados.chave_pix && chave.trim() === dados.chave_pix && <Text style={s.dica}>Chave cadastrada no seu PIX</Text>}
            <View style={s.row}>
              <TouchableOpacity style={[s.btn, s.btnFlex, { backgroundColor: "#252525" }]} onPress={() => setSacando(false)} disabled={enviando}>
                <Text style={[s.btnTxt, { color: "#FFF" }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnFlex, { backgroundColor: cor }]} onPress={enviarSaque} disabled={enviando}>
                {enviando ? <ActivityIndicator color="#000" /> : <Text style={s.btnTxt}>Confirmar saque</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.titulo}>👥 Últimos indicados</Text>
        {dados.ultimos_indicados.length === 0 ? (
          <Text style={s.vazio}>Você ainda não tem indicados.</Text>
        ) : dados.ultimos_indicados.map((i, idx) => (
          <View key={idx} style={s.item}>
            <View style={{ flex: 1 }}>
              <Text style={s.nome} numberOfLines={1}>{i.nome}</Text>
              <Text style={s.sub}>{TIPOS[i.tipo] || i.tipo}</Text>
            </View>
            <Text style={s.sub}>{brData(i.criado_em)}</Text>
          </View>
        ))}
      </View>

      {dados.ultimos_saques.length > 0 && (
        <View style={s.card}>
          <Text style={s.titulo}>🧾 Últimos saques</Text>
          {dados.ultimos_saques.map((q) => (
            <View key={q.id} style={s.item}>
              <View style={{ flex: 1 }}>
                <Text style={s.nome}>{brl(q.valor)}</Text>
                <Text style={s.sub}>{brData(q.criado_em)}</Text>
              </View>
              <Text style={[s.sub, { color: q.status === "pago" || q.status === "aprovado" ? "#1DB954" : "#F59E0B" }]}>{STATUS[q.status] || q.status}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#1A1A1A", borderRadius: 16, padding: 16, marginBottom: 12 },
  titulo: { fontSize: 14, fontWeight: "800", color: "#FFF", marginBottom: 10 },
  saldo: { fontSize: 30, fontWeight: "900", marginBottom: 10 },
  linha: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  rotulo: { fontSize: 12, color: "#888" },
  val: { fontSize: 13, color: "#FFF", fontWeight: "700" },
  btn: { borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 12 },
  btnFlex: { flex: 1 },
  btnTxt: { fontSize: 14, fontWeight: "800", color: "#000" },
  row: { flexDirection: "row", gap: 10 },
  input: { backgroundColor: "#111", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#FFF", fontSize: 15, marginTop: 6 },
  dica: { fontSize: 11, color: "#666", marginTop: 6, textAlign: "center" },
  item: { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#252525", gap: 10 },
  nome: { fontSize: 13, color: "#FFF", fontWeight: "700" },
  sub: { fontSize: 11, color: "#777", marginTop: 2 },
  vazio: { fontSize: 12, color: "#666" },
  erro: { fontSize: 13, color: "#EF4444", marginBottom: 8 },
  link: { fontSize: 13, fontWeight: "700" },
});
