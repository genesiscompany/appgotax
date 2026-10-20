import React, { useState } from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, Platform, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { fotoUrl } from "@/utils/fotoUrl";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export default function FotoPerfilPro({ token, foto, cor, onAtualizado }: {
  token: string; foto?: string | null; cor: string; onAtualizado: () => Promise<void>;
}) {
  const [enviando, setEnviando] = useState(false);
  const url = fotoUrl(foto);

  const escolher = async (camera: boolean) => {
    try {
      if (Platform.OS !== "web") {
        const perm = camera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permissão necessária", camera ? "Permita o acesso à câmera." : "Permita o acesso à galeria.");
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1],
      };
      const result = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setEnviando(true);
      const formData = new FormData();
      if (Platform.OS === "web") {
        const blob = await (await globalThis.fetch(asset.uri)).blob();
        formData.append("file", blob, "foto.jpg");
      } else {
        formData.append("file", { uri: asset.uri, name: "foto.jpg", type: asset.mimeType || "image/jpeg" } as any);
      }
      const res = await globalThis.fetch(`${API_BASE}/motorista-app/foto`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { Alert.alert("Erro", data.error || "Não foi possível enviar a foto."); return; }
      await onAtualizado();
      Alert.alert("✅ Foto salva!", "Os passageiros vão ver esta foto quando você aceitar uma corrida.");
    } catch {
      Alert.alert("Erro", "Sem conexão.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={st.card}>
      <View style={[st.fotoWrap, { borderColor: url ? cor : "#EF4444" }]}>
        {url ? <Image source={{ uri: url }} style={st.foto} /> : <Text style={st.semFoto}>📷</Text>}
      </View>
      <Text style={st.titulo}>{url ? "Sua foto de perfil" : "Foto obrigatória"}</Text>
      <Text style={st.sub}>
        Use uma foto recente, de frente, com o rosto visível e sem óculos escuros.
        {url ? "" : " Sem foto você não consegue ficar online."}
      </Text>
      {enviando ? (
        <ActivityIndicator color={cor} style={{ marginVertical: 12 }} />
      ) : (
        <View style={st.row}>
          <TouchableOpacity style={[st.btn, { backgroundColor: cor }]} onPress={() => escolher(true)}>
            <Text style={st.btnTxt}>📸 Tirar foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.btn, st.btnSec]} onPress={() => escolher(false)}>
            <Text style={st.btnSecTxt}>🖼️ Galeria</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: "#1A1A1A", borderRadius: 16, padding: 20, alignItems: "center", gap: 10 },
  fotoWrap: { width: 140, height: 140, borderRadius: 70, borderWidth: 3, overflow: "hidden", justifyContent: "center", alignItems: "center", backgroundColor: "#111" },
  foto: { width: "100%", height: "100%" },
  semFoto: { fontSize: 48 },
  titulo: { fontSize: 16, fontWeight: "800", color: "#FFF", marginTop: 6 },
  sub: { fontSize: 13, color: "#888", textAlign: "center", lineHeight: 19 },
  row: { flexDirection: "row", gap: 10, marginTop: 6, alignSelf: "stretch" },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  btnTxt: { fontSize: 14, fontWeight: "800", color: "#000" },
  btnSec: { backgroundColor: "#252525" },
  btnSecTxt: { fontSize: 14, fontWeight: "700", color: "#FFF" },
});
