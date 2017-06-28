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
