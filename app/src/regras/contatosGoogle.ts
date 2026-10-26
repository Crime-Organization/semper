// Pessoas no formato do Google Contatos: o mesmo CSV que o Google exporta e aceita em "Importar".
// Nome, telefones, e-mails, aniversário e, se pedido, a qualificação na descrição.
import type { Pessoa } from '../dados/tipos';
import { dig, qualificacao, type Representante } from './pessoa';

// Colunas na ordem em que o Google exporta. Telefones e e-mails ganham colunas (Phone 4, 5…) quando alguém tem mais de 3.
const ANTES = ['First Name', 'Middle Name', 'Last Name', 'Phonetic First Name', 'Phonetic Middle Name', 'Phonetic Last Name',
  'Name Prefix', 'Name Suffix', 'Nickname', 'File As', 'Organization Name', 'Organization Title', 'Organization Department',
  'Birthday', 'Notes', 'Photo', 'Labels'];
const DEPOIS = ['Address 1 - Label', 'Address 1 - Formatted', 'Address 1 - Street', 'Address 1 - City', 'Address 1 - PO Box',
  'Address 1 - Region', 'Address 1 - Postal Code', 'Address 1 - Country', 'Address 1 - Extended Address', 'Website 1 - Label',
  'Website 1 - Value', 'Custom Field 1 - Label', 'Custom Field 1 - Value', 'Custom Field 2 - Label', 'Custom Field 2 - Value'];

export function cabecalhoGoogle(telefones = 3, emails = 3) {
  const grupo = (nome: string, n: number) => Array.from({ length: Math.max(3, n) }, (_, i) => [`${nome} ${i + 1} - Label`, `${nome} ${i + 1} - Value`]).flat();
  return [...ANTES, ...grupo('E-mail', emails), ...grupo('Phone', telefones), ...DEPOIS];
}

/** Número no formato que o Google reconhece (+55 38 99999-9999). Tira o 0 antes do DDD e põe o 9 nos
 *  celulares antigos de 8 dígitos; número estrangeiro, sem DDD ou incompleto vai como foi digitado. */
export function telefoneGoogle(v: string) {
  const original = String(v || '').trim();
  if (/^\+/.test(original) && !/^\+\s*55/.test(original)) return original;
  let d = dig(original);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  else if ((d.length === 11 || d.length === 12) && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10 && /[6-9]/.test(d[2])) d = d.slice(0, 2) + '9' + d.slice(2);
  if (d.length === 11 && d[2] === '9') return `+55 ${d.slice(0, 2)} ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10 && /[2-5]/.test(d[2])) return `+55 ${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}`;
  return original;
}

const celular = (t: string) => /^\+55 \d{2} 9\d{4}-\d{4}$/.test(t);
// Aniversário do contato: nascimento (pessoa física) ou data de criação (pessoa jurídica), como na planilha do escritório.
const aniversario = (p: Pessoa) => (p.tipo === 'pj' ? p.abertura : p.nascimento) || '';
const campo = (v: string) => /[",\r\n]|^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

/** representantes: por id da pessoa jurídica, quem a representa (entra na qualificação dela). */
export function csvContatosGoogle(pessoas: Pessoa[], { comQualificacao, representantes = {} }: { comQualificacao: boolean; representantes?: Record<string, Representante[]> }) {
  const contatos = pessoas.map(p => ({
    p,
    telefones: [...new Set((p.telefones || []).map(telefoneGoogle).filter(Boolean))],
    emails: [...new Set((p.emails || []).map(e => e.trim().toLowerCase()).filter(Boolean))]
  }));
  const cab = cabecalhoGoogle(Math.max(0, ...contatos.map(c => c.telefones.length)), Math.max(0, ...contatos.map(c => c.emails.length)));
  const linhas = contatos.map(({ p, telefones, emails }) => {
    const v: Record<string, string> = {
      'First Name': p.nome, Birthday: aniversario(p), Labels: '* myContacts',
      Notes: comQualificacao ? qualificacao(p, { representantes: representantes[p.id] }) : ''
    };
    telefones.forEach((t, i) => { v[`Phone ${i + 1} - Label`] = celular(t) ? 'Mobile' : ''; v[`Phone ${i + 1} - Value`] = t; });
    emails.forEach((e, i) => { v[`E-mail ${i + 1} - Value`] = e; });
    return cab.map(k => campo(v[k] || '')).join(',');
  });
  return [cab.join(','), ...linhas].join('\r\n') + '\r\n';
}
