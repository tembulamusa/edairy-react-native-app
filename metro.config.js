const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

const defaultConfig = getDefaultConfig(__dirname);

const config = {
    resolver: {
        sourceExts: [...defaultConfig.resolver.sourceExts, "css"],
        assetExts: [
            ...defaultConfig.resolver.assetExts.filter((ext) => ext !== "css"),
            "ttf",
        ],
        resolverMainFields: ["react-native", "browser", "main"],
    },
    transformer: {
        babelTransformerPath: require.resolve("react-native-css-transformer"),
        getTransformOptions: async () => ({
            transform: {
                experimentalImportSupport: false,
                inlineRequires: true,
            },
        }),
    },
    cacheStores: [],
};

module.exports = mergeConfig(defaultConfig, config);