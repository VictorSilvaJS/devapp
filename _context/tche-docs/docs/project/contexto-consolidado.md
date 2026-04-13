# Contexto Consolidado do Projeto

## Problema central

As informações da lavoura, especialmente mapas, arquivos técnicos, registros de visitas e dados associados às propriedades, tendem a ficar dispersas em pastas, relatórios e fluxos manuais. O projeto nasce para reduzir essa dispersão e facilitar a consulta operacional.

## Propósito do sistema

Criar uma plataforma que centralize informações por produtor e por fazenda, permitindo:

- consulta rápida de mapas e arquivos;
- organização por propriedade/fazenda;
- apoio ao trabalho da equipe técnica;
- disponibilização controlada de dados ao cliente/produtor;
- uso em contexto de internet instável.

## Usuários principais

### Administração geral
Responsáveis com visão total do sistema e acesso às diferentes regiões e produtores.

### Colaboradores
Usuários da equipe que atuam sobre regiões específicas, com acesso apenas ao seu escopo.

### Cliente/Produtor
Usuário final ligado à propriedade, com foco em consulta, histórico e download de materiais.

## Unidade central do domínio

A estrutura do sistema deve ser pensada a partir de:

- produtor/cliente/proprietário;
- fazendas vinculadas a esse produtor;
- mapas, arquivos, visitas e registros associados a cada fazenda.

## Foco do MVP

O MVP deve priorizar:

- estruturação de acesso;
- visualização organizada de propriedades/fazendas;
- biblioteca de mapas e arquivos;
- visitas técnicas;
- caderno de campo enxuto;
- consulta simples e intuitiva.

## Restrições relevantes

- internet instável em campo;
- necessidade de clareza de perfis de acesso sem UX confusa;
- necessidade de organização por região;
- necessidade de refletir a rotina real do negócio, não apenas uma visão genérica de software agrícola.
