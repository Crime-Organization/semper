// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O prazo do cartão na folhinha (#442): quanto falta, vencido em vermelho, a concluída com o dia da conclusão, quem só lê e o link
// e a folhinha que abrem a janela das datas, com o início lá dentro.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMPOS_DO_PRAZO, errosDosCampos, type CamposDoPrazo, type InicioEPrazoGravados } from '../../regras/datasNoCartao';
import { TAREFA_VAZIA, validarTarefa } from '../../regras/tarefa';
import { Avisos } from '../avisos';
import { PrazoNaFolhinha } from './PrazoNaFolhinha';

/** Hoje, nos testes: quarta-feira, 25/11/2026, à tarde em Brasília. */
const AGORA = new Date('2026-11-25T18:00:00.000Z');
const COM_PRAZO: InicioEPrazoGravados = { data_inicio: '2026-11-18', prazo: '2026-11-27', prazo_hora: '18:00:00', lembrete: 60 };
const conferir = (c: CamposDoPrazo) => errosDosCampos(validarTarefa, TAREFA_VAZIA, c, CAMPOS_DO_PRAZO);

function Prazo({ valor = COM_PRAZO, concluidaEm = null, podeMudar = true }: { valor?: InicioEPrazoGravados; concluidaEm?: string | null; podeMudar?: boolean }) {
  return <>
    <Avisos />
    <PrazoNaFolhinha nomeDoPrazo="Prazo" valor={valor} concluidaEm={concluidaEm} conferirPrazo={conferir} aoSalvar={podeMudar ? vi.fn() : undefined} />
  </>;
}
const bloco = () => screen.getByRole('group', { name: 'Prazo' });
const janela = () => screen.getByRole('dialog', { name: 'Mudar as datas' });
/** A folhinha é só para o mouse (aria-hidden): o teste a acha como a pessoa a vê, pelo dia escrito nela. */
const folhinha = (dia: string) => within(bloco()).getByText(dia).parentElement!;

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(AGORA); });
afterEach(() => vi.useRealTimers());

describe('O prazo na folhinha (#442)', () => {
  it('dado o prazo daqui a dois dias, com hora e lembrete, quando o cartão abre, então a folhinha, "Faltam 2 dias", a hora e o lembrete e "Mudar prazo"', () => {
    // Quando
    render(<Prazo />);
    // Então
    expect(bloco()).toHaveTextContent('nov27sexta');
    expect(bloco()).toHaveTextContent('Faltam 2 dias');
    expect(bloco()).toHaveTextContent('Prazo: sexta-feira, 27/11/2026');
    expect(bloco()).toHaveTextContent('Às 18:00 · lembrete 1 h antes');
    expect(within(bloco()).getByRole('button', { name: 'Mudar prazo' })).toHaveAccessibleDescription(/Início 18\/11\/2026/);
    // O início não aparece no cartão
    expect(bloco()).not.toHaveTextContent('18/11/2026');
  });

  it('dado o link "Mudar prazo", quando a pessoa clica, então abre a janela das datas, com o início lá dentro', async () => {
    // Dado
    render(<Prazo />);
    // Quando
    await userEvent.click(within(bloco()).getByRole('button', { name: 'Mudar prazo' }));
    // Então
    expect(within(janela()).getByRole('textbox', { name: 'Data de início' })).toHaveValue('18/11/2026');
    expect(within(bloco()).getByRole('button', { name: 'Mudar prazo' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('dado a folhinha, quando a pessoa clica nela, então abre a mesma janela (presa ao link, para o foco voltar a ele)', async () => {
    // Dado
    render(<Prazo />);
    // Quando
    await userEvent.click(folhinha('27'));
    // Então
    expect(janela()).toBeInTheDocument();
    await userEvent.click(within(janela()).getByRole('button', { name: 'Fechar' }));
    expect(within(bloco()).getByRole('button', { name: 'Mudar prazo' })).toHaveFocus();
  });

  it('dado a tarefa sem prazo, quando o cartão abre, então "Sem prazo" e "Definir prazo", sem folhinha', () => {
    // Quando
    render(<Prazo valor={{ ...COM_PRAZO, prazo: null, prazo_hora: null, lembrete: null }} />);
    // Então
    expect(bloco()).toHaveTextContent('Sem prazo');
    expect(within(bloco()).getByRole('button', { name: 'Definir prazo' })).toBeInTheDocument();
    expect(within(bloco()).queryByText('nov')).not.toBeInTheDocument();
  });

  it('dado o prazo vencido, quando o cartão abre, então "Venceu há 2 dias"', () => {
    // Quando
    render(<Prazo valor={{ ...COM_PRAZO, prazo: '2026-11-23', prazo_hora: null, lembrete: null }} />);
    // Então
    expect(within(bloco()).getByText('Venceu há 2 dias')).toBeInTheDocument();
    expect(bloco()).toHaveTextContent('nov23segunda');
  });

  it('dado a tarefa concluída um dia antes do prazo, quando o cartão abre, então a folhinha é o dia da conclusão, que não abre nada, e diz quanto antes', async () => {
    // Quando: concluída na quinta, 26/11, às 10:00 de Brasília
    render(<Prazo concluidaEm="2026-11-26T13:00:00Z" />);
    // Então
    expect(bloco()).toHaveTextContent('nov26quinta');
    expect(bloco()).toHaveTextContent('Concluída em: quinta-feira, 26/11/2026');
    expect(bloco()).toHaveTextContent('1 dia antes do prazo');
    expect(folhinha('26').tagName).not.toBe('BUTTON');
    await userEvent.click(folhinha('26'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Quem altera ainda muda as datas da concluída
    expect(within(bloco()).getByRole('button', { name: 'Mudar prazo' })).toBeInTheDocument();
  });

  it('dado quem só lê, quando o cartão abre, então vê o prazo, sem nenhum botão', () => {
    // Quando
    render(<Prazo podeMudar={false} />);
    // Então
    expect(bloco()).toHaveTextContent('Faltam 2 dias');
    expect(within(bloco()).queryByRole('button')).not.toBeInTheDocument();
    expect(folhinha('27').tagName).not.toBe('BUTTON');
  });
});
