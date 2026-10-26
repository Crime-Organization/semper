import { describe, expect, it } from 'vitest';
import type { Pessoa } from '../dados/tipos';
import { cabecalhoGoogle, csvContatosGoogle, telefoneGoogle } from './contatosGoogle';

const pessoa = (campos: Partial<Pessoa>) => ({ id: 'p1', codigo: 'P1', tipo: 'pf', nome: 'MARIA TESTE', telefones: [], emails: [], resp: [], ...campos }) as Pessoa;
// Lê o CSV de volta (aspas, vírgulas e quebras de linha dentro do campo).
function ler(csv: string) {
  const linhas: string[][] = []; let campo = '', linha: string[] = [], aspas = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (aspas) { if (c === '"') { if (csv[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; }
    else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo.replace(/\r$/, '')); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  const [cab, ...dados] = linhas;
  return dados.map(l => Object.fromEntries(cab.map((k, i) => [k, l[i]])));
}

describe('contatos para o Google', () => {
  it('põe os telefones no formato do Google e corrige o 9 dos celulares antigos', () => {
    expect(telefoneGoogle('(38) 99999-1234')).toBe('+55 38 99999-1234');
    expect(telefoneGoogle('38 3222-1111')).toBe('+55 38 3222-1111');
    expect(telefoneGoogle('(38) 9999-1234')).toBe('+55 38 99999-1234');
    expect(telefoneGoogle('(038) 99999-1234')).toBe('+55 38 99999-1234');
    expect(telefoneGoogle('5538999991234')).toBe('+55 38 99999-1234');
    expect(telefoneGoogle('99999-1234')).toBe('99999-1234');
    expect(telefoneGoogle('+1 415 555 0100')).toBe('+1 415 555 0100');
  });

  it('usa as colunas do Google e acrescenta as que faltarem', () => {
    expect(cabecalhoGoogle()).toHaveLength(44);
    const csv = csvContatosGoogle([pessoa({ telefones: ['38999990001', '38999990002', '38999990003', '38999990004'] })], { comQualificacao: false });
    const [c] = ler(csv);
    expect(c['Phone 4 - Value']).toBe('+55 38 99999-0004');
    expect(c['Phone 1 - Label']).toBe('Mobile');
    expect(c.Labels).toBe('* myContacts');
  });

  it('leva a qualificação na descrição só quando pedido, e o aniversário da pessoa', () => {
    const p = pessoa({ nascimento: '1980-05-10', documento: '52998224725', emails: ['Maria@Exemplo.com'], telefones: ['(38) 3222-1111'] });
    const [com] = ler(csvContatosGoogle([p], { comQualificacao: true }));
    const [sem] = ler(csvContatosGoogle([p], { comQualificacao: false }));
    expect(com.Notes).toContain('MARIA TESTE');
    expect(com.Notes).toContain('529.982.247-25');
    expect(sem.Notes).toBe('');
    expect(com.Birthday).toBe('1980-05-10');
    expect(com['E-mail 1 - Value']).toBe('maria@exemplo.com');
    expect(com['Phone 1 - Label']).toBe('');
  });

  it('pessoa jurídica faz aniversário na data de criação', () => {
    const [c] = ler(csvContatosGoogle([pessoa({ tipo: 'pj', nome: 'PADARIA, PÃES & CIA "BOA"', abertura: '2010-03-01', nascimento: null })], { comQualificacao: false }));
    expect(c.Birthday).toBe('2010-03-01');
    expect(c['First Name']).toBe('PADARIA, PÃES & CIA "BOA"');
  });
});
