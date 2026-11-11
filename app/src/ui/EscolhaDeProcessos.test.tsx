// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosCompromissos, ProcessoParaLigar } from '../dados';
import { EscolhaDeProcessos, type ProcessoEscolhido } from './EscolhaDeProcessos';

const { processosParaLigar } = vi.hoisted(() => ({ processosParaLigar: vi.fn<DadosCompromissos['processosParaLigar']>() }));
vi.mock('../dados', () => ({ SD: { processosParaLigar } satisfies Pick<DadosCompromissos, 'processosParaLigar'> }));

const marca: ProcessoParaLigar = { id: 'pr-marca', codigo: 'E901D209', tipo: 'administrativo', numero: '912345678', titulo: 'Registro da marca Exemplo', cliente_nome: 'JOSÉ DA SILVA TESTE' };
const acao: ProcessoParaLigar = { id: 'pr-acao', codigo: '2FF7C598', tipo: 'judicial', numero: '0001234-97.2026.8.13.0024', titulo: null, cliente_nome: 'MARIA APARECIDA EXEMPLO' };

/** A peça com a lista guardada, como no formulário. */
function Formulario({ inicio = [] as ProcessoEscolhido[], ocultos = 0, maximo = undefined as number | undefined, aoMudar = vi.fn() }) {
  const [lista, setLista] = useState(inicio);
  return <EscolhaDeProcessos rotulo="Processos" escolhidos={lista} ocultos={ocultos} maximo={maximo} aoMudar={x => { setLista(x); aoMudar(x); }} />;
}

describe('Processos do cadastro', () => {
  beforeEach(() => { processosParaLigar.mockReset(); processosParaLigar.mockResolvedValue([marca, acao]); });

  it('dado um processo ligado, quando a pessoa clica no "X" dele, então ele sai da lista e o foco vai ao grupo', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Formulario inicio={[marca]} aoMudar={aoMudar} />);
    expect(screen.getByRole('group', { name: 'Processos' })).toHaveTextContent('Registro da marca Exemplo');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar o processo Registro da marca Exemplo' }));
    // Então
    expect(aoMudar).toHaveBeenLastCalledWith([]);
    expect(screen.queryByText('Registro da marca Exemplo')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Processos' })).toHaveFocus();
  });

  it('quando a pessoa liga um segundo processo, então os dois ficam na lista', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Formulario inicio={[marca]} aoMudar={aoMudar} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar processo' }));
    await userEvent.click(await screen.findByRole('button', { name: /MARIA APARECIDA EXEMPLO/ }));
    // Então
    expect(aoMudar).toHaveBeenLastCalledWith([marca, acao]);
    expect(screen.getByRole('group', { name: 'Processos' })).toHaveTextContent('Judicial · 0001234-97.2026.8.13.0024 · 2FF7C598');
  });

  it('dado um cadastro de um processo só (a tarefa) já com o seu, quando aparece, então não há o botão de ligar outro', () => {
    // Quando
    render(<Formulario inicio={[marca]} maximo={1} />);
    // Então
    expect(screen.queryByRole('button', { name: 'Ligar processo' })).not.toBeInTheDocument();
  });

  it('dado um processo ligado que a pessoa não pode abrir, quando o cadastro aparece, então avisa que ele continua ligado, sem o "X"', () => {
    // Quando
    render(<Formulario ocultos={1} maximo={1} />);
    // Então
    expect(screen.getByText('Também há processo ligado que você não tem acesso para abrir. Ele continua ligado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tirar o processo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ligar processo' })).not.toBeInTheDocument();
  });
});
