import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { DebugLocations } from './debug-locations';

@NgModule({
  declarations: [
    DebugLocations,
  ],
  imports: [
    IonicPageModule.forChild(DebugLocations),
  ],
  exports: [
    DebugLocations
  ]
})
export class DebugLocationsModule {}
