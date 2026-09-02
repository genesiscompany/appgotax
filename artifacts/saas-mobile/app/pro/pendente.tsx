import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StatusBar, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useProAuth, PRO_COLORS, PRO_LABELS, PRO_ICONS } from "@/context/ProAuthContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const DOC_INFO: Record<string, { label: string; icon: string; desc: string }> = {
  cnh:    { label: "CNH",              icon: "🪪", desc: "Carteira Nacional de Habilitação (frente e verso)" },
  veiculo:{ label: "CRLV do Veículo",  icon: "📄", desc: "Documento do veículo (frente e verso)" },
  selfie: { label: "Selfie com CNH",   icon: "🤳", desc: "Foto sua segurando a CNH aberta" },
};

const DOC_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", em_analise: "Em análise", aprovado: "✓ Aprovado", rejeitado: "✗ Rejeitado",
};
const DOC_STATUS_COLOR: Record<string, string> = {
  pendente: "#555", em_analise: "#8B5CF6", aprovado: "#10B981", rejeitado: "#EF4444",
};

const ETAPAS = ["Cadastro", "Documentos", "Análise", "Aprovado!"];

export default function Pendente() {
  const { proUser, isLoaded, logout, refreshPerfil } = useProAuth();
  const [uploading, setUploading] = useState<string | null>(null);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0D0D0D", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#F5C518" />
      </View>
    );
  }

  if (!proUser) {
    router.replace("/pro/login" as any);
    return null;
  }

  const cor = PRO_COLORS[proUser.tipo_profissional] || "#F5C518";

  const docStatuses: Record<string, string> = {
    cnh:     proUser.doc_cnh_status,
    veiculo: proUser.doc_veiculo_status,
    selfie:  proUser.doc_selfie_status,
  };

  const docsEnviados = Object.values(docStatuses).every(s => s !== "pendente");

  const etapaAtual =
    proUser.status === "aprovado" ? 3 :
    proUser.status === "em_analise" ? 2 :
    docsEnviados ? 2 : 1;

  const handleEnviarDoc = (tipo: string) => {
    if (Platform.OS === "web") {
      pickAndUpload(tipo, "library");
    } else {
      Alert.alert(
        `Enviar ${DOC_INFO[tipo].label}`,
        "Escolha como deseja enviar:",
        [
          { text: "📷 Câmera", onPress: () => pickAndUpload(tipo, "camera") },
          { text: "🖼 Galeria de Fotos", onPress: () => pickAndUpload(tipo, "library") },
          { text: "Cancelar", style: "cancel" },
        ]
      );
    }
  };

  const pickAndUpload = async (tipo: string, source: "camera" | "library") => {
    setUploading(tipo);
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === "camera") {
        if (Platform.OS !== "web") {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permissão necessária", "Permita o acesso à câmera nas configurações do dispositivo para fotografar o documento.");
            setUploading(null);
            return;
          }
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.75,
        });
      } else {
        if (Platform.OS !== "web") {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permissão necessária", "Permita o acesso à galeria nas configurações do dispositivo para selecionar o documento.");
            setUploading(null);
            return;
          }
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.75,
        });
      }

      if (result.canceled || !result.assets?.[0]) {
        setUploading(null);
        return;
      }

      const asset = result.assets[0];

      // Upload the file to server
      let fileUrl = asset.uri;
      try {
        const formData = new FormData();
        if (Platform.OS === "web") {
          const blobRes = await globalThis.fetch(asset.uri);
          const blob = await blobRes.blob();
          formData.append("file", blob, `${tipo}.jpg`);
        } else {
          formData.append("file", {
            uri: asset.uri,
            name: `${tipo}.jpg`,
            type: asset.mimeType || "image/jpeg",
          } as any);
        }

        const uploadRes = await globalThis.fetch(`${API_BASE}/motorista-app/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${proUser!.token}` },
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          fileUrl = uploadData.url || fileUrl;
        }
      } catch {
        // If upload fails, continue with local URI (graceful degradation)
      }

      // Register document URL
      await globalThis.fetch(`${API_BASE}/motorista-app/documentos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${proUser!.token}`,
        },
        body: JSON.stringify({ tipo, url: fileUrl }),
      });

      await refreshPerfil();
      Alert.alert("✅ Documento enviado!", "Nossa equipe irá analisar em breve.");
    } catch {
      Alert.alert("Erro", "Não foi possível enviar o documento. Tente novamente.");
    }
    setUploading(null);
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.badge, { borderColor: cor }]}>
            <Text style={styles.badgeIcon}>{PRO_ICONS[proUser.tipo_profissional]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nome}>{proUser.nome}</Text>
            <Text style={[styles.tipo, { color: cor }]}>{PRO_LABELS[proUser.tipo_profissional]}</Text>
          </View>
          <TouchableOpacity onPress={() => Alert.alert("Sair", "Deseja sair?", [
            { text: "Cancelar", style: "cancel" },
            { text: "Sair", style: "destructive", onPress: async () => { router.replace("/pro/bem-vindo" as any); await logout(); } }
          ])}>
            <Text style={{ color: "#555", fontSize: 14 }}>Sair</Text>
          </TouchableOpacity>
        </View>

        {/* Etapas */}
        <View style={styles.etapasRow}>
          {ETAPAS.map((e, i) => (
            <React.Fragment key={e}>
              <View style={styles.etapaItem}>
                <View style={[styles.etapaCircle, i <= etapaAtual && { backgroundColor: cor, borderColor: cor }]}>
                  <Text style={[styles.etapaNum, i <= etapaAtual && { color: "#000" }]}>
                    {i < etapaAtual ? "✓" : i + 1}
                  </Text>
                </View>
                <Text style={[styles.etapaLabel, i <= etapaAtual && { color: "#FFF" }]}>{e}</Text>
              </View>
              {i < ETAPAS.length - 1 && (
                <View style={[styles.etapaLine, i < etapaAtual && { backgroundColor: cor }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Status card */}
        <View style={[styles.statusCard, { borderLeftColor: cor }]}>
          <Text style={styles.statusTitle}>
            {proUser.status === "em_analise" ? "🔍 Em análise" :
             proUser.status === "aprovado" ? "✅ Aprovado!" : "📋 Cadastro recebido"}
          </Text>
          <Text style={styles.statusDesc}>
            {proUser.status === "em_analise"
              ? "Nossa equipe está revisando seus documentos. Em breve você terá uma resposta."
              : proUser.status === "aprovado"
              ? "Parabéns! Sua conta foi aprovada."
              : "Envie seus documentos abaixo para agilizar a aprovação da sua conta."}
          </Text>
        </View>

        {/* Documentos */}
        <Text style={styles.sectionTitle}>Documentos obrigatórios</Text>

        {Object.entries(DOC_INFO).map(([key, info]) => {
          const status = docStatuses[key] || "pendente";
          const statusColor = DOC_STATUS_COLOR[status];
          const podeEnviar = status === "pendente" || status === "rejeitado";

          return (
            <View key={key} style={styles.docCard}>
              <Text style={styles.docIcon}>{info.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.docLabel}>{info.label}</Text>
                <Text style={styles.docDesc}>{info.desc}</Text>
                <View style={styles.docStatusRow}>
                  <View style={[styles.docDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.docStatusTxt, { color: statusColor }]}>
                    {DOC_STATUS_LABEL[status]}
                  </Text>
                </View>
              </View>
              {podeEnviar && (
                <TouchableOpacity
                  style={[styles.docBtn, { borderColor: cor }]}
                  onPress={() => handleEnviarDoc(key)}
                  disabled={!!uploading}
                >
                  {uploading === key
                    ? <ActivityIndicator size="small" color={cor} />
                    : <Text style={[styles.docBtnTxt, { color: cor }]}>Enviar</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <TouchableOpacity style={styles.refreshBtn} onPress={refreshPerfil}>
          <Text style={[styles.refreshTxt, { color: cor }]}>↻  Atualizar status</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D0D" },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 },
  badge: { width: 52, height: 52, borderRadius: 14, borderWidth: 2, justifyContent: "center", alignItems: "center", backgroundColor: "#1A1A1A" },
  badgeIcon: { fontSize: 24 },
  nome: { fontSize: 17, fontWeight: "700", color: "#FFF" },
  tipo: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  etapasRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  etapaItem: { alignItems: "center", gap: 4 },
  etapaCircle: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "#333", backgroundColor: "#1A1A1A", justifyContent: "center", alignItems: "center" },
  etapaNum: { fontSize: 11, fontWeight: "800", color: "#555" },
  etapaLabel: { fontSize: 9, color: "#555", fontWeight: "600", textAlign: "center", maxWidth: 60 },
  etapaLine: { flex: 1, height: 2, backgroundColor: "#2A2A2A", marginBottom: 16 },
  statusCard: { backgroundColor: "#1A1A1A", borderRadius: 16, padding: 18, marginBottom: 24, borderLeftWidth: 4, gap: 8 },
  statusTitle: { fontSize: 17, fontWeight: "800", color: "#FFF" },
  statusDesc: { fontSize: 13, color: "#8896B0", lineHeight: 20 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#FFF", marginBottom: 12 },
  docCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#1A1A1A", borderRadius: 14, padding: 16, marginBottom: 10 },
  docIcon: { fontSize: 28 },
  docLabel: { fontSize: 15, fontWeight: "700", color: "#FFF" },
  docDesc: { fontSize: 11, color: "#8896B0", marginTop: 2 },
  docStatusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  docDot: { width: 6, height: 6, borderRadius: 3 },
  docStatusTxt: { fontSize: 12, fontWeight: "600" },
  docBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  docBtnTxt: { fontSize: 13, fontWeight: "700" },
  refreshBtn: { alignItems: "center", paddingVertical: 20 },
  refreshTxt: { fontSize: 14, fontWeight: "600" },
});
