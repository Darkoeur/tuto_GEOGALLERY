import { BrowserModule } from '@angular/platform-browser';
import { ErrorHandler, NgModule } from '@angular/core';
import { IonicApp, IonicErrorHandler, IonicModule } from 'ionic-angular';
import { SplashScreen } from '@ionic-native/splash-screen';
import { StatusBar } from '@ionic-native/status-bar';
import { GoogleMaps } from '@ionic-native/google-maps';

import { ZetaPushClientConfig, ZetaPushModule } from 'zetapush-angular';

import { MyApp } from './app.component';
import { HomePage } from '../pages/home/home';
import { AddLocation } from '../pages/add-location/add-location';
import { DebugLocations } from '../pages/debug-locations/debug-locations';

import { ZetaLocations } from '../providers/zeta-locations/zeta-locations';
import { LocationsApiProvider } from '../providers/zeta-locations/locations-api.service';

import { MessageService } from '../providers/messages/messages.service';

@NgModule({
  declarations: [
    MyApp,
    HomePage,
    AddLocation,
    DebugLocations
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot(MyApp),
    ZetaPushModule
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    HomePage,
    AddLocation,
    DebugLocations
  ],
  providers: [
    StatusBar,
    SplashScreen,
    {provide: ErrorHandler, useClass: IonicErrorHandler},
    GoogleMaps,
    ZetaLocations,
    LocationsApiProvider,
    {provide: ZetaPushClientConfig, useValue: {sandboxId: '< YOUR SANDBOX ID >'}},
    MessageService
  ]
})
export class AppModule {}
