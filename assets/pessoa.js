// Regras de cadastro de pessoas: listas do formulário, formatos, validação e qualificação.
// Não depende do banco: serve ao formulário, ao cartão e às listagens.
(function () {
  const TIPOS = { pf: 'Pessoa física', pj: 'Pessoa jurídica', contato: 'Somente contato' };

  const NATUREZAS = {
    empresarial: 'Entidades empresariais',
    publica: 'Administração pública',
    sem_fins: 'Entidades sem fins lucrativos'
  };

  // Tipos de entidade conforme a tabela de naturezas jurídicas da Receita (iguais ao formulário do site).
  const ENTIDADES = {
    empresarial: ['Clube/Fundo de Investimento', 'Consórcio de Empregadores', 'Consórcio de Sociedades', 'Consórcio Simples',
      'Cooperativa', 'Cooperativas de Consumo', 'Empresa Binacional', 'Empresa Domiciliada no Exterior',
      'Empresa Individual de Responsabilidade Limitada (de Natureza Empresária)',
      'Empresa Individual de Responsabilidade Limitada (de Natureza Simples)', 'Empresa Pública',
      'Empresa Simples de Inovação', 'Empresário(a) Individual',
      'Estabelecimento, no Brasil, de Empresa Binacional Argentino-Brasileira',
      'Estabelecimento, no Brasil, de Sociedade Estrangeira', 'Grupo de Sociedades',
      'Microempreendedor(a) Individual (MEI)', 'Investidor Não Residente', 'Sociedade Anônima Aberta',
      'Sociedade Anônima Fechada', 'Sociedade de Economia Mista', 'Sociedade em Conta de Participação',
      'Sociedade Empresária em Comandita por Ações', 'Sociedade Empresária em Comandita Simples',
      'Sociedade Empresária em Nome Coletivo', 'Sociedade Empresária Limitada', 'Sociedade Simples em Comandita Simples',
      'Sociedade Simples em Nome Coletivo', 'Sociedade Simples Limitada', 'Sociedade Simples Pura',
      'Sociedade Unipessoal de Advogados'],
    publica: ['Autarquia Estadual ou do Distrito Federal', 'Autarquia Federal', 'Autarquia Municipal', 'Comissão Polinacional',
      'Consórcio Público de Direito Privado', 'Consórcio Público de Direito Público (Associação Pública)',
      'Estado ou Distrito Federal', 'Fundação Pública de Direito Privado Estadual ou do Distrito Federal',
      'Fundação Pública de Direito Privado Federal', 'Fundação Pública de Direito Privado Municipal',
      'Fundação Pública de Direito Público Estadual ou do Distrito Federal', 'Fundação Pública de Direito Público Federal',
      'Fundação Pública de Direito Público Municipal', 'Fundo Público da Administração Direta Estadual ou do Distrito Federal',
      'Fundo Público da Administração Direta Federal', 'Fundo Público da Administração Direta Municipal',
      'Fundo Público da Administração Indireta Estadual ou do Distrito Federal', 'Fundo Público da Administração Indireta Federal',
      'Fundo Público da Administração Indireta Municipal', 'Município', 'Órgão Público Autônomo Estadual ou do Distrito Federal',
      'Órgão Público Autônomo Federal', 'Órgão Público Autônomo Municipal',
      'Órgão Público do Poder Executivo Estadual ou do Distrito Federal', 'Órgão Público do Poder Executivo Federal',
      'Órgão Público do Poder Executivo Municipal', 'Órgão Público do Poder Judiciário Estadual',
      'Órgão Público do Poder Judiciário Federal', 'Órgão Público do Poder Legislativo Estadual ou do Distrito Federal',
      'Órgão Público do Poder Legislativo Federal', 'Órgão Público do Poder Legislativo Municipal', 'União'],
    sem_fins: ['Associação Privada', 'Comissão de Conciliação Prévia', 'Comitê Financeiro de Partido Político', 'Comunidade Indígena',
      'Condomínio Edilício', 'Demais Condomínios', 'Entidade de Mediação e Arbitragem', 'Entidade Sindical',
      'Estabelecimento, no Brasil, de Fundação ou Associação Estrangeiras', 'Frente Plebiscitária ou Referendária',
      'Fundação ou Associação Domiciliada no Exterior', 'Fundação Privada', 'Fundo Privado', 'Organização Religiosa',
      'Organização Social (OS)', 'Órgão de Direção Local de Partido Político', 'Órgão de Direção Nacional de Partido Político',
      'Órgão de Direção Regional de Partido Político', 'Plano de Benefícios de Previdência Complementar Fechada',
      'Serviço Notarial e Registral (Cartório)', 'Serviço Social Autônomo', 'Candidato a Cargo Político Eletivo']
  };

  const PORTES = { me: 'Microempresa', epp: 'Empresa de pequeno porte', medio: 'Empresa de médio porte', grande: 'Empresa de grande porte' };

  // [masculino, feminino, sem gênero informado]
  const ESTADO_CIVIL = {
    solteiro: ['solteiro', 'solteira', 'solteiro(a)'],
    uniao_estavel: ['em união estável', 'em união estável', 'em união estável'],
    casado: ['casado', 'casada', 'casado(a)'],
    separado: ['separado', 'separada', 'separado(a)'],
    divorciado: ['divorciado', 'divorciada', 'divorciado(a)'],
    viuvo: ['viúvo', 'viúva', 'viúvo(a)']
  };

  const LGPD = {
    contrato: 'Execução de contrato ou procedimentos preliminares (art. 7º, V)',
    processo: 'Exercício regular de direitos em processo (art. 7º, VI)',
    consentimento: 'Consentimento do titular (art. 7º, I)',
    obrigacao_legal: 'Cumprimento de obrigação legal (art. 7º, II)',
    legitimo_interesse: 'Legítimo interesse (art. 7º, IX)'
  };

  const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

  // Rótulos dos campos (usados no histórico de alterações).
  const CAMPOS = {
    tipo: 'Tipo de cadastro', nome: 'Nome', genero: 'Gênero', nacionalidade: 'Nacionalidade', profissao: 'Profissão',
    estado_civil: 'Estado civil', rg: 'RG', rg_expedicao: 'Expedição do RG', nome_mae: 'Nome da mãe', nome_pai: 'Nome do pai',
    nascimento: 'Data de nascimento', nascimento_municipio: 'Município de nascimento', nascimento_uf: 'UF de nascimento',
    natureza: 'Natureza jurídica', tipo_entidade: 'Tipo de entidade', nome_fantasia: 'Nome fantasia', porte: 'Porte',
    abertura: 'Data de abertura', representantes: 'Representante(s) legal(is)', documento: 'CPF/CNPJ', cep: 'CEP',
    logradouro: 'Logradouro', numero: 'Número', complemento: 'Complemento', bairro: 'Bairro', municipio: 'Município',
    uf: 'UF', telefones: 'Telefones', emails: 'E-mails', lgpd_base: 'Base legal (LGPD)',
    lgpd_consentimento: 'Data do consentimento', etapa: 'Etapa do atendimento', arquivado_em: 'Arquivamento'
  };

  // ---------- formatos ----------
  const dig = v => String(v ?? '').replace(/\D/g, '');
  const fmtCPF = v => { const d = dig(v); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : String(v ?? ''); };
  const fmtCNPJ = v => { const d = dig(v); return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : String(v ?? ''); };
  const fmtDocumento = v => { const d = dig(v); return d.length === 14 ? fmtCNPJ(d) : d.length === 11 ? fmtCPF(d) : String(v ?? ''); };
  const fmtCEP = v => { const d = dig(v); return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : String(v ?? ''); };
  const fmtCEPQualificacao = v => { const d = dig(v); return d.length === 8 ? d.replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2-$3') : String(v ?? ''); };
  function fmtTelefone(v) {
    let d = dig(v);
    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
    if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return String(v ?? '').trim();
  }
  const telefoneNormal = v => { let d = dig(v); if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2); return d; };
  const fmtData = iso => { if (!iso) return ''; const [a, m, d] = String(iso).slice(0, 10).split('-'); return d && m && a ? `${d}/${m}/${a}` : ''; };
  // "dd/mm/aaaa" -> "aaaa-mm-dd" (ou null se vazia; lança erro se inválida)
  function lerData(txt) {
    const t = String(txt ?? '').trim();
    if (!t) return null;
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) throw new Error('Use o formato DD/MM/AAAA.');
    const [, d, mes, a] = m.map(Number);
    const data = new Date(Date.UTC(a, mes - 1, d));
    if (data.getUTCFullYear() !== a || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== d || a < 1850 || a > 2200) {
      throw new Error('Data inexistente.');
    }
    return `${String(a).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // Máscaras enquanto digita
  const MASCARAS = {
    cpf: v => { const d = dig(v).slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); },
    cnpj: v => { const d = dig(v).slice(0, 14); return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2'); },
    cep: v => dig(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2'),
    data: v => dig(v).slice(0, 8).replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2'),
    telefone: v => {
      const d = dig(v).slice(0, 11);
      return d.length <= 10 ? d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
        : d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
    }
  };

  // ---------- validação ----------
  function cpfValido(v) {
    const d = dig(v);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const calc = n => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
  }
  function cnpjValido(v) {
    const d = dig(v);
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    const calc = n => {
      const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const s = pesos.reduce((t, p, i) => t + Number(d[i]) * p, 0);
      const r = s % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
  }
  const emailValido = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v ?? '').trim());

  // ---------- texto ----------
  const genero = (p, m, f, n) => p.genero === 'm' ? m : p.genero === 'f' ? f : n;
  // "Sociedade Empresária Limitada" -> "sociedade empresária limitada" (mantém siglas como MEI)
  const minusculas = t => String(t || '').split(' ').map(w => (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)) ? w : w.toLowerCase()).join(' ');
  const listaE = itens => itens.length <= 1 ? (itens[0] || '') : itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1];

  function nacionalidade(p) {
    const n = String(p.nacionalidade || '').trim();
    if (!n) return '';
    if (/^brasileir/i.test(n)) return genero(p, 'brasileiro', 'brasileira', 'brasileiro(a)');
    return n.toLowerCase();
  }

  function endereco(p) {
    if (!p.logradouro && !p.municipio) return '';
    const partes = [];
    if (p.logradouro) partes.push(p.logradouro.trim() + (p.numero ? `, nº ${String(p.numero).trim()}` : ''));
    if (p.complemento) partes.push(p.complemento.trim());
    if (p.bairro) partes.push(`bairro ${p.bairro.trim()}`);
    if (p.municipio) partes.push(`em ${p.municipio.trim()}${p.uf ? '/' + p.uf : ''}`);
    if (p.cep) partes.push(`CEP: ${fmtCEPQualificacao(p.cep)}`);
    return partes.join(', ');
  }

  function contatos(p) {
    const partes = [];
    const emails = (p.emails || []).filter(Boolean);
    const tels = (p.telefones || []).filter(Boolean).map(fmtTelefone);
    if (emails.length) partes.push((emails.length > 1 ? 'e-mails ' : 'e-mail ') + listaE(emails));
    if (tels.length) partes.push((tels.length > 1 ? 'telefones nº ' : 'telefone nº ') + listaE(tels));
    return partes.join(', ');
  }

  // Qualificação no padrão das peças do escritório, gerada a partir do cadastro.
  function qualificacao(p) {
    if (!p || !p.nome) return '';
    const partes = [String(p.nome).trim().toUpperCase()];
    if (p.tipo === 'pf') {
      const o = (m, f, n) => genero(p, m, f, n);
      if (nacionalidade(p)) partes.push(nacionalidade(p));
      if (p.profissao) partes.push(String(p.profissao).trim());
      if (p.estado_civil && ESTADO_CIVIL[p.estado_civil]) partes.push(o(...ESTADO_CIVIL[p.estado_civil]));
      if (p.documento) partes.push(`${o('inscrito', 'inscrita', 'inscrito(a)')} no CPF nº ${fmtCPF(p.documento)}`);
      if (p.rg) partes.push(`com RG nº ${String(p.rg).trim()}`);
      const pais = [p.nome_mae, p.nome_pai].filter(Boolean).map(n => String(n).trim().toUpperCase());
      if (pais.length) partes.push(`${o('filho', 'filha', 'filho(a)')} de ${pais.join(' e de ')}`);
      if (p.nascimento) partes.push(`${o('nascido', 'nascida', 'nascido(a)')} em ${fmtData(p.nascimento)}`);
      if (p.nascimento_municipio) partes.push(`natural de ${String(p.nascimento_municipio).trim()}${p.nascimento_uf ? '/' + p.nascimento_uf : ''}`);
      const end = endereco(p);
      if (end) partes.push(`${o('residente e domiciliado', 'residente e domiciliada', 'residente e domiciliado(a)')} na ${end}`);
    } else if (p.tipo === 'pj') {
      if (p.tipo_entidade) partes.push(minusculas(p.tipo_entidade));
      if (p.documento) partes.push(`inscrito(a) no CNPJ nº ${fmtCNPJ(p.documento)}`);
      if (p.porte && PORTES[p.porte]) partes.push(`com porte de ${PORTES[p.porte].toLowerCase()}`);
      const end = endereco(p);
      if (end) partes.push(`com sede na ${end}`);
    } else {
      return '';
    }
    const cont = contatos(p);
    if (cont) partes.push(cont);
    if (p.tipo === 'pj' && p.representantes) {
      const nomes = String(p.representantes).split(/\s+e\/ou\s+/i).map(n => n.trim().toUpperCase()).filter(Boolean);
      partes.push(`neste ato representado(a) por ${nomes.join(' e/ou ')}`);
    }
    return partes.join(', ');
  }

  // ---------- consulta de CNPJ (publica.cnpj.ws) ----------
  const ALIAS_NATUREZA = {
    'Empresário (Individual)': 'Empresário(a) Individual',
    'Empresa Simples de Inovação - Inova Simples': 'Empresa Simples de Inovação'
  };
  const REPRESENTANTES = ['Administrador', 'Diretor', 'Presidente', 'Sócio-Administrador', 'Sócio Ostensivo', 'Sócio Comanditado',
    'Titular Pessoa Física Residente ou Domiciliado no Brasil', 'Produtor Rural', 'Conselheiro de Administração',
    'Administrador Residente ou Domiciliado no Exterior', 'Diretor Residente ou Domiciliado no Exterior',
    'Presidente Residente ou Domiciliado no Exterior', 'Sócio-Administrador Residente ou Domiciliado no Exterior',
    'Sócio Comanditado Residente no Exterior', 'Conselheiro de Administração Residente ou Domiciliado no Exterior',
    'Titular Pessoa Física Residente ou Domiciliado no Exterior'];

  // Converte a resposta da API em campos do cadastro.
  function deCNPJws(data) {
    const est = data.estabelecimento || {};
    let tipoEnt = String(data.natureza_juridica?.descricao || '').replace(/^\d{1,3}-\d\s*-\s*/, '').trim();
    tipoEnt = ALIAS_NATUREZA[tipoEnt] || tipoEnt;
    if (tipoEnt === 'Empresário(a) Individual' && (data.simples?.mei === 'Sim')) tipoEnt = 'Microempreendedor(a) Individual (MEI)';
    const natureza = Object.keys(ENTIDADES).find(k => ENTIDADES[k].includes(tipoEnt)) || null;
    const porteApi = String(data.porte?.descricao || '').toLowerCase();
    let porte = porteApi.includes('micro') ? 'me' : porteApi.includes('pequeno') ? 'epp' : porteApi.includes('médio') || porteApi.includes('medio') ? 'medio' : porteApi.includes('grande') ? 'grande' : null;
    if (!porte && tipoEnt !== 'Microempreendedor(a) Individual (MEI)' && (data.simples?.simples === 'Sim')) porte = 'me';
    const representantes = (data.socios || [])
      .filter(s => REPRESENTANTES.includes(String(s.qualificacao_socio?.descricao || '').trim()))
      .map(s => String(s.nome || '').toUpperCase()).filter(Boolean);
    const telefones = [[est.ddd1, est.telefone1], [est.ddd2, est.telefone2]].filter(([d, t]) => d && t).map(([d, t]) => fmtTelefone(d + t));
    return {
      nome: String(data.razao_social || '').toUpperCase(),
      nome_fantasia: est.nome_fantasia ? String(est.nome_fantasia).toUpperCase() : '',
      natureza, tipo_entidade: natureza ? tipoEnt : '',
      porte,
      abertura: est.data_inicio_atividade || null,
      representantes: representantes.join(' e/ou '),
      cep: dig(est.cep), logradouro: [est.tipo_logradouro, est.logradouro].filter(Boolean).join(' '),
      numero: est.numero || '', complemento: est.complemento ? String(est.complemento).replace(/\s+/g, ' ').trim() : '',
      bairro: est.bairro || '', municipio: est.cidade?.nome || '', uf: est.estado?.sigla || '',
      telefones, emails: est.email ? [String(est.email).toLowerCase()] : []
    };
  }

  async function consultarCNPJ(cnpj) {
    const d = dig(cnpj);
    const r = await fetch(`https://publica.cnpj.ws/cnpj/${d}`);
    if (r.status === 404) throw new Error('CNPJ não encontrado na Receita.');
    if (r.status === 429) throw new Error('Muitas consultas seguidas. Aguarde um minuto e tente de novo.');
    if (!r.ok) throw new Error('Não foi possível consultar o CNPJ agora.');
    const data = await r.json();
    if (!data || !data.razao_social) throw new Error('CNPJ não encontrado na Receita.');
    return deCNPJws(data);
  }

  // CEP: BrasilAPI (principal) e ViaCEP (reserva).
  async function consultarCEP(cep) {
    const d = dig(cep);
    if (d.length !== 8) throw new Error('O CEP tem 8 dígitos.');
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${d}`);
      if (r.ok) { const x = await r.json(); return { logradouro: x.street || '', bairro: x.neighborhood || '', municipio: x.city || '', uf: x.state || '' }; }
    } catch (e) { /* tenta a reserva */ }
    let x;
    try { x = await (await fetch(`https://viacep.com.br/ws/${d}/json/`)).json(); }
    catch (e) { throw new Error('Não foi possível consultar o CEP agora. Preencha o endereço manualmente.'); }
    if (!x || x.erro) throw new Error('CEP não encontrado. Confira o número ou preencha manualmente.');
    return { logradouro: x.logradouro || '', bairro: x.bairro || '', municipio: x.localidade || '', uf: x.uf || '' };
  }

  // Valor legível de um campo (para histórico e cartão).
  function valorLegivel(campo, v) {
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return '—';
    if (campo === 'tipo') return TIPOS[v] || v;
    if (campo === 'genero') return v === 'm' ? 'Masculino' : v === 'f' ? 'Feminino' : v;
    if (campo === 'estado_civil') return ESTADO_CIVIL[v]?.[2] || v;
    if (campo === 'natureza') return NATUREZAS[v] || v;
    if (campo === 'porte') return PORTES[v] || v;
    if (campo === 'lgpd_base') return LGPD[v] || v;
    if (campo === 'documento') return fmtDocumento(v);
    if (campo === 'cep') return fmtCEP(v);
    if (campo === 'telefones') return v.map(fmtTelefone).join(', ');
    if (campo === 'emails') return v.join(', ');
    if (campo === 'arquivado_em') return 'Arquivado';
    if (['rg_expedicao', 'nascimento', 'abertura', 'lgpd_consentimento'].includes(campo)) return fmtData(v);
    return Array.isArray(v) ? v.join(', ') : String(v);
  }

  window.PES = {
    TIPOS, NATUREZAS, ENTIDADES, PORTES, ESTADO_CIVIL, LGPD, UFS, CAMPOS, MASCARAS,
    dig, fmtCPF, fmtCNPJ, fmtDocumento, fmtCEP, fmtTelefone, telefoneNormal, fmtData, lerData,
    cpfValido, cnpjValido, emailValido, qualificacao, consultarCNPJ, consultarCEP, deCNPJws, valorLegivel
  };
})();
