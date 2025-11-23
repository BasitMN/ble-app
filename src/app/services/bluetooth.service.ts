import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

/// <reference types="web-bluetooth" />

@Injectable({
    providedIn: 'root'
})
export class BluetoothService {
    private deviceSubject = new BehaviorSubject<BluetoothDevice | null>(null);
    public device$ = this.deviceSubject.asObservable();

    private connectionStatusSubject = new BehaviorSubject<boolean>(false);
    public connectionStatus$ = this.connectionStatusSubject.asObservable();

    private errorSubject = new BehaviorSubject<string | null>(null);
    public error$ = this.errorSubject.asObservable();

    private server: BluetoothRemoteGATTServer | null = null;

    constructor(private ngZone: NgZone) { }

    /**
     * Scans for BLE devices.
     * Note: This must be triggered by a user gesture (e.g., button click).
     */
    async scan(): Promise<void> {
        this.errorSubject.next(null);
        try {
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['battery_service'] // Add common services or allow user to specify
            });

            this.ngZone.run(() => {
                this.deviceSubject.next(device);
                this.connect(device);
            });
        } catch (error: any) {
            this.ngZone.run(() => {
                console.error('Scan error:', error);
                this.errorSubject.next(error.message || 'Scanning failed');
            });
        }
    }

    /**
     * Connects to the selected device.
     */
    async connect(device: BluetoothDevice): Promise<void> {
        if (!device.gatt) {
            this.errorSubject.next('Device does not support GATT');
            return;
        }

        try {
            this.server = await device.gatt.connect();
            this.ngZone.run(() => {
                this.connectionStatusSubject.next(true);
                console.log('Connected to', device.name);

                // Setup disconnect listener
                device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));
            });
        } catch (error: any) {
            this.ngZone.run(() => {
                console.error('Connection error:', error);
                this.errorSubject.next(error.message || 'Connection failed');
                this.connectionStatusSubject.next(false);
            });
        }
    }

    /**
     * Disconnects from the current device.
     */
    disconnect(): void {
        if (this.server && this.server.connected) {
            this.server.disconnect();
        } else {
            // If already disconnected, just trigger the cleanup
            this.onDisconnected(null);
        }
    }

    private onDisconnected(event: Event | null): void {
        this.ngZone.run(() => {
            console.log('Disconnected');
            this.connectionStatusSubject.next(false);
            this.server = null;
        });
    }

    /**
     * Gets the primary services of the connected device.
     */
    async getPrimaryServices(): Promise<BluetoothRemoteGATTService[]> {
        if (!this.server || !this.server.connected) {
            throw new Error('Device not connected');
        }
        return await this.server.getPrimaryServices();
    }

    /**
     * Reads a value from a characteristic.
     */
    async readValue(serviceUuid: string, characteristicUuid: string): Promise<DataView> {
        if (!this.server || !this.server.connected) {
            throw new Error('Device not connected');
        }
        const service = await this.server.getPrimaryService(serviceUuid);
        const characteristic = await service.getCharacteristic(characteristicUuid);
        return await characteristic.readValue();
    }

    /**
     * Writes a value to a characteristic.
     */
    async writeValue(serviceUuid: string, characteristicUuid: string, value: BufferSource): Promise<void> {
        if (!this.server || !this.server.connected) {
            throw new Error('Device not connected');
        }
        const service = await this.server.getPrimaryService(serviceUuid);
        const characteristic = await service.getCharacteristic(characteristicUuid);
        await characteristic.writeValue(value);
    }
}
