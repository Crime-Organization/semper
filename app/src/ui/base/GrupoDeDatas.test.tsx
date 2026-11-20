// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Avisos } from '../avisos';
import { DadoDoGrupo, DadoEditavel, GrupoDeDatas, LinhaDoGrupo } from './GrupoDeDatas';

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

  it('dado um grupo de uma data só (o compromisso), quando aparece, então só ela aparece', () => {
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
