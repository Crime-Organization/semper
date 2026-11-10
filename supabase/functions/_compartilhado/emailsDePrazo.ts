// Partes puras dos e-mails de prazo (#113) e dos lembretes (#286), usadas pela função do servidor prazos-enviar-emails.
// Sem Deno e sem rede: dá para testar no app (app/src/regras/emailsDePrazo.test.ts).
import { escapar, molduraDoEmail, paragrafoDoEmail } from './modeloDeEmail.ts';

export type ModuloDoPrazo = 'processos' | 'demandas' | 'tarefas' | 'compromissos';
/** Um prazo, como o banco conta (privado.prazos_da_equipe). `pagina` é o caminho da lista onde o cartão abre. */
export interface ItemDePrazo { modulo: ModuloDoPrazo; pagina: string; cartao_id: string; cartao_codigo: string; titulo: string; data: string; hora: string | null }
export interface ItemDoAviso extends ItemDePrazo { id: string; aviso: 'proximo' | 'hoje' }
/** O e-mail diário de uma pessoa (public.prazos_emails_a_enviar). */
export interface EmailDiario { para: string; nome: string; itens: ItemDoAviso[] }
/** Quantos minutos antes do prazo o lembrete chega (a regra da coluna lembrete em tarefas e demandas, #286). */
export type AntecedenciaDoLembrete = 0 | 30 | 60 | 1440;
export interface ItemDoLembrete extends ItemDePrazo { id: string; aviso: 'lembrete'; antecedencia: AntecedenciaDoLembrete }
/** Os lembretes que chegaram agora para uma pessoa (public.prazos_lembretes_a_enviar). */
export interface EmailDosLembretes { para: string; nome: string; itens: ItemDoLembrete[] }
export interface SecaoDoResumo { total: number; itens: ItemDePrazo[] }
/** O resumo de sexta-feira de uma pessoa (public.prazos_resumos_a_enviar). */
export interface ResumoSemanal { id: string; para: string; nome: string; semana: string; concluidos: number; atrasados: SecaoDoResumo; esta_semana: SecaoDoResumo; proxima_semana: SecaoDoResumo }
export interface MensagemDePrazo { para: string; assunto: string; texto: string; html: string }
/** Cada rotina do banco chama pedindo o seu tipo de e-mail. */
export type TipoDeEnvio = 'diario' | 'resumo' | 'lembrete';
export interface PassosDosEmails {
  diarios(): Promise<EmailDiario[]>;
  resumos(): Promise<ResumoSemanal[]>;
  lembretes(): Promise<EmailDosLembretes[]>;
  enviar(mensagem: MensagemDePrazo): Promise<void>;
  marcarDiario(ids: string[]): Promise<void>;
  marcarResumo(id: string): Promise<void>;
}

/** O endereço do sistema nos links dos e-mails: é o mesmo para todos os escritórios. */
const SITE = 'https://semper.app.br';
/** Quantas pessoas cada chamada atende. A rotina chama de 5 em 5 minutos, e cada chamada precisa caber no tempo máximo da função. */
export const PESSOAS_POR_CHAMADA = 20;
/** Quantos itens o resumo lista em cada seção; os outros entram só na conta. */
export const ITENS_POR_SECAO = 20;
/** Quantos e-mails saem ao mesmo tempo: a caixa de envio é a mesma de todos os escritórios. */
const ENVIOS_AO_MESMO_TEMPO = 5;
/** A hora em que o lembrete conta o prazo sem hora: a mesma de privado.hora_padrao_do_lembrete (migração lembretes_dos_prazos). */
const HORA_PADRAO_DO_LEMBRETE = '09:00';

const NOME_DO_MODULO: Record<ModuloDoPrazo, string> = { processos: 'Prazo de processo', demandas: 'Demanda', tarefas: 'Tarefa', compromissos: 'Compromisso' };

const dataEmTexto = (iso: string) => iso.split('-').reverse().join('/');
const enderecoDoItem = (i: ItemDePrazo) => `${SITE}/${i.pagina}/?id=${encodeURIComponent(i.cartao_id)}`;
const quandoDoPrazo = (i: ItemDePrazo) => `${dataEmTexto(i.data)}${i.hora ? ` às ${i.hora}` : ''}`;
/** Um item no e-mail: o lembrete troca a linha de baixo, para dizer também a antecedência. */
type ItemNoEmail = ItemDePrazo & { detalhe?: string };
const detalheDoItem = (i: ItemNoEmail) => i.detalhe ?? `${NOME_DO_MODULO[i.modulo]} · ${quandoDoPrazo(i)}`;
const ENDERECO_DA_CONTA = `${SITE}/minha-conta/`;
const COMO_DESLIGAR = 'Para deixar de receber este e-mail, desligue-o em Minha conta';

interface Secao { titulo: string; total: number; itens: ItemNoEmail[] }

const secaoEmHtml = ({ titulo, total, itens }: Secao) => `<h2 style="margin:20px 0 4px;font-size:16px;font-weight:900">${escapar(titulo)}</h2>
      <ul style="margin:0 0 8px;padding:0;list-style:none">${itens.map(i => `
        <li style="padding:10px 0;border-top:1px solid #EBEBE6">
          <a href="${escapar(enderecoDoItem(i))}" style="color:#377D22;font-size:16px;font-weight:700">${escapar(i.titulo)}</a><br>
          <span style="font-size:14px;color:#6B6A63">${escapar(detalheDoItem(i))}</span>
        </li>`).join('')}
      </ul>${total > itens.length ? `\n      <p style="margin:0 0 8px;font-size:14px;color:#6B6A63">E mais ${total - itens.length}, no sistema.</p>` : ''}`;

const secaoEmTexto = ({ titulo, total, itens }: Secao) => [
  titulo,
  ...itens.map(i => `- ${i.titulo} (${detalheDoItem(i)}): ${enderecoDoItem(i)}`),
  ...(total > itens.length ? [`E mais ${total - itens.length}, no sistema.`] : [])
].join('\n');

function montar(para: string, assunto: string, chapeu: string, titulo: string, abertura: string[], secoes: Secao[]): MensagemDePrazo {
  const comItens = secoes.filter(s => s.total > 0);
  const html = [...abertura.map(paragrafoDoEmail), ...comItens.map(secaoEmHtml),
    `<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#8A8981">${COMO_DESLIGAR}: <a href="${ENDERECO_DA_CONTA}" style="color:#377D22">${ENDERECO_DA_CONTA}</a></p>`].join('\n      ');
  const texto = [...abertura, ...comItens.map(secaoEmTexto), `${COMO_DESLIGAR}: ${ENDERECO_DA_CONTA}`].join('\n\n');
  return { para, assunto, texto, html: molduraDoEmail(chapeu, titulo, html) };
}

const quantos = (partes: [number, string][]) => partes.filter(([n]) => n > 0).map(([n, nome]) => `${n} ${nome}`).join(', ');

export function emailDiario(e: EmailDiario): MensagemDePrazo {
  const hoje = e.itens.filter(i => i.aviso === 'hoje'), proximos = e.itens.filter(i => i.aviso === 'proximo');
  return montar(e.para, `Prazos: ${quantos([[hoje.length, 'para hoje'], [proximos.length, 'nos próximos dias']])}`, 'Avisos de prazo', 'Seus prazos', [`Olá, ${e.nome}.`], [
    { titulo: 'Para hoje', total: hoje.length, itens: hoje },
    { titulo: 'Nos próximos dias', total: proximos.length, itens: proximos }
  ]);
}

/** As datas de uma semana, a partir da sexta-feira: segunda é 4 dias antes, e domingo é 2 dias depois. */
function diaDaSemana(sexta: string, dias: number) {
  const d = new Date(`${sexta}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const PLURAL_DE_CONCLUIDO: Record<'um' | 'varios', (n: number) => string> = {
  um: () => '1 prazo desta semana foi concluído.',
  varios: n => `${n} prazos desta semana foram concluídos.`
};

export function emailDoResumo(r: ResumoSemanal): MensagemDePrazo {
  const periodo = `Semana de ${dataEmTexto(diaDaSemana(r.semana, -4))} a ${dataEmTexto(diaDaSemana(r.semana, 2))}.`;
  const nadaPendente = !r.atrasados.total && !r.esta_semana.total && !r.proxima_semana.total;
  const conta = quantos([[r.atrasados.total, r.atrasados.total === 1 ? 'atrasado' : 'atrasados'], [r.proxima_semana.total, 'na próxima semana']]);
  return montar(r.para, conta ? `Resumo da semana: ${conta}` : 'Resumo da semana', 'Resumo da semana', 'Sua semana', [
    `Olá, ${r.nome}.`,
    periodo,
    ...(r.concluidos ? [PLURAL_DE_CONCLUIDO[r.concluidos === 1 ? 'um' : 'varios'](r.concluidos)] : []),
    ...(nadaPendente ? ['Você não tem prazos em aberto nesta semana nem na próxima.'] : [])
  ], [
    { titulo: 'Atrasados', ...r.atrasados },
    { titulo: 'Ainda nesta semana', ...r.esta_semana },
    { titulo: 'Na próxima semana', ...r.proxima_semana }
  ]);
}

/** O texto de cada antecedência, o mesmo da escolha do lembrete no cadastro. */
const ANTECEDENCIA_EM_TEXTO: Record<AntecedenciaDoLembrete, string> = {
  0: 'na hora do prazo', 30: '30 minutos antes', 60: '1 hora antes', 1440: '1 dia antes'
};

const detalheDoLembrete = (i: ItemDoLembrete) =>
  `${NOME_DO_MODULO[i.modulo]} · prazo: ${quandoDoPrazo(i)}${i.hora ? '' : ` (sem hora; o lembrete conta o prazo às ${HORA_PADRAO_DO_LEMBRETE})`} · lembrete: ${ANTECEDENCIA_EM_TEXTO[i.antecedencia]}`;

/** Um lembrete só: o assunto e a abertura dizem qual é. Vários (marcados para a mesma hora): o assunto conta. */
const UM_OU_VARIOS: Record<'um' | 'varios', (e: EmailDosLembretes) => { assunto: string; abertura: string }> = {
  um: ({ itens: [i] }) => ({ assunto: `Lembrete: ${i.titulo}`, abertura: `Este é o lembrete que você marcou: o prazo é ${quandoDoPrazo(i)}.` }),
  varios: e => ({ assunto: `Lembretes: ${e.itens.length} prazos`, abertura: 'Estes são os lembretes que você marcou.' })
};

export function emailDoLembrete(e: EmailDosLembretes): MensagemDePrazo {
  const { assunto, abertura } = UM_OU_VARIOS[e.itens.length === 1 ? 'um' : 'varios'](e);
  return montar(e.para, assunto, 'Lembrete de prazo', e.itens.length === 1 ? 'Seu lembrete' : 'Seus lembretes', [`Olá, ${e.nome}.`, abertura], [
    { titulo: 'Lembretes', total: e.itens.length, itens: e.itens.map(i => ({ ...i, detalhe: detalheDoLembrete(i) })) }
  ]);
}

/** Só o código do erro vai para os registros do servidor: a mensagem de um erro de envio pode trazer o endereço de alguém. */
const registrarErro = (etapa: string, e: unknown) => console.error('e-mails de prazo', etapa, (e as { code?: string } | null)?.code ?? 'sem código');

/** Faz cada etapa e diz se deu certo. O erro fica nos registros, sem parar os outros e-mails. */
async function tentar(etapa: string, acao: () => Promise<void>) {
  try {
    await acao();
    return true;
  } catch (e) {
    registrarErro(etapa, e);
    return false;
  }
}

/** Faz cada um, em levas pequenas. Devolve quantos deram certo e quantos falharam. */
async function emLevas<T>(lista: T[], acao: (x: T) => Promise<boolean>) {
  let enviados = 0;
  for (let i = 0; i < lista.length; i += ENVIOS_AO_MESMO_TEMPO) {
    const resultados = await Promise.all(lista.slice(i, i + ENVIOS_AO_MESMO_TEMPO).map(acao));
    enviados += resultados.filter(Boolean).length;
  }
  return { enviados, falhas: lista.length - enviados };
}

/** O que cada rotina envia. Só marca como enviado depois de o e-mail sair: o que falhar volta numa próxima chamada, até o limite de tentativas contado pelo banco. */
const ENVIOS: Record<TipoDeEnvio, (p: PassosDosEmails) => Promise<{ enviados: number; falhas: number }>> = {
  diario: async p => emLevas(await p.diarios(), async e =>
    await tentar('envio', () => p.enviar(emailDiario(e))) && await tentar('marca', () => p.marcarDiario(e.itens.map(i => i.id)))),
  resumo: async p => emLevas(await p.resumos(), async r =>
    await tentar('envio', () => p.enviar(emailDoResumo(r))) && await tentar('marca', () => p.marcarResumo(r.id))),
  // O lembrete é uma mensagem de prazo como o aviso diário: a marca de enviado é a mesma (public.prazos_emails_enviados).
  lembrete: async p => emLevas(await p.lembretes(), async e =>
    await tentar('envio', () => p.enviar(emailDoLembrete(e))) && await tentar('marca', () => p.marcarDiario(e.itens.map(i => i.id))))
};

export const tipoDeEnvioValido = (tipo: unknown): tipo is TipoDeEnvio => typeof tipo === 'string' && Object.keys(ENVIOS).includes(tipo);

/** Envia os e-mails devidos agora, do tipo pedido pela rotina. */
export const enviarEmailsDePrazo = (passos: PassosDosEmails, tipo: TipoDeEnvio) => ENVIOS[tipo](passos);
