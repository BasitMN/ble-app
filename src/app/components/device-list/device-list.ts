import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DeviceHistoryEntry } from '../../services/device-history.service';

@Component({
  selector: 'app-device-list',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatMenuModule, MatTooltipModule],
  template: `
    <div class="device-list">
      <div class="section-header">
        <h3>{{ title }}</h3>
        <button mat-icon-button [matMenuTriggerFor]="menu" *ngIf="showMenu">
          <mat-icon>more_vert</mat-icon>
        </button>
        <mat-menu #menu="matMenu">
          <button mat-menu-item (click)="clearAll.emit()" *ngIf="devices.length > 0">
            <mat-icon>clear_all</mat-icon>
            <span>Clear All</span>
          </button>
        </mat-menu>
      </div>

      <div *ngIf="devices.length === 0" class="empty-state">
        <mat-icon>{{ emptyIcon }}</mat-icon>
        <p>{{ emptyMessage }}</p>
      </div>

      <mat-card *ngFor="let entry of devices; trackBy: trackByDeviceId" class="device-card">
        <mat-card-header>
          <mat-icon mat-card-avatar [class.favorite]="entry.isFavorite">
            {{ entry.isFavorite ? 'favorite' : 'bluetooth' }}
          </mat-icon>
          <mat-card-title>{{ entry.deviceInfo.name || 'Unknown Device' }}</mat-card-title>
          <mat-card-subtitle>
            {{ entry.deviceInfo.id.substring(0, 20) }}...
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div class="device-stats">
            <div class="stat">
              <mat-icon>access_time</mat-icon>
              <span>{{ entry.lastConnected | date:'short' }}</span>
            </div>
            <div class="stat">
              <mat-icon>sync</mat-icon>
              <span>{{ entry.connectionCount }} connection(s)</span>
            </div>
          </div>

          <div *ngIf="entry.deviceInfo.serviceUUIDs && entry.deviceInfo.serviceUUIDs.length > 0" class="services-preview">
            <mat-chip-set>
              <mat-chip *ngFor="let service of entry.deviceInfo.serviceUUIDs.slice(0, 3)">
                {{ getServiceName(service) }}
              </mat-chip>
              <mat-chip *ngIf="entry.deviceInfo.serviceUUIDs.length > 3">
                +{{ entry.deviceInfo.serviceUUIDs.length - 3 }} more
              </mat-chip>
            </mat-chip-set>
          </div>
        </mat-card-content>

        <mat-card-actions>
          <button mat-button color="primary" (click)="connectToDevice.emit(entry.deviceInfo)">
            <mat-icon>bluetooth_connected</mat-icon>
            Connect
          </button>
          <button mat-icon-button (click)="toggleFavorite.emit(entry.deviceInfo.id)" 
                  [color]="entry.isFavorite ? 'warn' : 'default'"
                  [matTooltip]="entry.isFavorite ? 'Remove from favorites' : 'Add to favorites'">
            <mat-icon>{{ entry.isFavorite ? 'favorite' : 'favorite_border' }}</mat-icon>
          </button>
          <button mat-icon-button (click)="removeDevice.emit(entry.deviceInfo.id)" 
                  color="warn" matTooltip="Remove from history">
            <mat-icon>delete</mat-icon>
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styleUrls: ['./device-list.css']
})
export class DeviceListComponent {
  @Input() devices: DeviceHistoryEntry[] = [];
  @Input() title: string = 'Devices';
  @Input() emptyMessage: string = 'No devices found';
  @Input() emptyIcon: string = 'bluetooth_disabled';
  @Input() showMenu: boolean = true;

  @Output() connectToDevice = new EventEmitter<any>();
  @Output() toggleFavorite = new EventEmitter<string>();
  @Output() removeDevice = new EventEmitter<string>();
  @Output() clearAll = new EventEmitter<void>();

  trackByDeviceId(index: number, entry: DeviceHistoryEntry): string {
    return entry.deviceInfo.id;
  }

  getServiceName(uuid: string): string {
    const standardServices: { [key: string]: string } = {
      '0000180f-0000-1000-8000-00805f9b34fb': 'Battery',
      '0000180a-0000-1000-8000-00805f9b34fb': 'Device Info',
      '0000180d-0000-1000-8000-00805f9b34fb': 'Heart Rate',
      '00001800-0000-1000-8000-00805f9b34fb': 'Generic Access',
      '00001801-0000-1000-8000-00805f9b34fb': 'Generic Attribute'
    };
    
    return standardServices[uuid] || uuid.substring(0, 8);
  }
}