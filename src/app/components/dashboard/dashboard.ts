import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatExpansionModule } from '@angular/material/expansion';
import { BluetoothService } from '../../services/bluetooth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatListModule, MatExpansionModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  device$;
  services: BluetoothRemoteGATTService[] = [];

  constructor(private bluetoothService: BluetoothService, private router: Router) {
    this.device$ = this.bluetoothService.device$;
  }

  ngOnInit() {
    this.device$.subscribe(device => {
      if (!device) {
        this.router.navigate(['/']);
      } else {
        this.loadServices();
      }
    });
  }

  async loadServices() {
    try {
      this.services = await this.bluetoothService.getPrimaryServices();
    } catch (error) {
      console.error('Error loading services', error);
    }
  }

  disconnect() {
    this.bluetoothService.disconnect();
    this.router.navigate(['/']);
  }
}
