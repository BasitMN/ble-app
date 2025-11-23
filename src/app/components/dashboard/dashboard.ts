import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { BluetoothService, DeviceInfo, ServiceInfo, CharacteristicInfo } from '../../services/bluetooth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatListModule, 
    MatExpansionModule, MatChipsModule, MatProgressSpinnerModule, MatSnackBarModule,
    MatInputModule, MatFormFieldModule, FormsModule
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  deviceInfo$;
  services$;
  connectionStatus$;
  
  notificationData: { [uuid: string]: string } = {};
  writeValues: { [uuid: string]: string } = {};

  constructor(
    private bluetoothService: BluetoothService, 
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.deviceInfo$ = this.bluetoothService.deviceInfo$;
    this.services$ = this.bluetoothService.services$;
    this.connectionStatus$ = this.bluetoothService.connectionStatus$;
  }

  ngOnInit() {
    this.connectionStatus$.subscribe(connected => {
      if (!connected) {
        this.router.navigate(['/']);
      }
    });
  }

  async readCharacteristic(char: CharacteristicInfo) {
    try {
      const value = await this.bluetoothService.readCharacteristic(char.characteristic);
      const textValue = this.dataViewToString(value);
      this.snackBar.open(`Read: ${textValue}`, 'Close', { duration: 3000 });
    } catch (error) {
      this.snackBar.open('Failed to read characteristic', 'Close', { duration: 3000 });
    }
  }

  async writeCharacteristic(char: CharacteristicInfo) {
    const value = this.writeValues[char.uuid];
    if (!value) {
      this.snackBar.open('Enter a value to write', 'Close', { duration: 3000 });
      return;
    }

    try {
      const buffer = this.stringToArrayBuffer(value);
      await this.bluetoothService.writeCharacteristic(char.characteristic, buffer);
      this.snackBar.open('Value written successfully', 'Close', { duration: 3000 });
      this.writeValues[char.uuid] = '';
    } catch (error) {
      this.snackBar.open('Failed to write characteristic', 'Close', { duration: 3000 });
    }
  }

  async toggleNotifications(char: CharacteristicInfo) {
    try {
      if (this.notificationData[char.uuid]) {
        await this.bluetoothService.stopNotifications(char.characteristic);
        delete this.notificationData[char.uuid];
        this.snackBar.open('Notifications stopped', 'Close', { duration: 2000 });
      } else {
        await this.bluetoothService.startNotifications(char.characteristic, (value) => {
          this.notificationData[char.uuid] = this.dataViewToString(value);
        });
        this.snackBar.open('Notifications started', 'Close', { duration: 2000 });
      }
    } catch (error) {
      this.snackBar.open('Failed to toggle notifications', 'Close', { duration: 3000 });
    }
  }

  getServiceName(uuid: string): string {
    return this.bluetoothService.getServiceName(uuid);
  }

  getCharacteristicName(uuid: string): string {
    return this.bluetoothService.getCharacteristicName(uuid);
  }

  private dataViewToString(dataView: DataView): string {
    const decoder = new TextDecoder('utf-8');
    const uint8Array = new Uint8Array(dataView.buffer);
    
    // Try to decode as text first
    try {
      const text = decoder.decode(uint8Array);
      if (/^[\x20-\x7E]*$/.test(text)) { // ASCII printable characters
        return text;
      }
    } catch (e) {
      // Fall through to hex display
    }
    
    // Display as hex if not readable text
    return Array.from(uint8Array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
  }

  private stringToArrayBuffer(str: string): ArrayBuffer {
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
  }

  disconnect() {
    this.bluetoothService.disconnect();
    this.router.navigate(['/']);
  }
}
