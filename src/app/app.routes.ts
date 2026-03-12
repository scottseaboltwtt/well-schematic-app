import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/well-schematic-page/well-schematic-page.component').then(m => m.WellSchematicPageComponent) },
  { path: '**', redirectTo: '' },
];
