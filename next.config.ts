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
  // Headers para habilitar SharedArrayBuffer (interrupcion graceful de Pyodide).
  // COOP: same-origin aísla la pagina de popups cross-origin.
  // COEP: credentialless es menos restrictivo que require-corp — no rompe CDNs
  // ni recursos externos (fuentes, scripts Pyodide), solo omite credenciales.
  // Juntos habilitan crossOriginIsolated → SharedArrayBuffer → setInterruptBuffer.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
