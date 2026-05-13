const replitDomain = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "https://replit.com/";

const replitExpoDomain = process.env.REPLIT_EXPO_DEV_DOMAIN
  ? `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`
  : replitDomain;

module.exports = {
  expo: {
    name: "IPTV Player",
    slug: "iptv-player",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "iptv-player",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/icon.png",
      resizeMode: "contain",
      backgroundColor: "#111111",
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        UIBackgroundModes: ["audio"],
      },
    },
    android: {
      package: "com.iptv.player",
      adaptiveIcon: {
        foregroundImage: "./assets/images/icon.png",
        backgroundColor: "#111111",
      },
    },
    web: {
      favicon: "./assets/images/icon.png",
    },
    plugins: [
      [
        "expo-router",
        {
          origin: replitDomain,
        },
      ],
      "expo-font",
      "expo-web-browser",
      "expo-av",
      "expo-video",
    ],
    extra: {
      router: {
        origin: replitDomain,
        headOrigin: replitExpoDomain,
      },
    },
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
