const normalizeText = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

export const buildSolicitacaoAtualizacaoCadastral = ({
  produtorNome,
  propriedades = [],
}: {
  produtorNome?: string | null;
  propriedades?: Array<string | null | undefined>;
}): string => {
  const nome = normalizeText(produtorNome) || 'Não informado';
  const nomesPropriedades = Array.from(new Set(
    propriedades.map(normalizeText).filter(Boolean)
  ));
  const propriedadeLabel = nomesPropriedades.length === 1
    ? 'Propriedade vinculada'
    : 'Propriedades vinculadas';
  const propriedadesValue = nomesPropriedades.length > 0
    ? nomesPropriedades.join(', ')
    : 'Nenhuma informada';

  return [
    'Solicitação de atualização cadastral',
    `Produtor: ${nome}`,
    `${propriedadeLabel}: ${propriedadesValue}`,
    'Peço o contato da equipe responsável para confirmar e atualizar os dados cadastrais necessários.',
  ].join('\n');
};
