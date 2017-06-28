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
