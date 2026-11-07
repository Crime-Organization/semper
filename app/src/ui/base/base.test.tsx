// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As peças precisam gerar as mesmas classes que as telas usam hoje: é isso que garante que trocar a marcação
// de uma tela por elas não muda a aparência.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Botao, BotaoDuplo } from '../Botoes';
import { Indicador, Indicadores, NavegacaoEmAbas, Segmentos, Abas, Aviso, BotaoLink, Campo, Carregando, Cartao, Dica, Escolhas, estiloBotao, FaixaDoBanco, idDaAba, Nota, Progresso, propsDoCampo, Selo, TituloSecao, Vazio } from '.';

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

describe('Abas', () => {
  const ABAS = [{ id: 'a', rotulo: 'Novos', contador: 120 }, { id: 'b', rotulo: 'Completar', contador: 1500 }, { id: 'c', rotulo: 'Com erro' }] as const;
  type Id = (typeof ABAS)[number]['id'];
  /** As abas como uma tela as usa: guarda a escolhida e avisa o teste a cada troca. */
  function abrir(inicial: Id = 'a') {
    const aoTrocar = vi.fn<(id: Id) => void>();
    function Tela() {
      const [atual, setAtual] = useState<Id>(inicial);
      return <Abas rotulo="Conferência" abas={ABAS} atual={atual} aoTrocar={id => { aoTrocar(id); setAtual(id); }} />;
    }
    render(<Tela />);
    return aoTrocar;
  }

  it('quando abre, então as abas ficam num grupo com nome, com o contador no nome de cada uma, e só a escolhida no Tab', () => {
    // Quando
    abrir();
    // Então
    expect(screen.getByRole('tablist', { name: 'Conferência' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Novos 120' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Completar 1.500' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Com erro' })).toHaveAttribute('aria-selected', 'false');
  });

  it('dadas 3 abas, quando clica na 2ª, então a tela é avisada e ela fica escolhida', async () => {
    // Dado
    const aoTrocar = abrir();
    // Quando
    await userEvent.click(screen.getByRole('tab', { name: /Completar/ }));
    // Então
    expect(aoTrocar).toHaveBeenCalledWith('b');
    expect(screen.getByRole('tab', { name: /Completar/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Novos/ })).toHaveAttribute('aria-selected', 'false');
  });

  it.each([
    ['a', '{ArrowRight}', 'b'],
    ['c', '{ArrowRight}', 'a'],
    ['a', '{ArrowLeft}', 'c'],
    ['b', '{Home}', 'a'],
    ['a', '{End}', 'c']
  ] as const)('dada a aba "%s", quando aperta %s, então passa para a aba "%s" e o foco vai junto', async (inicial, teclas, esperada) => {
    // Dado
    const aoTrocar = abrir(inicial);
    screen.getByRole('tab', { selected: true }).focus();
    // Quando
    await userEvent.keyboard(teclas);
    // Então
    expect(aoTrocar).toHaveBeenCalledWith(esperada);
    expect(screen.getByRole('tab', { selected: true })).toHaveFocus();
  });

  it('quando aperta outra tecla, então a aba não muda', async () => {
    // Dado
    const aoTrocar = abrir();
    screen.getByRole('tab', { selected: true }).focus();
    // Quando
    await userEvent.keyboard('{ArrowDown}');
    // Então
    expect(aoTrocar).not.toHaveBeenCalled();
  });

  it('dado o painel das abas, quando troca de aba, então as abas apontam para o painel e o painel leva o nome da escolhida', async () => {
    // Dado
    function Tela() {
      const [atual, setAtual] = useState<Id>('a');
      return <>
        <Abas rotulo="Conferência" abas={ABAS} atual={atual} aoTrocar={setAtual} painel="painel-teste" />
        <div role="tabpanel" id="painel-teste" aria-labelledby={idDaAba('painel-teste', atual)} tabIndex={0}>Conteúdo</div>
      </>;
    }
    render(<Tela />);
    // Quando
    await userEvent.click(screen.getByRole('tab', { name: /Completar/ }));
    // Então
    expect(screen.getAllByRole('tab').map(a => a.getAttribute('aria-controls'))).toEqual(['painel-teste', 'painel-teste', 'painel-teste']);
    expect(screen.getByRole('tabpanel', { name: 'Completar 1.500' })).toHaveTextContent('Conteúdo');
  });
});

describe('Barra de progresso', () => {
  it('dado 40 de 200, então o leitor de tela ouve 20% e a conta', () => {
    // Quando
    render(<Progresso rotulo="Gravando a importação" valor={40} maximo={200} />);
    // Então
    const barra = screen.getByRole('progressbar', { name: 'Gravando a importação' });
    expect(barra).toHaveAttribute('aria-valuenow', '20');
    expect(barra).toHaveAttribute('aria-valuemin', '0');
    expect(barra).toHaveAttribute('aria-valuemax', '100');
    expect(barra).toHaveAttribute('aria-valuetext', '40 de 200');
  });

  it.each([
    [0, 0, '0'],
    [5, 0, '0'],
    [300, 200, '100'],
    [1, 3, '33']
  ])('dado %d de %d, então o percentual é %s (sem dividir por zero nem passar de 100)', (valor, maximo, esperado) => {
    // Quando
    render(<Progresso rotulo="Andamento" valor={valor} maximo={maximo} />);
    // Então
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', esperado);
  });
});

describe('FaixaDoBanco', () => {
  it('dado o banco local, quando aparece, então avisa que não toca na produção', () => {
    // Quando
    render(<FaixaDoBanco modo="docker" noComputador />);
    // Então
    expect(screen.getByRole('status')).toHaveTextContent('nada aqui toca na produção');
  });

  it('dado o banco de produção no computador, quando aparece, então alerta que grava em dados reais', () => {
    // Quando
    render(<FaixaDoBanco modo="producao" noComputador />);
    // Então
    expect(screen.getByRole('alert')).toHaveTextContent('dados reais');
  });

  it('dado o site publicado, quando abre, então a faixa não aparece', () => {
    // Quando
    const { container } = render(<FaixaDoBanco modo="production" noComputador={false} />);
    // Então
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Indicadores', () => {
  it('quando mostra um indicador, então o número fica ligado ao nome, com o tom e a linha de apoio', () => {
    // Quando
    render(<Indicadores rotulo="Totais do mês"><Indicador rotulo="Entradas" valor="R$ 1.000,00" detalhe="3 lançamentos" tom="entrada" /><Indicador rotulo="Saídas" valor="R$ 0,00" /></Indicadores>);
    // Então
    const grupo = screen.getByRole('group', { name: 'Totais do mês' });
    const entradas = screen.getByRole('region', { name: 'Entradas' });
    expect(grupo).toContainElement(entradas);
    expect(entradas).toHaveClass('indicador', 'entrada');
    expect(entradas).toHaveTextContent('R$ 1.000,00');
    expect(entradas).toHaveTextContent('3 lançamentos');
    expect(screen.getByRole('region', { name: 'Saídas' })).toHaveClass('indicador', 'neutro');
  });
});

describe('Segmentos', () => {
  it('quando clica num segmento, então ele fica escolhido, e o desligado não responde', async () => {
    // Dado
    const aoEscolher = vi.fn<(id: string) => void>();
    function Tela() {
      const [atual, setAtual] = useState('jan');
      return <Segmentos rotulo="Mês" atual={atual} aoEscolher={id => { aoEscolher(id); setAtual(id); }}
        opcoes={[{ id: 'jan', rotulo: 'Jan', marcado: true }, { id: 'fev', rotulo: 'Fev' }, { id: 'mar', rotulo: 'Mar', desligado: true }]} />;
    }
    render(<Tela />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Fev' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mar' }));
    // Então
    expect(aoEscolher.mock.calls).toEqual([['fev']]);
    expect(screen.getByRole('button', { name: 'Fev' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Jan' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('group', { name: 'Mês' })).toBeInTheDocument();
  });
});

describe('Navegação em abas', () => {
  it('quando mostra as abas, então cada uma é um link, e só a da página aberta fica marcada', () => {
    // Quando
    render(<MemoryRouter><NavegacaoEmAbas rotulo="Financeiro" abas={[{ para: '/a/', rotulo: 'Painel', atual: true }, { para: '/b/', rotulo: 'Lançar', atual: false }]} /></MemoryRouter>);
    // Então
    const nav = screen.getByRole('navigation', { name: 'Financeiro' });
    expect(nav).toContainElement(screen.getByRole('link', { name: 'Painel' }));
    expect(screen.getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Lançar' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Lançar' })).toHaveAttribute('href', '/b/');
  });
});

describe('Grupo de indicadores com nome', () => {
  it('dado um título, quando aparece, então o nome fica em cima e o grupo continua com o rótulo para o leitor de tela', () => {
    // Quando
    render(<Indicadores rotulo="Desempenho de Nov/2026" titulo="Desempenho"><Indicador rotulo="Receita bruta" valor="R$ 10,00" /></Indicadores>);
    // Então
    expect(screen.getByRole('group', { name: 'Desempenho de Nov/2026' })).toHaveTextContent('Receita bruta');
    expect(screen.getByText('Desempenho')).toBeInTheDocument();
  });
});
