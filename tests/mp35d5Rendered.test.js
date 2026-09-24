const assert = require('node:assert/strict');
const test = require('node:test');
// Reuses real NavigationContainer/native-stack; also registers 11 inherited D-2 cases.
const nav = require('./mp35d2RenderedNavigation.test');
const data = require('./fixtures/mp35d5');
const { act, flush, renderedFixture, mountFixture, unmount, httpNavigationRef, rootState } = nav;
const { user, page, relation, historicRelation, titular, property, receipt, ok, failure, deferred, PROPERTY, SECOND, PRODUCER } = data;
const SelectField = require('../.tmp-mp35d2-navigation/src/components/SelectField').default;
function texts(root) { return root.findAllByType('Text').flatMap(n => n.children).filter(x => typeof x === 'string').join(' '); }
function button(root, label) { return root.findAll(n => ['Pressable','TouchableOpacity'].includes(n.type) && typeof n.props.onPress === 'function' &&
  n.findAllByType('Text').some(t => t.children.includes(label))).sort((a,b) => a.findAllByType('Text').length-b.findAllByType('Text').length)[0]; }
async function press(root, label, twice=false) { const b=button(root,label); assert.ok(b, label); assert.ok(!b.props.disabled, `${label} habilitado`);
  await act(async()=>{ b.props.onPress(); if(twice) b.props.onPress(); }); await flush(); }
const modal = r => r.root.findAllByType('Modal').find(n=>n.props.visible && n.props.transparent === false);
const stack = () => rootState().routes.map(({name,key})=>({name,key}));
async function mount(t, options={}) {
  const f={ requests:[], handlers:{}, user:user({id:nav.USER_ID,...options.user}), items:options.items ?? [relation()] };
  const transport=request=>{
    const path=new URL(request.url).pathname;
    if(path === '/v1/auth/refresh') return failure(401,'invalid_session');
    if(path === `/v1/usuarios/${nav.USER_ID}/propriedades`) {
      f.requests.push(request);
      if(request.method==='PATCH') {
        if(f.handlers.patch) return f.handlers.patch(request);
        f.user={...f.user,versao:f.user.versao+1};
        f.items=f.items.map(item=>({...item,status_vinculo:request.body.remover.includes(item.propriedade_id)?'inativo':request.body.adicionar.includes(item.propriedade_id)?'ativo':item.status_vinculo}));
        return ok(receipt({recurso_id:nav.USER_ID,versao:f.user.versao}));
      }
      return f.handlers.relations?.(request) ?? ok(page({usuario_id:nav.USER_ID,versao:f.user.versao,itens:f.items}));
    }
    if(path === `/v1/usuarios/${nav.USER_ID}` && request.method === 'GET') return ok(f.user);
    if(path === '/v1/propriedades') return ok({itens:[property()],paginacao:{proximo_cursor:null}});
    return undefined;
  };
  const context = Object.assign(renderedFixture({additionalTransport:transport,initialProfile:options.profile ?? 'admin'}),f);
  const renderer=await mountFixture(context,options.strict); t.after(async()=>{await unmount(renderer);});
  await act(async()=>httpNavigationRef.navigate('AdministrativeUserDetail',{id:nav.USER_ID})); await flush();
  f.patches=()=>f.requests.filter(r=>r.method==='PATCH');
  return { f,renderer,context };
}
async function open(renderer) { await press(renderer.root,'Acessos a Propriedades'); assert.ok(modal(renderer)); return modal(renderer); }
async function removeAndReview(renderer) {
  const root=modal(renderer); await press(root,'Remover vínculo: Propriedade Um');
  await act(async()=>root.findAllByType(SelectField).find(n=>n.props.label==='Motivo').props.onChange('fim_relacao'));
  await press(root,'Revisar vínculos');
}

test('F01 UI original: histórico de Colaborador aparece inativo e não envia PATCH',async t=>{
  const {f,renderer}=await mount(t,{user:{status:'inativo'},items:[historicRelation()]}); await open(renderer);
  assert.match(texts(modal(renderer)),/Propriedade histórica/);
  assert.match(texts(modal(renderer)),/Vínculo direto inativo/);
  assert.match(texts(modal(renderer)),/Sem acesso efetivo: Usuário não está ativo/);
  assert.ok(button(modal(renderer),'Pesquisar Propriedades'));
  assert.equal(button(modal(renderer),'Revisar vínculos').props.disabled,true);
  assert.equal(f.patches().length,0);
});
test('F01 UI: Produtor consulta histórico colaborador e mantém Titularidade somente leitura',async t=>{
  const history=historicRelation({tipo_vinculo:'colaborador'});
  const {f,renderer}=await mount(t,{user:{perfil:'produtor',produtor_id:PRODUCER},items:[titular(),history]}); await open(renderer);
  assert.match(texts(modal(renderer)),/Propriedade histórica/); assert.match(texts(modal(renderer)),/Vínculo direto inativo/);
  assert.match(texts(modal(renderer)),/Este vínculo inativo não concede acesso/);
  assert.match(texts(modal(renderer)),/Titularidade · somente leitura/);
  assert.equal(!!button(modal(renderer),'Remover vínculo: Propriedade Um'),false);
  assert.ok(button(modal(renderer),'Reativar vínculo: Propriedade histórica')); assert.equal(f.patches().length,0);
});

test('F01 UI: Admin consulta ambos os tipos históricos sem ações de vínculo',async t=>{
  const items=[historicRelation(),historicRelation({id:data.id(9),propriedade_id:PROPERTY,
    propriedade_nome:'Histórico Colaborador',tipo_vinculo:'colaborador'})];
  const {f,renderer}=await mount(t,{user:{perfil:'admin'},items}); await open(renderer);
  const text=texts(modal(renderer)); assert.match(text,/Propriedade histórica/); assert.match(text,/Histórico Colaborador/);
  assert.equal((text.match(/Vínculo direto inativo/g)||[]).length,2); assert.match(text,/acesso global/);
  for(const label of ['Reativar vínculo: Propriedade histórica','Reativar vínculo: Histórico Colaborador',
    'Pesquisar Propriedades','Revisar vínculos']) assert.equal(!!button(modal(renderer),label),false);
  assert.equal(f.patches().length,0);
});

test('F01 UI: adicionar acesso atual exige confirmação e preserva registro de tipo histórico',async t=>{
  const history=historicRelation(); const {f,renderer}=await mount(t,{items:[history]}); await open(renderer);
  assert.match(texts(modal(renderer)),/Este vínculo inativo não concede acesso/);
  assert.doesNotMatch(texts(modal(renderer)),/Condições de acesso atendidas/);
  // SQL reuses only an inactive row of the derived current type; otherwise it creates a new row.
  f.handlers.patch=()=>{
    f.user={...f.user,versao:5}; f.items=[history,relation({id:data.id(10),propriedade_id:SECOND,
      propriedade_nome:history.propriedade_nome,versao_vinculo:1})];
    return ok(receipt({recurso_id:nav.USER_ID,versao:5}));
  };
  await press(modal(renderer),'Reativar vínculo: Propriedade histórica');
  await act(async()=>modal(renderer).findAllByType(SelectField).find(n=>n.props.label==='Motivo').props.onChange('correcao_administrativa'));
  await press(modal(renderer),'Revisar vínculos'); assert.equal(f.patches().length,0);
  await press(modal(renderer),'Confirmar vínculos');
  assert.deepEqual(f.patches()[0].body,{versao:4,adicionar:[SECOND],remover:[],motivo:'correcao_administrativa'});
  assert.equal(f.patches().length,1); assert.deepEqual(f.items[0],history);
  assert.match(texts(modal(renderer)),/Vínculos atualizados/);
  assert.match(texts(modal(renderer)),/Vínculo direto inativo/); assert.match(texts(modal(renderer)),/Vínculo direto ativo/);
});

test('F01 UI: coleção mista permite remover outro vínculo e continua exibindo histórico',async t=>{
  const history=historicRelation(); const {f,renderer}=await mount(t,{items:[relation(),history]}); await open(renderer);
  assert.match(texts(modal(renderer)),/Propriedade histórica/); await removeAndReview(renderer);
  await press(modal(renderer),'Confirmar vínculos');
  assert.deepEqual(f.patches()[0].body.remover,[PROPERTY]); assert.deepEqual(f.patches()[0].body.adicionar,[]);
  assert.match(texts(modal(renderer)),/Vínculos atualizados/); assert.match(texts(modal(renderer)),/Propriedade histórica/);
  assert.deepEqual(f.items[1],history); assert.equal(f.patches().length,1);
});

test('D5 UI: remoção e reconciliação mantêm detalhe/key, modal opaco e confirmação explícita',async t=>{
  const {f,renderer}=await mount(t); const before=stack(); await open(renderer);
  assert.match(texts(modal(renderer)),/Vínculo direto ativo/); await removeAndReview(renderer);
  assert.equal(f.patches().length,0); assert.match(texts(modal(renderer)),/sessões do Usuário afetado/);
  await press(modal(renderer),'Confirmar vínculos',true); assert.equal(f.patches().length,1);
  assert.match(texts(modal(renderer)),/Vínculos atualizados/); assert.match(texts(modal(renderer)),/Vínculo direto inativo/);
  assert.deepEqual(stack(),before); await press(modal(renderer),'Fechar'); assert.equal(!!modal(renderer),false); assert.deepEqual(stack(),before);
});
test('D5 UI: Cancelar antes do envio não escreve; callback antigo não fecha nova instância',async t=>{
  const {f,renderer}=await mount(t); await open(renderer); const old=button(modal(renderer),'Cancelar').props.onPress;
  await press(modal(renderer),'Cancelar'); await open(renderer); await act(async()=>old()); await flush();
  assert.ok(modal(renderer)); assert.equal(f.patches().length,0);
});
test('D5 UI: boundary do modal aguarda revalidação e foco antigo não libera nova instância',async t=>{
  const {f,renderer,context}=await mount(t); await open(renderer);
  await press(modal(renderer),'Remover vínculo: Propriedade Um');
  const boundary=modal(renderer).findAllByType('HttpPrivacyView')[0]; assert.ok(boundary);
  const oldFocus=boundary.props.onPrivacyFocus;
  await act(async()=>oldFocus({nativeEvent:{generation:23,focused:true}}));
  assert.equal(context.calls.me,1); assert.equal(boundary.props.releasedGeneration,-1);
  await act(async()=>context.pendingRevalidations[0].resolve(ok(context.sessionIdentityWire()))); await flush();
  assert.equal(boundary.props.releasedGeneration,23); assert.match(texts(modal(renderer)),/Alterações selecionadas/);
  await press(modal(renderer),'Cancelar'); await open(renderer);
  await act(async()=>oldFocus({nativeEvent:{generation:24,focused:true}})); await flush();
  assert.equal(context.calls.me,1); assert.equal(modal(renderer).findAllByType('HttpPrivacyView')[0].props.releasedGeneration,-1);
  assert.equal(f.patches().length,0);
});
test('D5 UI: recibo seguido de falha preserva modal e recovery não repete PATCH',async t=>{
  const {f,renderer}=await mount(t); await open(renderer); await removeAndReview(renderer);
  f.handlers.relations=()=>failure(503,'service_unavailable'); await press(modal(renderer),'Confirmar vínculos');
  assert.match(texts(modal(renderer)),/Alteração confirmada/); assert.equal(!!button(modal(renderer),'Confirmar vínculos'),false);
  await press(modal(renderer),'Tentar atualizar acessos',true); assert.equal(f.patches().length,1);
  delete f.handlers.relations; await press(modal(renderer),'Tentar atualizar acessos'); assert.match(texts(modal(renderer)),/Vínculos atualizados/);
  assert.equal(f.patches().length,1);
});
test('D5 UI: adicionar por busca remota e reativar item inativo',async t=>{
  const {f,renderer}=await mount(t,{items:[relation({status_vinculo:'inativo',propriedade_status:'inativa'})]}); await open(renderer);
  assert.match(texts(modal(renderer)),/Sem acesso efetivo: Propriedade inativa/);
  await press(modal(renderer),'Reativar vínculo: Propriedade Um'); await press(modal(renderer),'Pesquisar Propriedades');
  await press(modal(renderer),'Adicionar acesso: Propriedade Dois');
  await act(async()=>modal(renderer).findAllByType(SelectField).find(n=>n.props.label==='Motivo').props.onChange('correcao_administrativa'));
  await press(modal(renderer),'Revisar vínculos'); await press(modal(renderer),'Confirmar vínculos');
  assert.deepEqual(f.patches()[0].body.adicionar,[PROPERTY,SECOND].sort()); assert.deepEqual(f.patches()[0].body.remover,[]);
});
test('D5 UI: desfazer seleção elimina confirmação sem efeito',async t=>{
  const {f,renderer}=await mount(t); await open(renderer); await press(modal(renderer),'Remover vínculo: Propriedade Um');
  await press(modal(renderer),'Desfazer: Propriedade Um'); assert.equal(button(modal(renderer),'Revisar vínculos').props.disabled,true);
  assert.equal(f.patches().length,0);
});
test('D5 UI: titularidade e Admin alvo somente leitura',async t=>{
  const {f,renderer}=await mount(t,{user:{perfil:'produtor',produtor_id:PRODUCER},items:[titular()]}); await open(renderer);
  assert.match(texts(modal(renderer)),/Titularidade · somente leitura/); assert.equal(!!button(modal(renderer),'Remover vínculo: Propriedade Um'),false);
  await press(modal(renderer),'Pesquisar Propriedades'); assert.equal(!!button(modal(renderer),'Adicionar acesso: Propriedade Dois'),false);
  assert.equal(f.patches().length,0);
});
test('D5 UI: Admin alvo tem mensagem global e nenhum comando',async t=>{
  const {f,renderer}=await mount(t,{user:{perfil:'admin'},items:[]}); await open(renderer);
  assert.match(texts(modal(renderer)),/acesso global/); assert.equal(!!button(modal(renderer),'Revisar vínculos'),false); assert.equal(f.patches().length,0);
});
test('D5 UI: conflito exige nova decisão; não salva automaticamente',async t=>{
  const {f,renderer}=await mount(t); await open(renderer); await removeAndReview(renderer);
  f.handlers.patch=()=>{f.user={...f.user,versao:8}; return failure(409,'version_conflict');}; await press(modal(renderer),'Confirmar vínculos');
  assert.match(texts(modal(renderer)),/não foi aplicada/); assert.equal(f.patches().length,1); await press(modal(renderer),'Nova decisão de vínculos');
  assert.equal(button(modal(renderer),'Revisar vínculos').props.disabled,true);
});
test('D5 UI: StrictMode conserva lifecycle e dispose impede resposta antiga',async t=>{
  const {f,renderer}=await mount(t,{strict:true}); await open(renderer); await removeAndReview(renderer);
  const gate=deferred(); f.handlers.patch=()=>gate.promise; await press(modal(renderer),'Confirmar vínculos');
  await press(modal(renderer),'Fechar'); await open(renderer);
  await act(async()=>gate.resolve(ok(receipt({recurso_id:nav.USER_ID})))); await flush();
  assert.ok(modal(renderer)); assert.doesNotMatch(texts(modal(renderer)),/Vínculos atualizados/); assert.equal(f.patches().length,1);
});
for(const status of [401,403]) test(`D5 UI: ${status} limpa nova superfície`,async t=>{
  const {f,renderer}=await mount(t); await open(renderer); await removeAndReview(renderer);
  f.handlers.patch=()=>failure(status,status===401?'invalid_session':'forbidden'); await press(modal(renderer),'Confirmar vínculos');
  assert.equal(!!modal(renderer),false); assert.equal(f.patches().length,1);
});
test('D5 UI: 403 após publicação incidental descarta o modal sem bloquear nova instância',async t=>{
  const {f,renderer,context}=await mount(t); await open(renderer); await removeAndReview(renderer);
  const gate=deferred(); f.handlers.patch=()=>gate.promise; await press(modal(renderer),'Confirmar vínculos');
  await act(async()=>{
    const boundary=context.runtime.administrativeUserData, lease=boundary.issueLease();
    boundary.publishAuthoritativeUser(lease,{...f.user,versao:8}); boundary.revokeLease(lease);
    gate.resolve(failure(403,'forbidden'));
  }); await flush();
  assert.equal(!!modal(renderer),false); assert.equal(f.patches().length,1);
  await open(renderer); assert.match(texts(modal(renderer)),/Consultar acessos cadastrados/);
});
for(const profile of ['produtor','colaborador']) test(`D5 UI: ${profile} não abre detalhe administrativo por navegação direta`,async t=>{
  const {f,renderer}=await mount(t,{profile}); assert.equal(!!button(renderer.root,'Acessos a Propriedades'),false); assert.equal(f.requests.length,0);
});
