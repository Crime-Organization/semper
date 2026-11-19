// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// As janelas abertas são do sistema todo: cada caso recarrega o módulo para começar sem nenhuma.
let janela: typeof import('./janela');
beforeEach(async () => { vi.resetModules(); janela = await import('./janela'); render(<janela.Janelas />); });

describe('Janela de confirmação', () => {
  const abrir = () => { let r!: Promise<boolean | null>; act(() => { r = janela.confirmar('Excluir pessoa', 'Isso não pode ser desfeito.', 'Excluir', true); }); return r; };

  it('quando abre, então mostra o título, o texto e as duas escolhas', () => {
    // Quando
    void abrir();
    // Então
    expect(screen.getByRole('dialog', { name: 'Excluir pessoa' })).toHaveTextContent('Isso não pode ser desfeito.');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
  });

  it('quando a pessoa confirma, então a resposta é sim e a janela fecha', async () => {
    // Dado
    const resposta = abrir();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    // Então
    await expect(resposta).resolves.toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('quando a pessoa cancela, então a resposta é não', async () => {
    // Dado
    const resposta = abrir();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Então
    await expect(resposta).resolves.toBe(false);
  });

  it('quando a pessoa aperta Esc, então a janela fecha sem resposta', async () => {
    // Dado
    const resposta = abrir();
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    await expect(resposta).resolves.toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Pedir um texto', () => {
  const abrir = () => { let r!: Promise<string | null>; act(() => { r = janela.pedirTexto('Nome da coluna', 'Orçamento', { maximo: 10 }); }); return r; };

  it('quando abre, então o campo já vem com o valor atual', () => {
    // Quando
    void abrir();
    // Então
    expect(screen.getByRole('textbox', { name: 'Nome da coluna' })).toHaveValue('Orçamento');
  });

  it('quando se digita além do limite, então o campo para no limite', async () => {
    // Dado
    void abrir();
    const campo = screen.getByRole('textbox', { name: 'Nome da coluna' });
    await userEvent.clear(campo);
    // Quando
    await userEvent.type(campo, 'Orçamento enviado');
    // Então
    expect(campo).toHaveValue('Orçamento ');
  });

  it('quando a pessoa salva, então devolve o texto digitado sem espaços nas pontas', async () => {
    // Dado
    const resposta = abrir();
    const campo = screen.getByRole('textbox', { name: 'Nome da coluna' });
    await userEvent.clear(campo);
    await userEvent.type(campo, '  Contrato ');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    await expect(resposta).resolves.toBe('Contrato');
  });

  it('quando a pessoa aperta Enter no campo, então salva', async () => {
    // Dado
    const resposta = abrir();
    // Quando
    await userEvent.type(screen.getByRole('textbox', { name: 'Nome da coluna' }), '{Enter}');
    // Então
    await expect(resposta).resolves.toBe('Orçamento');
  });

  it('quando a pessoa cancela, então não devolve texto', async () => {
    // Dado
    const resposta = abrir();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Então
    await expect(resposta).resolves.toBeNull();
  });
});

describe('Janela com campos', () => {
  it('quando a pessoa preenche os campos e confirma, então quem abriu recebe os valores pelo nome de cada campo', async () => {
    // Dado
    let resposta!: Promise<{ nome: string; cor: string } | null>;
    act(() => {
      resposta = janela.janela({
        titulo: 'Nova etiqueta',
        corpo: <><label>Nome<input name="nome" /></label>
          <label><input type="radio" name="cor" value="verde" />Verde</label><label><input type="radio" name="cor" value="azul" />Azul</label></>,
        acoes: [{ rotulo: 'Cancelar', valor: null },
          { rotulo: 'Criar', tipo: 'pri', valor: campos => ({ nome: String(campos.get('nome')), cor: String(campos.get('cor')) }) }]
      });
    });
    await userEvent.type(screen.getByRole('textbox', { name: 'Nome' }), 'Urgente');
    await userEvent.click(screen.getByRole('radio', { name: 'Azul' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
    // Então
    await expect(resposta).resolves.toEqual({ nome: 'Urgente', cor: 'azul' });
  });
});

describe('Janela larga', () => {
  it('quando abre um texto para ler com "larga", então a janela ganha a medida larga (só o corpo rola) e o Fechar vem com o foco', () => {
    // Quando
    act(() => { void janela.janela({ titulo: 'Novidades', corpo: <p>O que mudou.</p>, larga: true }); });
    // Então
    const aberta = screen.getByRole('dialog', { name: 'Novidades' });
    expect(aberta).toHaveClass('janela', 'larga');
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
  });

  it('quando abre sem "larga", então fica na medida de sempre', () => {
    // Quando
    act(() => { void janela.confirmar('Excluir', 'Certeza?'); });
    // Então
    expect(screen.getByRole('dialog', { name: 'Excluir' })).not.toHaveClass('larga');
  });
});

describe('Pedir uma data (#357)', () => {
  const abrir = (valor = '10/11/2030') => { let r!: Promise<string | null>; act(() => { r = janela.pedirData('Data de entrega', valor); }); return r; };

  it('quando abre, então o campo de data já vem com a data atual e o foco', () => {
    // Quando
    void abrir();
    // Então
    const campo = screen.getByRole('textbox', { name: 'Data de entrega' });
    expect(campo).toHaveValue('10/11/2030');
    expect(campo).toHaveFocus();
  });

  it('quando a pessoa escolhe um dia no calendário e salva, então devolve a data escolhida', async () => {
    // Dado
    const resposta = abrir();
    await userEvent.click(screen.getByRole('textbox', { name: 'Data de entrega' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /^sexta-feira, 15 de novembro de 2030/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    await expect(resposta).resolves.toBe('15/11/2030');
  });

  it('quando a pessoa apaga a data e salva, então devolve vazio (para tirar a data)', async () => {
    // Dado
    const resposta = abrir();
    // Quando
    await userEvent.clear(screen.getByRole('textbox', { name: 'Data de entrega' }));
    await userEvent.keyboard('{Enter}');
    // Então
    await expect(resposta).resolves.toBe('');
  });
});

describe('Escolher numa lista (#309)', () => {
  const opcoes = [{ valor: '', nome: 'Fora dos grupos' }, { valor: 'g1', nome: '1. Documentos pessoais' }, { valor: 'g3', nome: '2.1 Aposentadoria por idade' }];
  const abrir = () => {
    let r!: Promise<string | null>;
    act(() => { r = janela.escolherNaJanela({ titulo: 'Mover "RG" para o grupo', rotulo: 'Grupo', opcoes, atual: 'g1' }); });
    return r;
  };

  it('quando abre, então mostra as opções com a atual marcada', () => {
    // Quando
    void abrir();
    // Então
    const campo = screen.getByRole('combobox', { name: 'Grupo' });
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Fora dos grupos', '1. Documentos pessoais', '2.1 Aposentadoria por idade']);
    expect(campo).toHaveValue('g1');
  });

  it('quando a pessoa escolhe outra e confirma, então devolve o valor dela', async () => {
    // Dado
    const resposta = abrir();
    // Quando
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Grupo' }), '2.1 Aposentadoria por idade');
    await userEvent.click(screen.getByRole('button', { name: 'Mover' }));
    // Então
    await expect(resposta).resolves.toBe('g3');
  });

  it('quando a pessoa cancela, então a resposta é nula', async () => {
    // Dado
    const resposta = abrir();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Então
    await expect(resposta).resolves.toBeNull();
  });
});
