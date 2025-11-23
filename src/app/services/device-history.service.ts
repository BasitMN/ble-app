import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DeviceInfo } from './bluetooth.service';

export interface DeviceHistoryEntry {
  deviceInfo: DeviceInfo;
  isFavorite: boolean;
  connectionCount: number;
  lastConnected: Date;
}

@Injectable({
  providedIn: 'root'
})
export class DeviceHistoryService {
  private readonly STORAGE_KEY = 'ble_device_history';
  private readonly MAX_HISTORY_SIZE = 50;
  
  private historySubject = new BehaviorSubject<DeviceHistoryEntry[]>([]);
  public history$ = this.historySubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  addDevice(deviceInfo: DeviceInfo): void {
    const history = this.historySubject.value;
    const existingIndex = history.findIndex(entry => entry.deviceInfo.id === deviceInfo.id);

    if (existingIndex >= 0) {
      // Update existing device
      history[existingIndex].lastConnected = new Date();
      history[existingIndex].connectionCount++;
      history[existingIndex].deviceInfo = { ...deviceInfo }; // Update device info
    } else {
      // Add new device
      const newEntry: DeviceHistoryEntry = {
        deviceInfo: { ...deviceInfo },
        isFavorite: false,
        connectionCount: 1,
        lastConnected: new Date()
      };
      history.unshift(newEntry);
    }

    // Keep only the most recent entries
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.splice(this.MAX_HISTORY_SIZE);
    }

    this.saveToStorage(history);
    this.historySubject.next(history);
  }

  toggleFavorite(deviceId: string): void {
    const history = this.historySubject.value;
    const entryIndex = history.findIndex(entry => entry.deviceInfo.id === deviceId);
    
    if (entryIndex >= 0) {
      history[entryIndex].isFavorite = !history[entryIndex].isFavorite;
      this.saveToStorage(history);
      this.historySubject.next(history);
    }
  }

  removeDevice(deviceId: string): void {
    const history = this.historySubject.value;
    const filteredHistory = history.filter(entry => entry.deviceInfo.id !== deviceId);
    this.saveToStorage(filteredHistory);
    this.historySubject.next(filteredHistory);
  }

  clearHistory(): void {
    this.saveToStorage([]);
    this.historySubject.next([]);
  }

  getFavorites(): DeviceHistoryEntry[] {
    return this.historySubject.value.filter(entry => entry.isFavorite);
  }

  getRecentDevices(limit: number = 10): DeviceHistoryEntry[] {
    return this.historySubject.value
      .sort((a, b) => b.lastConnected.getTime() - a.lastConnected.getTime())
      .slice(0, limit);
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        const history = parsed.map((entry: any) => ({
          ...entry,
          lastConnected: new Date(entry.lastConnected),
          deviceInfo: {
            ...entry.deviceInfo,
            lastSeen: new Date(entry.deviceInfo.lastSeen)
          }
        }));
        this.historySubject.next(history);
      }
    } catch (error) {
      console.error('Error loading device history from storage:', error);
      this.historySubject.next([]);
    }
  }

  private saveToStorage(history: DeviceHistoryEntry[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving device history to storage:', error);
    }
  }
}