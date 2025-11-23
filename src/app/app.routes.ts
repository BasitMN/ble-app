import { Routes } from '@angular/router';
import { ScanComponent } from './components/scan/scan';
import { DashboardComponent } from './components/dashboard/dashboard';

export const routes: Routes = [
    { path: '', component: ScanComponent },
    { path: 'dashboard', component: DashboardComponent },
    { path: '**', redirectTo: '' }
];
