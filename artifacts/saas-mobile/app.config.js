// Dynamic Expo config — substitui a chave do Google Maps a partir da variável
// de ambiente EXPO_PUBLIC_GOOGLE_MAPS_KEY no momento do build EAS.
//
// IMPORTANTE: a sintaxe "$(EXPO_PUBLIC_GOOGLE_MAPS_KEY)" no app.json só funciona
// no iOS (substituição do Xcode). No Android, o EAS escreve esse texto literal
// no AndroidManifest, fazendo o mapa aparecer em branco. Esta config corrige isso.

const fs = require("fs");
const path = require("path");
const baseConfig = require("./app.json").expo;

// Firebase (FCM) é obrigatório no Android para o app obter o token de push.
// O arquivo NÃO vai para o repositório (é público): use a variável de arquivo
// GOOGLE_SERVICES_JSON do EAS ou gere ./google-services.json antes do build.
function resolveGoogleServicesFile() {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const local = path.join(__dirname, "google-services.json");
  if (fs.existsSync(local)) return "./google-services.json";
  console.warn("[app.config] google-services.json ausente: push notifications não vão funcionar no Android.");
  return undefined;
}

module.exports = ({ config }) => {
  const googleMapsKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
    process.env.GOOGLE_MAPS_KEY ||
    "";

  const googleServicesFile = resolveGoogleServicesFile();

  return {
    ...baseConfig,
    ...config,
    ios: {
      ...baseConfig.ios,
      ...(config.ios || {}),
      config: {
        ...(baseConfig.ios && baseConfig.ios.config),
        ...(config.ios && config.ios.config),
        googleMapsApiKey: googleMapsKey,
      },
    },
    android: {
      ...baseConfig.android,
      ...(config.android || {}),
      ...(googleServicesFile ? { googleServicesFile } : {}),
      config: {
        ...(baseConfig.android && baseConfig.android.config),
        ...(config.android && config.android.config),
        googleMaps: {
          apiKey: googleMapsKey,
        },
      },
    },
  };
};
