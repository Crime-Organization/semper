// @vitest-environment jsdom
// Contrato da camada de dados: o que as telas pressupõem de qualquer implementação de Dados.
// Hoje roda no banco fictício (falso.ts), que substitui o Supabase em "npm run teste" e nos testes de ponta a ponta:
// se ele se comportar diferente do banco de verdade, os testes das telas passam por engano.
// Para rodar também no Supabase (com um Supabase local), basta chamar contrato() com a outra implementação.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dados } from './tipos';

function contrato(nome: string, abrir: () => Promise<Dados>) {
  describe(`Contrato da camada de dados (${nome})`, () => {
    let SD: Dados;
    beforeEach(async () => { SD = await abrir(); });

    // Cada caso cria os próprios cadastros, com um marcador no nome, para não depender da semente.
    const marca = () => 'CONTRATO ' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const criar = (nome: string, extra: Parameters<Dados['pessoaCriar']>[0] = {}) => SD.pessoaCriar({ tipo: 'pf', nome, ...extra });

    describe('Pessoas', () => {
      it('quando uma pessoa é criada, então ela pode ser lida de volta com o que foi gravado e um código', async () => {
        // Quando
        const { id, codigo } = await criar('MARIA CONTRATO', { documento: '28625587887', telefones: ['38999990000'] });
        // Então
        const lida = await SD.pessoaObter(id);
        expect(codigo).toBeTruthy();
        expect(lida).toMatchObject({ id, codigo, tipo: 'pf', nome: 'MARIA CONTRATO', documento: '28625587887', telefones: ['38999990000'] });
      });

      it('quando se busca por parte do nome, sem acento e em minúsculas, então a pessoa é encontrada', async () => {
        // Dado
        const nome = marca();
        await criar(`JOSÉ ${nome}`);
        // Quando
        const r = await SD.pessoasListar({ termo: `jose ${nome.toLowerCase()}` });
        // Então
        expect(r.linhas.map(p => p.nome)).toEqual([`JOSÉ ${nome}`]);
        expect(r.total).toBe(1);
      });

      it('quando a lista é paginada, então as páginas não se repetem e o total é o mesmo em todas', async () => {
        // Dado
        const nome = marca();
        for (let i = 0; i < 5; i++) await criar(`${nome} ${i}`);
        // Quando
        const p0 = await SD.pessoasListar({ termo: nome, porPagina: 2, pagina: 0 });
        const p1 = await SD.pessoasListar({ termo: nome, porPagina: 2, pagina: 1 });
        const p2 = await SD.pessoasListar({ termo: nome, porPagina: 2, pagina: 2 });
        // Então
        expect([p0.total, p1.total, p2.total]).toEqual([5, 5, 5]);
        expect([p0.linhas.length, p1.linhas.length, p2.linhas.length]).toEqual([2, 2, 1]);
        expect(new Set([...p0.linhas, ...p1.linhas, ...p2.linhas].map(p => p.id)).size).toBe(5);
      });

      it('quando já existe alguém com o mesmo CPF, então criar outro é recusado com a mensagem em português', async () => {
        // Dado
        await criar(marca(), { documento: '31572498609' });
        // Quando
        const repetida = criar(marca(), { documento: '31572498609' });
        // Então
        await expect(repetida).rejects.toThrow('Já existe um cadastro com este CPF/CNPJ.');
      });

      it('quando se procura pelo documento, então acha a pessoa, menos quando ela mesma é a exceção', async () => {
        // Dado
        const { id } = await criar('ANA CONTRATO', { documento: '40718392523' });
        // Quando
        const achada = await SD.pessoaPorDocumento('40718392523');
        const semEla = await SD.pessoaPorDocumento('40718392523', id);
        // Então
        expect(achada).toMatchObject({ id, nome: 'ANA CONTRATO' });
        expect(semEla).toBeNull();
      });

      it('quando a pessoa é arquivada, então sai das ativas, entra nas arquivadas e volta ao desarquivar', async () => {
        // Dado
        const nome = marca();
        const { id } = await criar(nome);
        const ids = async (situacao: 'ativas' | 'arquivadas') => (await SD.pessoasListar({ termo: nome, situacao })).linhas.map(p => p.id);
        // Quando
        await SD.pessoasArquivar([id]);
        const arquivada = [await ids('ativas'), await ids('arquivadas')];
        await SD.pessoasArquivar([id], false);
        const devolvida = [await ids('ativas'), await ids('arquivadas')];
        // Então
        expect(arquivada).toEqual([[], [id]]);
        expect(devolvida).toEqual([[id], []]);
      });
    });

    describe('Quadro', () => {
      it('quando a pessoa é movida para uma coluna, então aparece nessa coluna e sai da anterior', async () => {
        // Dado
        const [primeira, segunda] = await SD.colunasListar('pessoas');
        const nome = marca();
        const { id } = await criar(nome);
        await SD.pessoaMover(id, primeira.id, 1);
        // Quando
        await SD.pessoaMover(id, segunda.id, 1);
        // Então
        const naPrimeira = await SD.pessoasDaEtapa(primeira.id, { termo: nome });
        const naSegunda = await SD.pessoasDaEtapa(segunda.id, { termo: nome });
        expect(naPrimeira.linhas.map(p => p.id)).toEqual([]);
        expect(naSegunda.linhas.map(p => p.id)).toEqual([id]);
      });
    });

    describe('Convites', () => {
      it('quando um convite é criado, então aparece nos pendentes com um código de acesso, e sai ao ser cancelado', async () => {
        // Dado
        const { id: pessoa } = await criar(marca());
        // Quando
        const convite = await SD.conviteCriar(pessoa, 'contrato@exemplo.com', 'usuario');
        const pendentes = (await SD.convitesListar()).map(c => c.email);
        await SD.conviteCancelar(convite.id);
        const depois = (await SD.convitesListar()).map(c => c.email);
        // Então
        expect(convite.codigo).toBeTruthy();
        expect(pendentes).toContain('contrato@exemplo.com');
        expect(depois).not.toContain('contrato@exemplo.com');
      });

      it('quando já há um convite pendente para o e-mail, então um segundo é recusado com a mensagem em português', async () => {
        // Dado (no banco, o índice convites_email_pendente não deixa dois convites pendentes para o mesmo e-mail)
        const { id: pessoa } = await criar(marca());
        const { id: outra } = await criar(marca());
        await SD.conviteCriar(pessoa, 'repetido@exemplo.com', 'usuario');
        // Quando
        const segundo = SD.conviteCriar(outra, 'repetido@exemplo.com', 'usuario');
        // Então
        await expect(segundo).rejects.toThrow('Este e-mail já tem um convite pendente.');
      });
    });

    describe('Sessão', () => {
      it('quando a pessoa sai, então não há mais sessão nem contexto', async () => {
        // Quando
        await SD.sair();
        // Então
        expect(await SD.sessao()).toBeNull();
        expect(await SD.contexto()).toBeNull();
      });
    });
  });
}

// O banco fictício guarda tudo na sessão da aba: cada caso começa com ele zerado.
contrato('banco fictício', async () => {
  sessionStorage.clear();
  vi.resetModules();
  return (await import('./falso')).SD;
});
