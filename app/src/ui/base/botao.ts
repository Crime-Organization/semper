// Estilo dos botões do SEMPER (veja DESIGN.md): a classe certa para <button>, <Link>, Botao e BotaoDuplo.
// Forma: "botao" (o normal, .btn), "mini" (pequeno e discreto, .mini) ou "link" (parece um link, .link).
// Variante: "principal" (verde, uma por área da tela), "escuro" ou "perigo" (excluir, desativar).
export type FormaBotao = 'botao' | 'mini' | 'link';
export type VarianteBotao = 'padrao' | 'principal' | 'escuro' | 'perigo';
export interface EstiloBotao { forma?: FormaBotao; variante?: VarianteBotao; pequeno?: boolean }

const FORMA: Record<FormaBotao, string> = { botao: 'btn', mini: 'mini', link: 'link' };
const VARIANTE: Record<VarianteBotao, string> = { padrao: '', principal: 'pri', escuro: 'esc', perigo: 'perigo' };

/** Classes do botão; "extra" acrescenta classes próprias da tela (ex.: "acao-copiar"). */
export function estiloBotao({ forma = 'botao', variante = 'padrao', pequeno = false }: EstiloBotao = {}, extra?: string) {
  return [FORMA[forma], VARIANTE[variante], pequeno && forma === 'botao' ? 'btn-sm' : '', extra].filter(Boolean).join(' ');
}
