import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BluetoothService } from '../../services/bluetooth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './scan.html',
  styleUrls: ['./scan.css']
})
export class ScanComponent {
  device$;
  connectionStatus$;
  error$;

  constructor(private bluetoothService: BluetoothService, private router: Router) {
    this.device$ = this.bluetoothService.device$;
    this.connectionStatus$ = this.bluetoothService.connectionStatus$;
    this.error$ = this.bluetoothService.error$;
  }

  scan() {
    this.bluetoothService.scan();
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }
}
