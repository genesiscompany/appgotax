import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Colors, PRO_TYPE_COLORS, PRO_TYPE_LABELS, PRO_TYPE_ICONS } from "@/constants/colors";
import { apiFetch } from "@/constants/api";

const STATUS_INFO: Record<string, { label: string; desc: string; icon: string }> = {
  pendente:   { label: "Cadastro Recebido", desc: "Seus dados foram enviados. Envie seus documentos para agilizar a aprovação.", icon: "📋" },
  em_analise: { label: "Em Análise",         desc: "Nossa equipe está revisando sua documentação. Em breve você receberá uma resposta.", icon: "🔍" },
  suspenso:   { label: "Conta Suspensa",     desc: "Sua conta foi suspensa. Entre em contato com o suporte.", icon: "⚠️" },
  bloqueado:  { label: "Conta Bloqueada",    desc: "Sua conta foi bloqueada. Entre em contato com o suporte.", icon: "🚫" },
};

const DOC_LABELS: Record<string, string> = { pendente: "Pendente", em_analise: "Em análise", aprovado: "Aprovado", rejeitado: "Rejeitado" };
const DOC_COLORS: Record<string, string> = { pendente: Colors.textMuted, em_analise: "#8B5CF6", aprovado: Colors.success, rejeitado: Colors.danger };

export default function PendentePage() {
  const { user, logout, refreshPerfil, token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const cor = PRO_TYPE_COLORS[user.tipo_profissional] || Colors.primary;
  const statusInfo = STATUS_INFO[user.status] || STATUS_INFO.pendente;

  const handleEnviarDoc = async (tipo: "cnh" | "veiculo" | "selfie") => {
    const nomes: Record<string, string> = { cnh: "CNH", veiculo: "CRLV do Veículo", selfie: "Selfie com CNH" };
    Alert.alert(
      `Enviar ${nomes[tipo]}`,
      "No app final, aqui você seleciona a foto da galeria ou câmera. Por enquanto, simulando envio.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Simular envio", onPress: async () => {
            setLoading(true);
            try {
              await apiFetch("/api/motorista-app/documentos", {
                method: "POST",
                body: JSON.stringify({ tipo, url: `https://docs.gotaxi.com/${tipo}-simulado-${Date.now()}.jpg` }),
              }, token);
              await refreshPerfil();
            } catch (_) { Alert.alert("Erro", "Não foi possível enviar o documento."); }
            setLoading(false);
          }
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja sair do app?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => { logout(); router.replace("/"); } },
    ]);
  };

  const docs = [
    { key: "cnh" as const, label: "CNH", desc: "Carteira Nacional de Habilitação", status: user.doc_cnh_status },
    { key: "veiculo" as const, label: "CRLV", desc: "Documento do Veículo", status: user.doc_veiculo_status },
    { key: "selfie" as const, label: "Selfie", desc: "Selfie segurando a CNH", status: user.doc_selfie_status },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.badge, { borderColor: cor }]}>
            <Text style={styles.badgeIcon}>{PRO_TYPE_ICONS[user.tipo_profissional]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.nome}</Text>
            <Text style={[styles.tipo, { color: cor }]}>{PRO_TYPE_LABELS[user.tipo_profissional]}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutTxt}>Sair</Text>
          </TouchableOpacity>
        </View>

        {/* Status card */}
        <View style={[styles.statusCard, { borderLeftColor: cor }]}>
          <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
          <Text style={styles.statusLabel}>{statusInfo.label}</Text>
          <Text style={styles.statusDesc}>{statusInfo.desc}</Text>
        </View>

        {/* Etapas */}
        <View style={styles.steps}>
          {[
            { num: 1, label: "Cadastro enviado", done: true },
            { num: 2, label: "Documentos enviados", done: docs.every(d => d.status !== "pendente") },
            { num: 3, label: "Análise da equipe", done: user.status === "em_analise" || user.status === "aprovado" },
            { num: 4, label: "Aprovado!", done: user.status === "aprovado" },
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepCircle, step.done && { backgroundColor: cor }]}>
                <Text style={[styles.stepNum, step.done && { color: "#000" }]}>{step.done ? "✓" : step.num}</Text>
              </View>
              {i < 3 && <View style={[styles.stepLine, step.done && { backgroundColor: cor }]} />}
              <Text style={[styles.stepLabel, step.done && { color: Colors.text }]}>{step.label}</Text>
            </View>
          ))}
        </View>

        {/* Documentos */}
        <Text style={styles.sectionTitle}>Documentos Obrigatórios</Text>
        {docs.map(doc => (
          <View key={doc.key} style={styles.docCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.docLabel}>{doc.label}</Text>
              <Text style={styles.docDesc}>{doc.desc}</Text>
              <View style={styles.docStatusRow}>
                <View style={[styles.docDot, { backgroundColor: DOC_COLORS[doc.status] || Colors.textMuted }]} />
                <Text style={[styles.docStatus, { color: DOC_COLORS[doc.status] || Colors.textMuted }]}>
                  {DOC_LABELS[doc.status] || "Pendente"}
                </Text>
              </View>
            </View>
            {(doc.status === "pendente" || doc.status === "rejeitado") && (
              <TouchableOpacity style={[styles.docBtn, { borderColor: cor }]} onPress={() => handleEnviarDoc(doc.key)} disabled={loading}>
                {loading ? <ActivityIndicator size="small" color={cor} /> : (
                  <Text style={[styles.docBtnTxt, { color: cor }]}>Enviar</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.refreshBtn} onPress={refreshPerfil}>
          <Text style={[styles.refreshTxt, { color: cor }]}>↻ Atualizar status</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  badge: { width: 52, height: 52, borderRadius: 14, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  badgeIcon: { fontSize: 24 },
  name: { fontSize: 17, fontWeight: "700", color: Colors.text },
  tipo: { fontSize: 13, fontWeight: "600" },
  logoutTxt: { color: Colors.textSecondary, fontSize: 14 },
  statusCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 24, borderLeftWidth: 4, gap: 6 },
  statusIcon: { fontSize: 32 },
  statusLabel: { fontSize: 18, fontWeight: "700", color: Colors.text },
  statusDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  steps: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, paddingHorizontal: 4 },
  stepRow: { alignItems: "center", flex: 1 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceAlt, borderWidth: 1.5, borderColor: Colors.border, justifyContent: "center", alignItems: "center" },
  stepNum: { fontSize: 12, fontWeight: "700", color: Colors.textMuted },
  stepLine: { position: "absolute", left: "50%", right: "-50%", top: 15, height: 2, backgroundColor: Colors.border },
  stepLabel: { fontSize: 10, color: Colors.textMuted, textAlign: "center", marginTop: 6, fontWeight: "500" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.text, marginBottom: 12 },
  docCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  docLabel: { fontSize: 15, fontWeight: "700", color: Colors.text },
  docDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  docStatusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  docDot: { width: 6, height: 6, borderRadius: 3 },
  docStatus: { fontSize: 12, fontWeight: "600" },
  docBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  docBtnTxt: { fontSize: 13, fontWeight: "700" },
  refreshBtn: { alignItems: "center", padding: 20 },
  refreshTxt: { fontSize: 14, fontWeight: "600" },
});
