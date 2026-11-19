// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { Lembrete } from '../../dados';
import { BotaoDoLembrete } from './BotaoDoLembrete';

/** O botão com o lembrete guardado pela tela, como no cadastro de tarefa e de demanda. */
function Formulario({ prazo = '15/11/2030', inicial = null }: { prazo?: string; inicial?: Lembrete | null }) {
  const [lembrete, setLembrete] = useState<Lembrete | null>(inicial);
  return <>
    <BotaoDoLembrete valor={lembrete} prazo={prazo} aoMudar={setLembrete} />
    <output aria-label="Guardado">{String(lembrete)}</output>
  </>;
}
const botao = () => screen.getByRole('button', { name: /^Lembrete:/ });

describe('Botão do lembrete, com o sino (#299)', () => {
  it('dado um prazo sem lembrete, quando o botão aparece, então mostra "Sem lembrete"', () => {
    // Quando
    render(<Formulario />);
    // Então
    expect(botao()).toHaveAccessibleName('Lembrete: Sem lembrete');
    expect(botao()).toHaveTextContent('Sem lembrete');
    expect(botao()).toBeEnabled();
  });

  it('dado um prazo, quando a pessoa clica no sino, então vê as opções combinadas, da mais perto à mais longe, e nenhum, com a nota de quem recebe', async () => {
    // Dado
    render(<Formulario />);
    // Quando
    await userEvent.click(botao());
    // Então
    expect(botao()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('menuitemradio').map(o => o.textContent))
      .toEqual(['Na hora do prazo', '30 minutos antes', '1 hora antes', '1 dia antes', 'Sem lembrete']);
    expect(screen.getByRole('menuitemradio', { name: 'Sem lembrete' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/Sem hora, o lembrete conta o prazo às 9h/)).toBeInTheDocument();
  });

  it('dado as opções abertas, quando a pessoa escolhe "1 hora antes", então o menu fecha, o botão mostra a escolha e o foco volta a ele', async () => {
    // Dado
    render(<Formulario />);
    await userEvent.click(botao());
    // Quando
    await userEvent.click(screen.getByRole('menuitemradio', { name: '1 hora antes' }));
    // Então
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(botao()).toHaveAccessibleName('Lembrete: 1 hora antes');
    expect(botao()).toHaveFocus();
    expect(screen.getByLabelText('Guardado')).toHaveTextContent('60');
  });

  it('dado um lembrete marcado, quando a pessoa escolhe "Sem lembrete", então o lembrete sai', async () => {
    // Dado
    render(<Formulario inicial={1440} />);
    expect(botao()).toHaveTextContent('1 dia antes');
    // Quando
    await userEvent.click(botao());
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Sem lembrete' }));
    // Então
    expect(screen.getByLabelText('Guardado')).toHaveTextContent('null');
    expect(botao()).toHaveAccessibleName('Lembrete: Sem lembrete');
  });

  it('dado as opções abertas, quando a pessoa aperta Esc, então o menu fecha sem mudar nada e o foco volta ao botão', async () => {
    // Dado
    render(<Formulario inicial={30} />);
    await userEvent.click(botao());
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(botao()).toHaveFocus();
    expect(screen.getByLabelText('Guardado')).toHaveTextContent('30');
  });

  it('dado o formulário sem prazo, quando o botão aparece, então fica desligado e diz por quê; com um lembrete já marcado, continua ligado para tirá-lo', () => {
    // Quando
    const { unmount } = render(<Formulario prazo="" />);
    // Então
    expect(botao()).toHaveAttribute('aria-disabled', 'true');
    expect(botao()).toHaveAttribute('title', 'Informe o prazo para marcar o lembrete');
    unmount();
    // Quando
    render(<Formulario prazo="" inicial={60} />);
    // Então
    expect(botao()).not.toHaveAttribute('aria-disabled');
  });

  it('dado o formulário sem prazo, quando a pessoa chega no sino pelo teclado e o aperta, então ouve o motivo e o menu não abre', async () => {
    // Dado
    render(<Formulario prazo="" />);
    // Quando
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    // Então
    expect(botao()).toHaveFocus();
    expect(botao()).toHaveAccessibleDescription('Informe o prazo para marcar o lembrete.');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Guardado')).toHaveTextContent('null');
  });
});
