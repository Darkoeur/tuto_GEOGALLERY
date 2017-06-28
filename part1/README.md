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

On créé un fichier *src/utils.zms* contenant la macro **getLogin()** :

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

Enfin, modifiez *init.zms* pour qu'au déploiement notre index soit configuré.

```javascript
// fichier init.zms
// create a test user, to be able to run/debug macros from the eclipse UI
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

La syntaxe est propre à ElasticSearch et d'autres types sont disponibles, susceptibles de correspondre à votre utilisation.

// TODO - from here

## Côté Client ##

Le client sera réalisé sous la forme d'une application Ionic, mais il serait aussi facile de procéder à un client en HTML/javascript standard.

### Configuration ###

Crééons le projet et configurons le :
```bash
> ionic start <APPNAME> blank --type=ionic-angular
> cd <APPNAME>
> cordova platform add android
> npm install zetapush-js --save
> npm install zetapush-angular --save
```
**ZetaPush utilise la version 4 d'Angular, plus d'informations sur [le blog officiel](http://angularjs.blogspot.fr/2017/03/angular-400-now-available.html)**

Importons à présent ZetaPush dans notre application en modifiant le fichier *src/app/app.module.ts* :

```javascript
import { ZetaPushClientConfig, ZetaPushModule } from 'zetapush-angular';
...
imports: [
    ...,
    ZetaPushModule
],
...
providers: [
    ...,
    { provide: ZetaPushClientConfig, useValue: {sandboxId: '<yourId>'} }
]
```

Puis dans le fichier *src/pages/home/home.ts* - qui constitue notre composant principal - établissons une connexion à ZetaPush :

```javascript
import { Component, OnInit } from '@angular/core';
import { NavController, AlertController, Platform } from 'ionic-angular';
import { ZetaPushConnection } from 'zetapush-angular';

...

export class HomePage implements OnInit {

        constructor(
            public navCtrl: NavController,
            public alertCtrl: AlertController,
            private platform: Platform,
            private zpConnection: ZetaPushConnection) {}

        ngOnInit(): void {

            this.platform.ready().then(() => {
                this.zpConnection.connect().then(() => {
                    console.debug("ZetaPushConnection:OK");
                });
            });
        }
}
```
À ce stade il est d'ores et déjà possible de tester l'application client avec la commande `> ionic serve` qui la déploie à l'adresse `http://localhost:8100/`.

### Code ###

Pour gagner du temps voici le template qui permettra de présenter les notes de notre TODO liste, il ne tient qu'à vous de le modifier en vous basant sur les [composants ionic](https://ionicframework.com/docs/components/) et votre imagination personnelle. Il correspond au contenu du fichier *src/pages/home/home.html*.

```html
<!-- en-tête de notre application -->
<ion-header>
    <ion-navbar color="primary" no-border-bottom>
        <ion-title>
            <ion-icon name="albums"></ion-icon>
            My Todo List
        </ion-title>
    </ion-navbar>
</ion-header>

<ion-content>
    <ion-list>
        <!-- chaque note sera représentée de la sorte : -->
        <ion-card *ngFor="let note of notes">
            <ion-card-content>
                <p>{{note.text}}</p>
            </ion-card-content>
            <ion-row padding>
                <ion-col>
                    <button (click)="userDelete(note)" ion-button clear small color="dark" icon-only>
                        <ion-icon name="trash"></ion-icon>
                    </button>
                </ion-col>
            </ion-row>
        </ion-card>
    </ion-list>

    <!-- on propose à l'utilisateur trois boutons -->
    <button round (click)="userRefresh()" id="refreshButton" class="actionButtons" color="dark" ion-button icon-only>
        <ion-icon name="refresh"></ion-icon>
    </button>
    <button round (click)="userAddNote()" id="addButton" class="actionButtons" color="primary" ion-button icon-only>
        <ion-icon name="add"></ion-icon>
    </button>
    <button round (click)="userClear()" id="clearButton" class="actionButtons" color="danger" ion-button icon-only>
        <ion-icon name="trash"></ion-icon>
    </button>

</ion-content>
```

Modifions le css à appliquer en changeant le contenu de *src/pages/home/home.scss* de la sorte :
```css
.actionButtons {
    position: fixed;
    right: 30px;
    width: 50px;
    height: 50px;
}

#clearButton { bottom: 20px; }
#addButton { bottom: 90px; }
#refreshButton { bottom: 160px; }
```

Pour garantir un code clair, nous allons définir une API de gestion de notes. Celle-ci sera contenue dans la fichier *src/api/notes-api.service.ts*. Ni le fichier ni le répertoire n'existent, il vous faudra donc les créer au préalable.

```javascript
// fichier src/api/notes-api.service.ts
import { NgZone } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Api, ZetaPushClient, createApi } from 'zetapush-angular';

// représentation d'une note
export interface Note {
    id: string,
    text: string
}

// A feature will implement auto-generation
// of the code below in the future
export class NotesApi extends Api {

	// Observables to catch the server response
	// They act as listeners
	onPushNote: Observable<any>;
	onGetNotes: Observable<any>;
	onDeleteNotes: Observable<any>;

	// Names MUST match the macros on server

	pushNote({content}){
		return this.$publish('pushNote', {content});
	}

	getNotes({}){
		return this.$publish('getNotes', {});
	}

	deleteNotes({ids} : { ids : Array<string> }){
		return this.$publish('deleteNotes', {ids});
	}

	reset({}){
		return this.$publish('reset', {});
	}

}

export function NotesApiFactory(client: ZetaPushClient, zone: NgZone): NotesApi {
    return createApi(client, zone, NotesApi) as NotesApi;
}

export const NotesApiProvider = {
	provide: NotesApi, useFactory: NotesApiFactory, deps: [ ZetaPushClient, NgZone ]
}
```

Reprenons le code du fichier *src/app/app.module.ts* pour y intégrer l'API nouvellement créée.

```javascript
import { NotesApiProvider } from '../api/notes-api.service';
...
providers: [
    ...
    NotesApiProvider
]
...
```

Bonne nouvelle : c'est presque terminé ! Il ne reste désormais plus qu'à configurer les appels à notre API depuis notre composant principal *home* correspondant au fichier *src/pages/home/home.ts*.

```javascript
...
import { Note, NotesApi } from '../../api/notes-api.service';
...

export class HomePage implements OnInit {

    // where we will store our notes
    notes : Array<Note> = [];

    constructor(
        public navCtrl: NavController,
        public alertCtrl: AlertController,
        private platform: Platform,
        private zpConnection: ZetaPushConnection,
        private api: NotesApi) {

            // we set listeners to handle server response
            api.onGetNotes.subscribe((response) => {
                this.notes = [];
                response['notes'].forEach(note => {
                    this.notes.push(note);
                });
            });

            api.onPushNote.subscribe((response) => {
                this.notes.unshift(response['note']);
            });

            api.onDeleteNotes.subscribe((response) => {
                this.api.getNotes({});
            });

        }

        ngOnInit(): void {
            this.platform.ready().then(() => {
                this.zpConnection.connect().then(() => {
                    // getting notes from server after connection
                    this.api.getNotes({});
                });
            });
        }

        // functions user will trigger with buttons
        userAddNote() {
            let form = this.alertCtrl.create({
                title : 'Add a note',
                message : 'Enter the text of the note here',
                inputs: [
                    {
                        name: 'text',
                        placeholder: ''
                    }
                ],
                buttons: [
                    {
                        text: 'Cancel',
                        handler: data => {
                            // nothing
                        }
                    },
                    {
                        text: 'Add',
                        handler: data => {
                            this.api.pushNote({content:data.text});
                        }
                    }
                ]
            });
            form.present();
        }

        userClear() {
            this.api.reset({});
            this.notes = [];
        }

        userRefresh() {
            this.api.getNotes({});
        }

        userDelete(deleted : Note) {
            var ids = [];
            ids.push(deleted.id);
            this.api.deleteNotes({ids});
        }

}
```

Beaucoup de code mais rien de bien compliqué, des fonctions émettent des ordres au serveur  et l'on écoute la réponse de ce dernier au travers de souscriptions.
Pour lancer l'application, `ionic serve` et le tour est joué !
