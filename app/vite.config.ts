/// <reference types="vitest/config" />
import { defineConfig, loadEnv, searchForWorkspaceRoot, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arquivoDoModo, politicaComOBanco, qualBanco, type Banco } from './src/regras/qualBanco.ts';

/** O fuso dos testes, o de Brasília, para as datas darem o mesmo resultado em qualquer computador, inclusive no Windows e na rotina do GitHub. */
const FUSO_DOS_TESTES = 'America/Sao_Paulo';
/** A pasta dos arquivos .env (a do app), qualquer que seja a pasta de onde o comando roda. */
const PASTA_DO_APP = fileURLToPath(new URL('.', import.meta.url));

/** Na compilação, põe o endereço do banco no connect-src do .htaccess copiado de public/ (#74): o endereço só existe no
 *  app/.env.<modo>, e o navegador do site publicado só fala com o banco que a política de conteúdo libera. */
function bancoNaPoliticaDeConteudo(banco: Banco): Plugin {
  let pastaDeSaida = '';
  return {
    name: 'semper-banco-na-politica-de-conteudo',
    apply: 'build',
    configResolved: config => { pastaDeSaida = resolve(config.root, config.build.outDir); },
    closeBundle: () => {
      const arquivo = resolve(pastaDeSaida, '.htaccess');
      writeFileSync(arquivo, politicaComOBanco(readFileSync(arquivo, 'utf8'), banco));
    }
  };
}

// "npm run teste" usa o modo "falso": a camada de dados vira um banco fictício na aba do navegador,
// sem login e sem tocar no Supabase. Os testes (modo "test" do Vitest) também usam o fictício, para que
// nenhum teste fale com o banco de verdade. Em qualquer outro modo, os dados vêm do banco de verdade.
export default defineConfig(({ mode }) => {
  if (mode === 'test') process.env.TZ = FUSO_DOS_TESTES;
  // O banco deste modo (#74): VITE_SUPABASE_URL e VITE_SUPABASE_CHAVE do app/.env.<modo> (ou do ambiente, que tem prioridade); o
  // "npm run dev-producao" lê o app/.env.production, o mesmo do site publicado. Se faltar num modo que precisa de banco, o servidor
  // não liga e a compilação para, com o erro em português de regras/qualBanco.ts: nunca sai um site sem banco ou no banco errado.
  const variaveis = loadEnv(arquivoDoModo(mode), PASTA_DO_APP, 'VITE_SUPABASE_');
  const banco = qualBanco(mode, { url: variaveis.VITE_SUPABASE_URL, chave: variaveis.VITE_SUPABASE_CHAVE });
  return {
  plugins: [react(), bancoNaPoliticaDeConteudo(banco)],
  // A versão desta compilação, para o aviso de versão nova (ui/versaoNova.tsx). Vem da variável VERSAO, que só a rotina
  // "Publicar o SEMPER" preenche (a mesma do versao.txt); no npm run dev, no banco fictício e nos testes fica vazia.
  // A data dela (aaaa-mm-dd, DATA_DA_VERSAO, também da rotina) vai junto: as novidades ainda em app/novidades/proxima/ aparecem
  // com esse número e essa data no site publicado (#353).
  define: {
    __VERSAO__: JSON.stringify(mode === 'test' ? '' : process.env.VERSAO ?? ''),
    __DATA_DA_VERSAO__: JSON.stringify(mode === 'test' ? '' : process.env.DATA_DA_VERSAO ?? ''),
    __BANCO__: JSON.stringify(banco)
  },
  // O conversor AVIF da foto do perfil carrega o próprio .wasm ao lado do código: não pode ser reempacotado pelo Vite.
  optimizeDeps: { exclude: ['@jsquash/avif'] },
  // Em cópias de trabalho, node_modules pode ser um link para outra pasta: sem isto, o servidor local bloqueia as fontes e o .wasm da foto.
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), realpathSync(new URL('./node_modules', import.meta.url))] } },
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
};
});
