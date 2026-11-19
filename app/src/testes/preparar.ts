// Preparação comum dos testes: os comparadores de tela (toBeInTheDocument, toBeDisabled…)
// e a limpeza da tela entre um caso e outro, nos arquivos que rodam em jsdom.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());
  // O jsdom não mede o texto, e o editor ao vivo (o CodeMirror, #364) pede as medidas de um trecho para pôr o cursor na tela:
  // aqui o trecho não tem tamanho, como uma página ainda sem desenho.
  const medidas = {
    getClientRects: () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }),
    getBoundingClientRect: () => new DOMRect()
  };
  for (const [nome, medir] of Object.entries(medidas))
    if (!(nome in Range.prototype)) Object.defineProperty(Range.prototype, nome, { value: medir, configurable: true });
}
