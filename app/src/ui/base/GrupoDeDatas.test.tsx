// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Avisos } from '../avisos';
import { erroDaDataDeInicio } from '../../regras/dataDeInicio';
import { CAMPOS_DO_PRAZO, errosDosCampos } from '../../regras/datasNoCartao';
import { SALVE_OU_CANCELE } from '../../regras/edicaoUnica';
import { TAREFA_VAZIA, validarTarefa } from '../../regras/tarefa';
import { DataEditavel } from './DataEditavel';
import { DadoDoGrupo, DadoEditavel, FaixaDasDatas, GrupoDeDatas, LinhaDoGrupo } from './GrupoDeDatas';
import { PrazoEditavel } from './PrazoEditavel';
import { LembreteDoCartao } from '../useEdicaoUnica';

/** Um dado de texto simples, para ver o formulário pequeno sem o calendário. */
function Apelido({ aoSalvar, aoMudarRascunho }: { aoSalvar?: (v: { apelido: string }) => unknown; aoMudarRascunho?: (r: string | null) => void }) {
  return <DadoEditavel nome="Apelido" titulo="Mudar o apelido" resumo="Zé" lido={<b>Zé</b>} inicial={() => ({ apelido: 'Zé' })}
    conferir={v => v.apelido.trim() ? {} : { apelido: 'Dê um apelido.' }} aoSalvar={aoSalvar} aoMudarRascunho={aoMudarRascunho}
    campos={({ rascunho, mudar, marcar }) => <input aria-label="Apelido" {...marcar('apelido')} value={rascunho.apelido} onChange={e => mudar({ apelido: e.target.value })} />} />;
}

describe('Faixa das datas do cartão (#361, #383)', () => {
  it('dadas as datas, quando a faixa aparece, então cada dado tem o nome e o valor, com o nome antes do valor', () => {
    // Quando
    render(<GrupoDeDatas rotulo="Datas">
      <DadoDoGrupo rotulo="Criada em"><b>18/11/2026</b></DadoDoGrupo>
      <DadoDoGrupo rotulo="Prazo"><b>Sem prazo</b></DadoDoGrupo>
    </GrupoDeDatas>);
    // Então
    const faixa = screen.getByRole('group', { name: 'Datas' });
    expect(within(faixa).getByRole('group', { name: 'Criada em' })).toHaveTextContent('Criada em 18/11/2026');
    expect(within(faixa).getByRole('group', { name: 'Prazo' })).toHaveTextContent('Prazo Sem prazo');
  });

  it('dado um grupo de um dado só, quando aparece, então só ele aparece', () => {
    // Quando
    render(<GrupoDeDatas rotulo="Datas"><DadoDoGrupo rotulo="Criado em">18/11/2026</DadoDoGrupo></GrupoDeDatas>);
    // Então
    expect(screen.getAllByRole('group')).toHaveLength(2);
  });

  it('dado o tempo numa faixa própria, logo abaixo das datas (#383), quando aparece, então o cronômetro e o resumo ficam na faixa do tempo, e nada dele na das datas', () => {
    // Quando
    render(<>
      <GrupoDeDatas rotulo="Datas"><DadoDoGrupo rotulo="Criada em"><b>18/11/2026</b></DadoDoGrupo></GrupoDeDatas>
      <GrupoDeDatas rotulo="Tempo">
        <DadoDoGrupo rotulo="Seu tempo" largo><span role="timer">0:10:00</span><button type="button">Iniciar</button></DadoDoGrupo>
        <LinhaDoGrupo><p>Total da equipe: 1 h</p></LinhaDoGrupo>
      </GrupoDeDatas>
    </>);
    // Então
    const datas = screen.getByRole('group', { name: 'Datas' }), tempo = screen.getByRole('group', { name: 'Tempo' });
    expect(within(datas).queryByRole('timer')).not.toBeInTheDocument();
    const relogio = within(tempo).getByRole('group', { name: 'Seu tempo' });
    expect(within(relogio).getByRole('timer')).toHaveTextContent('0:10:00');
    expect(within(relogio).getByRole('button', { name: 'Iniciar' })).toBeInTheDocument();
    expect(within(tempo).getByText('Total da equipe: 1 h')).toBeInTheDocument();
    // E a faixa do tempo vem depois da das datas
    expect(datas.compareDocumentPosition(tempo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

/** Um instante gravado (o criado_em) e como a faixa o mostra: o dia em Brasília. */
const CRIADO_EM = '2026-11-18T15:00:00Z', CRIADO_EM_NA_TELA = '18/11/2026';

describe('A faixa das datas de um cartão, que some com só a criação (#385)', () => {
  it('dado um cartão só com a criação (a pessoa, o processo, a anotação), quando ele abre, então não há faixa das datas', () => {
    // Quando
    const { container } = render(<FaixaDasDatas criacao={{ rotulo: 'Cadastrada em', em: CRIADO_EM }} />);
    // Então: a criação fica só no rodapé do cartão
    expect(screen.queryByRole('group', { name: 'Datas' })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('dado um contrato visto por quem não vê os valores (a assinatura escondida), quando ele abre, então não há faixa das datas', () => {
    // Dado
    const oculto = true;
    // Quando
    const { container } = render(<FaixaDasDatas criacao={{ rotulo: 'Criado em', em: CRIADO_EM }}>
      {!oculto && <DadoDoGrupo rotulo="Assinado em"><b>10/03/2026</b></DadoDoGrupo>}
    </FaixaDasDatas>);
    // Então
    expect(container).toBeEmptyDOMElement();
  });

  it('dado um cartão com a criação e outras datas, quando ele abre, então a faixa mostra a criação primeiro, no dia de Brasília, e as outras depois', () => {
    // Quando
    render(<FaixaDasDatas criacao={{ rotulo: 'Criada em', em: CRIADO_EM }}>
      <DadoDoGrupo rotulo="Início"><b>19/11/2026</b></DadoDoGrupo>
      <DadoDoGrupo rotulo="Prazo"><b>Sem prazo</b></DadoDoGrupo>
    </FaixaDasDatas>);
    // Então
    const faixa = screen.getByRole('group', { name: 'Datas' });
    const dados = within(faixa).getAllByRole('group');
    expect(dados.map(d => d.textContent)).toEqual([`Criada em ${CRIADO_EM_NA_TELA}`, 'Início 19/11/2026', 'Prazo Sem prazo']);
  });

  it('dado o compromisso, com a criação no fim, quando ele abre, então a data e o horário vêm primeiro e a criação depois', () => {
    // Quando
    render(<FaixaDasDatas criacao={{ rotulo: 'Criado em', em: CRIADO_EM }} criacaoNoFim>
      <DadoDoGrupo rotulo="Data e horário"><b>20/12/2030 às 14:30</b></DadoDoGrupo>
    </FaixaDasDatas>);
    // Então
    const dados = within(screen.getByRole('group', { name: 'Datas' })).getAllByRole('group');
    expect(dados.map(d => d.textContent)).toEqual(['Data e horário 20/12/2030 às 14:30', `Criado em ${CRIADO_EM_NA_TELA}`]);
  });
});

describe('Dado que se muda no próprio lugar (#361)', () => {
  it('dado quem pode alterar, quando clica no valor, muda e aperta Enter, então salva o rascunho', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Apelido aoSalvar={aoSalvar} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Apelido: Zé. Clique para mudar' }));
    const campo = within(screen.getByRole('group', { name: 'Mudar o apelido' })).getByLabelText('Apelido');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Zezinho{Enter}');
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith({ apelido: 'Zezinho' }));
    expect(screen.queryByRole('group', { name: 'Mudar o apelido' })).not.toBeInTheDocument();
  });

  it('quando a pessoa aperta Esc, então desfaz só o dado, e o Esc não chega ao cartão em volta (que fecharia)', async () => {
    // Dado
    const aoSalvar = vi.fn(), cartaoFecha = vi.fn();
    const ouvir = (e: KeyboardEvent) => { if (e.key === 'Escape') cartaoFecha(); };
    document.addEventListener('keydown', ouvir);
    render(<Apelido aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByRole('button', { name: /^Apelido/ }));
    // Quando
    await userEvent.type(screen.getByLabelText('Apelido'), 'zinho{Escape}');
    // Então
    expect(screen.queryByRole('group', { name: 'Mudar o apelido' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Apelido/ })).toHaveFocus();
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(cartaoFecha).not.toHaveBeenCalled();
    document.removeEventListener('keydown', ouvir);
  });

  it('quando a pessoa apaga e salva, então o erro da regra aparece, o campo fica marcado e nada é gravado; Cancelar fecha', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Apelido aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByRole('button', { name: /^Apelido/ }));
    // Quando
    await userEvent.clear(screen.getByLabelText('Apelido'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(screen.getByRole('alert')).toHaveTextContent('Dê um apelido.');
    expect(screen.getByLabelText('Apelido')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Apelido')).toHaveAccessibleDescription('Dê um apelido.');
    expect(aoSalvar).not.toHaveBeenCalled();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Então
    expect(screen.getByRole('button', { name: /^Apelido/ })).toHaveTextContent('Zé');
  });

  it('dado quem só lê, quando clica no valor, então nada vira campo', async () => {
    // Dado
    render(<Apelido />);
    // Quando
    await userEvent.click(screen.getByText('Zé'));
    // Então
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('dado o formulário aberto, quando a pessoa muda, volta ao gravado e fecha, então o cartão sabe do rascunho só enquanto ele é diferente', async () => {
    // Dado
    const aoMudarRascunho = vi.fn();
    render(<Apelido aoSalvar={vi.fn()} aoMudarRascunho={aoMudarRascunho} />);
    await userEvent.click(screen.getByRole('button', { name: /^Apelido/ }));
    // Então: abrir sem mudar não conta
    expect(aoMudarRascunho).not.toHaveBeenCalled();
    // Quando
    await userEvent.type(screen.getByLabelText('Apelido'), 'zinho');
    // Então
    expect(aoMudarRascunho).toHaveBeenLastCalledWith(JSON.stringify({ apelido: 'Zézinho' }));
    // Quando: volta ao gravado
    await userEvent.clear(screen.getByLabelText('Apelido'));
    await userEvent.type(screen.getByLabelText('Apelido'), 'Zé');
    // Então
    expect(aoMudarRascunho).toHaveBeenLastCalledWith(null);
    // Quando: muda de novo e cancela
    await userEvent.type(screen.getByLabelText('Apelido'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Então
    expect(aoMudarRascunho).toHaveBeenLastCalledWith(null);
  });

  it('dado o formulário aberto com uma mudança, quando a edição deixa de ser permitida (o lápis abriu) e volta, então o valor aparece fechado', async () => {
    // Dado
    const aoMudarRascunho = vi.fn();
    const { rerender } = render(<Apelido aoSalvar={vi.fn()} aoMudarRascunho={aoMudarRascunho} />);
    await userEvent.click(screen.getByRole('button', { name: /^Apelido/ }));
    await userEvent.type(screen.getByLabelText('Apelido'), 'zinho');
    // Quando
    rerender(<Apelido aoMudarRascunho={aoMudarRascunho} />);
    rerender(<Apelido aoSalvar={vi.fn()} aoMudarRascunho={aoMudarRascunho} />);
    // Então: nada do rascunho antigo, e o cartão não espera mais por ele
    expect(screen.queryByRole('group', { name: 'Mudar o apelido' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Apelido/ })).toHaveTextContent('Zé');
    expect(aoMudarRascunho).toHaveBeenLastCalledWith(null);
  });

  it('dado uma gravação em andamento, quando a pessoa aperta Esc e a gravação falha, então o formulário continua aberto com o que ela escreveu', async () => {
    // Dado
    let falhar: (e: Error) => void = () => {};
    const aoSalvar = vi.fn(() => new Promise((_, rejeitar) => { falhar = rejeitar; }));
    render(<><Avisos /><Apelido aoSalvar={aoSalvar} /></>);
    await userEvent.click(screen.getByRole('button', { name: /^Apelido/ }));
    await userEvent.type(screen.getByLabelText('Apelido'), 'zinho');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
    // Quando
    fireEvent.keyDown(screen.getByLabelText('Apelido'), { key: 'Escape' });
    falhar(new Error('Sem conexão.'));
    // Então
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled());
    expect(screen.getByRole('group', { name: 'Mudar o apelido' })).toBeInTheDocument();
    expect(screen.getByLabelText('Apelido')).toHaveValue('Zézinho');
  });
});

describe('As datas que se mudam na faixa do cartão (#395)', () => {
  /** A faixa de uma tarefa: a criação, o início e o prazo, que quem altera muda ali mesmo. */
  function Faixa({ aoSalvar = vi.fn() }: { aoSalvar?: (o: string) => unknown }) {
    return <FaixaDasDatas criacao={{ rotulo: 'Criada em', em: '2026-11-18T12:00:00.000Z' }}>
      <DadoDoGrupo rotulo="Início">
        <DataEditavel nome="Data de início" valor="2026-11-18" conferir={erroDaDataDeInicio} aoSalvar={iso => aoSalvar('inicio ' + iso)} />
      </DadoDoGrupo>
      <DadoDoGrupo rotulo="Prazo">
        <PrazoEditavel nome="Prazo" valor={{ prazo: '2026-11-20', prazo_hora: null, lembrete: null }}
          conferir={c => errosDosCampos(validarTarefa, TAREFA_VAZIA, c, CAMPOS_DO_PRAZO)} aoSalvar={c => aoSalvar('prazo ' + c.prazo)} />
      </DadoDoGrupo>
    </FaixaDasDatas>;
  }
  const faixa = () => screen.getByRole('group', { name: 'Datas' });
  const dado = (nome: string) => within(faixa()).getByRole('group', { name: nome });
  const inicio = () => screen.getByRole('button', { name: /^Data de início: / });
  const prazo = () => screen.getByRole('button', { name: /^Prazo: / });

  it('quando a pessoa abre o início, então as outras datas continuam no lugar e à vista, o início fica marcado, e o formulário abre embaixo dos dados, fora deles', async () => {
    // Dado
    render(<Faixa />);
    // Quando
    await userEvent.click(inicio());
    // Então
    const formulario = within(faixa()).getByRole('group', { name: 'Mudar a data de início' });
    expect(dado('Criada em')).toHaveTextContent('18/11/2026');
    expect(within(dado('Prazo')).getByRole('button', { name: /^Prazo: / })).toBeInTheDocument();
    expect(within(dado('Início')).getByRole('button', { name: /^Data de início: / })).toHaveAttribute('aria-expanded', 'true');
    for (const nome of ['Criada em', 'Início', 'Prazo']) expect(dado(nome)).not.toContainElement(formulario);
    expect(within(formulario).getByRole('textbox', { name: 'Data de início' })).toHaveFocus();
  });

  it('dado o prazo aberto sem mudança, quando a pessoa clica no início, então o prazo fecha e o início abre: uma data de cada vez', async () => {
    // Dado
    render(<Faixa />);
    await userEvent.click(prazo());
    // Quando
    await userEvent.click(inicio());
    // Então
    expect(screen.queryByRole('group', { name: 'Mudar o prazo' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Mudar a data de início' })).toBeInTheDocument();
  });

  it('dado o prazo mudado e não salvo, quando a pessoa clica no início, então o prazo continua aberto, com o que ela escreveu, e lembra de salvar ou cancelar antes', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Faixa aoSalvar={aoSalvar} />);
    await userEvent.click(prazo());
    const doPrazo = within(screen.getByRole('group', { name: 'Mudar o prazo' })).getByRole('textbox', { name: 'Prazo' });
    await userEvent.clear(doPrazo);
    await userEvent.type(doPrazo, '04042031');
    // Quando
    await userEvent.click(inicio());
    // Então
    expect(screen.queryByRole('group', { name: 'Mudar a data de início' })).not.toBeInTheDocument();
    const formulario = screen.getByRole('group', { name: 'Mudar o prazo' });
    expect(within(formulario).getByRole('status')).toHaveTextContent(SALVE_OU_CANCELE);
    expect(within(formulario).getByRole('textbox', { name: 'Prazo' })).toHaveValue('04/04/2031');
    expect(within(formulario).getByRole('textbox', { name: 'Prazo' })).toHaveFocus();
    expect(aoSalvar).not.toHaveBeenCalled();
    // Quando: cancela o prazo, e aí o início abre
    await userEvent.click(within(formulario).getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(inicio());
    // Então
    expect(screen.getByRole('group', { name: 'Mudar a data de início' })).toBeInTheDocument();
  });

  it('dado o início aberto, quando a pessoa abre o calendário, então ele fica dentro do formulário, antes de Cancelar e Salvar, e escolher o dia não grava', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Faixa aoSalvar={aoSalvar} />);
    await userEvent.click(inicio());
    const formulario = screen.getByRole('group', { name: 'Mudar a data de início' });
    // Quando
    await userEvent.click(within(formulario).getByRole('button', { name: 'Abrir o calendário' }));
    // Então
    const calendario = within(formulario).getByRole('dialog', { name: 'Calendário' });
    expect(calendario.compareDocumentPosition(within(formulario).getByRole('button', { name: 'Cancelar' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Quando
    await userEvent.click(within(calendario).getByRole('button', { name: /^quarta-feira, 25 de novembro de 2026/ }));
    // Então
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(within(formulario).getByRole('textbox', { name: 'Data de início' })).toHaveValue('25/11/2026');
  });

  it('dado o início aberto, quando a pessoa usa o Shift+Tab no campo e o Tab no valor, então o foco vai e volta entre o início e o formulário dele', async () => {
    // Dado
    render(<Faixa />);
    await userEvent.click(inicio());
    const campo = within(screen.getByRole('group', { name: 'Mudar a data de início' })).getByRole('textbox', { name: 'Data de início' });
    expect(campo).toHaveFocus();
    // Quando
    await userEvent.tab({ shift: true });
    // Então: volta ao início, e não ao prazo (o último dado antes do painel)
    expect(inicio()).toHaveFocus();
    // Quando
    await userEvent.tab();
    // Então
    expect(campo).toHaveFocus();
  });

  it('dado o prazo aberto e mudado, quando a pessoa aperta Esc com o foco no valor, então desfaz só o prazo, e o Esc não chega ao cartão', async () => {
    // Dado
    const cartaoFecha = vi.fn();
    const ouvir = (e: KeyboardEvent) => { if (e.key === 'Escape') cartaoFecha(); };
    document.addEventListener('keydown', ouvir);
    render(<Faixa />);
    await userEvent.click(prazo());
    const campo = within(screen.getByRole('group', { name: 'Mudar o prazo' })).getByRole('textbox', { name: 'Prazo' });
    await userEvent.clear(campo);
    await userEvent.tab({ shift: true });
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('group', { name: 'Mudar o prazo' })).not.toBeInTheDocument();
    expect(prazo()).toHaveAttribute('aria-expanded', 'false');
    expect(prazo()).toHaveAccessibleName(/^Prazo: 20\/11\/2026/);
    expect(cartaoFecha).not.toHaveBeenCalled();
    document.removeEventListener('keydown', ouvir);
  });

  it('dado o prazo mudado e não salvo, quando o cartão barra o lápis (LembreteDoCartao), então o prazo continua aberto e lembra de salvar ou cancelar', async () => {
    // Dado
    const { rerender } = render(<LembreteDoCartao value={0}><Faixa /></LembreteDoCartao>);
    await userEvent.click(prazo());
    const campo = within(screen.getByRole('group', { name: 'Mudar o prazo' })).getByRole('textbox', { name: 'Prazo' });
    await userEvent.clear(campo);
    await userEvent.type(campo, '04042031');
    await userEvent.tab({ shift: true });
    // Quando
    rerender(<LembreteDoCartao value={1}><Faixa /></LembreteDoCartao>);
    // Então
    const formulario = screen.getByRole('group', { name: 'Mudar o prazo' });
    expect(within(formulario).getByRole('status')).toHaveTextContent(SALVE_OU_CANCELE);
    expect(within(formulario).getByRole('textbox', { name: 'Prazo' })).toHaveValue('04/04/2031');
    expect(within(formulario).getByRole('textbox', { name: 'Prazo' })).toHaveFocus();
  });
});
