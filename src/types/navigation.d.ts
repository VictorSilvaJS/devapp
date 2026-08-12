import type {
  FazendaMapaRouteParams,
  MapasRouteParams,
} from '../navigation/mapaRouteCompat';
import type { MaterialViewerRouteParams } from '../navigation/materialRouteCompat';
import type {
  FazendaIdRouteParams,
  PropriedadeDetailRouteParams,
} from '../navigation/propriedadeRouteCompat';

export {};

declare global {
  namespace ReactNavigation {
    interface RootParamList {
      [routeName: string]: any;
      Login: undefined;
      Main: undefined;
      ProdutorDetail: PropriedadeDetailRouteParams | undefined;
      Mapas: MapasRouteParams | undefined;
      MaterialViewer: MaterialViewerRouteParams;
      NovaPropriedade: undefined;
      EditarPropriedade: PropriedadeDetailRouteParams | undefined;
      NovaVisita: (FazendaIdRouteParams & { visitaOrigemId?: string }) | undefined;
      VisitaDetail: { id?: string; visitaId?: string } | undefined;
      EditarVisita: { id?: string; visitaId?: string } | undefined;
      ConcluirVisita: { id?: string; visitaId?: string } | undefined;
      CorrigirVisita: { id?: string; visitaId?: string } | undefined;
      CadernoDetail: { id?: string; cadernoId?: string; registroId?: string } | undefined;
      NovoCaderno: FazendaIdRouteParams | undefined;
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
