// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A primeira sincronização com o Google Contatos (#164, etapa 2): quais contatos da conta são pessoas do SEMPER,
// em supabase/functions/_compartilhado/correspondenciaDeContatos.ts.
import { describe, expect, it } from 'vitest';
import {
  CANDIDATOS_PARA_CONFERIR, CASOS_DO_INDICIO, corresponder, emailComparavel, forcaDoIndicio, MARCA_DO_SEMPER, nomeComparavel, semelhancaDoNome,
  telefoneComparavel, type ContatoDaConta, type Indicio, type PessoaDoEscritorio
} from '../../../supabase/functions/_compartilhado/correspondenciaDeContatos';

const pessoa = (id: string, campos: Partial<PessoaDoEscritorio> = {}): PessoaDoEscritorio => ({
  id, tipo: 'pf', nome: 'MARIA JOSÉ TESTE', telefones: [], emails: [], nascimento: null, abertura: null, recurso: null, ...campos
});
const contato = (recurso: string, campos: Omit<Partial<ContatoDaConta>, 'names'> & { nome?: string } = {}): ContatoDaConta => {
  const { nome, ...resto } = campos;
  return { resourceName: `people/${recurso}`, etag: `etag-${recurso}`, ...(nome ? { names: [{ displayName: nome }] } : {}), ...resto };
};
const tel = (...v: string[]) => ({ phoneNumbers: v.map(value => ({ value })) });
const mail = (...v: string[]) => ({ emailAddresses: v.map(value => ({ value })) });
const aniversario = (date: { year?: number; month: number; day: number }) => ({ birthdays: [{ date }] });

describe('como cada dado é comparado', () => {
  it.each([
    ['(38) 99999-1234', '38999991234'],
    ['+55 38 99999-1234', '38999991234'],
    ['038 99999-1234', '38999991234'],
    ['38 9999-1234', '38999991234'],
    ['(38) 3222-1111', '3832221111'],
    ['+1 650 253 0000', '+16502530000'],
    ['99999-1234', null],
    ['', null]
  ])('dado o telefone %s, quando é comparado, então vale %s', (entrada, esperado) => {
    // Quando / Então
    expect(telefoneComparavel(entrada)).toBe(esperado);
  });

  it('dado um e-mail com maiúsculas e espaços, quando é comparado, então fica em minúsculas e sem espaços; sem @, não serve', () => {
    // Quando / Então
    expect(emailComparavel('  Maria@Exemplo.COM ')).toBe('maria@exemplo.com');
    expect(emailComparavel('sem arroba')).toBeNull();
  });

  it('dado um nome com acento, minúsculas e pontuação, quando é comparado, então fica sem acento, em maiúsculas e só com letras e números', () => {
    // Quando / Então
    expect(nomeComparavel('  José   da Silva-Júnior, ')).toBe('JOSE DA SILVA JUNIOR');
  });

  it.each([
    ['MARIA JOSE TESTE', 'MARIA JOSE TESTE', 'igual'],
    ['MARIA TESTE', 'MARIA JOSE TESTE', 'contido'],
    ['MARIA JOSE TESTE CLIENTE', 'MARIA DE JOSE TESTE', 'contido'],
    ['MARIA', 'MARIA JOSE TESTE', 'contido'],
    ['JOAO TESTE', 'MARIA JOSE TESTE', null],
    ['', 'MARIA', null]
  ])('dados os nomes "%s" e "%s", quando comparados, então a semelhança é %s', (a, b, esperado) => {
    // Quando / Então
    expect(semelhancaDoNome(a, b)).toBe(esperado);
  });
});

describe('a tabela de casos dos indícios', () => {
  const indicio = (campos: Partial<Indicio>): Indicio => ({ telefone: false, email: false, nome: null, nomeCompleto: true, aniversario: null, ...campos });

  it.each<[string, Partial<Indicio>, string]>([
    ['nome e telefone', { nome: 'igual', telefone: true }, 'certo'],
    ['nome contido e telefone', { nome: 'contido', telefone: true }, 'certo'],
    ['nome e e-mail', { nome: 'contido', email: true }, 'certo'],
    ['nome e telefone, aniversário diferente', { nome: 'igual', telefone: true, aniversario: 'diferente' }, 'conflito'],
    ['telefone com outro nome', { telefone: true }, 'conflito'],
    ['só o e-mail (nunca conta sozinho)', { email: true }, 'nenhuma'],
    ['nome completo e o mesmo aniversário', { nome: 'igual', aniversario: 'igual' }, 'certo'],
    ['só o nome completo', { nome: 'igual' }, 'so-nome'],
    ['só o nome, com aniversário diferente (homônimos)', { nome: 'igual', aniversario: 'diferente' }, 'nenhuma'],
    ['só o nome de uma palavra', { nome: 'igual', nomeCompleto: false }, 'nenhuma'],
    ['só o nome contido', { nome: 'contido' }, 'nenhuma'],
    ['nada', {}, 'nenhuma']
  ])('dado %s, quando a força é medida, então é %s', (_, campos, esperado) => {
    // Quando / Então
    expect(forcaDoIndicio(indicio(campos))).toBe(esperado);
  });

  it('então a última linha da tabela vale para tudo (nenhum indício fica sem força)', () => {
    // Então
    expect(CASOS_DO_INDICIO.at(-1)!.vale(indicio({}))).toBe(true);
  });
});

describe('corresponder', () => {
  it('dado um contato com o mesmo telefone e o mesmo nome (sem acento, em outra caixa), quando corresponde, então liga o contato à pessoa', () => {
    // Dado
    const pessoas = [pessoa('p1', { telefones: ['(38) 99999-1234'] })];
    // Quando
    const r = corresponder([contato('c1', { nome: 'Maria Jose Teste', ...tel('+55 38 99999-1234') })], pessoas);
    // Então
    expect(r).toEqual({ ligar: [{ pessoa_id: 'p1', recurso: 'people/c1', etag: 'etag-c1' }], conferir: [], semCorrespondencia: 0 });
  });

  it('dado um contato com o nome e o e-mail da pessoa, quando corresponde, então liga', () => {
    // Quando
    const r = corresponder([contato('c1', { nome: 'Maria Teste', ...mail('MARIA@exemplo.com') })], [pessoa('p1', { emails: ['maria@exemplo.com'] })]);
    // Então
    expect(r.ligar).toEqual([{ pessoa_id: 'p1', recurso: 'people/c1', etag: 'etag-c1' }]);
  });

  it('dado um contato só com o e-mail de várias empresas (a contabilidade), quando corresponde, então não liga nem sugere ninguém', () => {
    // Dado
    const pessoas = [pessoa('p1', { tipo: 'pj', nome: 'EMPRESA UM LTDA', emails: ['contabil@exemplo.com'] }),
      pessoa('p2', { tipo: 'pj', nome: 'EMPRESA DOIS LTDA', emails: ['contabil@exemplo.com'] })];
    // Quando
    const r = corresponder([contato('c1', { nome: 'Contador Fulano', ...mail('contabil@exemplo.com') })], pessoas);
    // Então
    expect(r).toEqual({ ligar: [], conferir: [], semCorrespondencia: 1 });
  });

  it('dado um contato com o telefone da pessoa e outro nome, quando corresponde, então vai para conferir como conflito, com os dados do Google', () => {
    // Quando
    const r = corresponder([contato('c1', { nome: 'Filho da Maria', ...tel('38 99999-1234'), ...mail('filho@exemplo.com'), ...aniversario({ month: 3, day: 9 }) })],
      [pessoa('p1', { telefones: ['38999991234'] })]);
    // Então
    expect(r.ligar).toEqual([]);
    expect(r.conferir).toEqual([{ recurso: 'people/c1', etag: 'etag-c1', nome: 'Filho da Maria', telefones: ['38 99999-1234'], emails: ['filho@exemplo.com'],
      aniversario: '03-09', motivo: 'conflito', candidatos: ['p1'] }]);
  });

  it('dado um contato só com o nome completo de uma pessoa, quando corresponde, então vai para conferir como "só o nome"', () => {
    // Quando
    const r = corresponder([contato('c1', { nome: 'Maria José Teste' })], [pessoa('p1')]);
    // Então
    expect(r.conferir.map(c => [c.motivo, c.candidatos])).toEqual([['so-nome', ['p1']]]);
  });

  it('dado um contato com o nome e o aniversário da pessoa, quando corresponde, então liga; com aniversário diferente, não sugere ninguém', () => {
    // Dado
    const pessoas = [pessoa('p1', { nascimento: '1980-05-17' })];
    // Quando
    const igual = corresponder([contato('c1', { nome: 'Maria José Teste', ...aniversario({ year: 1980, month: 5, day: 17 }) })], pessoas);
    const semAno = corresponder([contato('c1', { nome: 'Maria José Teste', ...aniversario({ month: 5, day: 17 }) })], pessoas);
    const outro = corresponder([contato('c1', { nome: 'Maria José Teste', ...aniversario({ year: 1990, month: 1, day: 2 }) })], pessoas);
    // Então
    expect(igual.ligar.map(l => l.pessoa_id)).toEqual(['p1']);
    expect(semAno.ligar.map(l => l.pessoa_id)).toEqual(['p1']);
    expect(outro).toEqual({ ligar: [], conferir: [], semCorrespondencia: 1 });
  });

  it('dada uma empresa, quando o aniversário é comparado, então vale a data de abertura', () => {
    // Dado
    const empresa = pessoa('p1', { tipo: 'pj', nome: 'PADARIA EXEMPLO LTDA', telefones: ['3832221111'], abertura: '2001-02-03', nascimento: null });
    // Quando
    const r = corresponder([contato('c1', { nome: 'Padaria Exemplo', ...tel('3832221111'), ...aniversario({ year: 2001, month: 2, day: 4 }) })], [empresa]);
    // Então
    expect(r.conferir.map(c => c.motivo)).toEqual(['conflito']);
  });

  it('dado um contato com o mesmo telefone de duas pessoas com o mesmo nome, quando corresponde, então vai para conferir com as duas', () => {
    // Dado
    const pessoas = [pessoa('p1', { telefones: ['38999991234'] }), pessoa('p2', { telefones: ['38999991234'] })];
    // Quando
    const r = corresponder([contato('c1', { nome: 'Maria José Teste', ...tel('38999991234') })], pessoas);
    // Então
    expect(r.conferir.map(c => [c.motivo, c.candidatos])).toEqual([['varios', ['p1', 'p2']]]);
  });

  it('dado um telefone da equipe em várias pessoas, quando um contato o tem com outro nome, então vai para conferir com todas (até o limite)', () => {
    // Dado
    const pessoas = Array.from({ length: CANDIDATOS_PARA_CONFERIR + 3 }, (_, i) => pessoa(`p${i}`, { nome: `PESSOA ${i} TESTE`, telefones: ['3832220000'] }));
    // Quando
    const r = corresponder([contato('c1', { nome: 'Recepção', ...tel('(38) 3222-0000') })], pessoas);
    // Então
    expect(r.conferir).toHaveLength(1);
    expect(r.conferir[0]).toMatchObject({ motivo: 'varios' });
    expect(r.conferir[0].candidatos).toHaveLength(CANDIDATOS_PARA_CONFERIR);
  });

  it('dado um contato certo para uma pessoa e duvidoso para outra, quando corresponde, então liga à certa', () => {
    // Dado
    const pessoas = [pessoa('p1', { telefones: ['38999991234'] }), pessoa('p2', { nome: 'JOAO TESTE', telefones: ['38999991234'] })];
    // Quando
    const r = corresponder([contato('c1', { nome: 'Maria José Teste', ...tel('38999991234') })], pessoas);
    // Então
    expect(r.ligar.map(l => l.pessoa_id)).toEqual(['p1']);
    expect(r.conferir).toEqual([]);
  });

  it('dado o contato que o próprio SEMPER criou (com a marca), quando corresponde, então liga à pessoa da marca, mesmo com outro nome', () => {
    // Quando
    const r = corresponder([contato('c1', { nome: 'Outro Nome', clientData: [{ key: MARCA_DO_SEMPER, value: 'p1' }] })], [pessoa('p1')]);
    // Então
    expect(r.ligar.map(l => l.pessoa_id)).toEqual(['p1']);
  });

  it('dados dois contatos certos para a mesma pessoa (repetidos no Google), quando corresponde, então liga um e manda o outro conferir', () => {
    // Dado
    const pessoas = [pessoa('p1', { telefones: ['38999991234'] })];
    const repetidos = [contato('c1', { nome: 'Maria Teste', ...tel('38999991234') }), contato('c2', { nome: 'Maria José Teste', ...tel('38999991234') })];
    // Quando
    const r = corresponder(repetidos, pessoas);
    // Então
    expect(r.ligar.map(l => l.recurso)).toEqual(['people/c1']);
    expect(r.conferir.map(c => [c.recurso, c.motivo, c.candidatos])).toEqual([['people/c2', 'repetido', ['p1']]]);
  });

  it('dados dois contatos repetidos, um deles criado pelo SEMPER, quando corresponde, então o do SEMPER é o ligado', () => {
    // Dado
    const repetidos = [contato('c1', { nome: 'Maria José Teste', ...tel('38999991234') }),
      contato('c2', { nome: 'MARIA JOSÉ TESTE', ...tel('38999991234'), clientData: [{ key: MARCA_DO_SEMPER, value: 'p1' }] })];
    // Quando
    const r = corresponder(repetidos, [pessoa('p1', { telefones: ['38999991234'] })]);
    // Então
    expect(r.ligar.map(l => l.recurso)).toEqual(['people/c2']);
    expect(r.conferir.map(c => [c.recurso, c.motivo])).toEqual([['people/c1', 'repetido']]);
  });

  it('dada uma pessoa já ligada a um contato nesta conta, quando corresponde, então esse contato fica de fora e outro igual vai para conferir', () => {
    // Dado
    const pessoas = [pessoa('p1', { telefones: ['38999991234'], recurso: 'people/c1' })];
    // Quando
    const r = corresponder([contato('c1', { nome: 'Maria José Teste', ...tel('38999991234') }), contato('c2', { nome: 'Maria José Teste', ...tel('38999991234') })], pessoas);
    // Então
    expect(r.ligar).toEqual([]);
    expect(r.conferir.map(c => [c.recurso, c.motivo])).toEqual([['people/c2', 'repetido']]);
  });

  it('dados contatos apagados ou de ninguém, quando corresponde, então ficam de fora (os de ninguém são contados)', () => {
    // Quando
    const r = corresponder([contato('c1', { nome: 'Maria José Teste', metadata: { deleted: true } }), contato('c2', { nome: 'Ninguém Daqui' }), contato('c3')], [pessoa('p1')]);
    // Então
    expect(r).toEqual({ ligar: [], conferir: [], semCorrespondencia: 2 });
  });
});
