import { NgZone } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Api, ZetaPushClient, createApi } from 'zetapush-angular';

import { Location, ServerLocation } from './zeta-locations';

interface DeleteResult {
    id: string;
    success: boolean;
}

export class LocationsApi extends Api {

    onAddToMap: Observable<ServerLocation>;
    onGetMap: Observable<Array<ServerLocation>>;
    onRemoveFromMap: Observable<DeleteResult>;

    getMap({}) {
        return this.$publish('getMap', {});
    }

    addToMap({location}: {location: Location}) {
        return this.$publish('addToMap', {location});
    }

    removeFromMap({id}: {id: string}) {
        return this.$publish('removeFromMap', {id});
    }
}

export function LocationsApiFactory(client: ZetaPushClient, zone: NgZone): LocationsApi {
    return createApi(client, zone, LocationsApi) as LocationsApi;
}

export const LocationsApiProvider = {
    provide: LocationsApi,
    useFactory: LocationsApiFactory,
    deps: [ ZetaPushClient, NgZone ]
}
