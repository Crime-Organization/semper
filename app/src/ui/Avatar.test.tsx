// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';

describe('Bolinha da equipe', () => {
  it('quando a pessoa não tem foto, então a bolinha mostra as iniciais', () => {
    // Quando
    render(<Avatar p={{ id: 'u-ana', nome: 'Ana Teste Lima' }} />);
    // Então
    expect(screen.getByLabelText('Ana Teste Lima').textContent).toBe('AL');
  });

  it('quando a pessoa foi excluída da equipe, então as iniciais ignoram o "(excluído)" do fim do nome', () => {
    // Quando
    render(<Avatar p={{ id: 'u-carla', nome: 'Carla Fictícia Rocha (excluído)' }} />);
    // Então
    expect(screen.getByLabelText('Carla Fictícia Rocha (excluído)').textContent).toBe('CR');
  });

  it('quando a pessoa tem foto, então a bolinha mostra a foto, com o nome dela', () => {
    // Quando
    render(<Avatar p={{ id: 'u-ana', nome: 'Ana Teste Lima', foto: 'https://exemplo.com/150.avif' }} tam={32} />);
    // Então
    const bolinha = screen.getByRole('img', { name: 'Ana Teste Lima' });
    expect(bolinha.querySelector('img')?.getAttribute('src')).toBe('https://exemplo.com/150.avif');
    expect(bolinha.textContent).toBe('');
  });

  it('quando a foto não abre (o link venceu), então a bolinha volta às iniciais', () => {
    // Dado
    render(<Avatar p={{ id: 'u-ana', nome: 'Ana Teste Lima', foto: 'https://exemplo.com/vencido.avif' }} />);
    // Quando
    fireEvent.error(screen.getByRole('img', { name: 'Ana Teste Lima' }).querySelector('img')!);
    // Então
    expect(screen.getByLabelText('Ana Teste Lima').textContent).toBe('AL');
  });
});
