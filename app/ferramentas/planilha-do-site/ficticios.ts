// Linhas fictícias para os testes do conversor, montadas no código (nada de arquivo de exemplo, nada de dado real).
import type { ArquivoGoogle, ColunaDoSite, LinhaDoSite } from './planilhas';

/** Documentos válidos e fictícios. */
export const CPF = '52998224725', CPF_2 = '11144477735', CPF_3 = '30000000035';
/** CPF que começa com zeros: a planilha o mostra sem eles ("100791905"). */
export const CPF_COM_ZERO = '00100791905';
export const CNPJ = '11222333000181', CNPJ_COM_LETRAS = '12ABC34501DE35';

/** Uma linha da planilha do site; o tipo, se não for dado, é pessoa física. */
export const site = (linha: number, valores: Partial<Record<ColunaDoSite, string>>): LinhaDoSite =>
  ({ linha, valores: { tipo: 'Pessoa Física', ...valores } });

export const CABECALHO_GOOGLE = ['First Name', 'Middle Name', 'Last Name', 'Notes', 'Birthday', 'Labels', 'E-mail 1 - Value', 'Phone 1 - Value'];
export interface ContatoFicticio { linha: number; nome: string; telefone?: string; email?: string; notas?: string; aniversario?: string }

/** Uma exportação do Google Contatos com os contatos dados. */
export const google = (arquivo: string, contatos: ContatoFicticio[]): ArquivoGoogle => ({
  arquivo, cabecalho: CABECALHO_GOOGLE,
  contatos: contatos.map(c => ({
    linha: c.linha,
    campos: {
      'First Name': c.nome, 'Middle Name': '', 'Last Name': '', Notes: c.notas ?? '', Birthday: c.aniversario ?? '',
      Labels: '* myContacts', 'E-mail 1 - Value': c.email ?? '', 'Phone 1 - Value': c.telefone ?? ''
    }
  }))
});
