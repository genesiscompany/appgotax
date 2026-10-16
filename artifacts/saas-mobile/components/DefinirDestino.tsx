import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Switch,
} from "react-native";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export interface DestinoSalvo { id: number; nome: string; endereco: string; lat: number; lng: number }
export interface DestinoInfo {
  ativo: boolean;
  endereco: string | null;
  salvos: DestinoSalvo[];
}

interface Prediction { placeId: string; description: string; mainText?: string; secondaryText?: string; lat?: number | null; lng?: number | null }

async function resolverCoordenadas(p: Prediction): Promise<{ lat: number; lng: number } | null> {
  if (p.lat != null && p.lng != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)) return { lat: p.lat, lng: p.lng };
  try {
    if (!p.placeId.startsWith("osm:")) {
      const r = await fetch(`${API_BASE}/places/details?placeId=${encodeURIComponent(p.placeId)}`);
      const d = r.ok ? await r.json() : null;
      if (d?.lat != null && d?.lng != null) return { lat: Number(d.lat), lng: Number(d.lng) };
    }
    const g = await fetch(`${API_BASE}/places/geocode?address=${encodeURIComponent(p.description)}`);
    const d = g.ok ? await g.json() : null;
    if (d?.lat != null && d?.lng != null) return { lat: Number(d.lat), lng: Number(d.lng) };
  } catch {}
  return null;
}

export function useDestino(token?: string) {
  const [info, setInfo] = useState<DestinoInfo | null>(null);
  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE}/motorista-app/destino`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setInfo(await r.json());
    } catch {}
  }, [token]);
  const desligar = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE}/motorista-app/destino`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setInfo(await r.json());
    } catch {
      Alert.alert("Erro", "Não foi possível desligar o destino. Tente novamente.");
    }
  }, [token]);
  return { info, setInfo, carregar, desligar };
}

export default function DefinirDestino({ token, cor, onChange }: {
  token: string;
  cor: string;
  onChange?: (info: DestinoInfo) => void;
}) {
  const { info, setInfo, carregar } = useDestino(token);
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState<Prediction[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [escolhido, setEscolhido] = useState<{ endereco: string; lat: number; lng: number } | null>(null);
  const [salvar, setSalvar] = useState(false);
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (info) onChange?.(info); }, [info]);

  const onBusca = (txt: string) => {
    setBusca(txt);
    setEscolhido(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (txt.trim().length < 3) { setSugestoes([]); return; }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(`${API_BASE}/places/autocomplete?input=${encodeURIComponent(txt.trim())}`);
        const list = r.ok ? await r.json() : [];
        setSugestoes(Array.isArray(list) ? list.slice(0, 6) : []);
      } catch { setSugestoes([]); }
      setBuscando(false);
    }, 400);
  };

  const escolher = async (p: Prediction) => {
    setBuscando(true);
    const c = await resolverCoordenadas(p);
    setBuscando(false);
    if (!c) { Alert.alert("Endereço não encontrado", "Não conseguimos localizar esse endereço. Tente outro."); return; }
    setEscolhido({ endereco: p.description, ...c });
    setBusca(p.description);
    setSugestoes([]);
  };

  const enviar = async (body: Record<string, unknown>) => {
    setEnviando(true);
    try {
      const r = await fetch(`${API_BASE}/motorista-app/destino`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { Alert.alert("Destino", d?.message || "Não foi possível definir o destino."); return; }
      setInfo(d);
      setBusca(""); setEscolhido(null); setSalvar(false); setNome("");
    } catch {
      Alert.alert("Erro", "Sem conexão. Tente novamente.");
    } finally { setEnviando(false); }
  };

  const ativarEscolhido = () => {
    if (!escolhido) return;
    if (salvar && !nome.trim()) { Alert.alert("Destino", "Dê um nome para salvar, por exemplo \"Casa\"."); return; }
    enviar({ ...escolhido, salvar_nome: salvar ? nome.trim() : undefined });
  };

  const desligar = async () => {
    setEnviando(true);
    try {
      const r = await fetch(`${API_BASE}/motorista-app/destino`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setInfo(await r.json());
    } catch {
      Alert.alert("Erro", "Não foi possível desligar o destino.");
    } finally { setEnviando(false); }
  };

  const apagarSalvo = (s: DestinoSalvo) => {
    Alert.alert("Apagar destino", `Apagar "${s.nome}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: async () => {
        try {
          const r = await fetch(`${API_BASE}/motorista-app/destino/salvos/${s.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          if (r.ok) setInfo(await r.json());
        } catch {}
      }},
    ]);
  };

  if (!info) return <ActivityIndicator color={cor} style={{ marginTop: 32 }} />;

  return (
    <View>
      <View style={[styles.statusCard, info.ativo && { borderColor: cor }]}>
        <Text style={styles.statusLabel}>{info.ativo ? "📍 Indo para" : "Modo destino desligado"}</Text>
        {info.ativo ? (
          <>
            <Text style={styles.statusEndereco}>{info.endereco}</Text>
            <TouchableOpacity style={styles.desligarBtn} onPress={desligar} disabled={enviando}>
              <Text style={styles.desligarTxt}>Desligar destino</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.ajuda}>
            Com o destino ligado, você só recebe corridas que terminam mais perto do seu destino.
            Ele desliga sozinho quando você chegar a menos de 1 km.
          </Text>
        )}
      </View>

      <Text style={styles.secao}>{info.ativo ? "TROCAR DESTINO" : "PARA ONDE VOCÊ VAI?"}</Text>
      <TextInput
        style={styles.input}
        value={busca}
        onChangeText={onBusca}
        placeholder="Digite o endereço ou a cidade"
        placeholderTextColor="#555"
        autoCorrect={false}
      />
      {buscando && <ActivityIndicator color={cor} style={{ marginVertical: 8 }} />}
      {sugestoes.map(p => (
        <TouchableOpacity key={p.placeId} style={styles.sugestao} onPress={() => escolher(p)}>
          <Text style={styles.sugestaoMain} numberOfLines={1}>{p.mainText || p.description}</Text>
          {!!p.secondaryText && <Text style={styles.sugestaoSec} numberOfLines={1}>{p.secondaryText}</Text>}
        </TouchableOpacity>
      ))}

      {escolhido && (
        <View style={styles.confirmCard}>
          <View style={styles.salvarRow}>
            <Text style={styles.salvarTxt}>Salvar este destino</Text>
            <Switch value={salvar} onValueChange={setSalvar} trackColor={{ true: cor, false: "#333" }} />
          </View>
          {salvar && (
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Nome (ex.: Casa)"
              placeholderTextColor="#555"
              maxLength={60}
            />
          )}
          <TouchableOpacity style={[styles.ativarBtn, { backgroundColor: cor }]} onPress={ativarEscolhido} disabled={enviando}>
            {enviando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ativarTxt}>Ligar destino</Text>}
          </TouchableOpacity>
        </View>
      )}

      {info.salvos.length > 0 && (
        <>
          <Text style={styles.secao}>DESTINOS SALVOS</Text>
          {info.salvos.map(s => (
            <View key={s.id} style={styles.salvoRow}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => enviar({ salvo_id: s.id })} disabled={enviando}>
                <Text style={styles.salvoNome}>📍 {s.nome}</Text>
                <Text style={styles.salvoEnd} numberOfLines={1}>{s.endereco}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => apagarSalvo(s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.apagar}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
          <Text style={styles.ajudaPeq}>Toque num destino salvo para ligar.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  statusCard: { backgroundColor: "#1A1A1A", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#222", marginBottom: 16 },
  statusLabel: { fontSize: 13, color: "#8896B0", fontWeight: "700" },
  statusEndereco: { fontSize: 16, color: "#FFF", fontWeight: "800", marginTop: 6 },
  ajuda: { fontSize: 13, color: "#777", marginTop: 6, lineHeight: 19 },
  ajudaPeq: { fontSize: 12, color: "#555", marginTop: 8 },
  desligarBtn: { marginTop: 12, borderWidth: 1, borderColor: "#EF4444", borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  desligarTxt: { color: "#EF4444", fontWeight: "800" },
  secao: { fontSize: 11, color: "#666", fontWeight: "800", letterSpacing: 1, marginTop: 8, marginBottom: 8 },
  input: { backgroundColor: "#1A1A1A", borderRadius: 12, borderWidth: 1, borderColor: "#2A2A2A", color: "#FFF", paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 8 },
  sugestao: { paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#1E1E1E" },
  sugestaoMain: { fontSize: 14, color: "#FFF", fontWeight: "600" },
  sugestaoSec: { fontSize: 12, color: "#777", marginTop: 2 },
  confirmCard: { backgroundColor: "#151515", borderRadius: 14, padding: 12, marginTop: 4, marginBottom: 8 },
  salvarRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  salvarTxt: { color: "#DDD", fontSize: 14, fontWeight: "600" },
  ativarBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  ativarTxt: { color: "#FFF", fontWeight: "900", fontSize: 15 },
  salvoRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#1A1A1A", borderRadius: 12, padding: 12, marginBottom: 8 },
  salvoNome: { fontSize: 14, color: "#FFF", fontWeight: "700" },
  salvoEnd: { fontSize: 12, color: "#777", marginTop: 2 },
  apagar: { fontSize: 18 },
});
