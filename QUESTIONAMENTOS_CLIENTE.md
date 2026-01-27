# 🤔 Questionamentos para o Cliente - AgroTchê

## Objetivo: Coletar informações para melhorar e customizar o sistema

---

## 📋 PARTE 1: ENTENDIMENTO DO NEGÓCIO

### 🏢 Sobre a Operação

**1. Estrutura Atual:**
- Quantos técnicos vocês têm no total?
- Como estão distribuídos por região?
- Cada técnico atende quantos produtores em média?
- Vocês trabalham com quantas regiões diferentes?

**2. Volume de Dados:**
- Quantos produtores (clientes) vocês atendem hoje?
- Quantos mapas, em média, vocês geram por produtor/ano?
- Qual o tamanho médio dos arquivos de mapas?
- Quantas visitas técnicas vocês realizam por mês?

**3. Workflow Atual:**
- Como vocês cadastram novos produtores hoje? (Planilha? Sistema?)
- Onde ficam guardados os mapas atualmente? (Google Drive? Servidor?)
- Como o técnico registra as visitas? (Papel? Planilha?)
- Quem é responsável por compartilhar mapas com os produtores?

---

## 🗺️ PARTE 2: MAPAS E DOCUMENTOS

### 📊 Tipos de Mapas

**4. Categorias:**
- As 5 categorias criadas cobrem tudo? (Fertilidade, Correção, NDVI, Panorama, Plantio)
- Falta alguma categoria importante?
- Vocês trabalham com outros tipos de mapa? Quais?
- Alguma categoria atual não faz sentido?

**5. Formatos:**
- Quais formatos de arquivo vocês mais usam? (PDF, DWG, KMZ, SHP, TIFF?)
- Os produtores conseguem abrir arquivos DWG (AutoCAD)?
- Preferem entregar em PDF ou em formato editável?
- Vocês usam imagens de drone? Com que frequência?

**6. Disponibilidade:**
- Todos os mapas devem estar disponíveis para o produtor?
- Existem mapas "internos" que o produtor não deve ver?
- Quem decide quais mapas ficam disponíveis para download?
- Quanto tempo após criar, o mapa deve estar disponível?

**7. Versionamento:**
- Vocês refazem mapas da mesma propriedade periodicamente?
- Como diferenciam "Mapa de pH 2024" do "Mapa de pH 2025"?
- O produtor precisa ter acesso às versões antigas?
- Quanto tempo vocês guardam mapas antigos?

---

## 👥 PARTE 3: USUÁRIOS E ACESSOS

### 🔐 Controles de Acesso

**8. Perfis:**
- Os 3 perfis (Admin, Técnico, Produtor) fazem sentido?
- Precisamos de algum perfil adicional? (Ex: Gerente Regional, Vendedor)
- Quem da empresa terá acesso como Admin?
- Quantos usuários aproximadamente usarão o sistema?

**9. Técnicos:**
- Um técnico pode atender mais de uma região?
- Técnicos devem ver dados uns dos outros (mesma região)?
- Vocês querem monitorar produtividade dos técnicos?
- Técnicos externos/terceirizados terão acesso?

**10. Produtores:**
- Todo produtor receberá login ou apenas alguns?
- Produtores pagam pelo acesso ou é cortesia?
- Proprietário e gerente da fazenda terão logins separados?
- Produtor pode ter acesso a mais de uma propriedade?

**11. Regiões:**
- As 7 regiões configuradas estão corretas? (Sul, Goiás, MT, Centro-Oeste, SP, Recife, Norte)
- Precisamos adicionar/remover alguma?
- As microrregiões fazem sentido? (Norte/Centro/Sul de cada estado)
- Vocês planejam expandir para novas regiões?

---

## 📱 PARTE 4: FUNCIONALIDADES

### ✨ Recursos Atuais

**12. Dashboard:**
- As estatísticas mostradas são úteis?
- Que outros números vocês gostariam de ver?
- Gráficos são importantes ou números simples bastam?
- Precisam exportar esses dados? (Excel, PDF)

**13. Cadastro de Produtores:**
- Quais campos são essenciais? (Nome, Fazenda, Área, Cultura, Contato...)
- Falta algum campo importante?
- Vocês trabalham com CPF/CNPJ dos produtores?
- Precisa cadastrar geolocalização da fazenda?

**14. Registro de Visitas:**
- O que deve ser registrado em uma visita?
- Fotos são importantes? (Já planejado)
- Assinatura digital do produtor é necessária? (Já planejado)
- Técnico deve poder editar visita depois?

**15. Caderno de Campo:**
- O conceito de "histórico de atividades" faz sentido?
- Que tipo de atividades devem ser registradas?
- Quem deve poder adicionar informações?
- Produtor deve ver tudo ou apenas parte?

---

## 🚀 PARTE 5: PRIORIDADES E MELHORIAS

### 🎯 Funcionalidades Futuras

**16. Upload de Arquivos:**
- Quem deve poder fazer upload? (Apenas admin ou técnicos também?)
- Upload deve ser pelo celular ou apenas computador?
- Precisa de validação antes de liberar para produtor?
- Existe limite de tamanho por arquivo?

**17. Notificações:**
- Quando produtor deve ser notificado?
  - [ ] Novo mapa disponível
  - [ ] Visita agendada
  - [ ] Nova atividade registrada
  - [ ] Outro: _______________

- Técnicos devem receber notificações?
- Por onde? (App, Email, SMS, WhatsApp)

**18. Modo Offline:**
- Técnicos trabalham em áreas sem internet?
- É crítico funcionar offline?
- Quais funcionalidades precisam estar disponíveis offline?
  - [ ] Visualizar produtores
  - [ ] Registrar visitas
  - [ ] Ver mapas já baixados
  - [ ] Cadastrar novo produtor

**19. Relatórios:**
- Que tipo de relatório seria útil?
  - [ ] Visitas por técnico/mês
  - [ ] Produtores por região
  - [ ] Mapas mais baixados
  - [ ] Atividades por fazenda
  - [ ] Outro: _______________

- Em que formato? (PDF, Excel, Email)
- Com que frequência? (Manual, Semanal, Mensal)

**20. Integrações:**
- Vocês usam algum sistema hoje que deveríamos integrar?
  - [ ] Sistema de gestão (ERP)
  - [ ] Software de mapas (QGIS, ArcGIS)
  - [ ] Plataforma de imagens (Sentinel, Planet)
  - [ ] Outro: _______________

---

## 💼 PARTE 6: MODELO DE NEGÓCIO

### 💰 Viabilidade

**21. Investimento:**
- Qual o orçamento disponível para o projeto?
- Preferem investimento único ou mensalidade?
- Quanto vale para vocês em economia de tempo/recursos?
- Existe verba para manutenção/melhorias futuras?

**22. Repasse aos Clientes:**
- Produtores pagarão pelo acesso?
- Será custo embutido no serviço de consultoria?
- Acesso ao app é diferencial competitivo?
- Como vocês venderão isso aos clientes?

**23. Suporte:**
- Quem dará suporte aos produtores? (Vocês ou nós?)
- Precisam de treinamento para a equipe?
- Preferem manual/vídeos ou treinamento presencial?
- Quanto tempo de suporte incluído no projeto?

---

## 🎨 PARTE 7: IDENTIDADE E PERSONALIZAÇÃO

### 🏷️ Branding

**24. Identidade Visual:**
- O nome "AgroTchê" será mantido ou vocês querem personalizar?
- Temos logo/marca da empresa para usar?
- Cores da marca devem ser aplicadas no app?
- Ícone do app deve ter identidade da empresa?

**25. Comunicação:**
- Que tom de voz preferem? (Formal, Casual, Técnico)
- Mensagens devem usar nome da empresa?
- Rodapé/marca d'água nos mapas?

---

## 📊 PARTE 8: MÉTRICAS DE SUCESSO

### 🎯 KPIs

**26. Como mediremos sucesso?**
- [ ] Redução de ligações pedindo mapas
- [ ] Tempo economizado por visita
- [ ] Satisfação dos produtores (NPS)
- [ ] Taxa de adoção dos técnicos
- [ ] Redução de erros de região
- [ ] Outro: _______________

**27. Em quanto tempo esperamos ver resultados?**
- 1 mês?
- 3 meses?
- 6 meses?

**28. O que considerariam um "sucesso total"?**
- 100% dos técnicos usando?
- 80% dos produtores com acesso?
- Zero retrabalho de envio de mapas?
- Outro: _______________

---

## 🚧 PARTE 9: RISCOS E PREOCUPAÇÕES

### ⚠️ Pontos de Atenção

**29. Resistências:**
- Técnicos são familiarizados com tecnologia?
- Há resistência a mudanças na equipe?
- Produtores têm smartphones? Android ou iOS?
- Conectividade nas fazendas é boa?

**30. Segurança:**
- Dados são sensíveis/confidenciais?
- Precisamos de termo de confidencialidade?
- Backups devem ser automáticos?
- Quanto tempo dados devem ser guardados?

**31. Conformidade:**
- Há requisitos legais específicos?
- LGPD é uma preocupação?
- Precisa de auditoria de acessos?
- Certificações necessárias?

---

## 🔄 PARTE 10: IMPLEMENTAÇÃO

### 📅 Cronograma

**32. Prazos:**
- Quando gostariam de começar a usar?
- Há algum período crítico? (Safra, plantio)
- Preferem implantação gradual ou de uma vez?
- Quanto tempo disponível para testes?

**33. Migração:**
- Precisamos importar dados antigos?
- De onde? (Planilhas, outro sistema)
- Quantos registros históricos?
- Mapas antigos devem ser migrados?

**34. Treinamento:**
- Quantas pessoas precisam ser treinadas?
- Preferem treinamento por perfil ou todos juntos?
- Presencial ou remoto?
- Material de apoio em vídeo é suficiente?

---

## 💡 PARTE 11: VISÃO DE FUTURO

### 🚀 Expansão

**35. Crescimento:**
- Planos de expansão nos próximos 2 anos?
- Novas regiões? Quantas?
- Novos serviços além de mapas?
- Parcerias com outras empresas?

**36. Inovação:**
- Interesse em IA para análise de mapas?
- Predição de problemas antes de acontecer?
- Recomendações automáticas?
- Integração com sensores/IoT nas fazendas?

**37. Diferenciação:**
- Como este app ajuda a vender mais?
- É ferramenta interna ou produto para vender?
- Pode virar receita recorrente?
- Outros consultores poderiam usar (white label)?

---

## ✅ CHECKLIST PÓS-REUNIÃO

### Usar essas respostas para:

- [ ] Ajustar categorias de mapas
- [ ] Adicionar/remover campos nos cadastros
- [ ] Priorizar funcionalidades futuras
- [ ] Definir cronograma de implementação
- [ ] Estimar custos e investimento
- [ ] Preparar proposta comercial
- [ ] Planejar migração de dados
- [ ] Desenhar fluxo de treinamento
- [ ] Definir métricas de sucesso
- [ ] Documentar requisitos específicos

---

## 🎯 PERGUNTAS-CHAVE (Não esquecer!)

### TOP 10 Mais Importantes:

1. **Quantos usuários vão usar o sistema?** (Planejamento de infraestrutura)
2. **Quais formatos de mapas vocês mais usam?** (Suporte técnico)
3. **Técnicos trabalham offline?** (Prioridade de desenvolvimento)
4. **Todos os mapas ficam disponíveis para o produtor?** (Regras de negócio)
5. **Quanto tempo/dinheiro perdem hoje com retrabalho?** (ROI)
6. **Quando querem começar a usar?** (Cronograma)
7. **Precisamos importar dados antigos?** (Migração)
8. **Produtores vão pagar pelo acesso?** (Modelo de negócio)
9. **Que funcionalidade seria mais útil agora?** (Priorização)
10. **Como mediremos se deu certo?** (Métricas de sucesso)

---

## 📝 TEMPLATE DE ANOTAÇÕES

**Durante a reunião, anote:**

```
EMPRESA: _______________________________
CONTATO: _______________________________
DATA: __/__/____

PRINCIPAIS NECESSIDADES:
1. _____________________________________
2. _____________________________________
3. _____________________________________

FUNCIONALIDADES PRIORITÁRIAS:
1. _____________________________________
2. _____________________________________
3. _____________________________________

PREOCUPAÇÕES/RISCOS:
1. _____________________________________
2. _____________________________________

PRÓXIMOS PASSOS:
1. _____________________________________
2. _____________________________________
3. _____________________________________

PRAZO DESEJADO: ______________________
ORÇAMENTO: ___________________________
```

---

## 🎤 COMO CONDUZIR OS QUESTIONAMENTOS

### ✅ BOAS PRÁTICAS:

**1. Não faça interrogatório**
- Transforme em conversa natural
- "Fiquei curioso, como vocês fazem hoje..."
- Deixe eles contarem histórias

**2. Ouça mais do que fale**
- Faça pergunta → Cale e escute
- Não interrompa
- Tome notas

**3. Busque exemplos concretos**
- "Me dá um exemplo?"
- "Como foi a última vez que isso aconteceu?"
- Exemplos revelam necessidades reais

**4. Valide o entendimento**
- "Deixa eu ver se entendi..."
- "Então vocês querem..."
- "Isso seria útil porque..."

**5. Priorize junto com eles**
- "Entre X e Y, o que seria mais útil agora?"
- "Se pudesse ter só uma funcionalidade, qual seria?"
- "Isso é essencial ou seria 'legal ter'?"

### ❌ EVITE:

- ❌ Fazer todas as perguntas de uma vez
- ❌ Usar termos técnicos
- ❌ Prometer funcionalidades sem analisar
- ❌ Julgar as respostas
- ❌ Forçar suas ideias
- ❌ Discutir preço antes de entender necessidades

---

## 🎯 MOMENTO IDEAL PARA CADA BLOCO

```
Durante a Apresentação:
→ Partes 1, 2, 3 (Entendimento, Mapas, Acessos)

Após Demonstração:
→ Partes 4, 5 (Funcionalidades, Melhorias)

Reunião de Follow-up:
→ Partes 6, 7, 8, 9, 10, 11 (Comercial, Técnico, Implantação)
```

---

**Boa reunião! 🚀**

*Lembre-se: Perguntas certas são mais importantes que respostas prontas.*
