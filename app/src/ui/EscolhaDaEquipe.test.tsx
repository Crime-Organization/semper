// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Membro } from '../dados/tipos';
import { EscolhaDaEquipe } from './EscolhaDaEquipe';

const EQUIPE: Membro[] = [
  { id: 'u-ana', nome: 'Ana Teste Lima', ativo: true },
  { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true },
  { id: 'u-caio', nome: 'Caio Ávila', ativo: true },
  { id: 'u-saiu', nome: 'Davi Que Saiu', ativo: false }
];

/** A peça com a lista guardada, como no formulário. */
function Formulario({ inicio = [] as string[], fora = [] as string[], aoMudar = vi.fn() }) {
  const [ids, setIds] = useState(inicio);
  return <EscolhaDaEquipe rotulo="Participantes" equipe={EQUIPE} escolhidos={ids} fora={fora} adicionar="Adicionar participante"
    aoMudar={x => { setIds(x); aoMudar(x); }} />;
}

describe('Equipe do item: o que aparece', () => {
  it('quando ninguém foi escolhido, então não aparece nenhum nome, só o botão de adicionar', () => {
    // Quando
    render(<Formulario />);
    // Então
    expect(screen.queryByText('Ana Teste Lima')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar participante' })).toBeInTheDocument();
  });

  it('dado alguém desativado que já estava no item, quando a lista aparece, então ele continua nela, marcado como desativado', () => {
    // Quando
    render(<Formulario inicio={['u-saiu']} />);
    // Então
    expect(screen.getByRole('group', { name: 'Participantes' })).toHaveTextContent('Davi Que Saiu (desativado)');
    expect(screen.getByRole('button', { name: 'Tirar Davi Que Saiu' })).toBeInTheDocument();
  });

  it('quando todos que podem entrar já estão no item, então no lugar do botão aparece que não há mais ninguém', () => {
    // Quando
    render(<Formulario inicio={['u-ana', 'u-bruno']} fora={['u-caio']} />);
    // Então
    expect(screen.queryByRole('button', { name: 'Adicionar participante' })).not.toBeInTheDocument();
    expect(screen.getByText('Não há mais ninguém na equipe.')).toBeInTheDocument();
  });
});

describe('Equipe do item: adicionar e tirar', () => {
  it('quando a pessoa clica em adicionar, então a busca mostra só quem da equipe ativa ainda pode entrar', async () => {
    // Dado: a Ana já está, e o Bruno é o responsável
    render(<Formulario inicio={['u-ana']} fora={['u-bruno']} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar participante' }));
    // Então
    const lista = screen.getByRole('list', { name: 'Equipe' });
    expect(lista).toHaveTextContent('Caio Ávila');
    expect(lista.querySelectorAll('button')).toHaveLength(1);
  });

  it('quando a pessoa digita parte do nome, sem acento, então a busca mostra só quem combina', async () => {
    // Dado
    render(<Formulario />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar participante' }));
    // Quando
    await userEvent.type(screen.getByRole('textbox'), 'avila');
    // Então
    expect(screen.getByRole('list', { name: 'Equipe' })).toHaveTextContent('Caio Ávila');
    expect(screen.getByRole('list', { name: 'Equipe' })).not.toHaveTextContent('Ana Teste Lima');
  });

  it('quando a pessoa escolhe alguém na busca, então ele entra na lista, a busca fecha e o foco volta ao botão', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Formulario aoMudar={aoMudar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar participante' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Bruno Exemplo Souza' }));
    // Então
    expect(aoMudar).toHaveBeenLastCalledWith(['u-bruno']);
    expect(screen.getByRole('button', { name: 'Tirar Bruno Exemplo Souza' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Adicionar participante' })).toHaveFocus());
  });

  it('quando a pessoa adiciona o último que podia entrar, então o foco fica no grupo, e não se perde', async () => {
    // Dado: só o Caio ainda pode entrar
    render(<Formulario inicio={['u-ana']} fora={['u-bruno']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar participante' }));
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    expect(screen.getByText('Não há mais ninguém na equipe.')).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('group', { name: 'Participantes' })).toHaveFocus());
  });

  it('quando a pessoa digita e tecla Enter, então entra o primeiro achado', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Formulario aoMudar={aoMudar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar participante' }));
    // Quando
    await userEvent.type(screen.getByRole('textbox'), 'ana{Enter}');
    // Então
    expect(aoMudar).toHaveBeenLastCalledWith(['u-ana']);
  });

  it('quando a pessoa tecla Esc na busca, então ela fecha sem escolher ninguém e o Esc não chega ao cartão em volta', async () => {
    // Dado
    const aoMudar = vi.fn(), noCartao = vi.fn();
    render(<div onKeyDown={e => { if (e.key === 'Escape') noCartao(); }}><Formulario aoMudar={aoMudar} /></div>);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar participante' }));
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(aoMudar).not.toHaveBeenCalled();
    expect(noCartao).not.toHaveBeenCalled();
  });

  it('quando a pessoa tira alguém, então ele sai da lista e volta a aparecer na busca', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<Formulario inicio={['u-ana', 'u-bruno']} aoMudar={aoMudar} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar Ana Teste Lima' }));
    // Então
    expect(aoMudar).toHaveBeenLastCalledWith(['u-bruno']);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar participante' }));
    expect(screen.getByRole('list', { name: 'Equipe' })).toHaveTextContent('Ana Teste Lima');
  });

  it('quando a pessoa sai da busca com Tab, então ela fecha e não fica por cima do campo seguinte', async () => {
    // Dado
    render(<><Formulario /><input aria-label='Campo seguinte' /></>);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar participante' }));
    // Quando: Tab pelos três achados e para o campo seguinte
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    // Então
    expect(screen.getByRole('textbox', { name: 'Campo seguinte' })).toHaveFocus();
    expect(screen.queryByRole('list', { name: 'Equipe' })).not.toBeInTheDocument();
  });

  it('quando a pessoa tecla Enter na busca, então o Enter não chega ao formulário em volta', async () => {
    // Dado
    const noFormulario = vi.fn();
    render(<div onKeyDown={e => { if (e.key === 'Enter') noFormulario(); }}><Formulario /></div>);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar participante' }));
    // Quando: ninguém combina com o que foi digitado
    await userEvent.type(screen.getByRole('textbox'), 'xyz{Enter}');
    // Então
    expect(noFormulario).not.toHaveBeenCalled();
    expect(screen.getByText('Ninguém da equipe com esse nome.')).toBeInTheDocument();
  });

  it('quando a pessoa usa as setas, então anda pela lista de achados e volta ao campo', async () => {
    // Dado
    render(<Formulario />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar participante' }));
    // Quando
    await userEvent.keyboard('{ArrowDown}');
    // Então
    expect(screen.getByRole('button', { name: 'Ana Teste Lima' })).toHaveFocus();
    // Quando
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Bruno Exemplo Souza' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    // Então
    expect(screen.getByRole('textbox')).toHaveFocus();
  });
});
