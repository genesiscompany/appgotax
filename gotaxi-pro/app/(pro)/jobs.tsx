import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { Colors, PRO_TYPE_COLORS, PRO_TYPE_ICONS, PRO_JOB_LABEL } from "@/constants/colors";
import { apiFetch } from "@/constants/api";

function fmtBRL(v: number) { return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`; }

const CORRIDA_STATUSES = ["aguardando", "a_caminho", "em_andamento", "concluida", "cancelada"];
const STATUS_LABELS: Record<string, string> = {
  disponivel: "Disponível", aguardando: "Aguardando", a_caminho: "A Caminho",
  em_andamento: "Em Andamento", concluida: "Concluída", cancelada: "Cancelada",
};
const STATUS_COLORS: Record<string, string> = {
  disponivel: Colors.info, aguardando: Colors.warning, a_caminho: Colors.info,
  em_andamento: "#8B5CF6", concluida: Colors.success, cancelada: Colors.danger,
};

const MOCK_JOBS: Record<string, any[]> = {
  motorista: [
    { id: 1, status: "disponivel", origem: "Av. Paulista, 1000", destino: "Aeroporto Guarulhos", distancia: "28 km", valor: 62.50, passageiro: "João Silva", tempo: "~35 min" },
    { id: 2, status: "disponivel", origem: "Shopping Ibirapuera", destino: "Pinheiros", distancia: "7 km", valor: 18.90, passageiro: "Maria Costa", tempo: "~12 min" },
  ],
  delivery: [
    { id: 1, status: "disponivel", origem: "Pizzaria Bella, Av. Faria Lima", destino: "Rua das Flores, 456", distancia: "3.2 km", valor: 8.50, descricao: "1x Pizza Margherita GG", tempo: "~15 min" },
    { id: 2, status: "disponivel", origem: "Burger King, Consolação", destino: "Bela Vista, Apto 72", distancia: "2.1 km", valor: 6.00, descricao: "Combo + Batata + Refri", tempo: "~10 min" },
  ],
  entregas: [
    { id: 1, status: "disponivel", origem: "Correios, Brás", destino: "Itaim Bibi", distancia: "12 km", valor: 24.00, descricao: "1 volume, ~3kg, frágil", tempo: "~25 min" },
    { id: 2, status: "disponivel", origem: "Mercado Livre Fulfillment, Cajamar", destino: "Perdizes", distancia: "35 km", valor: 45.00, descricao: "2 volumes", tempo: "~55 min" },
  ],
};

export default function JobsScreen() {
  const { user, token } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("a_caminho");
  const [jobs, setJobs] = useState<any[]>([]);

  const cor = user ? PRO_TYPE_COLORS[user.tipo_profissional] || Colors.primary : Colors.primary;
  const tipo = user?.tipo_profissional || "motorista";
  const jobLabel = PRO_JOB_LABEL[tipo] || "Trabalho";
  const icon = PRO_TYPE_ICONS[tipo] || "🚗";

  useEffect(() => {
    setJobs(MOCK_JOBS[tipo] || []);
  }, [tipo]);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1000));
    setRefreshing(false);
  };

  const handleAccept = (job: any) => {
    setActiveJob(job);
    setJobStatus("a_caminho");
  };

  const handleAdvance = () => {
    if (jobStatus === "a_caminho") setJobStatus("em_andamento");
    else if (jobStatus === "em_andamento") {
      Alert.alert("Confirmar conclusão", "Deseja concluir este serviço?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Concluir", onPress: () => { setActiveJob(null); Alert.alert("✅ Concluído!", `+${fmtBRL(activeJob.valor)} adicionado aos seus ganhos.`); } },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cor} />}
      >
        <Text style={styles.title}>{icon} {jobLabel}</Text>

        {/* Active job */}
        {activeJob && (
          <View style={[styles.activeCard, { borderColor: cor }]}>
            <View style={styles.activeHeader}>
              <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[jobStatus] + "22" }]}>
                <Text style={[styles.statusTxt, { color: STATUS_COLORS[jobStatus] }]}>{STATUS_LABELS[jobStatus]}</Text>
              </View>
              <Text style={[styles.activeValue, { color: cor }]}>{fmtBRL(activeJob.valor)}</Text>
            </View>

            <View style={styles.route}>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: cor }]} />
                <Text style={styles.routeAddr}>{activeJob.origem}</Text>
              </View>
              <View style={[styles.routeVert, { borderColor: cor + "44" }]} />
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: Colors.danger }]} />
                <Text style={styles.routeAddr}>{activeJob.destino}</Text>
              </View>
            </View>

            {activeJob.passageiro && <Text style={styles.passenger}>Passageiro: {activeJob.passageiro}</Text>}
            {activeJob.descricao && <Text style={styles.passenger}>Pedido: {activeJob.descricao}</Text>}

            <View style={styles.activeActions}>
              <TouchableOpacity style={[styles.mainBtn, { backgroundColor: cor }]} onPress={handleAdvance}>
                <Text style={styles.mainBtnTxt}>
                  {jobStatus === "a_caminho" ? "✅ Cheguei / Iniciar" : "🏁 Concluir"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Available jobs */}
        {!activeJob && (
          <>
            <Text style={styles.sectionLabel}>{jobs.length} disponível{jobs.length !== 1 ? "is" : ""}</Text>
            {jobs.map(job => (
              <View key={job.id} style={styles.jobCard}>
                <View style={styles.jobTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.routeRow}>
                      <View style={[styles.routeDot, { backgroundColor: cor }]} />
                      <Text style={styles.routeAddr} numberOfLines={1}>{job.origem}</Text>
                    </View>
                    <View style={[styles.routeVert, { borderColor: cor + "33" }]} />
                    <View style={styles.routeRow}>
                      <View style={[styles.routeDot, { backgroundColor: Colors.danger }]} />
                      <Text style={styles.routeAddr} numberOfLines={1}>{job.destino}</Text>
                    </View>
                  </View>
                  <View style={styles.jobRight}>
                    <Text style={[styles.jobVal, { color: cor }]}>{fmtBRL(job.valor)}</Text>
                    <Text style={styles.jobDist}>{job.distancia}</Text>
                    <Text style={styles.jobTime}>{job.tempo}</Text>
                  </View>
                </View>
                {job.descricao && <Text style={styles.jobDesc}>{job.descricao}</Text>}
                {job.passageiro && <Text style={styles.jobDesc}>👤 {job.passageiro}</Text>}
                <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: cor }]} onPress={() => handleAccept(job)}>
                  <Text style={styles.acceptBtnTxt}>Aceitar {jobLabel.slice(0, -1)}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {!activeJob && jobs.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{icon}</Text>
            <Text style={styles.emptyTxt}>Nenhum serviço disponível</Text>
            <Text style={styles.emptyDesc}>Fique online para receber {jobLabel.toLowerCase()}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, gap: 14 },
  title: { fontSize: 22, fontWeight: "800", color: Colors.text },
  activeCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 20, borderWidth: 2, gap: 14 },
  activeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusTxt: { fontSize: 12, fontWeight: "700" },
  activeValue: { fontSize: 24, fontWeight: "900" },
  route: { gap: 2 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeVert: { marginLeft: 4, width: 1, height: 16, borderLeftWidth: 1.5, borderStyle: "dashed", marginVertical: 2 },
  routeAddr: { fontSize: 14, color: Colors.text, flex: 1 },
  passenger: { fontSize: 13, color: Colors.textSecondary },
  activeActions: { gap: 10 },
  mainBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  mainBtnTxt: { fontSize: 15, fontWeight: "700", color: "#000" },
  sectionLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  jobCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 10 },
  jobTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  jobRight: { alignItems: "flex-end", gap: 2 },
  jobVal: { fontSize: 18, fontWeight: "800" },
  jobDist: { fontSize: 12, color: Colors.textSecondary },
  jobTime: { fontSize: 12, color: Colors.textMuted },
  jobDesc: { fontSize: 12, color: Colors.textSecondary },
  acceptBtn: { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  acceptBtnTxt: { fontSize: 14, fontWeight: "700", color: "#000" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyIcon: { fontSize: 56 },
  emptyTxt: { fontSize: 16, fontWeight: "700", color: Colors.textSecondary },
  emptyDesc: { fontSize: 13, color: Colors.textMuted },
});
