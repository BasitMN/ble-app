import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { BluetoothService, DeviceInfo, ScanOptions } from '../../services/bluetooth.service';
import { DeviceHistoryService } from '../../services/device-history.service';
import { DeviceListComponent } from '../device-list/device-list';
import { Router } from '@angular/router';

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, 
    MatChipsModule, MatDividerModule, MatTabsModule, DeviceListComponent
  ],
  templateUrl: './scan.html',
  styleUrls: ['./scan.css']
})
export class ScanComponent {
  deviceInfo$;
  connectionStatus$;
  error$;
  scanning$;
  deviceHistory$;

  constructor(
    private bluetoothService: BluetoothService, 
    private deviceHistoryService: DeviceHistoryService,
    private router: Router
  ) {
    this.deviceInfo$ = this.bluetoothService.deviceInfo$;
    this.connectionStatus$ = this.bluetoothService.connectionStatus$;
    this.error$ = this.bluetoothService.error$;
    this.scanning$ = this.bluetoothService.scanning$;
    this.deviceHistory$ = this.deviceHistoryService.history$;
  }

  scan() {
    this.bluetoothService.scan();
  }

  scanWithFilters() {
    const options: ScanOptions = {
      filters: [
        { namePrefix: 'ESP32' },
        { namePrefix: 'Arduino' },
        { services: ['battery_service'] },
        { services: ['heart_rate'] }
      ],
      optionalServices: [
        'battery_service',
        'device_information',
        'heart_rate',
        'generic_access'
      ]
    };
    this.bluetoothService.scan(options);
  }

  connectToDevice(deviceInfo: DeviceInfo) {
    this.bluetoothService.connectToKnownDevice(deviceInfo);
  }

  toggleFavorite(deviceId: string) {
    this.deviceHistoryService.toggleFavorite(deviceId);
  }

  removeDevice(deviceId: string) {
    this.deviceHistoryService.removeDevice(deviceId);
  }

  clearHistory() {
    this.deviceHistoryService.clearHistory();
  }

  getFavorites() {
    return this.deviceHistoryService.getFavorites();
  }

  getRecentDevices() {
    return this.deviceHistoryService.getRecentDevices(10);
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  getServiceName(uuid: string): string {
    return this.bluetoothService.getServiceName(uuid);
  }
}
