import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import { LocationsApi } from './locations-api.service';

export interface Coords {
    lat: number;
    // lng for the google maps LatLng object
    lng?: number;
    // lon for the geo_point ElasticSearch object
    lon?: number;
}

// On client-side
export interface Location {
    coords: Coords;
    name: string;
    tags: string;
    desc: string;
}

// On server-side
export interface ServerLocation {
    coords: Coords;
    name: string;
    tags: string;
    desc: string;
    date: number;
    creator: string;
    id: string;
}


@Injectable()
export class ZetaLocations {

    serverLocations: Array<ServerLocation>;
    private _locations: BehaviorSubject<Array<ServerLocation>> = new BehaviorSubject([]);
    public readonly locations: Observable<Array<ServerLocation>> = this._locations.asObservable();

    constructor(private locationsApi: LocationsApi) {

        // Components will subscribe to locations
        this.locationsApi.onAddToMap.subscribe(
            serverResponse => {
                this.serverLocations.push(serverResponse['location_data']);
                this._locations.next(this.serverLocations);
            },
            error => {
                // error server
            }
        );

        this.locationsApi.onGetMap.subscribe(
            serverResponse => {
                this.serverLocations = serverResponse['locations'];
                this._locations.next(this.serverLocations);
            },
            error => {
                // error server
            }
        );

        this.locationsApi.onRemoveFromMap.subscribe(
            serverResponse => {
                let i = -1;
                for(let j = 0; i == -1 && j < this.serverLocations.length; j++){
                    if(this.serverLocations[j].id == serverResponse['deletion']['id']){
                        i = j;
                        this.serverLocations.splice(i, 1);
                        this._locations.next(this.serverLocations);
                    }
                }
            }
        )
    }

    add(location: Location): void {
        this.locationsApi.addToMap({location: location});
    }

    list(): void {
        this.locationsApi.getMap({});
    }

    remove(location: ServerLocation): void {
        this.locationsApi.removeFromMap({id: location.id});
    }

}
