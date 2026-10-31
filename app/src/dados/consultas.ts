// Consultas a serviços de fora do SEMPER: CNPJ na Receita (publica.cnpj.ws) e CEP (BrasilAPI, com o ViaCEP de reserva).
// Aqui fica só a conversa com a internet e os erros em português; a conversão das respostas está em regras/pessoa.ts.
import { deBrasilAPI, deCNPJws, deViaCEP, dig, limparDocumento, type RespostaBrasilAPI, type RespostaCNPJws, type RespostaViaCEP } from '../regras/pessoa';

export async function consultarCNPJ(cnpj: string) {
  const d = limparDocumento(cnpj);
  const r = await fetch(`https://publica.cnpj.ws/cnpj/${d}`);
  if (r.status === 404) throw new Error('CNPJ não encontrado na Receita.');
  if (r.status === 429) throw new Error('Muitas consultas seguidas. Aguarde um minuto e tente de novo.');
  if (!r.ok) throw new Error('Não foi possível consultar o CNPJ agora.');
  const data = await r.json() as RespostaCNPJws;
  if (!data || !data.razao_social) throw new Error('CNPJ não encontrado na Receita.');
  return deCNPJws(data);
}

export async function consultarCEP(cep: string) {
  const d = dig(cep);
  if (d.length !== 8) throw new Error('O CEP tem 8 dígitos.');
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${d}`);
    if (r.ok) return deBrasilAPI(await r.json() as RespostaBrasilAPI);
  } catch { /* tenta a reserva */ }
  let x: RespostaViaCEP | null;
  try { x = await (await fetch(`https://viacep.com.br/ws/${d}/json/`)).json() as RespostaViaCEP | null; }
  catch { throw new Error('Não foi possível consultar o CEP agora. Preencha o endereço manualmente.'); }
  if (!x || x.erro) throw new Error('CEP não encontrado. Confira o número ou preencha manualmente.');
  return deViaCEP(x);
}
