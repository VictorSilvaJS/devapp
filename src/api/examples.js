/**
 * Exemplos de uso da API integrada com as entidades
 * 
 * Este arquivo demonstra como usar todas as funcionalidades da API mock
 * com validação automática baseada nas entidades.
 */

import { 
  User, 
  Produtor, 
  Visita, 
  CadernoCampo, 
  Mapa,
  PERFIS_USUARIO,
  STATUS_PRODUTOR,
  OBJETIVOS_VISITA,
  TIPOS_ATIVIDADE,
  CATEGORIAS_MAPA
} from './index';

// ============================================
// EXEMPLOS - USER
// ============================================

export const exemplosCriarUsuario = async () => {
  try {
    // Criar um colaborador
    const colaborador = await User.create({
      nome: 'Novo Colaborador',
      email: 'colaborador@agro.com',
      senha: 'hash123',
      perfil: 'colaborador',
      regiao: 'RS - Central',
      telefone: '(51) 99999-9999'
    });
    console.log('Colaborador criado:', colaborador);

    // Criar um cliente vinculado a produtor
    const cliente = await User.create({
      nome: 'Novo Cliente',
      email: 'cliente@email.com',
      senha: 'hash456',
      perfil: 'cliente',
      produtor_id: 'p1',
      telefone: '(51) 98888-8888'
    });
    console.log('Cliente criado:', cliente);

  } catch (error) {
    console.error('Erro ao criar usuário:', error.message);
  }
};

export const exemplosBuscarUsuarios = async () => {
  // Listar todos
  const todos = await User.list();
  console.log('Total de usuários:', todos.length);

  // Buscar por email
  const admin = await User.getByEmail('admin@agro.com');
  console.log('Admin encontrado:', admin.nome);

  // Filtrar colaboradores
  const colaboradores = await User.filter({ perfil: 'colaborador' });
  console.log('Colaboradores:', colaboradores.length);

  // Filtrar por região
  const rsNorte = await User.filter({ regiao: 'RS - Norte' });
  console.log('Usuários RS Norte:', rsNorte.length);
};

// ============================================
// EXEMPLOS - PRODUTOR
// ============================================

export const exemplosCriarProdutor = async () => {
  try {
    const produtor = await Produtor.create({
      nome: 'José da Silva',
      fazenda: 'Fazenda São João',
      area_total: 450,
      cultura_atual: 'Soja',
      telefone: '(51) 97777-7777',
      email: 'jose@fazenda.com',
      endereco: 'Estrada Principal, Km 8',
      cidade: 'Ijuí',
      estado: 'RS',
      cep: '98700-000',
      status: 'ativo'
    });
    console.log('Produtor criado:', produtor);

  } catch (error) {
    console.error('Erro ao criar produtor:', error.message);
  }
};

export const exemplosFiltrarProdutores = async () => {
  // Produtores ativos
  const ativos = await Produtor.filter({ status: 'ativo' });
  console.log('Produtores ativos:', ativos.length);

  // Produtores por cidade
  const cruzAlta = await Produtor.filter({ cidade: 'Cruz Alta' });
  console.log('Produtores em Cruz Alta:', cruzAlta);

  // Produtores por cultura
  const sojicultores = await Produtor.filter({ cultura_atual: 'Soja' });
  console.log('Produtores de Soja:', sojicultores.length);
};

export const exemplosAtualizarProdutor = async () => {
  try {
    const atualizado = await Produtor.update('p1', {
      cultura_atual: 'Milho',
      ultima_analise: new Date().toISOString()
    });
    console.log('Produtor atualizado:', atualizado);
  } catch (error) {
    console.error('Erro:', error.message);
  }
};

// ============================================
// EXEMPLOS - VISITA
// ============================================

export const exemplosCriarVisita = async () => {
  try {
    // Agendar nova visita
    const visita = await Visita.create({
      produtor_id: 'p1',
      tecnico_responsavel: 'Carlos Silva',
      data_visita: new Date(Date.now() + 86400000 * 3).toISOString(), // daqui 3 dias
      objetivo: 'consultoria',
      status: 'agendada'
    });
    console.log('Visita agendada:', visita);

    // Registrar visita realizada
    const visitaRealizada = await Visita.create({
      produtor_id: 'p2',
      tecnico_responsavel: 'Ana Santos',
      data_visita: new Date().toISOString(),
      objetivo: 'coleta_solo',
      observacoes: 'Coleta realizada em 10 pontos diferentes.',
      recomendacoes: 'Aguardar resultado da análise.',
      clima: 'Ensolarado',
      fotos: ['foto1.jpg', 'foto2.jpg'],
      proximaVisita: new Date(Date.now() + 86400000 * 30).toISOString(),
      status: 'realizada'
    });
    console.log('Visita registrada:', visitaRealizada);

  } catch (error) {
    console.error('Erro ao criar visita:', error.message);
  }
};

export const exemplosFiltrarVisitas = async () => {
  // Visitas de um produtor
  const visitasP1 = await Visita.filter({ produtor_id: 'p1' });
  console.log('Visitas do produtor P1:', visitasP1.length);

  // Visitas realizadas
  const realizadas = await Visita.filter({ status: 'realizada' });
  console.log('Visitas realizadas:', realizadas.length);

  // Visitas agendadas
  const agendadas = await Visita.filter({ status: 'agendada' });
  console.log('Visitas agendadas:', agendadas);
};

// ============================================
// EXEMPLOS - CADERNO DE CAMPO
// ============================================

export const exemplosCriarCadernoCampo = async () => {
  try {
    const registro = await CadernoCampo.create({
      produtor_id: 'p1',
      colaborador_responsavel: 'Carlos Silva',
      data_atividade: new Date().toISOString(),
      tipo_atividade: 'adubacao',
      talhao: 'Talhão A',
      produtos_utilizados: ['Ureia', 'MAP'],
      dosagem: '200 kg/ha',
      area_aplicada: 50,
      condicoes_clima: 'Ensolarado, 23°C',
      observacoes: 'Aplicação realizada conforme recomendação técnica.',
      recomendacoes: 'Monitorar desenvolvimento nas próximas 2 semanas.',
      fotos: ['aplicacao1.jpg'],
      visivel_para_cliente: true
    });
    console.log('Registro criado:', registro);

  } catch (error) {
    console.error('Erro ao criar registro:', error.message);
  }
};

export const exemplosFiltrarCadernoCampo = async () => {
  // Registros de um produtor
  const registrosP1 = await CadernoCampo.filter({ produtor_id: 'p1' });
  console.log('Registros do produtor P1:', registrosP1.length);

  // Registros por tipo de atividade
  const plantios = await CadernoCampo.filter({ tipo_atividade: 'plantio' });
  console.log('Registros de plantio:', plantios.length);

  // Registros visíveis para cliente
  const visiveis = await CadernoCampo.filter({ visivel_para_cliente: true });
  console.log('Registros visíveis:', visiveis.length);

  // Registros por colaborador
  const porCarlos = await CadernoCampo.filter({ colaborador_responsavel: 'Carlos Silva' });
  console.log('Registros de Carlos:', porCarlos.length);
};

// ============================================
// EXEMPLOS - MAPA
// ============================================

export const exemplosCriarMapa = async () => {
  try {
    const mapa = await Mapa.create({
      titulo: 'Mapa NDVI - Janeiro 2025',
      categoria: 'indice_vegetacao',
      produtor_id: 'p1',
      talhao: 'Talhão C',
      safra: '2024/2025',
      arquivo_url: 'mapas/ndvi_jan2025.pdf',
      arquivo_panorama_url: 'mapas/ndvi_jan2025_panorama.jpg',
      coordenadas: {
        latitude: -28.6341,
        longitude: -53.6055,
        poligono: [
          { lat: -28.6341, lng: -53.6055 },
          { lat: -28.6350, lng: -53.6055 },
          { lat: -28.6350, lng: -53.6040 },
          { lat: -28.6341, lng: -53.6040 }
        ]
      },
      observacoes: 'Imagem de satélite Sentinel-2.',
      disponivel_para_download: true
    });
    console.log('Mapa criado:', mapa);

  } catch (error) {
    console.error('Erro ao criar mapa:', error.message);
  }
};

export const exemplosFiltrarMapas = async () => {
  // Mapas de um produtor
  const mapasP1 = await Mapa.filter({ produtor_id: 'p1' });
  console.log('Mapas do produtor P1:', mapasP1.length);

  // Mapas por categoria
  const fertilidade = await Mapa.filter({ categoria: 'fertilidade' });
  console.log('Mapas de fertilidade:', fertilidade.length);

  // Mapas disponíveis para download
  const disponiveis = await Mapa.filter({ disponivel_para_download: true });
  console.log('Mapas disponíveis:', disponiveis.length);
};

// ============================================
// EXEMPLOS - TRATAMENTO DE ERROS
// ============================================

export const exemplosTratamentoErros = async () => {
  // Erro: campo obrigatório faltando
  try {
    await Produtor.create({
      nome: 'João',
      // fazenda e area_total são obrigatórios!
    });
  } catch (error) {
    console.error('Erro esperado:', error.message);
    // Output: "Produtor: Campos obrigatórios faltando: fazenda, area_total"
  }

  // Erro: valor enum inválido
  try {
    await User.create({
      nome: 'Teste',
      email: 'teste@email.com',
      senha: 'hash',
      perfil: 'invalido' // Deve ser: admin, colaborador ou cliente
    });
  } catch (error) {
    console.error('Erro esperado:', error.message);
    // Output: "User.perfil: Valor inválido. Valores permitidos: admin, colaborador, cliente"
  }

  // Erro: email inválido
  try {
    await Produtor.create({
      nome: 'Teste',
      fazenda: 'Fazenda Teste',
      area_total: 100,
      email: 'email-invalido' // Formato inválido
    });
  } catch (error) {
    console.error('Erro esperado:', error.message);
    // Output: "Produtor.email: Email inválido"
  }
};

// ============================================
// EXEMPLO COMPLETO - FLUXO DE TRABALHO
// ============================================

export const exemploFluxoCompleto = async () => {
  try {
    console.log('=== INICIANDO FLUXO COMPLETO ===\n');

    // 1. Criar novo produtor
    console.log('1. Criando novo produtor...');
    const produtor = await Produtor.create({
      nome: 'Fernando Alves',
      fazenda: 'Estância Progresso',
      area_total: 600,
      cultura_atual: 'Soja',
      cidade: 'Tupanciretã',
      estado: 'RS',
      telefone: '(55) 98765-4321',
      email: 'fernando@fazenda.com'
    });
    console.log(`✓ Produtor criado: ${produtor.nome} (${produtor.id})\n`);

    // 2. Criar usuário cliente vinculado ao produtor
    console.log('2. Criando usuário cliente...');
    const cliente = await User.create({
      nome: 'Fernando Alves',
      email: 'fernando@fazenda.com',
      senha: 'hash123',
      perfil: 'cliente',
      produtor_id: produtor.id,
      telefone: '(55) 98765-4321'
    });
    console.log(`✓ Cliente criado: ${cliente.nome}\n`);

    // 3. Agendar visita técnica
    console.log('3. Agendando visita técnica...');
    const visita = await Visita.create({
      produtor_id: produtor.id,
      tecnico_responsavel: 'Carlos Silva',
      data_visita: new Date(Date.now() + 86400000 * 7).toISOString(),
      objetivo: 'coleta_solo',
      status: 'agendada'
    });
    console.log(`✓ Visita agendada para: ${new Date(visita.data_visita).toLocaleDateString()}\n`);

    // 4. Registrar atividade no caderno de campo
    console.log('4. Registrando atividade no caderno...');
    const atividade = await CadernoCampo.create({
      produtor_id: produtor.id,
      colaborador_responsavel: 'Carlos Silva',
      data_atividade: new Date().toISOString(),
      tipo_atividade: 'vistoria',
      talhao: 'Talhão Principal',
      observacoes: 'Primeira vistoria técnica. Propriedade em boas condições.',
      recomendacoes: 'Realizar análise de solo completa.',
      visivel_para_cliente: true
    });
    console.log(`✓ Atividade registrada: ${atividade.tipo_atividade}\n`);

    // 5. Criar mapa técnico
    console.log('5. Criando mapa técnico...');
    const mapa = await Mapa.create({
      titulo: 'Levantamento Inicial - Estância Progresso',
      categoria: 'fertilidade',
      produtor_id: produtor.id,
      talhao: 'Talhão Principal',
      safra: '2024/2025',
      arquivo_url: `mapas/${produtor.id}_inicial.pdf`,
      disponivel_para_download: true
    });
    console.log(`✓ Mapa criado: ${mapa.titulo}\n`);

    console.log('=== FLUXO COMPLETO FINALIZADO COM SUCESSO ===');

  } catch (error) {
    console.error('Erro no fluxo:', error.message);
  }
};

// Executar exemplos (descomente para testar)
// exemploFluxoCompleto();
