// Fonte única das unidades SVN (nome + endereço).
// Backend consome via UNIDADES_ENDERECOS; frontend (config.js) adota via /api/config.
// NÃO duplicar endereços em outros arquivos.

export interface Unidade {
  nome: string;
  endereco: string;
}

export const UNIDADES: Unidade[] = [
  { nome: "SVN Aracaju", endereco: "R. Francisco Duarte Ramos, 34 - Jardins, Aracaju - SE" },
  { nome: "SVN Campo Grande", endereco: "Edifício Atrium - R. Euclides da Cunha, 1039 - Loja 3 - Jardim dos Estados" },
  { nome: "SVN Cascavel", endereco: "Av. Piquiri, 17 - Salas 01 e 02 - Centro" },
  { nome: "SVN Cuiabá", endereco: "R. Pres. Castelo Branco, 277 - Quilombo" },
  { nome: "SVN Curitiba", endereco: "Praça São Paulo da Cruz, 50 - Sala 1605 - Juveve, Curitiba - PR" },
  { nome: "SVN Foz do Iguaçu", endereco: "R. Alm. Barroso, 1139 - Centro" },
  { nome: "SVN Londrina", endereco: "Av. Higienópolis, 602 - Sala 2 - Centro, Londrina - PR" },
  { nome: "SVN Maringá", endereco: "Av. Cerro Azul, 123 - Zona 2, Maringá - PR" },
  { nome: "SVN Salvador", endereco: "Torre Nova York, Av. Tancredo Neves, 2539 - Sala 2104, Salvador - BA" },
  { nome: "SVN São Paulo", endereco: "Av. Dr. Cardoso de Melo, 1855 - Conjunto 51 - Vila Olímpia, São Paulo - SP" },
  { nome: "SVN Toledo", endereco: "Rua Nossa Senhora do Rocio, 2279 - Sala 02 - Jardim La Salle, Toledo - PR" },
  { nome: "SVN Vitória da Conquista", endereco: "Av. Jorge Teixeira, 29 - Salas 16 e 17" },
];

export const UNIDADES_ENDERECOS: Record<string, string> =
  Object.fromEntries(UNIDADES.map((u) => [u.nome, u.endereco]));
