/**
 * Testes básicos da API integrada com as entidades
 * Execute este arquivo para verificar se tudo está funcionando
 */

import { 
  User, 
  Produtor, 
  Visita, 
  CadernoCampo, 
  Mapa,
  validateUser,
  validateProdutor
} from './index';

// Cores para output no console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`)
};

// Função auxiliar para executar testes
const runTest = async (name, testFn) => {
  try {
    await testFn();
    log.success(name);
    return true;
  } catch (error) {
    log.error(`${name}: ${error.message}`);
    return false;
  }
};

// ============================================
// TESTES
// ============================================

const testUsuarios = async () => {
  console.log('\n📋 Testando API de Usuários...\n');
  
  let passed = 0;
  let total = 0;

  // Teste 1: Listar usuários
  total++;
  if (await runTest('Listar usuários', async () => {
    const users = await User.list();
    if (users.length === 0) throw new Error('Nenhum usuário encontrado');
  })) passed++;

  // Teste 2: Buscar por email
  total++;
  if (await runTest('Buscar usuário por email', async () => {
    const user = await User.getByEmail('admin@agro.com');
    if (!user) throw new Error('Usuário não encontrado');
  })) passed++;

  // Teste 3: Filtrar colaboradores
  total++;
  if (await runTest('Filtrar colaboradores', async () => {
    const colaboradores = await User.filter({ perfil: 'colaborador' });
    if (colaboradores.length === 0) throw new Error('Nenhum colaborador encontrado');
  })) passed++;

  // Teste 4: Criar usuário válido
  total++;
  if (await runTest('Criar usuário válido', async () => {
    const novo = await User.create({
      nome: 'Teste Usuario',
      email: 'teste@agro.com',
      senha: 'hash123',
      perfil: 'colaborador',
      regiao: 'RS - Teste'
    });
    if (!novo.id) throw new Error('Usuário não foi criado');
  })) passed++;

  // Teste 5: Validação - campo obrigatório faltando
  total++;
  if (await runTest('Validação: rejeitar usuário sem email', async () => {
    try {
      await User.create({
        nome: 'Teste',
        senha: 'hash',
        perfil: 'admin'
        // email faltando
      });
      throw new Error('Deveria ter rejeitado');
    } catch (error) {
      if (!error.message.includes('email')) throw new Error('Validação não funcionou corretamente');
    }
  })) passed++;

  console.log(`\nResultado Usuários: ${passed}/${total} testes passaram\n`);
  return { passed, total };
};

const testProdutores = async () => {
  console.log('🌾 Testando API de Produtores...\n');
  
  let passed = 0;
  let total = 0;

  // Teste 1: Listar produtores
  total++;
  if (await runTest('Listar produtores', async () => {
    const produtores = await Produtor.list();
    if (produtores.length === 0) throw new Error('Nenhum produtor encontrado');
  })) passed++;

  // Teste 2: Buscar por ID
  total++;
  if (await runTest('Buscar produtor por ID', async () => {
    const produtor = await Produtor.get('p1');
    if (!produtor) throw new Error('Produtor não encontrado');
  })) passed++;

  // Teste 3: Filtrar por status
  total++;
  if (await runTest('Filtrar produtores ativos', async () => {
    const ativos = await Produtor.filter({ status: 'ativo' });
    if (ativos.length === 0) throw new Error('Nenhum produtor ativo encontrado');
  })) passed++;

  // Teste 4: Criar produtor válido
  total++;
  if (await runTest('Criar produtor válido', async () => {
    const novo = await Produtor.create({
      nome: 'Produtor Teste',
      fazenda: 'Fazenda Teste',
      area_total: 100
    });
    if (!novo.id) throw new Error('Produtor não foi criado');
  })) passed++;

  // Teste 5: Atualizar produtor
  total++;
  if (await runTest('Atualizar produtor', async () => {
    const atualizado = await Produtor.update('p1', {
      cultura_atual: 'Trigo'
    });
    if (atualizado.cultura_atual !== 'Trigo') throw new Error('Produtor não foi atualizado');
  })) passed++;

  // Teste 6: Validação - area_total deve ser número
  total++;
  if (await runTest('Validação: rejeitar area_total inválida', async () => {
    try {
      await Produtor.create({
        nome: 'Teste',
        fazenda: 'Fazenda',
        area_total: -10 // negativo
      });
      throw new Error('Deveria ter rejeitado');
    } catch (error) {
      if (!error.message.includes('maior que zero')) throw new Error('Validação não funcionou');
    }
  })) passed++;

  console.log(`\nResultado Produtores: ${passed}/${total} testes passaram\n`);
  return { passed, total };
};

const testVisitas = async () => {
  console.log('📅 Testando API de Visitas...\n');
  
  let passed = 0;
  let total = 0;

  // Teste 1: Listar visitas
  total++;
  if (await runTest('Listar visitas', async () => {
    const visitas = await Visita.list();
    if (visitas.length === 0) throw new Error('Nenhuma visita encontrada');
  })) passed++;

  // Teste 2: Filtrar por produtor
  total++;
  if (await runTest('Filtrar visitas por produtor', async () => {
    const visitas = await Visita.filter({ produtor_id: 'p1' });
    if (!Array.isArray(visitas)) throw new Error('Resultado inválido');
  })) passed++;

  // Teste 3: Criar visita válida
  total++;
  if (await runTest('Criar visita válida', async () => {
    const nova = await Visita.create({
      produtor_id: 'p1',
      tecnico_responsavel: 'Teste',
      data_visita: new Date().toISOString(),
      objetivo: 'consultoria'
    });
    if (!nova.id) throw new Error('Visita não foi criada');
  })) passed++;

  console.log(`\nResultado Visitas: ${passed}/${total} testes passaram\n`);
  return { passed, total };
};

const testCadernoCampo = async () => {
  console.log('📖 Testando API de Caderno de Campo...\n');
  
  let passed = 0;
  let total = 0;

  // Teste 1: Listar registros
  total++;
  if (await runTest('Listar registros', async () => {
    const registros = await CadernoCampo.list();
    if (registros.length === 0) throw new Error('Nenhum registro encontrado');
  })) passed++;

  // Teste 2: Filtrar por tipo de atividade
  total++;
  if (await runTest('Filtrar por tipo de atividade', async () => {
    const plantios = await CadernoCampo.filter({ tipo_atividade: 'plantio' });
    if (!Array.isArray(plantios)) throw new Error('Resultado inválido');
  })) passed++;

  // Teste 3: Criar registro válido
  total++;
  if (await runTest('Criar registro válido', async () => {
    const novo = await CadernoCampo.create({
      produtor_id: 'p1',
      colaborador_responsavel: 'Teste',
      data_atividade: new Date().toISOString(),
      tipo_atividade: 'vistoria'
    });
    if (!novo.id) throw new Error('Registro não foi criado');
  })) passed++;

  console.log(`\nResultado Caderno de Campo: ${passed}/${total} testes passaram\n`);
  return { passed, total };
};

const testMapas = async () => {
  console.log('🗺️  Testando API de Mapas...\n');
  
  let passed = 0;
  let total = 0;

  // Teste 1: Listar mapas
  total++;
  if (await runTest('Listar mapas', async () => {
    const mapas = await Mapa.list();
    if (mapas.length === 0) throw new Error('Nenhum mapa encontrado');
  })) passed++;

  // Teste 2: Filtrar por categoria
  total++;
  if (await runTest('Filtrar por categoria', async () => {
    const fertilidade = await Mapa.filter({ categoria: 'fertilidade' });
    if (!Array.isArray(fertilidade)) throw new Error('Resultado inválido');
  })) passed++;

  // Teste 3: Criar mapa válido
  total++;
  if (await runTest('Criar mapa válido', async () => {
    const novo = await Mapa.create({
      titulo: 'Mapa Teste',
      categoria: 'plantio',
      produtor_id: 'p1',
      talhao: 'Teste'
    });
    if (!novo.id) throw new Error('Mapa não foi criado');
  })) passed++;

  console.log(`\nResultado Mapas: ${passed}/${total} testes passaram\n`);
  return { passed, total };
};

// ============================================
// EXECUTAR TODOS OS TESTES
// ============================================

export const runAllTests = async () => {
  console.log('\n' + '='.repeat(50));
  console.log('🧪 INICIANDO TESTES DA API INTEGRADA');
  console.log('='.repeat(50));

  const results = [];

  results.push(await testUsuarios());
  results.push(await testProdutores());
  results.push(await testVisitas());
  results.push(await testCadernoCampo());
  results.push(await testMapas());

  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalTests = results.reduce((sum, r) => sum + r.total, 0);

  console.log('='.repeat(50));
  console.log(`📊 RESULTADO FINAL: ${totalPassed}/${totalTests} testes passaram`);
  console.log('='.repeat(50) + '\n');

  if (totalPassed === totalTests) {
    log.success('Todos os testes passaram! 🎉');
  } else {
    log.warn(`${totalTests - totalPassed} teste(s) falharam`);
  }

  return { totalPassed, totalTests };
};

// Executar testes automaticamente se este arquivo for executado diretamente
if (typeof require !== 'undefined' && require.main === module) {
  runAllTests().catch(console.error);
}

export default runAllTests;
