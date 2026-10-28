// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
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

describe('Exportar contatos para o Google', () => {
  describe('Dado um telefone do cadastro', () => {
    it.each([
      ['(38) 99999-1234', '+55 38 99999-1234'],
      ['38 3222-1111', '+55 38 3222-1111'],
      ['(38) 9999-1234', '+55 38 99999-1234'],
      ['(038) 99999-1234', '+55 38 99999-1234'],
      ['5538999991234', '+55 38 99999-1234'],
      ['99999-1234', '99999-1234'],
      ['+1 415 555 0100', '+1 415 555 0100']
    ])('quando o telefone é "%s", então vai para o Google como "%s"', (telefone, esperado) => {
      // Quando
      const google = telefoneGoogle(telefone);
      // Então
      expect(google).toBe(esperado);
    });
  });

  it('quando o arquivo é gerado, então tem as 44 colunas do Google', () => {
    // Quando
    const colunas = cabecalhoGoogle();
    // Então
    expect(colunas).toHaveLength(44);
  });

  describe('Dada uma pessoa com quatro telefones', () => {
    const gerar = () => ler(csvContatosGoogle([pessoa({ telefones: ['38999990001', '38999990002', '38999990003', '38999990004'] })], { comQualificacao: false }))[0];

    it('quando o arquivo é gerado, então o quarto telefone ganha a coluna "Phone 4"', () => {
      // Quando
      const c = gerar();
      // Então
      expect(c['Phone 4 - Value']).toBe('+55 38 99999-0004');
    });

    it('quando o arquivo é gerado, então o celular leva o rótulo "Mobile"', () => {
      // Quando
      const c = gerar();
      // Então
      expect(c['Phone 1 - Label']).toBe('Mobile');
    });

    it('quando o arquivo é gerado, então o contato entra no grupo "myContacts"', () => {
      // Quando
      const c = gerar();
      // Então
      expect(c.Labels).toBe('* myContacts');
    });
  });

  describe('Dada uma pessoa física com nascimento, CPF, e-mail e telefone fixo', () => {
    const p = pessoa({ nascimento: '1980-05-10', documento: '52998224725', emails: ['Maria@Exemplo.com'], telefones: ['(38) 3222-1111'] });
    const gerar = (comQualificacao: boolean) => ler(csvContatosGoogle([p], { comQualificacao }))[0];

    it('quando a qualificação é pedida, então ela vai nas notas com o nome e o CPF', () => {
      // Quando
      const com = gerar(true);
      // Então
      expect(com.Notes).toContain('MARIA TESTE');
      expect(com.Notes).toContain('529.982.247-25');
    });

    it('quando a qualificação não é pedida, então as notas ficam vazias', () => {
      // Quando
      const sem = gerar(false);
      // Então
      expect(sem.Notes).toBe('');
    });

    it('quando o arquivo é gerado, então o aniversário é o nascimento', () => {
      // Quando
      const com = gerar(true);
      // Então
      expect(com.Birthday).toBe('1980-05-10');
    });

    it('quando o arquivo é gerado, então o e-mail vai em minúsculas', () => {
      // Quando
      const com = gerar(true);
      // Então
      expect(com['E-mail 1 - Value']).toBe('maria@exemplo.com');
    });

    it('quando o telefone é fixo, então fica sem o rótulo de celular', () => {
      // Quando
      const com = gerar(true);
      // Então
      expect(com['Phone 1 - Label']).toBe('');
    });
  });

  describe('Dada uma pessoa jurídica com vírgula, & e aspas no nome', () => {
    const gerar = () => ler(csvContatosGoogle([pessoa({ tipo: 'pj', nome: 'PADARIA, PÃES & CIA "BOA"', abertura: '2010-03-01', nascimento: null })], { comQualificacao: false }))[0];

    it('quando o arquivo é gerado, então o aniversário é a data de criação', () => {
      // Quando
      const c = gerar();
      // Então
      expect(c.Birthday).toBe('2010-03-01');
    });

    it('quando o arquivo é gerado e lido de volta, então o nome sai intacto', () => {
      // Quando
      const c = gerar();
      // Então
      expect(c['First Name']).toBe('PADARIA, PÃES & CIA "BOA"');
    });
  });
});
