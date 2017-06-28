import { Injectable } from '@angular/core';
import { ToastController, AlertController, LoadingController } from 'ionic-angular';

@Injectable()
export class MessageService {

    blocker: any;

    constructor(public toastr: ToastController,
                public alerts: AlertController,
                public loading: LoadingController) { }


    blockScreen() {
        this.blocker = this.loading.create({
            content: "Please wait...",
            duration: 5000
        });
        this.blocker.present();
    }

    unblockScreen() {
        this.blocker.dismiss();
    }

    locationAdded() {
        let toast = this.toastr.create({
            message: 'Location added !',
            position: 'bottom',
            duration: 2000
        });
        toast.present();
    }

    cantAddLocation() {
        let toast = this.toastr.create({
            message: 'Fill in the form first.',
            position: 'center',
            duration: 2000
        });
        toast.present();
    }

    welcome() {
        let alert = this.alerts.create({
            title: 'Welcome',
            subTitle: 'Click on the map to add a location to it',
            buttons: ['Understood !']
        });
        alert.present();
    }

    connected() {
        let toast = this.toastr.create({
            message: 'Connected to ZetaPush !',
            position: 'bottom',
            duration: 2000
        });
        toast.present();
    }

    selected(id: string) {
        let toast = this.toastr.create({
            message: 'Marker #' + id + ' clicked',
            position: 'bottom',
            duration: 2000
        });
        toast.present();
    }

}
