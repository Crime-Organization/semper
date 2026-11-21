// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As peças precisam gerar as mesmas classes que as telas usam hoje: é isso que garante que trocar a marcação
// de uma tela por elas não muda a aparência.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Botao, BotaoDuplo } from '../Botoes';
import { Contador, Indicador, Indicadores, ListaDeNumeros, NavegacaoEmAbas, Segmentos, Abas, Aviso, BotaoLink, Campo, CampoDeVarios, Carregando, Cartao, Codigo, Dica, Escolhas, estiloBotao, FaixaDoBanco, idDaAba, idsDoCampoDeVarios, Nota, Progresso, propsDoCampo, SecaoDoFormulario, Selo, TituloSecao, useFocoNoGrupo, Vazio } from '.';

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

describe('Seções do formulário (#359)', () => {
  it('quando a seção está no cadastro, então o título é um h2 que dá nome a uma região com os campos dentro, depois da frase que a explica', () => {
    // Quando
    render(<SecaoDoFormulario titulo="Pessoas" texto="Quem responde pela demanda.">
      <Campo rotulo="Responsável" para="resp"><select {...propsDoCampo('resp')}><option>Ana</option></select></Campo>
      <CampoDeVarios rotulo="Clientes"><input aria-label="Cliente" /></CampoDeVarios>
    </SecaoDoFormulario>);
    // Então
    const secao = screen.getByRole('region', { name: 'Pessoas' });
    expect(within(secao).getByRole('heading', { level: 2, name: 'Pessoas' })).toBeInTheDocument();
    expect(secao).toHaveTextContent('Quem responde pela demanda.');
    expect(within(secao).getByRole('combobox', { name: 'Responsável' })).toBeInTheDocument();
    expect(within(secao).getByRole('group', { name: 'Clientes' })).toBeInTheDocument();
    // Os campos ficam juntos, num bloco à parte do título (o que o estilo recua sob ele).
    const [cabeca, campos] = [...secao.children];
    expect(cabeca.tagName).toBe('HEADER');
    expect(campos).toHaveClass('etapa-campos');
    expect(campos).toContainElement(screen.getByRole('combobox', { name: 'Responsável' }));
  });

  it('quando a seção está no lápis do cartão, então o título é um h3, abaixo do título do cartão', () => {
    // Quando
    render(<SecaoDoFormulario titulo="Pessoas" nivel={3}><Campo rotulo="Responsável" para="resp"><input {...propsDoCampo('resp')} /></Campo></SecaoDoFormulario>);
    // Então
    const secao = screen.getByRole('region', { name: 'Pessoas' });
    expect(within(secao).getByRole('heading', { level: 3, name: 'Pessoas' })).toBeInTheDocument();
    expect(within(secao).queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });

  it('quando o campo aceita vários itens e é obrigatório, então o grupo tem o rótulo no plural, com * só à vista, e as linhas dentro', () => {
    // Quando
    render(<CampoDeVarios rotulo="Clientes" obrigatorio dica="Busque pelo nome.">
      <input aria-label="Cliente 1" /><input aria-label="Cliente 2" />
    </CampoDeVarios>);
    // Então
    const grupo = screen.getByRole('group', { name: 'Clientes' });
    expect(grupo).toHaveTextContent('Clientes*');
    expect(within(grupo).getAllByRole('textbox')).toHaveLength(2);
    expect(within(grupo).getByText('Busque pelo nome.')).toBeInTheDocument();
    expect(within(grupo).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('quando o campo de vários itens tem erro, então ele fica marcado e a mensagem é anunciada', () => {
    // Quando
    render(<CampoDeVarios rotulo="Pessoas ligadas" erro="Escolha a pessoa ou tire a linha."><input aria-label="Pessoa ligada" /></CampoDeVarios>);
    // Então
    const grupo = screen.getByRole('group', { name: 'Pessoas ligadas' });
    expect(grupo).toHaveClass('pergunta', 'erro');
    expect(within(grupo).getByRole('alert')).toHaveTextContent('Escolha a pessoa ou tire a linha.');
  });

  it('dado um id para o campo de vários itens, quando as linhas apontam para a dica e o erro, então o leitor de tela lê os dois em cada linha', () => {
    // Dado
    const ids = idsDoCampoDeVarios('objetos');
    // Quando
    render(<CampoDeVarios rotulo="Objetos do contrato" id="objetos" dica="Um por linha." erro="Informe pelo menos um objeto.">
      <ul aria-labelledby={ids.rotulo}><li><input aria-label="Objeto 1" aria-describedby={`${ids.dica} ${ids.erro}`} /></li></ul>
    </CampoDeVarios>);
    // Então
    expect(screen.getByRole('list', { name: 'Objetos do contrato' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Objeto 1' })).toHaveAccessibleDescription('Um por linha. Informe pelo menos um objeto.');
  });

  it('dado o grupo de vários itens com a referência, quando o código pede o foco (ao tirar a última linha), então o grupo o recebe', async () => {
    // Dado
    function Lista() {
      const grupo = useRef<HTMLDivElement>(null);
      return <CampoDeVarios rotulo="Participantes" grupo={grupo}>
        <button type="button" onClick={() => grupo.current?.focus()}>Tirar o último</button>
      </CampoDeVarios>;
    }
    render(<Lista />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar o último' }));
    // Então
    expect(screen.getByRole('group', { name: 'Participantes' })).toHaveFocus();
  });

  it('dada a seção com a referência do título, quando o código pede o foco (a etapa trocou), então o título o recebe e fora disso não entra na ordem do foco', async () => {
    // Dado
    function Etapa() {
      const titulo = useRef<HTMLHeadingElement>(null);
      return <>
        <SecaoDoFormulario titulo="Arquivo" focoNoTitulo={titulo}><button type="button" onClick={() => titulo.current?.focus()}>Seguir</button></SecaoDoFormulario>
        <SecaoDoFormulario titulo="Conferir"><p>Sem foco no título.</p></SecaoDoFormulario>
      </>;
    }
    render(<Etapa />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    // Então
    expect(screen.getByRole('heading', { name: 'Arquivo', level: 2 })).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Conferir', level: 2 })).not.toHaveAttribute('tabindex');
  });

  it('dado um grupo com o useFocoNoGrupo, quando a pessoa tira uma linha pelo botão dela, então o foco vai ao grupo e não se perde', async () => {
    // Dado
    function Lista() {
      const [linhas, setLinhas] = useState(['Telefone 1', 'Telefone 2']);
      const { grupo, focarNoGrupo } = useFocoNoGrupo();
      return <CampoDeVarios rotulo="Telefones" grupo={grupo}>
        {linhas.map((l, i) => <button key={l} type="button" onClick={() => { setLinhas(linhas.toSpliced(i, 1)); focarNoGrupo(); }}>{`Tirar o ${l}`}</button>)}
      </CampoDeVarios>;
    }
    render(<Lista />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar o Telefone 2' }));
    // Então
    expect(screen.queryByRole('button', { name: 'Tirar o Telefone 2' })).not.toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('group', { name: 'Telefones' })).toHaveFocus());
  });

  it('dado o grupo de vários itens sem a referência, quando aparece, então ele não entra na ordem do foco', () => {
    // Quando
    render(<CampoDeVarios rotulo="Clientes"><input aria-label="Cliente" /></CampoDeVarios>);
    // Então
    expect(screen.getByRole('group', { name: 'Clientes' })).not.toHaveAttribute('tabindex');
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
    ['Código', () => <Codigo>CA222B4B</Codigo>, 'codigo'],
    ['Vazio', () => <Vazio>Conteúdo</Vazio>, 'vazio'],
    ['Contador', () => <Contador>12</Contador>, 'recolher-contador num'],
    ['Contador apagado (zero)', () => <Contador apagado>0</Contador>, 'recolher-contador num vazio']
  ])('quando a peça é %s, então gera as classes "%s"', (_peca, criar, classes) => {
    // Quando
    const { container } = render(criar());
    // Então
    expect(container.firstElementChild).toHaveAttribute('class', classes);
  });

  it('dado um código com dica, quando aparece, então mostra o código e leva a dica que explica o que ele é (#84)', () => {
    // Dado / Quando
    render(<Codigo dica="Código da pessoa no SEMPER">CA222B4B</Codigo>);
    // Então
    expect(screen.getByText('CA222B4B')).toHaveAttribute('data-dica', 'Código da pessoa no SEMPER');
    expect(screen.getByText('CA222B4B')).toHaveAttribute('aria-description', 'Código da pessoa no SEMPER');
  });

  it('dado um código com dica, quando a pessoa usa o Tab, então o código recebe o foco, onde a dica aparece (#84)', async () => {
    // Dado
    render(<Codigo dica="Código da pessoa no SEMPER">CA222B4B</Codigo>);
    // Quando
    await userEvent.tab();
    // Então
    expect(screen.getByText('CA222B4B')).toHaveFocus();
  });

  it('dado um código sem dica, quando aparece, então não leva dica', () => {
    // Dado / Quando
    render(<Codigo>CA222B4B</Codigo>);
    // Então
    expect(screen.getByText('CA222B4B')).not.toHaveAttribute('data-dica');
    expect(screen.getByText('CA222B4B')).not.toHaveAttribute('tabindex');
    expect(screen.getByText('CA222B4B')).not.toHaveAttribute('aria-description');
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

describe('Lista de números', () => {
  it('quando mostra as linhas, então cada número vem com o nome, e só as com destino viram link', () => {
    // Quando
    render(<MemoryRouter><ListaDeNumeros rotulo="Demandas por situação" linhas={[
      { chave: 'a', n: 1500, nome: 'Para fazer', para: '/demandas/' }, { chave: 'b', n: 2, nome: 'Fazendo' }
    ]} /></MemoryRouter>);
    // Então
    const lista = screen.getByRole('list', { name: 'Demandas por situação' });
    expect(lista).toContainElement(screen.getByRole('link', { name: '1.500 Para fazer' }));
    expect(screen.getByRole('link', { name: '1.500 Para fazer' })).toHaveAttribute('href', '/demandas/');
    expect(screen.getAllByRole('listitem')[1]).toHaveTextContent('2 Fazendo');
    expect(screen.getAllByRole('link')).toHaveLength(1);
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
