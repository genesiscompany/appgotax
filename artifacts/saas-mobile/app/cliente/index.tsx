import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
  useColorScheme,
  Dimensions,
  Animated,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import ClienteBottomNav from "@/components/ClienteBottomNav";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useLocalSearchParams } from "expo-router";
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : "/api";

const { width } = Dimensions.get("window");

const BRAND_GREEN = "#22C55E";
const BRAND_DARK = "#16A34A";

const MODULOS = [
  {
    id: "food",
    nome: "Alimentação",
    desc: "Restaurantes e menus",
    rota: "/cliente/food",
    cores: ["#F97316", "#EF4444"] as [string, string],
    icone: "coffee" as const,
  },
  {
    id: "motorista",
    nome: "Viagens",
    desc: "Peça um carro agora",
    rota: "/cliente/motorista",
    cores: ["#3B82F6", "#1D4ED8"] as [string, string],
    icone: "navigation" as const,
  },
  {
    id: "ecommerce",
    nome: "E-commerce",
    desc: "Produtos e ofertas",
    rota: "/cliente/lojistas?modulo=ecommerce",
    cores: ["#8B5CF6", "#6D28D9"] as [string, string],
    icone: "shopping-bag" as const,
  },
  {
    id: "servicos",
    nome: "Serviços",
    desc: "Agende profissionais",
    rota: "/cliente/lojistas?modulo=servicos",
    cores: ["#06B6D4", "#0284C7"] as [string, string],
    icone: "tool" as const,
  },
  {
    id: "entrega",
    nome: "Entregas",
    desc: "Envie seus pacotes",
    rota: "/cliente/entrega",
    cores: ["#F59E0B", "#D97706"] as [string, string],
    icone: "package" as const,
  },
  {
    id: "passagens",
    nome: "Passagens",
    desc: "Viagens intermunicipais",
    rota: "/cliente/passagens",
    cores: ["#10B981", "#059669"] as [string, string],
    icone: "map-pin" as const,
  },
];

interface EmpresaDestaque {
  id: number;
  nome: string;
  cor: string;
  modulos: string[];
  destaque: boolean;
  categoria: string;
  total_produtos: number;
}

const MODULO_NAV: Record<string, string> = {
  food: "/cliente/food",
  ecommerce: "/cliente/ecommerce",
  motorista: "/cliente/motorista",
  servicos: "/cliente/servicos",
  entrega: "/cliente/entrega",
  passagens: "/cliente/passagens",
};

const MODULO_ICONE: Record<string, { icon: string }> = {
  food: { icon: "coffee" },
  ecommerce: { icon: "shopping-bag" },
  motorista: { icon: "navigation" },
  servicos: { icon: "tool" },
  entrega: { icon: "package" },
  passagens: { icon: "map-pin" },
};

function ModuloCard({ modulo }: { modulo: typeof MODULOS[0] }) {
  const scale = useRef(new Animated.Value(1)).current;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  const cardWidth = (width - 48) / 3;

  return (
    <Animated.View style={{ transform: [{ scale }], width: cardWidth }}>
      <Pressable onPress={() => router.push(modulo.rota as any)} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <LinearGradient
          colors={modulo.cores}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.moduloImagem, { height: cardWidth * 0.85 }]}
        >
          <View style={styles.moduloIconCircle}>
            <Feather name={modulo.icone} size={28} color="#fff" />
          </View>
          <View style={styles.moduloTag}>
            <Feather name="arrow-right" size={10} color="#fff" />
          </View>
        </LinearGradient>
        <Text style={[styles.moduloNome, { color: colors.text }]} numberOfLines={1}>{modulo.nome}</Text>
        <Text style={[styles.moduloDesc, { color: colors.textSecondary }]} numberOfLines={1}>{modulo.desc}</Text>
      </Pressable>
    </Animated.View>
  );
}

interface Promocao {
  id: number;
  empresa_id: number;
  nome: string;
  descricao?: string;
  tipo: "percentual" | "fixo";
  valor: number;
  codigo_cupom?: string;
  min_pedido: number;
  empresa_nome: string;
  empresa_cor: string;
  produto_id?: number | null;
  produto_nome?: string | null;
  produto_preco?: number | null;
  produto_imagem?: string | null;
  preco_promocional?: number | null;
  quantidade_disponivel?: number | null;
}

function PromoCard({ promo, isDark, colors }: { promo: Promocao; isDark: boolean; colors: any }) {
  const [copied, setCopied] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const cor = promo.empresa_cor || "#22C55E";

  const hasProduto = !!promo.produto_id;
  const precoAntigo = promo.produto_preco != null ? Number(promo.produto_preco) : null;
  const precoNovo = promo.preco_promocional != null ? Number(promo.preco_promocional) : null;
  const descontoPct = precoAntigo && precoNovo && precoAntigo > precoNovo
    ? Math.round(((precoAntigo - precoNovo) / precoAntigo) * 100)
    : (promo.tipo === "percentual" ? promo.valor : null);

  const onPress = () => {
    if (hasProduto) {
      // Vai direto pra tela do restaurante com o produto pré-selecionado
      router.push({
        pathname: "/cliente/food" as any,
        params: {
          empresaId: String(promo.empresa_id),
          produtoId: String(promo.produto_id),
          precoPromocional: promo.preco_promocional != null ? String(promo.preco_promocional) : "",
        },
      });
      return;
    }
    if (promo.codigo_cupom) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
      style={{ width: width * 0.65, marginRight: 12 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={[promoStyles.card, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
          <View style={[promoStyles.topBar, { backgroundColor: cor + "22" }]}>
            {descontoPct != null && (
              <View style={[promoStyles.discBadge, { backgroundColor: cor }]}>
                <Text style={[promoStyles.discText, { fontFamily: "Inter_700Bold" }]}>
                  -{descontoPct}%
                </Text>
              </View>
            )}
            <View style={promoStyles.topRight}>
              <Text style={[promoStyles.empresaNome, { color: cor, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
                {promo.empresa_nome}
              </Text>
            </View>
          </View>
          <View style={promoStyles.cardBody}>
            <Text style={[promoStyles.promoNome, { color: colors.text, fontFamily: "Inter_700Bold" }]} numberOfLines={2}>{promo.nome}</Text>
            {promo.produto_nome ? (
              <Text style={[promoStyles.promoDesc, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
                {promo.produto_nome}
              </Text>
            ) : promo.descricao ? (
              <Text style={[promoStyles.promoDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>{promo.descricao}</Text>
            ) : null}
            {precoNovo != null && (
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                {precoAntigo != null && precoAntigo > precoNovo && (
                  <Text style={{ color: colors.textSecondary, fontSize: 12, textDecorationLine: "line-through", fontFamily: "Inter_400Regular" }}>
                    R$ {precoAntigo.toFixed(2)}
                  </Text>
                )}
                <Text style={{ color: cor, fontSize: 18, fontFamily: "Inter_700Bold" }}>
                  R$ {precoNovo.toFixed(2)}
                </Text>
              </View>
            )}
            {promo.quantidade_disponivel != null && promo.quantidade_disponivel > 0 && (
              <Text style={{ color: "#F97316", fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 }}>
                Apenas {promo.quantidade_disponivel} restantes!
              </Text>
            )}
            {hasProduto && (
              <View style={{
                marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                backgroundColor: cor, paddingVertical: 8, borderRadius: 10,
              }}>
                <Feather name="shopping-bag" size={13} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" }}>Comprar agora</Text>
              </View>
            )}
            {promo.min_pedido > 0 && (
              <Text style={[promoStyles.minPedido, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                Pedido mínimo: R$ {Number(promo.min_pedido).toFixed(2)}
              </Text>
            )}
            {!hasProduto && promo.codigo_cupom && (
              <View style={[promoStyles.cupomRow, { backgroundColor: isDark ? "#0f172a" : "#f1f5f9", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
                <Feather name="tag" size={12} color={cor} />
                <Text style={[promoStyles.cupomCode, { color: cor, fontFamily: "Inter_700Bold" }]}>{promo.codigo_cupom}</Text>
                <View style={[promoStyles.copiarBtn, { backgroundColor: cor + "22" }]}>
                  <Feather name={copied ? "check" : "copy"} size={12} color={cor} />
                  <Text style={[promoStyles.copiarText, { color: cor, fontFamily: "Inter_600SemiBold" }]}>{copied ? "Copiado!" : "Copiar"}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const promoStyles = StyleSheet.create({
  card: { borderRadius: 16, overflow: "hidden", borderWidth: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  discBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  discText: { color: "#fff", fontSize: 16 },
  topRight: { flex: 1, alignItems: "flex-end" },
  empresaNome: { fontSize: 13 },
  cardBody: { padding: 14, gap: 6 },
  promoNome: { fontSize: 15, lineHeight: 21 },
  promoDesc: { fontSize: 12, lineHeight: 18 },
  minPedido: { fontSize: 11 },
  cupomRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, marginTop: 4 },
  cupomCode: { fontSize: 14, flex: 1, letterSpacing: 1 },
  copiarBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  copiarText: { fontSize: 11 },
});

function EmpresaCard({ empresa }: { empresa: EmpresaDestaque }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  const primeiroModulo = empresa.modulos.find(m => MODULO_NAV[m]);
  const iconInfo = primeiroModulo ? MODULO_ICONE[primeiroModulo] : null;
  const bgColor = isDark ? empresa.cor + "25" : empresa.cor + "18";

  const handlePress = () => {
    if (primeiroModulo && MODULO_NAV[primeiroModulo]) {
      router.push({ pathname: MODULO_NAV[primeiroModulo], params: { empresaId: String(empresa.id) } } as any);
    }
  };

  return (
    <Pressable onPress={handlePress} onPressIn={onPressIn} onPressOut={onPressOut} style={{ flex: 1 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={[styles.empresaImagem, { backgroundColor: bgColor, aspectRatio: 1 }]}>
          <View style={[styles.empresaIconCircle, { backgroundColor: empresa.cor }]}>
            <Feather name={(iconInfo?.icon ?? "star") as any} size={22} color="#fff" />
          </View>
          <View style={[styles.starBadge, { backgroundColor: empresa.cor }]}>
            <Feather name="star" size={9} color="#fff" />
          </View>
        </View>
        <Text style={[styles.empresaNome, { color: colors.text }]} numberOfLines={1}>{empresa.nome}</Text>
        <Text style={[styles.empresaCat, { color: colors.textSecondary }]} numberOfLines={1}>{empresa.categoria}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function ClienteHome() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { customer, isLoggedIn } = useCustomerAuth();
  const { empresaId } = useLocalSearchParams<{ empresaId?: string }>();
  const topPadding = insets.top;
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [destaques, setDestaques] = useState<EmpresaDestaque[]>([]);

  useEffect(() => {
    const url = empresaId ? `${API_BASE}/food/promocoes?empresa_id=${encodeURIComponent(String(empresaId))}` : `${API_BASE}/food/promocoes`;
    fetch(url)
      .then(r => r.json())
      .then(d => Array.isArray(d) ? setPromocoes(d.slice(0, 10)) : null)
      .catch(() => {});

    fetch(`${API_BASE}/public/parceiros`)
      .then(r => r.json())
      .then(d => Array.isArray(d) ? setDestaques(d.filter((e: EmpresaDestaque) => e.destaque)) : null)
      .catch(() => {});
  }, [empresaId]);

  const initials = customer?.nome
    ? customer.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.logoRow} onPress={() => router.canGoBack() ? router.back() : router.replace("/" as any)} activeOpacity={0.7}>
          <View style={[styles.logoBg, { backgroundColor: BRAND_GREEN }]}>
            <Feather name="grid" size={16} color="#fff" />
          </View>
          <Text style={[styles.logoText, { color: colors.text, fontFamily: "Inter_700Bold" }]}>GoTaxi</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <Pressable style={[styles.headerIconBtn, { backgroundColor: colors.backgroundSecondary }]}>
            <Feather name="bell" size={18} color={colors.textSecondary} />
            {isLoggedIn && <View style={styles.notifDot} />}
          </Pressable>
          {isLoggedIn ? (
            <Pressable
              onPress={() => router.push("/cliente/perfil" as any)}
              style={[styles.avatarBtn, { backgroundColor: BRAND_GREEN }]}
            >
              <Text style={[styles.avatarInitials, { fontFamily: "Inter_700Bold" }]}>{initials}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push("/cliente/cadastro" as any)}
              style={[styles.entrarBtn, { backgroundColor: BRAND_GREEN }]}
            >
              <Feather name="user" size={14} color="#fff" />
              <Text style={[styles.entrarText, { fontFamily: "Inter_600SemiBold" }]}>Entrar</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Saudação personalizada */}
      {isLoggedIn && customer && (
        <View style={[styles.saudacaoBar, { backgroundColor: BRAND_GREEN + "15", borderBottomColor: BRAND_GREEN + "30" }]}>
          <Feather name="sun" size={14} color={BRAND_GREEN} />
          <Text style={[styles.saudacaoText, { color: BRAND_GREEN, fontFamily: "Inter_500Medium" }]}>
            Olá, {customer.nome.split(" ")[0]}! O que você precisa hoje?
          </Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* NOSSOS SERVIÇOS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Nossos Serviços</Text>
            <Pressable onPress={() => router.push("/cliente/lojistas" as any)}>
              <Text style={[styles.verTodos, { color: BRAND_GREEN, fontFamily: "Inter_600SemiBold" }]}>Ver todos</Text>
            </Pressable>
          </View>

          <View style={styles.modulosGrid}>
            {MODULOS.map(mod => (
              <ModuloCard key={mod.id} modulo={mod} />
            ))}
          </View>
        </View>

        {/* BANNER PARCEIROS */}
        <Pressable onPress={() => router.push("/cliente/parceiros" as any)} style={styles.bannerContainer}>
          <LinearGradient
            colors={["#0F172A", "#1E293B"]}
            style={styles.banner}
          >
            <View style={styles.bannerContent}>
              <Text style={[styles.bannerTitulo, { fontFamily: "Inter_700Bold" }]}>Tem um negócio?</Text>
              <Text style={[styles.bannerDesc, { fontFamily: "Inter_400Regular" }]}>
                Junte-se ao GoTaxi e alcance milhares de novos clientes. Escolha seu módulo e comece a vender hoje mesmo.
              </Text>
              <View style={[styles.bannerBtn]}>
                <Text style={[styles.bannerBtnText, { fontFamily: "Inter_600SemiBold" }]}>Seja um Parceiro</Text>
                <Feather name="arrow-right" size={15} color="#0F172A" />
              </View>
            </View>
            <View style={styles.bannerDecor}>
              <View style={[styles.decorCircle, { backgroundColor: BRAND_GREEN + "30", width: 80, height: 80, borderRadius: 40 }]} />
              <View style={[styles.decorCircle2, { backgroundColor: BRAND_GREEN + "15" }]} />
            </View>
          </LinearGradient>
        </Pressable>

        {/* PROMOÇÕES */}
        {promocoes.length > 0 && (
          <View style={[styles.section, { paddingHorizontal: 0 }]}>
            <View style={[styles.sectionHeader, { paddingHorizontal: 16 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#F97316", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="tag" size={14} color="#fff" />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Promoções</Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/cliente/promocoes" as any)}>
                <Text style={[styles.verTodos, { color: BRAND_GREEN, fontFamily: "Inter_600SemiBold" }]}>Ver todas</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
            >
              {promocoes.map(p => (
                <PromoCard key={p.id} promo={p} isDark={isDark} colors={colors} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* EMPRESAS EM DESTAQUE */}
        {destaques.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.sectionIcon, { backgroundColor: "#F59E0B" }]}>
                  <Feather name="star" size={14} color="#fff" />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Empresas em Destaque</Text>
              </View>
              <Pressable onPress={() => router.push("/cliente/lojistas" as any)}>
                <Text style={[styles.verTodos, { color: BRAND_GREEN, fontFamily: "Inter_600SemiBold" }]}>Ver todas</Text>
              </Pressable>
            </View>

            <FlatList
              data={destaques}
              keyExtractor={(item) => String(item.id)}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={{ gap: 8, marginBottom: 8 }}
              renderItem={({ item }) => <EmpresaCard empresa={item} />}
            />
          </View>
        )}
      </ScrollView>

      {/* BOTTOM NAV */}
      <ClienteBottomNav activeTab="inicio" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoBg: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 20 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", position: "relative" },
  notifDot: { position: "absolute", top: 7, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: "#fff" },
  entrarBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  entrarText: { color: "#fff", fontSize: 13 },
  avatarBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: "#fff", fontSize: 13 },
  saudacaoBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  saudacaoText: { fontSize: 14 },

  /* Sections */
  section: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 18 },
  verTodos: { fontSize: 14 },

  /* Modulos Grid */
  modulosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  moduloImagem: {
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    position: "relative",
    overflow: "hidden",
  },
  moduloIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  moduloTag: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  moduloNome: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 1,
  },
  moduloDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

  /* Banner */
  bannerContainer: { marginHorizontal: 16, marginTop: 20, borderRadius: 18, overflow: "hidden" },
  banner: { padding: 24, minHeight: 180, position: "relative", overflow: "hidden" },
  bannerContent: { zIndex: 2 },
  bannerTitulo: { fontSize: 26, color: "#fff", marginBottom: 10 },
  bannerDesc: { fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 22, marginBottom: 20 },
  bannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: BRAND_GREEN,
    alignSelf: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bannerBtnText: { color: "#fff", fontSize: 15 },
  bannerDecor: { position: "absolute", right: -20, top: -20, zIndex: 1 },
  decorCircle: { position: "absolute", right: 0, top: 0 },
  decorCircle2: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#22C55E15", position: "absolute", right: 30, top: 30 },

  /* Empresas */
  empresasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  empresaImagem: {
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
    position: "relative",
  },
  empresaEmoji: {
    fontSize: 38,
    lineHeight: 46,
  },
  empresaIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  starBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  starEmoji: { fontSize: 10, lineHeight: 14 },
  starRating: { fontSize: 10, color: "#374151" },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  empresaNome: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 1,
  },
  empresaCat: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
