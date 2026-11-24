// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Janelas } from '../janela';
import { DadosEditaveis, FormularioDosDados } from './DadosEditaveis';

afterEach(cleanup);

/**
 * Uma seção de dados num cartão: lida, mostra só os preenchidos; aberta, mostra todos os campos, inclusive os vazios. Salvar grava
 * o que foi mudado e fecha.
 */
function Secao({ pode = true, aoSalvar = vi.fn() }: { pode?: boolean; aoSalvar?: (d: Record<string, string>) => void }) {
  const [gravado, setGravado] = useState<Record<string, string>>({ numero: '123', comarca: '' });
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(gravado);
  const abrir = () => { setRascunho(gravado); setEditando(true); };
  return <>
    <Janelas />
    <DadosEditaveis rotulo="Dados do processo" editando={editando} aoEditar={pode ? abrir : undefined}
      edicao={<FormularioDosDados rotulo="Editar os dados" estado={rascunho} ocupado={false} aoCancelar={() => setEditando(false)}
        aoSalvar={() => { aoSalvar(rascunho); setGravado(rascunho); setEditando(false); }}>
        <label>Número<input value={rascunho.numero} onChange={e => setRascunho(r => ({ ...r, numero: e.target.value }))} /></label>
        <label>Comarca<input value={rascunho.comarca} onChange={e => setRascunho(r => ({ ...r, comarca: e.target.value }))} /></label>
      </FormularioDosDados>}>
      <dl>{Object.entries(gravado).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </DadosEditaveis>
    <Link to="/lista">Ir para a lista</Link>
  </>;
}

function abrirCartao(props: Parameters<typeof Secao>[0] = {}) {
  const roteador = createMemoryRouter([
    { path: '/cartao', element: <Secao {...props} /> },
    { path: '/lista', element: <p>Página da lista</p> }
  ], { initialEntries: ['/cartao'] });
  render(<RouterProvider router={roteador} />);
}
const formulario = () => screen.queryByRole('form', { name: 'Editar os dados' });
const campo = (nome: string) => screen.getByRole('textbox', { name: nome });

describe('Seção de dados que se muda no próprio lugar (#428)', () => {
  it('dado quem pode alterar, quando clica nos dados, então eles viram um formulário ali mesmo, com os campos vazios e Salvar e Cancelar', async () => {
    // Dado
    abrirCartao();
    expect(screen.queryByText('comarca')).not.toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByText('123'));
    // Então
    expect(formulario()).toBeInTheDocument();
    expect(campo('Número')).toHaveValue('123');
    expect(campo('Número')).toHaveFocus();
    expect(campo('Comarca')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('dado quem usa o teclado, quando chega aos dados com o Tab e tecla Enter, então o formulário abre', async () => {
    // Dado
    abrirCartao();
    // Quando
    screen.getByRole('group', { name: 'Dados do processo' }).focus();
    await userEvent.keyboard('{Enter}');
    // Então
    expect(formulario()).toBeInTheDocument();
  });

  it('dado o formulário aberto, quando preenche um campo vazio e salva, então grava e a seção volta a mostrar só os preenchidos', async () => {
    // Dado
    const aoSalvar = vi.fn();
    abrirCartao({ aoSalvar });
    await userEvent.click(screen.getByText('123'));
    // Quando
    await userEvent.type(campo('Comarca'), 'Belo Horizonte');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(aoSalvar).toHaveBeenCalledWith({ numero: '123', comarca: 'Belo Horizonte' });
    expect(formulario()).not.toBeInTheDocument();
    expect(screen.getByText('Belo Horizonte')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Dados do processo' })).toHaveFocus();
  });

  it('dado o formulário aberto, quando tecla Enter num campo, então o cursor passa ao próximo e, no último, salva', async () => {
    // Dado
    const aoSalvar = vi.fn();
    abrirCartao({ aoSalvar });
    await userEvent.click(screen.getByText('123'));
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    expect(campo('Comarca')).toHaveFocus();
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    expect(aoSalvar).toHaveBeenCalled();
  });

  it('dado o formulário sem mudança, quando aperta Esc, então ele fecha e nada muda', async () => {
    // Dado
    const aoSalvar = vi.fn();
    abrirCartao({ aoSalvar });
    await userEvent.click(screen.getByText('123'));
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(formulario()).not.toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('dado o formulário com mudança, quando aperta Esc, então pergunta antes e, descartando, nada muda', async () => {
    // Dado
    const aoSalvar = vi.fn();
    abrirCartao({ aoSalvar });
    await userEvent.click(screen.getByText('123'));
    await userEvent.type(campo('Número'), '4');
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(await screen.findByRole('dialog', { name: 'Descartar as mudanças?' })).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    // Então
    expect(formulario()).not.toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('dado o formulário com mudança, quando clica em Cancelar, então fecha sem gravar', async () => {
    // Dado
    const aoSalvar = vi.fn();
    abrirCartao({ aoSalvar });
    await userEvent.click(screen.getByText('123'));
    await userEvent.type(campo('Número'), '4');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Então
    expect(formulario()).not.toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('dado o formulário com mudança, quando a pessoa tenta sair da tela, então o aviso de sair pergunta antes', async () => {
    // Dado
    abrirCartao();
    await userEvent.click(screen.getByText('123'));
    await userEvent.type(campo('Número'), '4');
    // Quando
    await userEvent.click(screen.getByRole('link', { name: 'Ir para a lista' }));
    // Então
    expect(await screen.findByRole('dialog', { name: 'Sair sem salvar?' })).toBeInTheDocument();
    expect(screen.queryByText('Página da lista')).not.toBeInTheDocument();
  });

  it('dado quem não pode alterar, quando clica nos dados, então nada vira formulário', async () => {
    // Dado
    abrirCartao({ pode: false });
    // Quando
    await userEvent.click(screen.getByText('123'));
    // Então
    expect(formulario()).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Dados do processo' })).not.toBeInTheDocument();
  });
});
