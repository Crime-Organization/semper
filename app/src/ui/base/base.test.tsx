// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As peças precisam gerar as mesmas classes que as telas usam hoje: é isso que garante que trocar a marcação
// de uma tela por elas não muda a aparência.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Botao, BotaoDuplo } from '../Botoes';
import { Aviso, BotaoLink, Campo, Carregando, Cartao, Dica, Escolhas, estiloBotao, Nota, propsDoCampo, Selo, TituloSecao, Vazio } from '.';

describe('Estilo dos botões', () => {
  it.each([
    [{}, 'btn'],
    [{ variante: 'principal' }, 'btn pri'],
    [{ variante: 'principal', pequeno: true }, 'btn pri btn-sm'],
    [{ variante: 'escuro' }, 'btn esc'],
    [{ variante: 'perigo', pequeno: true }, 'btn perigo btn-sm'],
    [{ forma: 'mini' }, 'mini'],
    [{ forma: 'mini', variante: 'perigo' }, 'mini perigo'],
    [{ forma: 'mini', pequeno: true }, 'mini'],
    [{ forma: 'link' }, 'link']
  ] as const)('quando o estilo é %j, então as classes são "%s"', (estilo, classes) => {
    // Quando
    const resultado = estiloBotao(estilo);
    // Então
    expect(resultado).toBe(classes);
  });

  it('quando a tela acrescenta uma classe própria, então ela vem depois das do estilo', () => {
    // Quando
    const resultado = estiloBotao({ pequeno: true }, 'acao-copiar');
    // Então
    expect(resultado).toBe('btn btn-sm acao-copiar');
  });
});

describe('Botões com estilo', () => {
  it('quando o Botao recebe uma variante, então usa as classes do estilo e as próprias da tela', () => {
    // Quando
    render(<Botao variante="escuro" className="extra">Buscar</Botao>);
    // Então
    expect(screen.getByRole('button', { name: 'Buscar' })).toHaveAttribute('class', 'btn esc extra');
  });

  it('quando o Botao não recebe estilo, então vale só o className, como nas telas de hoje', () => {
    // Quando
    render(<Botao className="btn esc">Buscar</Botao>);
    // Então
    expect(screen.getByRole('button', { name: 'Buscar' })).toHaveAttribute('class', 'btn esc');
  });

  it('quando o BotaoDuplo pede confirmação, então mantém o estilo e acrescenta "confirmar"', async () => {
    // Dado
    render(<BotaoDuplo forma="mini" variante="perigo" confirmar="Confirmar" aoConfirmar={() => {}}>Cancelar</BotaoDuplo>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Então
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveAttribute('class', 'mini perigo confirmar');
  });

  it('quando o BotaoLink é usado, então é um link com cara de botão', () => {
    // Quando
    render(<MemoryRouter><BotaoLink to="/pessoas/nova/" variante="principal">Nova pessoa</BotaoLink></MemoryRouter>);
    // Então
    const link = screen.getByRole('link', { name: 'Nova pessoa' });
    expect(link).toHaveAttribute('class', 'btn pri');
    expect(link).toHaveAttribute('href', '/pessoas/nova/');
  });
});

describe('Campo de formulário', () => {
  it('quando o campo é obrigatório e tem dica, então o rótulo leva * e o campo é descrito pela dica', () => {
    // Quando
    render(<Campo rotulo="Nome" para="nome" obrigatorio dica="Nome completo, em letras maiúsculas.">
      <input {...propsDoCampo('nome', { dica: true })} />
    </Campo>);
    // Então
    const campo = screen.getByRole('textbox', { name: 'Nome*' });
    expect(campo).toHaveAccessibleDescription('Nome completo, em letras maiúsculas.');
    expect(campo).not.toHaveAttribute('aria-invalid');
    expect(campo.closest('.pergunta')).not.toHaveClass('erro');
  });

  it('quando há erro, então o campo fica marcado, a mensagem aparece e o leitor de tela a ouve', () => {
    // Quando
    render(<Campo rotulo="CPF" para="cpf" erro="CPF inválido: confira os números.">
      <input {...propsDoCampo('cpf', { erro: true })} />
    </Campo>);
    // Então
    const campo = screen.getByRole('textbox', { name: 'CPF' });
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('CPF inválido: confira os números.');
    expect(campo.closest('.pergunta')).toHaveClass('erro');
    expect(screen.getByRole('alert')).toHaveTextContent('CPF inválido: confira os números.');
  });

  it('quando o grupo de opções é usado, então as opções ficam agrupadas sob o rótulo', () => {
    // Quando
    render(<Escolhas rotulo="Gênero" obrigatorio>
      <label><input type="radio" name="g" value="f" />Feminino</label><label><input type="radio" name="g" value="m" />Masculino</label>
    </Escolhas>);
    // Então
    const grupo = screen.getByRole('group', { name: 'Gênero*' });
    expect(grupo.querySelectorAll('.escolhas input[type="radio"]')).toHaveLength(2);
  });
});

describe('Campo e grupo de opções: acréscimos do cadastro', () => {
  it('quando o campo tem erro e um resultado de busca, então o resultado vem depois da mensagem de erro', () => {
    // Quando
    const { container } = render(<Campo rotulo="CEP" para="cep" erro="O CEP tem 8 dígitos." depois={<Aviso tipo="ok">Endereço preenchido.</Aviso>}>
      <input {...propsDoCampo('cep', { erro: true })} />
    </Campo>);
    // Então
    const filhos = [...container.firstElementChild!.children].map(e => e.className || e.tagName.toLowerCase());
    expect(filhos).toEqual(['label', 'input', 'msg-erro', 'aviso ok']);
  });

  it('quando o grupo tem dica e arranjo, então a dica vem antes das opções e o arranjo entra na classe delas', () => {
    // Quando
    const { container } = render(<Escolhas rotulo="Porte" dica="No MEI, não é preciso marcar." arranjo="coluna-unica">
      <label><input type="radio" name="porte" value="me" />Microempresa</label>
    </Escolhas>);
    // Então
    const grupo = container.firstElementChild!;
    expect([...grupo.children].map(e => e.className)).toEqual(['rot', 'dica', 'escolhas coluna-unica']);
  });
});

describe('Peças de texto e de estado', () => {
  it.each([
    ['Aviso de erro', () => <Aviso tipo="erro">Falhou</Aviso>, 'aviso erro', 'alert'],
    ['Aviso de sucesso', () => <Aviso tipo="ok">Salvo</Aviso>, 'aviso ok', 'status'],
    ['Carregando', () => <Carregando />, 'carregando', 'status']
  ])('quando a peça é %s, então tem as classes e o papel certos', (_peca, criar, classes, papel) => {
    // Quando
    render(criar());
    // Então
    expect(screen.getByRole(papel)).toHaveAttribute('class', classes);
  });

  it.each([
    ['Selo', () => <Selo tipo="pend">Pendente</Selo>, 'selo pend'],
    ['Selo sem tipo', () => <Selo>Novo</Selo>, 'selo'],
    ['Cartão', () => <Cartao>Conteúdo</Cartao>, 'cartao'],
    ['Cartão com classe da tela', () => <Cartao className="campos">Conteúdo</Cartao>, 'cartao campos'],
    ['Nota', () => <Nota>Conteúdo</Nota>, 'nota'],
    ['Dica', () => <Dica>Conteúdo</Dica>, 'dica'],
    ['Vazio', () => <Vazio>Conteúdo</Vazio>, 'vazio']
  ])('quando a peça é %s, então gera as classes "%s"', (_peca, criar, classes) => {
    // Quando
    const { container } = render(criar());
    // Então
    expect(container.firstElementChild).toHaveAttribute('class', classes);
  });

  it('quando o título de seção é usado, então é um h2 com a classe "secao"', () => {
    // Quando
    render(<TituloSecao>Usuários</TituloSecao>);
    // Então
    expect(screen.getByRole('heading', { level: 2, name: 'Usuários' })).toHaveAttribute('class', 'secao');
  });

  it('quando Carregando não recebe texto, então mostra "Carregando…"', () => {
    // Quando
    render(<Carregando />);
    // Então
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…');
  });
});
