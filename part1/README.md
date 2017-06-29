# Découverte de la géolocalisation avec ZetaPush #
*~ 30 minutes
Concepts : google maps, elasticsearch, observables*

## Introduction ##

ZetaPush en tant que Backend as a Service temps réel va nous permettre d'accélerer grandement notre développement côté serveur pour pouvoir rapidement se concentrer sur la partie client.  

Ce tutoriel est destiné aux personnes souhaitant explorer davantage les possibilités de ZetaPush. Certaines étapes déjà décrites dans d'autres tutoriels (tels que la todoliste ou la galerie photo) ne seront pas détaillées ici. Je vous invite à vous y référer en cas de doute !  

## Prérequis ##

Dans ce tutoriel, nous avons besoin d'*Eclipse*, d'*Angular* et d'*Ionic 2* donc veuillez les installer si nécessaire.

* **Eclipse** : [Téléchargement](https://www.eclipse.org/downloads/)
* **Angular** : `npm install -g @angular/cli`
* **Ionic** : `npm install -g ionic cordova`
* **GoogleMaps** : Munissez-vous d'une clé d'API Google Maps. Aucun paiement requis, la marche à suivre est détaillée [sur la page officielle Google Maps API](https://developers.google.com/maps/documentation/android-api/?hl=fr).

Le plugin ZetaPush pour Eclipse sera également requis, de même qu'une *sandbox* fonctionnelle sur la plateforme ZetaPush. Vous pourrez obtenir la marche à suivre en lisant le [Quickstart](https://doc.zetapush.com/quickstart/), parties *Sandbox Configuration* et *Setup your environment*.

## Côté ZetaPush ##

### Services ###  

Nouveau projet, nouvelle sandbox, on peut créer sans plus attendre une nouvelle recette sous Eclipse.

```javascript
// fichier recipe.zms
recipe com.zetapush.tutorials.zetamap 1.0.0;

/** Welcome message read from configuration */
const WELCOME_MESSAGE = @com.zetapush.tutorials.zetamap.welcomeMessage;
/** Constant to easily modify the index name */
const MAP_INDEX = 'map';

/** a simple authentication service */
service auth = simple(__default);

/** our code is run by this service */
service code = macro(__default) for 'src';

/** elastic search engine */
service es = search(__default).forbiddenVerbs(__all);

/** service giving access to the users informations */
service users = userdir(__default).forbiddenVerbs(__all);
```

ZetaPush propose un service nommé SearchEngine qui implémente le moteur de recherche ElasticSearch. Nous nous baserons sur celui-ci pour indexer nos lieux.

C'est dans *init.zms* que nous configurons notre index. Cette configuration sera effective après déploiement (!).

```javascript
// fichier init.zms

// variables declared in zms.properties, chosen values :
// login: john, password: travolta
auth.memauth_createUser({
	login:@zms.test.login,
	password:@zms.test.password,
	email:@com.zetapush.tutorials.zetamap.test.user.email
});

es.search_createIndex({
	index: MAP_INDEX,
	mappings: {
		location: {
			properties: {
				coords: {
					type: "geo_point"
				},
				name: {
					type: "string"
				},
				tags: {
					type: "string"
				},
				desc: {
					type: "string"
				},
				creator: {
					type: "string"
				}
			}

		}
	}
});
```

On créé ensuite un fichier *src/utils.zms* contenant la macro **getLogin()** :

```javascript
/**
* var { result : { login: login }} = call getLogin();
* will give the login of the current user
*/
macroscript getLogin () {

	var keys = [__userKey];

	// using the service User Directory
	var { users } = users.userInfo({userKeys : keys});
	trace(users);
	var login = users[__userKey]['login'];

} return { login }
```

Puis trois macros pour interagir avec notre index 'map'. Respectivement contenues dans trois fichiers :  

```javascript
// fichier src/map/addToMap.zms
/** add a location to the map */
macroscript addToMap(object location) {

	var id = str:rnd36(8);

	var { result : { login: login }} = call getLogin();

	var date = time:now();

	var tags = str:upper(location.tags);

	var location_data = {
		coords: location.coords,
		name: location.name,
		tags: tags,
		desc: location.desc,
		date: date,
		creator: login
	};

	es.index({
		'type': 'location',
		'id': id,
		'index': MAP_INDEX,
		'data': location_data
	});

	location_data.id = id;

} broadcast { location_data } on channel __selfName
```

```javascript
// fichier src/map/getMap.zms
/** obtain ALL the locations stored in the elastic search engine */
macroscript getMap() {
	var searchResult = es.search({
		indices: [MAP_INDEX],
		query: {
			"match_all": {}
		}
	});

	var locations = [];

	for result in searchResult.items.content {
		var location = result.data;
		location.id = result.id;
		locations = list:add(locations, location);
	}

} return { locations } on channel __selfName
```

```javascript
// fichier src/map/removeFromMap.zms
macroscript removeFromMap(string id) {

	es.delete({type : 'location', id : id, index : MAP_INDEX});

	var deletion = {
		id: id,
		success: true
	};

} broadcast { deletion } on channel __selfName
```

Et voilà notre moteur de recherche prêt à indexer des lieux !

// TODO - from here

## Côté Client ##

Pour une expérience utilisateur fluide, nous allons baser notre Client sur une application mobile réalisée avec Ionic/Cordova et Angular.

### Configuration ###

Crééons le projet et configurons le :
```bash
> ionic start <APPNAME> blank --type=ionic-angular
> cd <APPNAME>
> cordova platform add android
> npm install zetapush-js --save
> npm install zetapush-angular --save
> ionic cordova plugin add cordova-plugin-googlemaps --variable API_KEY_FOR_ANDROID=<yourApiKey>
> npm install @ionic-native/google-maps --save
```

Pensez à vérifier votre version d'Angular (version 4 requise).

**IMPORTANT** : Comment allons-nous procéder ?  
* **Service LocationsApi**, permet d'appeler les macros disponibles côté serveur
* **Service ZetaLocations**,réutilisant le service précédent et se charge de la mémorisation (+ définit les interfaces)
* **Service MessageService** (optimisation), centralise tous les messages, popups, toasts, etc...
* **Composant HomePage**, point d'entrée de l'application montrant la carte et gérant les évènements associés
* **Composant AddLocation**, formulaire pour confirmer l'ajout d'un Lieu
* **Composant DebugLocations**, présente les Lieux sous la forme d'une liste

N'oubliez pas de correctement importer les différents composants & services au niveau de *app.module.ts* au fur et à mesure pour vous éviter une liste d'erreurs.

#### Services requis pour ZetaPush ####

```javascript
// fichier src/providers/zeta-locations/locations-api.service.ts
import { NgZone } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Api, ZetaPushClient, createApi } from 'zetapush-angular';

// TODO: ZetaLocations interfaces (next step)
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
```

```javascript
// fichier src/providers/zeta-locations/zeta-locations.ts
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

    // Stockage en mémoire des Lieux
    serverLocations: Array<ServerLocation>;

    // Un BehaviorSubject pour agir tel un proxy
    private _locations: BehaviorSubject<Array<ServerLocation>> = new BehaviorSubject([]);

    // Attention, on n'expose pas directement _locations !
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
            },
            error => {
                // error server
            }
        );
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
```

#### Client générique ####

```javascript
// fichier src/providers/messages/messages.service.ts
import { Injectable } from '@angular/core';
import { ToastController } from 'ionic-angular';

@Injectable()
export class MessageService {

    constructor(public toastr: ToastController) { }

    locationAdded() {
        let toast = this.toastr.create({
            message: 'Location added !',
            position: 'bottom',
            duration: 2000
        });
        toast.present();
    }

    connected() {
        let toast = this.toastr.create({
            message: 'Connected to ZetaPush !',
            position: 'bottom',
            duration: 2000
        });
        toast.present();
    }

}
```

```javascript
// fichier src/pages/home/home.ts
import { Component } from '@angular/core';
import { NavController, ModalController, Platform } from 'ionic-angular';

import { AddLocation } from '../add-location/add-location';
import { DebugLocations } from '../debug-locations/debug-locations';

import {
    GoogleMaps,
    GoogleMap,
    GoogleMapsEvent,
    LatLng,
    CameraPosition,
    MarkerOptions,
    Marker
} from '@ionic-native/google-maps';

import { Coords, Location, ServerLocation } from '../../providers/zeta-locations/zeta-locations';
import { MessageService } from '../../providers/messages/messages.service';

import { ZetaPushConnection } from 'zetapush-angular';
// ZetaLocations for getting locations and interact
import { ZetaLocations } from '../../providers/zeta-locations/zeta-locations';

@Component({
    selector: 'page-home',
    templateUrl: 'home.html',
    providers: [MessageService]
})
export class HomePage {

    map: GoogleMap;
    selected: ServerLocation;

    constructor(public navCtrl: NavController,
                public modalCtrl: ModalController,
                public platform: Platform,
                private googleMaps: GoogleMaps,
                private messages: MessageService,
                private zpConnection: ZetaPushConnection,
                private zpLocations: ZetaLocations) {

        platform.ready().then(() => {
            zpConnection.connect({login: 'john', password: 'travolta'}).then(() => {
                // we're connected
                messages.connected();

                // subscribing
                this.zpLocations.locations.subscribe(
                    list => {
                        this.draw(list);
                    },
                    error => {
                        // Error happend
                    }
                );

                this.zpLocations.list();

            });
        });

        this.selected = null;
    }

    ngAfterViewInit() {
        this.loadMap();
    }

    loadMap() {
        let element: HTMLElement = document.getElementById('map');
        this.map = this.googleMaps.create(element);
        this.map.one(GoogleMapsEvent.MAP_READY).then(
            () => {

                let pos_Republique: Coords = {
                    lat: 48.109798622,
                    lng: -1.6791795194
                };

                this.move(pos_Republique);

                this.map.on(GoogleMapsEvent.MAP_LONG_CLICK).subscribe(
                    (coords: Coords) => {
                        this.navCtrl.push(AddLocation, {coords: coords});
                    }
                );

                this.map.on(GoogleMapsEvent.MAP_CLICK).subscribe(
                    (coords: Coords) => {
                        this.selected = null;
                    }
                );

            }
        );

    }

    draw(locations: Array<ServerLocation>): void {
        this.map.clear();

        // We draw each marker
        for(let k = 0; k < locations.length; k++) {
            this.addMarker(locations[k]).then(
                // Once drawn, we can add an event listener to it
                (marker: Marker) => {
                    marker.on(GoogleMapsEvent.MARKER_CLICK).subscribe(() => {
                        this.selected = locations[k];
                    });
                }
            );
        }
    }

    // Add a marker
    addMarker(location: ServerLocation): Promise<Marker> {
        let target: LatLng = new LatLng(location.coords.lat, location.coords.lon);
        let markerOpts: MarkerOptions = {
            position: target,
            title: location.name,
            snippet: location.desc
        };

        return this.map.addMarker(markerOpts);
    }

    // Move the camera
    move(position: Coords) {
        let target: LatLng = new LatLng(position.lat,position.lng);

        let camera: CameraPosition = {
            target: target,
            zoom: 18,
            tilt: 45
        };

        this.map.moveCamera(camera);
    }

    /* USER INTERFACE */
    canDelete(): boolean {
        return (this.selected != null);
    }

    delete(): void {
        if(this.canDelete()) {
            this.zpLocations.remove(this.selected);
            this.selected = null;
        }
    }

    debug(): void {
        this.navCtrl.push(DebugLocations);
    }

}
```

```html
<!-- fichier src/pages/home/home.html -->
<ion-header>
    <ion-navbar color="danger">
        <ion-title>
            GMap Sample
        </ion-title>
    </ion-navbar>
</ion-header>

<ion-content>
    <div #map id="map" style="height:100%;">
        <button class="trash-button" outline large color="dark" [disabled]="!canDelete()" (click)="delete()" ion-button icon-only>
            <ion-icon name="trash"></ion-icon>
        </button>

        <button class="debug-button" large color="primary" (click)="debug()" ion-button icon-only>
            <ion-icon name="construct"></ion-icon>
        </button>
    </div>
</ion-content>
```

```css
/* fichier src/pages/home/home.scss */
page-home {
    .trash-button {
        position: absolute;
        bottom: 60px;
        right: 30px;
    }

    .debug-button {
        position: absolute;
        top: 20px;
        right: 20px;
    }
}
```

Et enfin les deux dernières pages *AddLocation* et *DebugLocations*, générées respectivement avec `> ionic generate page add-location` et `> ionic generate page debug-locations`;

```javascript
// fichier src/pages/add-location/add-location.ts
import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';

import { Coords, Location, ZetaLocations } from '../../providers/zeta-locations/zeta-locations';

import { MessageService } from '../../providers/messages/messages.service';

@IonicPage()
@Component({
    selector: 'page-add-location',
    templateUrl: 'add-location.html',
    providers: [MessageService]
})
export class AddLocation {

    coords: Coords;
    name: string;
    desc: string;
    tags: string;

    constructor(public navCtrl: NavController,
                public navParams: NavParams,
                private zetaLocations: ZetaLocations,
                private messages: MessageService) {

    }

    ionViewWillEnter() {
        this.coords = this.navParams.get('coords');
        this.name = "";
        this.desc = "";
        this.tags = "";
    }

    formComplete(): boolean {
        return (this.name != "" && this.desc != "" && this.tags != "");
    }

    add(): void {
        if(this.formComplete()){
            const location: Location = {
                name: this.name,
                desc: this.desc,
                tags: this.tags,
                coords: {
                    lat: this.coords.lat,
                    lon: this.coords.lng
                }
            };

            this.messages.locationAdded();
            this.zetaLocations.add(location);
            this.navCtrl.pop();
        }
    }

}
```
```html
<!-- fichier src/pages/add-location/add-location.html -->
<ion-header>
    <ion-navbar color="danger">
        <ion-title>Add a new location</ion-title>
    </ion-navbar>
</ion-header>

<ion-content padding>

      <ion-item>
        <ion-label floating>Name :</ion-label>
        <ion-input [(ngModel)]="name" type="text"></ion-input>
      </ion-item>

      <ion-item>
        <ion-label floating>Description :</ion-label>
        <ion-input [(ngModel)]="desc" type="text"></ion-input>
      </ion-item>

      <ion-item>
        <ion-label floating>Tags :</ion-label>
        <ion-input [(ngModel)]="tags" type="text"></ion-input>
      </ion-item>

    <br/>

    <button ion-button full large color="primary" (click)="add()" [disabled]="!formComplete()">Submit</button>

</ion-content>
```

Il est déjà possible de tester l'application pour les pressés, le dernier composant est facultatif étant donné qu'il se résume simplement à une autre vue de nos Lieux.

```javascript
// fichier src/pages/debug-locations/debug-locations.ts
import { Component, OnDestroy } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';

import { ServerLocation, ZetaLocations } from '../../providers/zeta-locations/zeta-locations';

@IonicPage()
@Component({
    selector: 'page-debug-locations',
    templateUrl: 'debug-locations.html'
})
export class DebugLocations implements OnDestroy {

    locations: Array<ServerLocation> = [];
    subscription: any;

    constructor(private zpLocations: ZetaLocations, public navCtrl: NavController, public navParams: NavParams) {

        // Using a subscription and not just a getValue() in case
        // Locations are modified with another device (real-time sync)
        this.subscription = this.zpLocations.locations.subscribe(
            list => {
                this.locations = list;
            }
        );
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}
```

```html
<!-- fichier src/pages/debug-locations/debug-locations.html -->
<ion-header>
    <ion-navbar>
        <ion-title>Locations - debug tool</ion-title>
    </ion-navbar>
</ion-header>

<ion-content padding>

    <ion-card *ngFor="let location of locations">
        <ion-item>
            <h1>{{location.name}}</h1>
        </ion-item>
        <ion-card-content>
            <p>{{location.desc}}</p>
            <p><i>{{location.tags}}</i></p>
        </ion-card-content>
        <ion-row>
            <ion-col>
                <button ion-button icon-left clear small>
                    <ion-icon name="contact"></ion-icon>
                    <div>{{location.creator}}</div>
                </button>
            </ion-col>
            <ion-col>
                <button color="danger" ion-button icon-left clear small>
                    <ion-icon name="calendar"></ion-icon>
                    <div>{{location.date | date:"dd/MM/yy HH:mm"}}</div>
                </button>
            </ion-col>
            <ion-col class="center">
                <ion-chip>
                    <ion-icon name="finger-print" color="dark"></ion-icon>
                    <ion-label>{{location.id}}</ion-label>
                </ion-chip>
            </ion-col>
        </ion-row>
    </ion-card>

</ion-content>
```

Terminé ! Cette première partie servira de support pour le coeur de ce tutoriel : intégrer une recette issue d'un autre projet.  

C'est d'ailleurs la raison pour laquelle la partie Client est peu expliquée, et sera de plus en plus reléguée au second plan par rapport à la partie Serveur.
