import type {
  FazendaMapaRouteParams,
  MapasRouteParams,
} from '../navigation/mapaRouteCompat';

export {};

declare global {
  namespace ReactNavigation {
    interface RootParamList {
      [routeName: string]: any;
      Login: undefined;
      Main: undefined;
      ProdutorDetail: { id: string } | undefined;
      Mapas: MapasRouteParams | undefined;
      NovoProdutor: undefined;
      EditarProdutor: { id: string } | undefined;
      NovaVisita: undefined;
      VisitaDetail: { id?: string; visitaId?: string } | undefined;
      EditarVisita: { id?: string; visitaId?: string } | undefined;
      CadernoDetail: { id?: string; cadernoId?: string; registroId?: string } | undefined;
      NovoCaderno: { fazendaId?: string; produtorId?: string } | undefined;
      EditarCaderno: { id?: string; cadernoId?: string; registroId?: string } | undefined;
      Notificacoes: undefined;
      EditProfile: undefined;
      FazendaMapa: FazendaMapaRouteParams | undefined;
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
