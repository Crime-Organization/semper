// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Membro } from '../dados/tipos';
import type { CamposContrato } from '../regras/contrato';
import { ParticipantesDoContrato } from './ParticipantesDoContrato';

const EQUIPE: Membro[] = [
  { id: 'u-ana', nome: 'Ana Teste Lima', ativo: true, pessoa_id: 'p-ana' },
  { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true, pessoa_id: 'p-bruno' },
  { id: 'u-res', nome: 'Conta Reservada', ativo: false, reservada: true, pessoa_id: 'p-res' },
  { id: 'u-carla', nome: 'Carla Que Saiu', ativo: false, pessoa_id: 'p-carla' }
];
type Linha = CamposContrato['participantes'][number];

/** A peça com as linhas guardadas, como no cadastro do contrato. */
function Formulario({ inicio = [] as Linha[], nomes: nomesIniciais = [] as string[], indicador = '', erro = '', aoMudar = vi.fn() }) {
  const [linhas, setLinhas] = useState(inicio);
  const [nomes, setNomes] = useState(nomesIniciais);
  const [chaves, setChaves] = useState(inicio.map((_, i) => i));
  const mudar = (novas: Linha[]) => { setLinhas(novas); aoMudar(novas); };
  return <ParticipantesDoContrato equipe={EQUIPE} linhas={linhas} nomes={nomes} chaves={chaves} indicadorId={indicador} erro={erro || undefined}
    aoAdicionar={m => { mudar([...linhas, { pessoaId: m.pessoa_id!, percentual: '' }]); setNomes([...nomes, m.nome]); setChaves([...chaves, chaves.length + 10]); }}
    aoTirar={i => { mudar(linhas.toSpliced(i, 1)); setNomes(nomes.toSpliced(i, 1)); setChaves(chaves.toSpliced(i, 1)); }}
    aoMudarPercentual={(i, percentual) => mudar(linhas.map((p, j) => j === i ? { ...p, percentual } : p))} />;
}

const abrirBusca = () => userEvent.click(screen.getByRole('button', { name: 'Adicionar participante' }));
const achados = () => screen.getByRole('list', { name: 'Equipe' });

describe('Participantes do contrato: a busca', () => {
  it('quando a pessoa abre a busca, então aparecem só os integrantes ativos e as contas reservadas, sem quem saiu da equipe', async () => {
    // Dado
    render(<Formulario />);
    // Quando
    await abrirBusca();
    // Então
    expect(achados()).toHaveTextContent('Ana Teste Lima');
    expect(achados()).toHaveTextContent('Bruno Exemplo Souza');
    expect(achados()).toHaveTextContent('Conta Reservada');
    expect(achados()).not.toHaveTextContent('Carla Que Saiu');
  });

  it('dado quem já é participante ou o indicador, quando a busca abre, então eles não aparecem para entrar de novo', async () => {
    // Dado: a Ana já é participante, e o Bruno é o indicador
    render(<Formulario inicio={[{ pessoaId: 'p-ana', percentual: '10' }]} nomes={['ANA TESTE LIMA']} indicador="p-bruno" />);
    // Quando
    await abrirBusca();
    // Então
    expect(within(achados()).getAllByRole('button')).toHaveLength(1);
    expect(within(achados()).getByRole('button', { name: /Conta Reservada/ })).toBeInTheDocument();
  });

  it('quando a pessoa escolhe alguém, então ele entra numa linha com o nome, sem %, e o foco vai ao % dele', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Formulario aoMudar={aoMudar} />);
    await abrirBusca();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Bruno Exemplo Souza' }));
    // Então
    expect(aoMudar).toHaveBeenLastCalledWith([{ pessoaId: 'p-bruno', percentual: '' }]);
    expect(screen.getByRole('list', { name: 'Participantes' })).toHaveTextContent('Bruno Exemplo Souza');
    await vi.waitFor(() => expect(screen.getByRole('textbox', { name: '% do participante 1' })).toHaveFocus());
  });
});

describe('Participantes do contrato: quem saiu da equipe', () => {
  it('dado um contrato antigo com quem saiu da equipe, quando a lista aparece, então ele continua nela, marcado, com o % dele', () => {
    // Quando
    render(<Formulario inicio={[{ pessoaId: 'p-carla', percentual: '5' }]} nomes={['CARLA QUE SAIU']} />);
    // Então
    expect(screen.getByRole('list', { name: 'Participantes' })).toHaveTextContent('Carla Que Saiu (desativado na equipe)');
    expect(screen.getByRole('textbox', { name: '% do participante 1' })).toHaveValue('5');
  });

  it('dado um contrato antigo com alguém que nunca foi da equipe, quando a lista aparece, então ele vem com o nome do cadastro, marcado', () => {
    // Quando
    render(<Formulario inicio={[{ pessoaId: 'p-cliente', percentual: '' }]} nomes={['LUCIANA ROCHA AMOSTRA']} />);
    // Então
    expect(screen.getByRole('list', { name: 'Participantes' })).toHaveTextContent('LUCIANA ROCHA AMOSTRA (não é da equipe)');
  });

  it('dado quem saiu da equipe na lista, quando a pessoa o tira, então ele sai e o % dos outros fica como estava', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Formulario inicio={[{ pessoaId: 'p-carla', percentual: '5' }, { pessoaId: 'p-ana', percentual: '10' }]} nomes={['CARLA QUE SAIU', 'ANA TESTE LIMA']} aoMudar={aoMudar} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar Carla Que Saiu' }));
    // Então
    expect(aoMudar).toHaveBeenLastCalledWith([{ pessoaId: 'p-ana', percentual: '10' }]);
    expect(screen.getByRole('textbox', { name: '% do participante 1' })).toHaveValue('10');
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Adicionar participante' })).toHaveFocus());
  });
});

describe('Participantes do contrato: o erro (#359)', () => {
  it('dado um erro nos participantes, quando a pessoa está no % de uma linha, então o leitor de tela lê o campo como inválido e diz o erro', () => {
    // Dado
    const erro = 'A soma dos % passa de 100.';
    // Quando
    render(<Formulario inicio={[{ pessoaId: 'p-ana', percentual: '120' }]} nomes={['ANA TESTE LIMA']} erro={erro} />);
    // Então
    const percentual = screen.getByRole('textbox', { name: '% do participante 1' });
    expect(percentual).toBeInvalid();
    expect(percentual).toHaveAccessibleDescription(erro);
  });
});
