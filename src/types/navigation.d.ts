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
      NovaPropriedade: undefined;
      EditarPropriedade: { id: string } | undefined;
      NovaVisita: { fazendaId?: string; produtorId?: string } | undefined;
      VisitaDetail: { id?: string; visitaId?: string } | undefined;
      EditarVisita: { id?: string; visitaId?: string } | undefined;
      CadernoDetail: { id?: string; cadernoId?: string; registroId?: string } | undefined;
      NovoCaderno: { fazendaId?: string; produtorId?: string } | undefined;
      EditarCaderno: { id?: string; cadernoId?: string; registroId?: string } | undefined;
      Notificacoes: undefined;
      EditProfile: undefined;
      FazendaMapa: FazendaMapaRouteParams | undefined;
      Home: undefined;
      Propriedades: undefined;
      Visitas: undefined;
      Caderno: undefined;
      Perfil: undefined;
      PropriedadesColaborador: undefined;
      'Minhas Visitas': undefined;
      'Minhas Fazendas': undefined;
      Histórico: undefined;
    }
  }
}
