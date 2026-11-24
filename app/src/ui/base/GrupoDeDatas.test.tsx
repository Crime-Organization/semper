// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DadoDoGrupo, FaixaDasDatas, GrupoDeDatas, LinhaDoGrupo } from './GrupoDeDatas';

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
    expect(screen.queryByRole('group', { name: 'Datas do cartão' })).not.toBeInTheDocument();
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
    const faixa = screen.getByRole('group', { name: 'Datas do cartão' });
    const dados = within(faixa).getAllByRole('group');
    expect(dados.map(d => d.textContent)).toEqual([`Criada em ${CRIADO_EM_NA_TELA}`, 'Início 19/11/2026', 'Prazo Sem prazo']);
  });

  it('dado o compromisso, com a criação no fim, quando ele abre, então a data e o horário vêm primeiro e a criação depois', () => {
    // Quando
    render(<FaixaDasDatas criacao={{ rotulo: 'Criado em', em: CRIADO_EM }} criacaoNoFim>
      <DadoDoGrupo rotulo="Data e horário"><b>20/12/2030 às 14:30</b></DadoDoGrupo>
    </FaixaDasDatas>);
    // Então
    const dados = within(screen.getByRole('group', { name: 'Datas do cartão' })).getAllByRole('group');
    expect(dados.map(d => d.textContent)).toEqual(['Data e horário 20/12/2030 às 14:30', `Criado em ${CRIADO_EM_NA_TELA}`]);
  });
});
