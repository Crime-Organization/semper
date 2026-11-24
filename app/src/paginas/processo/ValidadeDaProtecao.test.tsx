// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A seção "Validade e anuidades" do processo de propriedade intelectual (#317, #418): os prazos do INPI e os atalhos para a agenda.
// Aqui, o que depende do calendário do INPI (a seção espera por ele e, se ele não vem, não oferece a agenda).
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompromissoLigado, Dados } from '../../dados';
import type { PrazoExtraDaProtecao, PrazosDaProtecao } from '../../regras/propriedadeIntelectual';
import { Avisos } from '../../ui/avisos';
import { CALENDARIO_DO_INPI_FALHOU, ValidadeDaProtecao, type AcompanharNaAgenda } from './ValidadeDaProtecao';
import type { SituacaoDoCalendario } from './useCalendarioDoInpi';

// A seção lê os compromissos do processo e as colunas do quadro de compromissos; o mock declara exatamente essas operações.
const SD = vi.hoisted(() => ({
  compromissosDoProcesso: vi.fn<Dados['compromissosDoProcesso']>(async () => []),
  colunasListar: vi.fn<Dados['colunasListar']>(async () => [])
}));
vi.mock('../../dados', () => ({ SD: SD satisfies Pick<Dados, keyof typeof SD> }));

const HOJE = '2026-11-04';
const TITULO = 'Prazo após o deferimento 918000001';
const PRAZOS: PrazosDaProtecao = {
  validade: null, falta: 'A validade da marca conta da concessão: informe a data da concessão.',
  datas: [{ tipo: 'deferimento', nome: 'Prazo após o deferimento', inicio: '2026-10-06', fim: '2027-01-05', fimExtra: '2027-02-16' }]
};
const DEFERIMENTO: PrazoExtraDaProtecao = { nome: 'Prazo após o deferimento', titulo: TITULO, data: '2027-01-05', observacoes: '' };
const acompanhar = (extra: Partial<AcompanharNaAgenda> = {}): AcompanharNaAgenda => ({
  processoId: 'p1', comDemanda: false, hoje: HOJE, serie: null, extra: null, concluir: null,
  deferimento: { prazo: DEFERIMENTO, para: '/compromissos/novo/?processo=p1&acompanhar=deferimento' }, ...extra
});
const montar = (calendario: SituacaoDoCalendario, a: AcompanharNaAgenda = acompanhar()) => render(<MemoryRouter><Avisos />
  <ValidadeDaProtecao prazos={PRAZOS} hoje={HOJE} acompanhar={a} calendario={calendario} /></MemoryRouter>);

describe('Validade e anuidades: o calendário do INPI (#418)', () => {
  beforeEach(() => { Object.values(SD).forEach(f => f.mockClear()); });

  it('dado o calendário do INPI ainda chegando, quando a seção abre, então ela espera, sem mostrar datas nem o atalho para a agenda', () => {
    // Quando
    montar('lendo');
    // Então
    expect(screen.getByText('Carregando…')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Prazos do INPI' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pôr o prazo na agenda/ })).not.toBeInTheDocument();
    expect(SD.compromissosDoProcesso).not.toHaveBeenCalled();
  });

  it('dado que a leitura do calendário do INPI falhou, quando a seção abre, então ela avisa e mostra a conta, sem oferecer a agenda', () => {
    // Quando
    montar('falhou');
    // Então
    expect(screen.getByRole('alert')).toHaveTextContent(CALENDARIO_DO_INPI_FALHOU);
    expect(screen.getByRole('table', { name: 'Prazos do INPI' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pôr o prazo na agenda/ })).not.toBeInTheDocument();
    expect(SD.compromissosDoProcesso).not.toHaveBeenCalled();
  });

  it('dado o calendário do INPI pronto, quando a seção abre, então ela oferece pôr o prazo na agenda', async () => {
    // Quando
    montar('pronto');
    // Então
    expect(await screen.findByRole('link', { name: /Pôr o prazo na agenda/ })).toBeInTheDocument();
    expect(screen.getByText(`Cria na agenda "${TITULO}" em 05/01/2027.`)).toBeInTheDocument();
  });
});

const ligado = (extra: Partial<CompromissoLigado> = {}): CompromissoLigado => ({
  id: 'c1', codigo: 'C-1', tipo: 'outro', titulo: TITULO, data: '2027-01-05', hora: null, hora_fim: null, pessoa_nome: '', processo_numero: '918000001',
  etapa_id: null, arquivado_em: null, papeis: [], ...extra
});

describe('Validade e anuidades: os compromissos do processo (#418)', () => {
  beforeEach(() => { Object.values(SD).forEach(f => f.mockClear()); });

  it('dado o prazo já na agenda, quando o compromisso sai do processo em outra seção do cartão, então a seção relê e volta a oferecer o atalho', async () => {
    // Dado
    SD.compromissosDoProcesso.mockResolvedValueOnce([ligado()]);
    const { rerender } = montar('pronto', acompanhar({ versaoDoCartao: 0 }));
    expect(await screen.findByText(`O prazo após o deferimento já está na agenda: ${TITULO}, na seção "Compromissos".`)).toBeInTheDocument();
    // Quando: a seção "Compromissos" tirou o compromisso, e o cartão mudou de versão
    rerender(<MemoryRouter><Avisos /><ValidadeDaProtecao prazos={PRAZOS} hoje={HOJE} acompanhar={acompanhar({ versaoDoCartao: 1 })} calendario="pronto" /></MemoryRouter>);
    // Então
    expect(await screen.findByRole('link', { name: /Pôr o prazo na agenda/ })).toBeInTheDocument();
    expect(SD.compromissosDoProcesso).toHaveBeenCalledTimes(2);
  });
});
