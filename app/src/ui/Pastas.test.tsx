// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As pastas dos documentos na tela (#342): a árvore, o caminho acima do título e a escolha da pasta.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Pasta } from '../dados';
import { Avisos } from './avisos';
import { Janelas } from './janela';
import { ArvoreDePastas, CaminhoDaPasta, SeletorDePasta } from './Pastas';
import { iniciarPreferencias } from './preferencias';

vi.mock('./sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-bruno' }, ehAdmin: false }) }));

const pasta = (id: string, nome: string, pasta_mae_id: string | null = null): Pasta => ({ id, nome, pasta_mae_id, criada_por: 'u-ana', criada_em: '' });
const ESCRITORIO = pasta('esc', 'Escritório'), POPS = pasta('pops', 'POPs', 'esc'), FINANCEIRO = pasta('fin', 'Financeiro', 'pops');
const PASTAS = [ESCRITORIO, POPS, FINANCEIRO];
const arvore = () => within(screen.getByRole('navigation', { name: 'Pastas' }));

describe('A árvore das pastas', () => {
  beforeEach(() => {
    iniciarPreferencias({});
    vi.spyOn(SD, 'salvarPreferencia').mockResolvedValue();
    vi.spyOn(SD, 'pastasListar').mockResolvedValue(PASTAS);
  });

  it('dadas uma pasta e as subpastas, quando a pessoa abre e fecha a de cima, então as de dentro aparecem e somem', async () => {
    // Dado
    render(<ArvoreDePastas pastas={PASTAS} escolhida={null} aoEscolher={() => undefined} />);
    expect(arvore().queryByRole('button', { name: 'POPs' })).toBeNull();
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'Subpastas de Escritório' }));
    // Então
    expect(arvore().getByRole('button', { name: 'Subpastas de Escritório' })).toHaveAttribute('aria-expanded', 'true');
    expect(arvore().getByRole('button', { name: 'POPs' })).toBeTruthy();
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'Subpastas de Escritório' }));
    // Então
    expect(arvore().queryByRole('button', { name: 'POPs' })).toBeNull();
  });

  it('dada uma subpasta escolhida, quando a árvore aparece, então as pastas acima dela já vêm abertas e ela fica marcada', () => {
    // Quando
    render(<ArvoreDePastas pastas={PASTAS} escolhida="fin" aoEscolher={() => undefined} />);
    // Então
    expect(arvore().getByRole('button', { name: 'Financeiro' })).toHaveAttribute('aria-current', 'true');
    expect(arvore().getByRole('button', { name: 'Todos os documentos' })).not.toHaveAttribute('aria-current');
  });

  it('dada uma subpasta escolhida, quando a pessoa fecha a pasta acima dela, então ela fecha mesmo assim', async () => {
    // Dado
    render(<ArvoreDePastas pastas={PASTAS} escolhida="pops" aoEscolher={() => undefined} />);
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'Subpastas de Escritório' }));
    // Então
    expect(arvore().getByRole('button', { name: 'Subpastas de Escritório' })).toHaveAttribute('aria-expanded', 'false');
    expect(arvore().queryByRole('button', { name: 'POPs' })).toBeNull();
  });

  it('quando a pessoa clica numa pasta ou em "Todos os documentos", então quem chama recebe a escolha', async () => {
    // Dado
    const aoEscolher = vi.fn();
    render(<ArvoreDePastas pastas={PASTAS} escolhida="esc" aoEscolher={aoEscolher} />);
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'Escritório' }));
    await userEvent.click(arvore().getByRole('button', { name: 'Todos os documentos' }));
    // Então
    expect(aoEscolher.mock.calls).toEqual([['esc'], [null]]);
  });

  it('quando a pessoa cria uma subpasta pelo ⋯ da pasta, então ela é criada dentro dela e passa a ser a escolhida', async () => {
    // Dado
    const nova = pasta('nova', 'Atas', 'esc');
    const criar = vi.spyOn(SD, 'pastaCriar').mockResolvedValue(nova);
    const aoEscolher = vi.fn();
    render(<><ArvoreDePastas pastas={PASTAS} escolhida={null} aoEscolher={aoEscolher} /><Janelas /><Avisos /></>);
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'Ações da pasta Escritório' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Nova subpasta' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nova subpasta' }), 'Atas');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(criar).toHaveBeenCalledWith('Atas', 'esc');
    expect(await screen.findByText('Pasta "Atas" criada.')).toBeTruthy();
    expect(aoEscolher).toHaveBeenCalledWith('nova');
  });

  it('quando o nome repete o de uma irmã, então o SEMPER avisa e não cria', async () => {
    // Dado
    const criar = vi.spyOn(SD, 'pastaCriar');
    render(<><ArvoreDePastas pastas={PASTAS} escolhida={null} aoEscolher={() => undefined} /><Janelas /><Avisos /></>);
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'Nova pasta' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nova pasta' }), 'escritorio');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(await screen.findByText('Já existe uma pasta com esse nome aqui.')).toBeTruthy();
    expect(criar).not.toHaveBeenCalled();
  });

  it('dada uma pasta com conteúdo, quando a pessoa tenta apagá-la, então o aviso pede para esvaziá-la', async () => {
    // Dado
    vi.spyOn(SD, 'pastaExcluir').mockRejectedValue(new Error('Esvazie a pasta antes de apagá-la: tire dela as anotações e as subpastas.'));
    render(<><ArvoreDePastas pastas={PASTAS} escolhida={null} aoEscolher={() => undefined} /><Janelas /><Avisos /></>);
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'Ações da pasta Escritório' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Apagar' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Apagar a pasta' })).getByRole('button', { name: 'Apagar' }));
    // Então
    expect(await screen.findByText(/Esvazie a pasta antes de apagá-la/)).toBeTruthy();
  });

  it('dado o seletor da tela estreita, quando a pessoa escolhe uma pasta, então o caminho dela aparece como opção e a escolha chega', async () => {
    // Dado
    const aoEscolher = vi.fn();
    render(<SeletorDePasta pastas={PASTAS} escolhida={null} aoEscolher={aoEscolher} />);
    // Quando
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Pasta' }), 'Escritório › POPs › Financeiro');
    // Então
    expect(aoEscolher).toHaveBeenCalledWith('fin');
  });
});

describe('O caminho da pasta acima do título', () => {
  it('dada uma anotação numa subpasta, quando o caminho aparece com links, então cada pedaço leva à página Documentos naquela pasta', () => {
    // Quando
    render(<MemoryRouter><CaminhoDaPasta pastas={PASTAS} pastaId="fin" comLinks /></MemoryRouter>);
    // Então
    const caminho = within(screen.getByRole('navigation', { name: 'Pasta' }));
    expect(caminho.getAllByRole('link').map(l => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Escritório', '/documentos/?pasta=esc'], ['POPs', '/documentos/?pasta=pops'], ['Financeiro', '/documentos/?pasta=fin']
    ]);
    expect(screen.queryByRole('button', { name: 'Escolher a pasta' })).toBeNull();
  });

  it('dada uma anotação fora das pastas, quando quem só lê a vê, então não aparece caminho; quem pode mudar vê "Sem pasta"', () => {
    // Quando
    const { container, rerender } = render(<CaminhoDaPasta pastas={PASTAS} pastaId={null} />);
    // Então
    expect(container.textContent).toBe('');
    // Quando
    rerender(<CaminhoDaPasta pastas={PASTAS} pastaId={null} aoMudar={() => undefined} />);
    // Então
    expect(screen.getByRole('button', { name: 'Escolher a pasta' })).toHaveTextContent('Sem pasta');
  });

  it('dada uma anotação numa pasta, quando as pastas ainda estão chegando, então mostra que carrega, e não "Sem pasta"', () => {
    // Quando
    render(<CaminhoDaPasta pastas={null} pastaId="fin" aoMudar={() => undefined} />);
    // Então
    expect(screen.getByRole('status')).toHaveTextContent('Carregando a pasta…');
    expect(screen.queryByText('Sem pasta')).toBeNull();
  });

  it('quando quem pode mudar escolhe outra pasta, então quem chama recebe a escolhida; sem links, os pedaços são só texto', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<CaminhoDaPasta pastas={PASTAS} pastaId="pops" aoMudar={aoMudar} />);
    expect(screen.queryByRole('link')).toBeNull();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Escolher a pasta' }));
    // Então
    expect(screen.getByRole('menuitemradio', { name: 'Escritório › POPs' })).toHaveAttribute('aria-checked', 'true');
    // Quando
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Escritório › POPs › Financeiro' }));
    // Então
    expect(aoMudar).toHaveBeenCalledWith('fin');
  });
});
