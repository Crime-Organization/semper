// Estilo dos botões do SEMPER (veja DESIGN.md): a classe certa para <button>, <Link>, Botao e BotaoDuplo.
// Forma: "botao" (o normal, .btn), "mini" (pequeno e discreto, .mini), "icone" (o mini redondo, só com o ícone, nas ações de cada
// linha de uma lista, #423; veja BotaoDeIcone) ou "link" (parece um link, .link).
// Variante: "principal" (verde, uma por área da tela), "escuro" ou "perigo" (excluir, desativar).
export type FormaBotao = 'botao' | 'mini' | 'icone' | 'link';
export type VarianteBotao = 'padrao' | 'principal' | 'escuro' | 'perigo';
export interface EstiloBotao { forma?: FormaBotao; variante?: VarianteBotao; pequeno?: boolean }

const FORMA: Record<FormaBotao, string> = { botao: 'btn', mini: 'mini', icone: 'mini so-icone', link: 'link' };
const VARIANTE: Record<VarianteBotao, string> = { padrao: '', principal: 'pri', escuro: 'esc', perigo: 'perigo' };

/** Classes do botão; "extra" acrescenta classes próprias da tela (ex.: "acao-copiar"). */
export function estiloBotao({ forma = 'botao', variante = 'padrao', pequeno = false }: EstiloBotao = {}, extra?: string) {
  return [FORMA[forma], VARIANTE[variante], pequeno && forma === 'botao' ? 'btn-sm' : '', extra].filter(Boolean).join(' ');
}
