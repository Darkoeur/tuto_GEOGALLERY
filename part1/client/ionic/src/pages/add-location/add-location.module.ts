import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { AddLocation } from './add-location';

@NgModule({
  declarations: [
    AddLocation,
  ],
  imports: [
    IonicPageModule.forChild(AddLocation),
  ],
  exports: [
    AddLocation
  ]
})
export class AddLocationModule {}
