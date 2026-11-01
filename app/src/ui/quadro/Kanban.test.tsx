// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui o quadro é aberto também como quem não é.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Coluna, GrupoDeColunas } from '../../dados';
import { blocosDoQuadro } from '../../regras/quadro';
import { Kanban } from './Kanban';
import type { Quadro } from './useColunas';

const INICIO: GrupoDeColunas = { id: 'g-inicio', nome: 'Início', ordem: 1, comeca_fechado: false };
const VAZIO: GrupoDeColunas = { id: 'g-vazio', nome: 'Sem colunas', ordem: 2, comeca_fechado: false };
const coluna = (id: string, nome: string, ordem: number, grupo_id: string | null = null): Coluna => ({ id, nome, ordem, grupo_id, criado_por: null, oculta: false });
const COLUNAS = [coluna('c-lead', 'Lead', 1), coluna('c-dist', 'Distribuído', 2, INICIO.id)];

function montar(podeGerirGrupos: boolean, grupos: GrupoDeColunas[], colunas = COLUNAS) {
  const nada = () => Promise.resolve();
  const quadro = {
    colunas, sugestoes: [], pronto: true, rotuloSemEtapa: 'Sem etapa', grupos, blocos: blocosDoQuadro(colunas, grupos), podeGerirGrupos,
    grupoAberto: () => true, podeReordenar: false, podeRenomear: () => false, podeExcluir: () => false, ordemDe: () => 'manual',
    nomeDe: () => '', criar: () => Promise.resolve(true), criarGrupo: () => Promise.resolve(true), alternarGrupo: nada, ordenar: nada
  } as unknown as Quadro;
  render(<Kanban quadro={quadro} recarga={0} carregar={() => Promise.resolve({ linhas: [], total: 0 })} ordemDe={() => null} cartao={() => null}
    endereco={() => '/'} aoAbrir={() => undefined} aoMover={nada} />);
}

describe('Grupos no quadro', () => {
  it('quando quem abre não é administrador, então escolhe o grupo da coluna nova, mas não cria nem mexe nos grupos', async () => {
    // Quando
    montar(false, [INICIO, VAZIO]);
    // Então
    const grupo = await screen.findByRole('region', { name: 'Grupo Início' });
    expect(within(grupo).getByRole('button', { name: 'Fechar o grupo Início' })).toBeTruthy();
    expect(screen.getByLabelText('Grupo da coluna')).toBeTruthy();
    expect(screen.queryByLabelText('Novo grupo')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Opções do grupo Início' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Grupo Sem colunas' })).toBeNull();
  });

  it('quando quem abre é administrador, então cria grupos, tem o menu deles e vê os grupos sem coluna', async () => {
    // Quando
    montar(true, [INICIO, VAZIO]);
    // Então
    expect(await screen.findByRole('button', { name: 'Opções do grupo Início' })).toBeTruthy();
    expect(screen.getByLabelText('Novo grupo')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Grupo Sem colunas' }).textContent).toContain('Nenhuma coluna');
  });

  it('quando o quadro não tem grupos, então não aparece nenhum grupo nem a escolha de grupo', async () => {
    // Quando
    montar(false, []);
    // Então
    expect(await screen.findByRole('list', { name: 'Lead' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: /^Grupo / })).toBeNull();
    expect(screen.queryByLabelText('Grupo da coluna')).toBeNull();
  });
});
