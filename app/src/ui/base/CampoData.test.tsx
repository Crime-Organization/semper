// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampoData, LugarDoCalendario, type PropsCampoData } from './CampoData';
import { janela, Janelas } from '../janela';

/** O campo num formulário, com o rótulo e a data guardada pela tela (como os cadastros fazem). */
function Formulario({ inicial = '', aoMudar, comHora = false, ...resto }: Partial<PropsCampoData> & { inicial?: string; comHora?: boolean }) {
  const [valor, setValor] = useState(inicial);
  const [hora, setHora] = useState('');
  return <>
    <label htmlFor="prazo">Prazo</label>
    <CampoData id="prazo" valor={valor} aoMudar={v => { setValor(v); aoMudar?.(v); }} hora={comHora ? { valor: hora, aoMudar: setHora } : undefined} {...resto} />
    <output aria-label="Hora guardada">{hora}</output>
    <button type="button">Outro campo</button>
  </>;
}
const campo = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Prazo' });
const calendario = () => screen.getByRole('dialog', { name: 'Calendário' });
const dia = (nome: RegExp) => within(calendario()).getByRole('button', { name: nome });

beforeEach(() => {
  // Hoje: quarta-feira, 18/11/2026, ao meio-dia de Brasília. Só o relógio é simulado: as esperas da tela correm normalmente.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T15:00:00.000Z'));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Campo de data com o calendário pequeno (#357)', () => {
  describe('Dado o computador', () => {
    it('quando a pessoa clica no campo, então o calendário abre no mês da data, com hoje e o dia escolhido marcados, e o foco continua no campo', async () => {
      // Dado
      render(<Formulario inicial="25/11/2026" />);
      // Quando
      await userEvent.click(campo());
      // Então
      expect(calendario()).toBeInTheDocument();
      expect(within(calendario()).getByRole('grid', { name: 'novembro de 2026' })).toBeInTheDocument();
      expect(dia(/^quarta-feira, 18 de novembro de 2026/)).toHaveAttribute('aria-current', 'date');
      expect(within(calendario()).getByRole('gridcell', { selected: true })).toHaveTextContent('25');
      expect(campo()).toHaveFocus();
      expect(campo()).toHaveAttribute('aria-expanded', 'true');
    });

    it('quando a pessoa escolhe um dia com o mouse, então a data vai para o campo, o calendário fecha e o foco volta ao campo', async () => {
      // Dado
      const aoMudar = vi.fn();
      render(<Formulario aoMudar={aoMudar} />);
      await userEvent.click(campo());
      // Quando
      await userEvent.click(dia(/^sexta-feira, 27 de novembro de 2026$/));
      // Então
      expect(aoMudar).toHaveBeenLastCalledWith('27/11/2026');
      expect(campo()).toHaveValue('27/11/2026');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(campo()).toHaveFocus();
    });

    it('quando a pessoa usa as setas do mês, então o calendário mostra o mês anterior e o seguinte', async () => {
      // Dado
      render(<Formulario />);
      await userEvent.click(campo());
      // Quando
      await userEvent.click(within(calendario()).getByRole('button', { name: 'Próximo mês' }));
      // Então
      expect(within(calendario()).getByRole('grid', { name: 'dezembro de 2026' })).toBeInTheDocument();
      // Quando
      await userEvent.click(within(calendario()).getByRole('button', { name: 'Mês anterior' }));
      await userEvent.click(within(calendario()).getByRole('button', { name: 'Mês anterior' }));
      // Então
      expect(within(calendario()).getByRole('grid', { name: 'outubro de 2026' })).toBeInTheDocument();
    });

    it('quando a pessoa usa o teclado, então a seta para baixo entra no calendário, as setas e o PageDown andam, e o Enter escolhe', async () => {
      // Dado
      const aoMudar = vi.fn();
      render(<Formulario inicial="20/11/2026" aoMudar={aoMudar} />);
      campo().focus();
      // Quando
      await userEvent.keyboard('{ArrowDown}');
      // Então: o foco vai ao dia escolhido
      expect(dia(/^sexta-feira, 20 de novembro de 2026$/)).toHaveFocus();
      // Quando
      await userEvent.keyboard('{ArrowRight}{ArrowDown}');
      // Então
      expect(dia(/^sábado, 28 de novembro de 2026$/)).toHaveFocus();
      // Quando
      await userEvent.keyboard('{PageDown}');
      // Então
      expect(within(calendario()).getByRole('grid', { name: 'dezembro de 2026' })).toBeInTheDocument();
      expect(dia(/^segunda-feira, 28 de dezembro de 2026$/)).toHaveFocus();
      // Quando
      await userEvent.keyboard('{Enter}');
      // Então
      expect(aoMudar).toHaveBeenLastCalledWith('28/12/2026');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(campo()).toHaveFocus();
    });

    it('quando a pessoa aperta Esc, então o calendário fecha sem mudar a data e o foco volta ao campo', async () => {
      // Dado
      const aoMudar = vi.fn();
      render(<Formulario inicial="20/11/2026" aoMudar={aoMudar} />);
      campo().focus();
      await userEvent.keyboard('{ArrowDown}{ArrowRight}');
      // Quando
      await userEvent.keyboard('{Escape}');
      // Então
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(campo()).toHaveFocus();
      expect(campo()).toHaveValue('20/11/2026');
      expect(aoMudar).not.toHaveBeenCalled();
    });

    it('dado o campo dentro de uma janela, quando a pessoa aperta Esc no calendário, então só o calendário fecha', async () => {
      // Dado
      render(<Janelas />);
      void janela({ titulo: 'Data de entrega', corpo: <Formulario /> });
      await userEvent.click(await screen.findByRole('textbox', { name: 'Prazo' }));
      // Quando
      await userEvent.keyboard('{Escape}');
      // Então
      expect(screen.queryByRole('dialog', { name: 'Calendário' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Data de entrega' })).toBeInTheDocument();
    });

    it('quando a pessoa escreve a data à mão, então a máscara põe as barras, e a data colada como aaaa-mm-dd também vale', async () => {
      // Dado
      const aoMudar = vi.fn();
      render(<Formulario aoMudar={aoMudar} />);
      // Quando
      await userEvent.type(campo(), '10112030');
      // Então
      expect(campo()).toHaveValue('10/11/2030');
      expect(aoMudar).toHaveBeenLastCalledWith('10/11/2030');
      // Quando
      fireEvent.change(campo(), { target: { value: '2031-01-05' } });
      // Então
      expect(campo()).toHaveValue('05/01/2031');
      expect(aoMudar).toHaveBeenLastCalledWith('05/01/2031');
    });

    it('dado o calendário aberto, quando a data escrita fica inteira, então ele vai para o mês dela', async () => {
      // Dado
      render(<Formulario />);
      await userEvent.click(campo());
      // Quando
      await userEvent.type(campo(), '15032031');
      // Então
      expect(within(calendario()).getByRole('grid', { name: 'março de 2031' })).toBeInTheDocument();
      expect(within(calendario()).getByRole('gridcell', { selected: true })).toHaveTextContent('15');
    });

    it('dado o campo que guarda aaaa-mm-dd, quando mostra e quando a pessoa escreve, então mostra dd/mm/aaaa e a tela recebe a data só inteira', async () => {
      // Dado
      const aoMudar = vi.fn();
      render(<Formulario formato="iso" inicial="2030-11-10" aoMudar={aoMudar} />);
      // Então
      expect(campo()).toHaveValue('10/11/2030');
      // Quando
      await userEvent.clear(campo());
      await userEvent.type(campo(), '0512');
      // Então: pela metade, vazio; o campo continua com o que foi escrito
      expect(aoMudar).toHaveBeenLastCalledWith('');
      expect(campo()).toHaveValue('05/12');
      // Quando
      await userEvent.type(campo(), '2031');
      // Então
      expect(aoMudar).toHaveBeenLastCalledWith('2031-12-05');
    });

    it('dado o campo com hora, quando a pessoa escolhe o dia, então a hora fica logo abaixo do calendário, com o foco, e "Pronto" fecha', async () => {
      // Dado
      render(<Formulario comHora />);
      await userEvent.click(campo());
      // Quando
      await userEvent.click(dia(/^sexta-feira, 20 de novembro de 2026$/));
      // Então
      const hora = within(calendario()).getByLabelText('Hora');
      expect(campo()).toHaveValue('20/11/2026');
      await vi.waitFor(() => expect(hora).toHaveFocus());
      expect(within(calendario()).getByRole('grid').compareDocumentPosition(hora) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // Quando
      fireEvent.change(hora, { target: { value: '14:30' } });
      await userEvent.click(within(calendario()).getByRole('button', { name: 'Pronto' }));
      // Então
      expect(screen.getByRole('status', { name: 'Hora guardada' })).toHaveTextContent('14:30');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('dados os limites, quando o calendário abre, então os dias de fora ficam desligados e a seta para o mês de fora também', async () => {
      // Dado
      render(<Formulario min="2026-11-10" max="2026-11-25" />);
      // Quando
      await userEvent.click(campo());
      // Então
      expect(dia(/^segunda-feira, 9 de novembro de 2026$/)).toBeDisabled();
      expect(dia(/^terça-feira, 10 de novembro de 2026$/)).toBeEnabled();
      expect(dia(/^quinta-feira, 26 de novembro de 2026$/)).toBeDisabled();
      expect(within(calendario()).getByRole('button', { name: 'Próximo mês' })).toBeDisabled();
    });

    it('quando a pessoa sai do campo e do calendário, então ele fecha, e quem usa o campo fica sabendo da saída só nessa hora', async () => {
      // Dado
      const aoSair = vi.fn();
      render(<Formulario onBlur={aoSair} />);
      await userEvent.click(campo());
      await userEvent.click(within(calendario()).getByRole('button', { name: 'Próximo mês' }));
      expect(aoSair).not.toHaveBeenCalled();
      // Quando
      await userEvent.click(screen.getByRole('button', { name: 'Outro campo' }));
      // Então
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(aoSair).toHaveBeenCalledTimes(1);
    });

    it('dado o calendário que flutua, quando a pessoa aperta Tab no último botão dele, então o foco vai para o campo seguinte da página, e não para o fim dela (#395)', async () => {
      // Dado
      render(<Formulario />);
      await userEvent.click(campo());
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.tab();
      expect(within(calendario()).getByRole('button', { name: 'Hoje' })).toHaveFocus();
      // Quando
      await userEvent.tab();
      // Então
      expect(screen.getByRole('button', { name: 'Outro campo' })).toHaveFocus();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('dado o calendário que flutua, quando a pessoa aperta Shift+Tab no primeiro botão dele, então o foco volta ao campo da data (#395)', async () => {
      // Dado
      render(<Formulario />);
      await userEvent.click(campo());
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.tab({ shift: true });
      await userEvent.tab({ shift: true });
      expect(within(calendario()).getByRole('button', { name: 'Mês anterior' })).toHaveFocus();
      // Quando
      await userEvent.tab({ shift: true });
      // Então
      expect(campo()).toHaveFocus();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('dado um formulário que reserva o lugar do calendário, quando a pessoa o abre, então ele fica nesse lugar, no fluxo do formulário, sem flutuar (#395)', async () => {
      // Dado
      function ComLugar() {
        const [lugar, setLugar] = useState<HTMLElement | null>(null);
        return <LugarDoCalendario value={lugar}>
          <Formulario />
          <section aria-label="Lugar do calendário" ref={setLugar} />
        </LugarDoCalendario>;
      }
      render(<ComLugar />);
      // Quando
      await userEvent.click(campo());
      // Então
      expect(within(screen.getByRole('region', { name: 'Lugar do calendário' })).getByRole('dialog', { name: 'Calendário' })).toBeInTheDocument();
      expect(calendario().style.position).toBe('');
    });
  });

  describe('Dado um celular', () => {
    beforeEach(() => {
      vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(pointer: coarse)', addEventListener: () => {}, removeEventListener: () => {} }));
    });
    // O calendário do aparelho (showPicker) é simulado só nos testes que o usam.
    afterEach(() => { delete (HTMLInputElement.prototype as { showPicker?: unknown }).showPicker; });

    it('quando o campo aparece, então é o campo de data do próprio aparelho, e a tela recebe a data no formato dela', () => {
      // Dado
      const aoMudar = vi.fn();
      render(<Formulario inicial="10/11/2030" aoMudar={aoMudar} />);
      const doAparelho = screen.getByLabelText<HTMLInputElement>('Prazo');
      // Então
      expect(doAparelho).toHaveAttribute('type', 'date');
      expect(doAparelho).toHaveValue('2030-11-10');
      expect(screen.queryByRole('button', { name: 'Abrir o calendário' })).not.toBeInTheDocument();
      // Quando
      fireEvent.change(doAparelho, { target: { value: '2030-12-24' } });
      // Então
      expect(aoMudar).toHaveBeenLastCalledWith('24/12/2030');
    });

    it('quando o campo aparece para abrir na hora, então ganha o foco e abre o calendário do aparelho; a escolha é avisada depois de aoMudar', async () => {
      // Dado
      const abrirDoAparelho = vi.fn();
      Object.defineProperty(HTMLInputElement.prototype, 'showPicker', { configurable: true, value: abrirDoAparelho });
      const ordem: string[] = [];
      // Quando
      render(<Formulario inicial="10/11/2030" abrirAoAparecer aoMudar={v => ordem.push('mudou ' + v)} aoEscolher={v => ordem.push('escolheu ' + v)} />);
      const doAparelho = screen.getByLabelText<HTMLInputElement>('Prazo');
      // Então
      expect(doAparelho).toHaveFocus();
      expect(abrirDoAparelho).toHaveBeenCalledTimes(1);
      // Quando
      fireEvent.change(doAparelho, { target: { value: '2030-12-24' } });
      // Então
      await waitFor(() => expect(ordem).toEqual(['mudou 24/12/2030', 'escolheu 24/12/2030']));
    });

    it('quando o navegador recusa abrir o calendário do aparelho, então o campo fica com o foco, sem erro', () => {
      // Dado
      Object.defineProperty(HTMLInputElement.prototype, 'showPicker', { configurable: true, value: () => { throw new DOMException('sem gesto', 'NotAllowedError'); } });
      // Quando
      render(<Formulario abrirAoAparecer />);
      // Então
      expect(screen.getByLabelText('Prazo')).toHaveFocus();
    });

    it('quando a pessoa aperta Enter ou Esc num teclado ligado ao aparelho, então quem usa o campo recebe a tecla, e o Esc desiste', () => {
      // Dado
      const teclas: string[] = [];
      const aoDesistir = vi.fn();
      render(<Formulario inicial="10/11/2030" onKeyDown={e => teclas.push(e.key)} aoDesistir={aoDesistir} />);
      const doAparelho = screen.getByLabelText('Prazo');
      // Quando
      fireEvent.keyDown(doAparelho, { key: 'Enter' });
      fireEvent.keyDown(doAparelho, { key: 'Escape' });
      // Então
      expect(teclas).toEqual(['Enter', 'Escape']);
      expect(aoDesistir).toHaveBeenCalledTimes(1);
    });
  });
});
