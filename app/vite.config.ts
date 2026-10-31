/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// "npm run teste" usa o modo "falso": a camada de dados vira um banco fictício na aba do navegador,
// sem login e sem tocar no Supabase. Os testes (modo "test" do Vitest) também usam o fictício, para que
// nenhum teste fale com o banco de verdade. Em qualquer outro modo, os dados vêm do banco de verdade.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // A versão desta compilação, para o aviso de versão nova (ui/versaoNova.tsx). Vem da variável VERSAO, que só a rotina
  // "Publicar o SEMPER" preenche (a mesma do versao.txt); no npm run dev, no banco fictício e nos testes fica vazia.
  define: { __VERSAO__: JSON.stringify(mode === 'test' ? '' : process.env.VERSAO ?? '') },
  // O conversor AVIF da foto do perfil carrega o próprio .wasm ao lado do código: não pode ser reempacotado pelo Vite.
  optimizeDeps: { exclude: ['@jsquash/avif'] },
  resolve: {
    alias: {
      '@dados-impl': fileURLToPath(new URL(mode === 'falso' || mode === 'test' ? './src/dados/falso.ts' : './src/dados/supabase.ts', import.meta.url))
    }
  },
  // Testes unitários e de componente (veja TESTES.md). Os de ponta a ponta, em e2e/, são do Playwright.
  test: {
    setupFiles: ['./src/testes/preparar.ts'],
    exclude: ['e2e/**', 'node_modules/**']
  },
  build: {
    // Fontes nunca viram texto dentro do CSS: o navegador baixa só o formato que usa (woff2).
    assetsInlineLimit: arquivo => /\.(woff2?|ttf)$/.test(arquivo) ? false : undefined,
    rolldownOptions: {
      output: {
        // Bibliotecas em arquivos próprios: mudam pouco, então ficam guardadas no navegador
        // de uma publicação para outra; só o código do SEMPER é baixado de novo.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/](@supabase|tslib|iceberg-js)[\\/]/ }
          ]
        }
      }
    }
  }
}));
