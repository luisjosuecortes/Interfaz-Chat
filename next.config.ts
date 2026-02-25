import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuracion para @huggingface/transformers (ONNX Runtime WASM en navegador)
  // Turbopack: excluir dependencias de Node.js que no se usan en el navegador
  turbopack: {
    resolveAlias: {
      sharp: { browser: "" },
      "onnxruntime-node": { browser: "" },
    },
  },
  // Webpack fallback (para builds con --webpack)
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default nextConfig;
