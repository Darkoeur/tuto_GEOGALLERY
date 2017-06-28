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

Beaucoup de code mais rien de bien compliqué, des fonctions émettent des ordres au serveur  et l'on écoute la réponse de ce dernier au travers de souscriptions.
Pour lancer l'application, `ionic serve` et le tour est joué !
