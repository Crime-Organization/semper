// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui o formulário é aberto como quem não é.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormularioDoPerfil } from './PerfilProfissional';

describe('Formulário do perfil profissional', () => {
  it('quando quem abre não é administrador, então "Aparecer no site" e a ordem ficam desligados, com o aviso de quem decide', async () => {
    // Quando
    render(<FormularioDoPerfil perfilId="u-bruno" nome="Bruno Exemplo Souza" podePublicar={false} />);
    // Então
    const noSite = await screen.findByRole('checkbox', { name: 'Aparecer no site' });
    expect((noSite as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Ordem na página da equipe') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('Só administradores decidem quem aparece no site e em que ordem.')).toBeTruthy();
    expect((screen.getByLabelText('Cargo no escritório', { exact: false }) as HTMLInputElement).disabled).toBe(false);
  });

  it('quando quem abre é administrador, então pode ligar "Aparecer no site"', async () => {
    // Quando
    render(<FormularioDoPerfil perfilId="u-bruno" nome="Bruno Exemplo Souza" podePublicar />);
    // Então
    const noSite = await screen.findByRole('checkbox', { name: 'Aparecer no site' });
    expect((noSite as HTMLInputElement).disabled).toBe(false);
  });
});
