// Preparação comum dos testes: os comparadores de tela (toBeInTheDocument, toBeDisabled…)
// e a limpeza da tela entre um caso e outro, nos arquivos que rodam em jsdom.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());
}
