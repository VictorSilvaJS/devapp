export {};

declare global {
  namespace ReactNavigation {
    interface RootParamList {
      [routeName: string]: any;
      Login: undefined;
      Main: undefined;
      ProdutorDetail: { id: string } | undefined;
      Mapas: { produtorId?: string } | undefined;
      NovoProdutor: undefined;
      EditarProdutor: { id: string } | undefined;
      NovaVisita: undefined;
      VisitaDetail: { id?: string; visitaId?: string } | undefined;
      EditarVisita: { id?: string; visitaId?: string } | undefined;
      Notificacoes: undefined;
      EditProfile: undefined;
      Home: undefined;
      Produtores: undefined;
      Visitas: undefined;
      Caderno: undefined;
      Perfil: undefined;
      'Meus Produtores': undefined;
      'Minhas Visitas': undefined;
      'Minhas Fazendas': undefined;
      Histórico: undefined;
    }
  }
}
