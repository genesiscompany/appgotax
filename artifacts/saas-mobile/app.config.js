// Dynamic Expo config — substitui a chave do Google Maps a partir da variável
// de ambiente EXPO_PUBLIC_GOOGLE_MAPS_KEY no momento do build EAS.
//
// IMPORTANTE: a sintaxe "$(EXPO_PUBLIC_GOOGLE_MAPS_KEY)" no app.json só funciona
// no iOS (substituição do Xcode). No Android, o EAS escreve esse texto literal
// no AndroidManifest, fazendo o mapa aparecer em branco. Esta config corrige isso.

const baseConfig = require("./app.json").expo;

module.exports = ({ config }) => {
  const googleMapsKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
    process.env.GOOGLE_MAPS_KEY ||
    "";

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
