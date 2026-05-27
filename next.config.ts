import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Otimizações de performance
  swcMinify: true,
  compress: true,
  
  // Imagens otimizadas
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Headers de segurança
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "X-DNS-Prefetch-Control",
          value: "on",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ],
    },
  ],

  // Configurações de TypeScript
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },

  // Configurações de ESLint
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Suporte para módulos antigos se necessário
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },

  // Variáveis de ambiente publicadas
  publicRuntimeConfig: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  },

  // ISR (Incremental Static Regeneration)
  experimental: {
    isrMemoryCacheSize: 52 * 1024 * 1024, // 52MB
  },
};

export default nextConfig;
