// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O mapa do sistema (#407) confere a si mesmo: se o código mudou e ninguém rodou "npm run mapa", este teste falha (e o pre-push
// roda o verificar, então o mapa nunca envelhece).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  chaveDoArquivo, citadosQueNaoExistem, gerarMapa, lerProjeto, partesDoContrato, primeiraFrase, rotasDoApp, semAssunto, tabelasDaMigracao,
  type Projeto
} from './gerar';

const RAIZ = fileURLToPath(new URL('../../..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const DESATUALIZADO = 'O mapa do sistema está desatualizado: rode npm run mapa --prefix app';
const semCR = (texto: string) => texto.replace(/\r\n?/g, '\n');

/** Um projeto de mentira, só com os arquivos dados (caminho → conteúdo). */
const projetoCom = (arquivos: Record<string, string>): Projeto => ({
  arquivos: Object.keys(arquivos).sort(),
  ler: caminho => arquivos[caminho] ?? ''
});

describe('Mapa do sistema', () => {
  describe('Dado o código de hoje', () => {
    const projeto = lerProjeto(RAIZ);

    it('quando o mapa é gerado de novo, então é igual ao que está gravado', () => {
      // Quando
      const gerado = gerarMapa(projeto);
      // Então
      for (const [caminho, esperado] of gerado) {
        let gravado = '';
        try { gravado = semCR(readFileSync(`${RAIZ}/${caminho}`, 'utf8')); } catch { /* sem o arquivo, o mapa também está desatualizado */ }
        const linhaDiferente = gravado.split('\n').findIndex((linha, i) => linha !== esperado.split('\n')[i]);
        expect(gravado === esperado, `${DESATUALIZADO} (${caminho}, linha ${linhaDiferente + 1})`).toBe(true);
      }
    });

    it('quando a tabela de assuntos é conferida, então não cita arquivo, tabela, contrato ou rota que não existe', () => {
      // Quando
      const citados = citadosQueNaoExistem(projeto);
      // Então
      expect(citados).toEqual([]);
    });
  });

  describe('Dado um projeto pequeno', () => {
    const projeto = projetoCom({
      'app/src/paginas/Pessoas.tsx': '',
      'app/src/paginas/CoisaNova.tsx': '',
      'app/e2e/pessoas.spec.ts': '',
      'supabase/migrations/20990101000000_coisa.sql': 'create table public.coisas (id uuid);'
    });

    it('quando gera o mapa, então o arquivo de um assunto aparece nele e o teste de tela vira o comando do assunto', () => {
      // Quando
      const mapa = gerarMapa(projeto).get('docs/MAPA.md')!;
      // Então
      const pessoas = mapa.slice(mapa.indexOf('## Pessoas'), mapa.indexOf('<a id="contratos">'));
      expect(pessoas).toContain('Pessoas.tsx');
      expect(pessoas).toContain('`npx playwright test e2e/pessoas.spec.ts`');
    });

    it('quando procura o que não tem assunto, então acha o arquivo e a tabela novos', () => {
      // Quando
      const sobra = semAssunto(projeto);
      // Então
      expect(sobra).toEqual(['app/src/paginas/CoisaNova.tsx', 'supabase/migrations/20990101000000_coisa.sql', 'tabela coisas']);
    });
  });

  describe('Dado o caminho de um arquivo', () => {
    it.each([
      ['app/src/paginas/Pessoas.tsx', 'Pessoas'],
      ['app/src/paginas/Pessoas.test.tsx', 'Pessoas'],
      ['app/src/ui/avisos.tela.test.tsx', 'avisos'],
      ['app/e2e/pessoas.spec.ts', 'pessoas'],
      ['supabase/migrations/20261025000003_vinculos.sql', 'vinculos'],
      ['supabase/tests/mensagens.test.sql', 'mensagens'],
      ['supabase/functions/google-conectar/index.ts', 'google-conectar']
    ])('quando o caminho é %s, então a chave é %s', (caminho, chave) => {
      // Então
      expect(chaveDoArquivo(caminho)).toBe(chave);
    });
  });

  describe('Dada uma migração', () => {
    it('quando cria e muda tabelas, então acha as duas, com o esquema privado no nome', () => {
      // Dado
      const sql = 'create table if not exists public.salas (id uuid);\nalter table public.compromissos add column sala_id uuid;\n'
        + 'create policy "quem vê" on public.salas for select using (true);\ncreate table privado.ligacoes (id uuid);';
      // Quando
      const tabelas = tabelasDaMigracao(sql);
      // Então
      expect(tabelas).toEqual({ cria: ['salas', 'privado.ligacoes'], mexe: ['salas', 'privado.ligacoes', 'compromissos'] });
    });

    it('quando monta o nome da tabela dentro de um laço, então não toma o esquema por tabela', () => {
      // Quando
      const tabelas = tabelasDaMigracao('execute format($f$ create table public.%1$I (id uuid); $f$, m.tabela);');
      // Então
      expect(tabelas.cria).toEqual([]);
    });

    it('quando a tabela só aparece num comentário, então não conta', () => {
      // Quando
      const tabelas = tabelasDaMigracao('-- create table public.antiga (id uuid);');
      // Então
      expect(tabelas.cria).toEqual([]);
    });
  });

  describe('Dado o contrato da camada de dados', () => {
    it('quando lê as partes, então pega só as do contrato Dados, com os nomes das funções', () => {
      // Dado
      const tipos = [
        'export interface DadosSalas {', '  /** Comentário. */', '  salasListar(): Promise<Sala[]>;', '  salaCriar(dados: DadosSala): Promise<Sala>;', '}',
        'export interface DadosDoRecebimento {', '  valor: number;', '}',
        'export interface Dados extends DadosSalas {}'
      ].join('\n');
      // Quando
      const partes = partesDoContrato(tipos);
      // Então
      expect([...partes]).toEqual([['DadosSalas', ['salasListar', 'salaCriar']]]);
    });
  });

  describe('Dadas as rotas do app', () => {
    it('quando lê, então junta as das páginas e as dos cadastros, sem repetir', () => {
      // Dado
      const app = `<Route path="/" element={<Home />} />\n<Route path="agenda" element={<A />} />\n['agenda/novo', FormularioCompromisso]\n<Route path="agenda" />`;
      // Quando
      const rotas = rotasDoApp(app);
      // Então
      expect(rotas).toEqual(['/', 'agenda', 'agenda/novo']);
    });
  });

  describe('Dado o comentário do topo de uma regra', () => {
    it('quando a primeira frase é curta, então é ela a descrição, sem o resto', () => {
      // Dado
      const codigo = '// Regras dos vínculos entre pessoas. Tudo puro,\n// sem tela nem banco.\nimport x from "y";';
      // Então
      expect(primeiraFrase(codigo)).toBe('Regras dos vínculos entre pessoas.');
    });

    it('quando a frase tem "!" ou "?" no meio, então continua até o ponto', () => {
      // Dado
      const codigo = '// Comentários do cartão, com @ e com ! e a tecla ? da ajuda. Mais coisa.';
      // Então
      expect(primeiraFrase(codigo)).toBe('Comentários do cartão, com @ e com ! e a tecla ? da ajuda.');
    });

    it('quando a frase é longa demais, então corta numa palavra inteira, com reticências', () => {
      // Dado
      const codigo = `// ${'palavra '.repeat(40)}fim.`;
      // Quando
      const frase = primeiraFrase(codigo);
      // Então
      expect(frase.endsWith('palavra…')).toBe(true);
      expect(frase.length).toBeLessThan(codigo.length);
    });
  });
});
