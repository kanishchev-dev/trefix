// pnpm keeps babel-preset-expo as a dependency of `expo` only, while Babel
// resolves presets relative to this file, so release bundling (export:embed)
// cannot find it by name. Resolve it through `expo`, which pins the version.
const babelPresetExpo = require.resolve("babel-preset-expo", {
  paths: [require.resolve("expo/package.json")],
});

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [babelPresetExpo],
    plugins: ["react-native-reanimated/plugin"],
  };
};
