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
