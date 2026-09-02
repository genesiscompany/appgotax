import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Colors, PRO_TYPE_COLORS, PRO_TYPE_LABELS, PRO_TYPE_ICONS } from "@/constants/colors";
import { apiFetch } from "@/constants/api";

const DOC_STATUS: Record<string, { label: string; color: string }> = {
  pendente:   { label: "Pendente",    color: Colors.textMuted },
  em_analise: { label: "Em análise",  color: "#8B5CF6" },
  aprovado:   { label: "Aprovado",    color: Colors.success },
  rejeitado:  { label: "Rejeitado",   color: Colors.danger },
};

export default function PerfilScreen() {
  const { user, token, logout, refreshPerfil } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: user?.nome || "",
    email: user?.email || "",
    cidade: user?.cidade || "",
    estado: user?.estado || "",
    veiculo_marca: user?.veiculo_marca || "",
    veiculo_modelo: user?.veiculo_modelo || "",
    veiculo_placa: user?.veiculo_placa || "",
    veiculo_cor: user?.veiculo_cor || "",
  });

  if (!user) return null;

  const cor = PRO_TYPE_COLORS[user.tipo_profissional] || Colors.primary;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/motorista-app/perfil", {
        method: "PUT",
        body: JSON.stringify(form),
      }, token);
      if (res.ok) {
        await refreshPerfil();
        setEditing(false);
        Alert.alert("✅ Perfil atualizado!");
      } else {
        Alert.alert("Erro", "Não foi possível salvar o perfil.");
      }
    } catch (_) { Alert.alert("Erro", "Erro de conexão."); }
    setSaving(false);
  };

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja sair do GoTaxi Pro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => { logout(); router.replace("/"); } },
    ]);
  };

  const docs = [
    { label: "CNH", status: user.doc_cnh_status },
    { label: "CRLV do Veículo", status: user.doc_veiculo_status },
    { label: "Selfie com CNH", status: user.doc_selfie_status },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.avatar, { borderColor: cor }]}>
            <Text style={styles.avatarIcon}>{PRO_TYPE_ICONS[user.tipo_profissional]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.nome}</Text>
            <Text style={[styles.tipo, { color: cor }]}>{PRO_TYPE_LABELS[user.tipo_profissional]}</Text>
            {user.avaliacao_media > 0 && (
              <Text style={styles.rating}>★ {Number(user.avaliacao_media).toFixed(1)} · {user.total_corridas} serviços</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setEditing(!editing)} style={[styles.editBtn, { borderColor: cor }]}>
            <Text style={[styles.editBtnTxt, { color: cor }]}>{editing ? "Cancelar" : "Editar"}</Text>
          </TouchableOpacity>
        </View>

        {/* Documentos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documentos</Text>
          {docs.map(doc => {
            const conf = DOC_STATUS[doc.status] || DOC_STATUS.pendente;
            return (
              <View key={doc.label} style={styles.docRow}>
                <View style={[styles.docDot, { backgroundColor: conf.color }]} />
                <Text style={styles.docLabel}>{doc.label}</Text>
                <Text style={[styles.docStatus, { color: conf.color }]}>{conf.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Dados pessoais */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados pessoais</Text>
          {editing ? (
            <>
              {[
                { label: "Nome", key: "nome" as const },
                { label: "E-mail", key: "email" as const },
                { label: "Cidade", key: "cidade" as const },
                { label: "Estado (UF)", key: "estado" as const },
              ].map(f => (
                <View key={f.key}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={form[f.key]}
                    onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              ))}
            </>
          ) : (
            <>
              <InfoRow label="Telefone" value={user.telefone} />
              <InfoRow label="E-mail" value={user.email || "–"} />
              <InfoRow label="CPF" value={user.cpf || "–"} />
              <InfoRow label="Cidade" value={[user.cidade, user.estado].filter(Boolean).join(" – ") || "–"} />
            </>
          )}
        </View>

        {/* Veículo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Veículo</Text>
          {editing ? (
            <>
              {[
                { label: "Marca", key: "veiculo_marca" as const },
                { label: "Modelo", key: "veiculo_modelo" as const },
                { label: "Placa", key: "veiculo_placa" as const },
                { label: "Cor", key: "veiculo_cor" as const },
              ].map(f => (
                <View key={f.key}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={form[f.key]}
                    onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              ))}
            </>
          ) : (
            <>
              <InfoRow label="Marca/Modelo" value={[user.veiculo_marca, user.veiculo_modelo].filter(Boolean).join(" ") || "–"} />
              <InfoRow label="Placa" value={user.veiculo_placa || "–"} />
              <InfoRow label="Cor" value={user.veiculo_cor || "–"} />
            </>
          )}
        </View>

        {editing && (
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: cor }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnTxt}>Salvar alterações</Text>}
          </TouchableOpacity>
        )}

        {/* Conta */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conta</Text>
          <InfoRow label="Repasse GoTaxi" value={`${user.percentual_repasse || 20}%`} />
          <InfoRow label="Saldo" value={`R$ ${Number(user.saldo || 0).toFixed(2).replace(".", ",")}`} />
          <InfoRow label="Membro desde" value={user.criado_em ? new Date(user.criado_em).toLocaleDateString("pt-BR") : "–"} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutTxt}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, gap: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  avatar: { width: 60, height: 60, borderRadius: 18, borderWidth: 2, justifyContent: "center", alignItems: "center", backgroundColor: Colors.surface },
  avatarIcon: { fontSize: 28 },
  name: { fontSize: 18, fontWeight: "800", color: Colors.text },
  tipo: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  rating: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  editBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  editBtnTxt: { fontSize: 13, fontWeight: "700" },
  section: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, gap: 2 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginBottom: 8 },
  docRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  docDot: { width: 8, height: 8, borderRadius: 4 },
  docLabel: { flex: 1, fontSize: 14, color: Colors.text },
  docStatus: { fontSize: 13, fontWeight: "600" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 13, color: Colors.textSecondary },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.text, fontSize: 15 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
  saveBtnTxt: { fontSize: 15, fontWeight: "700", color: "#000" },
  logoutBtn: { backgroundColor: Colors.surface, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  logoutTxt: { fontSize: 15, fontWeight: "600", color: Colors.danger },
});
