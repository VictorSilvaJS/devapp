# Regras de Negócio

## Entidades e relações principais

### Produtor, cliente e proprietário
No contexto do projeto, esses termos devem ser tratados como a mesma figura de negócio, salvo decisão futura em contrário.

### Produtor e fazenda
- Um produtor pode possuir ou gerenciar mais de uma fazenda.
- A navegação do sistema deve refletir essa relação.

### Acesso do cliente/produtor
- O cliente/produtor acessa seus próprios dados.
- Pode consultar informações e baixar arquivos autorizados.
- Não deve gerenciar dados estruturais do sistema.

### Acesso do colaborador
- O colaborador possui escopo regional.
- Não pode acessar dados fora da sua região ou sub-região.
- Atua no registro e manutenção operacional conforme suas permissões.

### Acesso da administração geral
- Possui visão abrangente do sistema.
- Pode navegar entre regiões, produtores e fazendas.

## Regra de visibilidade

- A visualização do cliente/produtor deve ser a mais restrita.
- A visualização do colaborador deve ser restrita ao escopo regional.
- A administração geral deve enxergar o panorama consolidado.

## Regra sobre mapas e arquivos

- Mapas e arquivos pertencem ao contexto da propriedade/fazenda.
- O cliente/produtor pode baixar o que estiver liberado.
- O upload e a gestão dos materiais ficam sob responsabilidade da equipe autorizada.

## Regra sobre caderno de campo

- Deve registrar o que é relevante para a operação.
- Não deve nascer excessivamente genérico ou pesado.
- O nível de visibilidade deve ser controlado por regra de perfil.

## Regra sobre offline

- O uso em campo exige que consulta e visualização tenham prioridade em cenários de internet ruim.
- Tudo que depender de conectividade contínua deve ser tratado com cautela.
