// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { AO_ENTRAR, fluxo, VALIDACAO, type CamposCadastro } from './cadastro';

const vazio: CamposCadastro = {
  tipo: '', nome: '', cnpjBusca: '', natureza: '', genero: '', nac: '', nacOutra: '', profissao: '', ec: '', cpf: '',
  rg: '', rgExp: '', mae: '', pai: '', nasc: '', nascMun: '', nascUf: '', entidade: '', fantasia: '', porte: '', cnpj: '',
  abertura: '', representantes: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', municipio: '', uf: '',
  telefones: [], emails: [], resp: [], lgpdBase: 'contrato', lgpdData: ''
};
const campos = (c: Partial<CamposCadastro>): CamposCadastro => ({ ...vazio, ...c });
const tel = (v: string) => ({ k: 1, v });

describe('Etapas de cada tipo de pessoa', () => {
  it.each([
    ['', ['s-tipo']],
    ['pf', ['s-tipo', 's-ident', 's-pf', 's-endereco', 's-contato']],
    ['contato', ['s-tipo', 's-ident', 's-contato']]
  ] as const)('quando o tipo é "%s", então as etapas são %j', (tipo, etapas) => {
    // Quando
    const resultado = fluxo(campos({ tipo }));
    // Então
    expect(resultado).toEqual(etapas);
  });

  it('quando a pessoa jurídica tem natureza escolhida, então ganha a etapa do tipo de entidade', () => {
    // Quando
    const sem = fluxo(campos({ tipo: 'pj' })), com = fluxo(campos({ tipo: 'pj', natureza: 'empresarial' }));
    // Então
    expect(sem).not.toContain('s-entidade');
    expect(com).toEqual(['s-tipo', 's-ident', 's-entidade', 's-empresa', 's-endereco', 's-contato']);
  });
});

describe('Validação de cada etapa', () => {
  it('quando o tipo não foi escolhido, então a etapa do tipo pede a escolha', () => {
    // Quando
    const r = VALIDACAO['s-tipo'](vazio);
    // Então
    expect(r.erros).toEqual({ tipo: 'Selecione o tipo de cadastro.' });
  });

  describe('Dada a etapa de identificação', () => {
    it('quando o nome vem em minúsculas e com espaços, então segue com o nome em maiúsculas', () => {
      // Quando
      const r = VALIDACAO['s-ident'](campos({ tipo: 'pf', nome: '  maria   da silva ' }));
      // Então
      expect(r.erros).toEqual({});
      expect(r.ajustes.nome).toBe('MARIA DA SILVA');
      expect(r.documento).toBeUndefined();
    });

    it('quando falta o nome, então pede o nome', () => {
      // Quando
      const r = VALIDACAO['s-ident'](campos({ tipo: 'contato', nome: '   ' }));
      // Então
      expect(r.erros).toEqual({ nome: 'Informe o nome.' });
    });

    it.each([
      ['', 'Informe o CNPJ.'],
      ['12345678000196', 'CNPJ inválido: confira as letras e os números.']
    ])('quando a pessoa jurídica tem o CNPJ "%s", então o erro é "%s"', (cnpjBusca, erro) => {
      // Quando
      const r = VALIDACAO['s-ident'](campos({ tipo: 'pj', nome: 'EMPRESA', cnpjBusca }));
      // Então
      expect(r.erros).toEqual({ cnpjBusca: erro });
      expect(r.documento).toBeUndefined();
    });

    it('quando o CNPJ tem letras e é válido, então pede a conferência no banco em maiúsculas e já preenche a etapa da empresa', () => {
      // Quando
      const r = VALIDACAO['s-ident'](campos({ tipo: 'pj', nome: 'EMPRESA', cnpjBusca: '12.abc.345/01de-35' }));
      // Então
      expect(r.erros).toEqual({});
      expect(r.documento).toBe('12ABC34501DE35');
      expect(r.ajustes.cnpj).toBe('12.ABC.345/01DE-35');
    });

    it('quando o CNPJ é válido, então pede a conferência no banco e já preenche o CNPJ da etapa da empresa', () => {
      // Quando
      const r = VALIDACAO['s-ident'](campos({ tipo: 'pj', nome: 'EMPRESA', cnpjBusca: '12.345.678/0001-95' }));
      // Então
      expect(r.documento).toBe('12345678000195');
      expect(r.ajustes.cnpj).toBe('12.345.678/0001-95');
    });

    it('quando o CNPJ da etapa da empresa já foi digitado, então ele não é trocado', () => {
      // Quando
      const r = VALIDACAO['s-ident'](campos({ tipo: 'pj', nome: 'EMPRESA', cnpjBusca: '12345678000195', cnpj: '11.222.333/0001-81' }));
      // Então
      expect(r.ajustes.cnpj).toBeUndefined();
    });
  });

  describe('Dada a etapa da pessoa física', () => {
    const certa = campos({ tipo: 'pf', genero: 'f', cpf: '529.982.247-25' });

    it('quando gênero e CPF estão certos, então pede a conferência do CPF no banco', () => {
      // Quando
      const r = VALIDACAO['s-pf'](certa);
      // Então
      expect(r.erros).toEqual({});
      expect(r.documento).toBe('52998224725');
    });

    it('quando faltam gênero e CPF, então pede os dois e não confere nada no banco', () => {
      // Quando
      const r = VALIDACAO['s-pf'](campos({ tipo: 'pf' }));
      // Então
      expect(r.erros).toEqual({ genero: 'Selecione o gênero (usado na concordância da qualificação).', cpf: 'Informe o CPF.' });
      expect(r.documento).toBeUndefined();
    });

    it.each([
      ['rgExp', '31/02/2001', 'Data inexistente.'],
      ['nasc', '1980-05-10', 'Use o formato DD/MM/AAAA.']
    ] as const)('quando a data %s é "%s", então o erro é "%s"', (campo, valor, erro) => {
      // Quando
      const r = VALIDACAO['s-pf']({ ...certa, [campo]: valor });
      // Então
      expect(r.erros).toEqual({ [campo]: erro });
      expect(r.documento).toBeUndefined();
    });
  });

  describe('Dada a etapa da empresa', () => {
    it('quando é MEI sem o gênero do titular, então pede o gênero com a mensagem do titular', () => {
      // Quando
      const r = VALIDACAO['s-empresa'](campos({ tipo: 'pj', entidade: 'Microempreendedor(a) Individual (MEI)', cnpj: '12345678000195' }));
      // Então
      expect(r.erros).toEqual({ genero: 'Selecione o gênero do(a) titular (usado na concordância da qualificação).' });
    });

    it('quando é sociedade, então o gênero não é pedido e o CNPJ vai para a conferência', () => {
      // Quando
      const r = VALIDACAO['s-empresa'](campos({ tipo: 'pj', entidade: 'Sociedade Empresária Limitada', cnpj: '12.345.678/0001-95' }));
      // Então
      expect(r.erros).toEqual({});
      expect(r.documento).toBe('12345678000195');
    });

    it('quando a data de abertura não existe, então avisa', () => {
      // Quando
      const r = VALIDACAO['s-empresa'](campos({ tipo: 'pj', cnpj: '12345678000195', abertura: '30/02/2010' }));
      // Então
      expect(r.erros).toEqual({ abertura: 'Data inexistente.' });
    });
  });

  it.each([
    ['', {}],
    ['39400-121', {}],
    ['3940', { cep: 'O CEP tem 8 dígitos.' }]
  ])('quando o CEP é "%s", então os erros do endereço são %j', (cep, erros) => {
    // Quando
    const r = VALIDACAO['s-endereco'](campos({ cep }));
    // Então
    expect(r.erros).toEqual(erros);
  });

  describe('Dada a etapa de contato', () => {
    it('quando não há telefone, então pede pelo menos um', () => {
      // Quando
      const r = VALIDACAO['s-contato'](campos({ telefones: [tel('')] }));
      // Então
      expect(r.erros.telefones).toBe('Informe pelo menos um telefone com DDD.');
    });

    it('quando o telefone não tem DDD, então pede DDD + número', () => {
      // Quando
      const r = VALIDACAO['s-contato'](campos({ telefones: [tel('99999-1234')] }));
      // Então
      expect(r.erros.telefones).toBe('Confira os telefones: use DDD + número.');
    });

    it('quando um e-mail está mal escrito, então avisa; e-mail em branco não conta', () => {
      // Quando
      const r = VALIDACAO['s-contato'](campos({ telefones: [tel('(38) 99999-1234')], emails: [{ k: 1, v: '' }, { k: 2, v: 'maria.exemplo.com' }] }));
      // Então
      expect(r.erros).toEqual({ emails: 'Confira o formato do e-mail.' });
    });

    it('quando a base é consentimento, então a data do consentimento é conferida', () => {
      // Quando
      const r = VALIDACAO['s-contato'](campos({ telefones: [tel('38999991234')], lgpdBase: 'consentimento', lgpdData: '31/02/2026' }));
      // Então
      expect(r.erros).toEqual({ lgpdData: 'Data inexistente.' });
    });
  });

  it('quando uma etapa é validada, então as datas e os campos dela contam como conferidos', () => {
    // Quando
    const r = VALIDACAO['s-endereco'](campos({}));
    // Então
    expect(r.conferidos).toEqual(['rgExp', 'nasc', 'abertura', 'lgpdData', 'cep']);
  });
});

describe('Ao abrir uma etapa', () => {
  let n = 0;
  const ctx = (entidadeDoCadastro?: string) => ({ entidadeDoCadastro, novaLinha: () => ({ k: ++n, v: '' }) });

  it('quando a entidade escolhida não é da natureza atual, então volta a do cadastro, se for dessa natureza', () => {
    // Quando
    const ajustes = AO_ENTRAR['s-entidade']!(campos({ natureza: 'empresarial', entidade: 'Associação Privada' }), ctx('Sociedade Empresária Limitada'));
    // Então
    expect(ajustes).toEqual({ entidade: 'Sociedade Empresária Limitada' });
  });

  it('quando a entidade não é da natureza e o cadastro não tem uma dessa natureza, então fica em branco', () => {
    // Quando
    const ajustes = AO_ENTRAR['s-entidade']!(campos({ natureza: 'empresarial', entidade: 'Associação Privada' }), ctx());
    // Então
    expect(ajustes).toEqual({ entidade: '' });
  });

  it('quando a entidade escolhida é da natureza atual, então nada muda', () => {
    // Quando
    const ajustes = AO_ENTRAR['s-entidade']!(campos({ natureza: 'empresarial', entidade: 'Sociedade Empresária Limitada' }), ctx());
    // Então
    expect(ajustes).toEqual({});
  });

  it('quando o contato abre sem telefone nem e-mail, então ganha uma linha vazia de cada', () => {
    // Quando
    const ajustes = AO_ENTRAR['s-contato']!(campos({}), ctx());
    // Então
    expect(ajustes.telefones).toHaveLength(1);
    expect(ajustes.emails).toHaveLength(1);
    expect(ajustes.telefones![0].k).not.toBe(ajustes.emails![0].k);
  });

  it('quando o contato já tem telefone e e-mail, então nada muda', () => {
    // Quando
    const ajustes = AO_ENTRAR['s-contato']!(campos({ telefones: [tel('38999991234')], emails: [{ k: 9, v: 'a@b.com' }] }), ctx());
    // Então
    expect(ajustes).toEqual({});
  });

  it.each([['s-tipo'], ['s-ident'], ['s-pf'], ['s-empresa'], ['s-endereco']] as const)('quando a etapa é %s, então ela não pede ajustes ao abrir', e => {
    // Então
    expect(AO_ENTRAR[e]).toBeUndefined();
  });
});
