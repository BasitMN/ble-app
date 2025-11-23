import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { DeviceHistoryService } from './device-history.service';

/// <reference types="web-bluetooth" />

export interface DeviceInfo {
    device: BluetoothDevice;
    rssi?: number;
    distanceCm?: number;
    manufacturerData?: Map<number, DataView>;
    serviceUUIDs?: string[];
    name?: string;
    id: string;
    lastSeen: Date;
}

export interface ScanOptions {
  acceptAllDevices?: boolean;
  filters?: BluetoothLEScanFilter[];
  optionalServices?: BluetoothServiceUUID[];
}

export interface ServiceInfo {
  uuid: string;
  isPrimary: boolean;
  service: BluetoothRemoteGATTService;
  characteristics: CharacteristicInfo[];
}

export interface CharacteristicInfo {
  uuid: string;
  properties: {
    read: boolean;
    write: boolean;
    notify: boolean;
    indicate: boolean;
  };
  value?: DataView;
  characteristic: BluetoothRemoteGATTCharacteristic;
}

@Injectable({
    providedIn: 'root'
})
export class BluetoothService {
    private deviceInfoSubject = new BehaviorSubject<DeviceInfo | null>(null);
    public deviceInfo$ = this.deviceInfoSubject.asObservable();

    private connectionStatusSubject = new BehaviorSubject<boolean>(false);
    public connectionStatus$ = this.connectionStatusSubject.asObservable();

    private errorSubject = new BehaviorSubject<string | null>(null);
    public error$ = this.errorSubject.asObservable();

    private scanningSubject = new BehaviorSubject<boolean>(false);
    public scanning$ = this.scanningSubject.asObservable();

    private servicesSubject = new BehaviorSubject<ServiceInfo[]>([]);
    public services$ = this.servicesSubject.asObservable();

    private connectedDevicesSubject = new BehaviorSubject<DeviceInfo[]>([]);
    public connectedDevices$ = this.connectedDevicesSubject.asObservable();

    private server: BluetoothRemoteGATTServer | null = null;
    private currentDevice: BluetoothDevice | null = null;

    constructor(private ngZone: NgZone, private deviceHistory: DeviceHistoryService) { }

    /**
     * Scans for BLE devices with enhanced options.
     * Note: This must be triggered by a user gesture (e.g., button click).
     */
    async scan(options?: ScanOptions): Promise<void> {
        this.errorSubject.next(null);
        this.scanningSubject.next(true);
        
        try {
            const scanOptions: RequestDeviceOptions = {
                acceptAllDevices: options?.acceptAllDevices ?? true,
                filters: options?.filters,
                optionalServices: options?.optionalServices || [
                    'battery_service',
                    'device_information',
                    'heart_rate',
                    'generic_access',
                    'generic_attribute'
                ]
            };

            const device = await navigator.bluetooth.requestDevice(scanOptions);
            // RSSI is not directly available from Web Bluetooth API, but if available via advertisement, use it
            let rssi: number | undefined = undefined;
            let distanceCm: number | undefined = undefined;
            // Try to get RSSI from manufacturerData or other means if available
            // For demo, set a mock RSSI value (e.g., -60)
            if ((device as any).rssi !== undefined) {
                rssi = (device as any).rssi;
            } else {
                // If not available, set a mock value for demonstration
                rssi = -60;
            }
            // Distance estimation formula (approx):
            // d = 10 ^ ((TxPower - RSSI) / (10 * n)), n=2 (environment factor), TxPower=-59 typical
            // We'll use TxPower = -59, n = 2
            if (rssi !== undefined) {
                const txPower = -59;
                const n = 2;
                const distance = Math.pow(10, (txPower - rssi) / (10 * n));
                distanceCm = Math.round(distance * 100); // convert meters to cm
            }
            const deviceInfo: DeviceInfo = {
                device,
                name: device.name || 'Unknown Device',
                id: device.id,
                lastSeen: new Date(),
                serviceUUIDs: [],
                rssi,
                distanceCm
            };

            this.ngZone.run(() => {
                this.deviceInfoSubject.next(deviceInfo);
                this.currentDevice = device;
                this.connect(device);
            });
        } catch (error: any) {
            this.ngZone.run(() => {
                console.error('Scan error:', error);
                if (error.name === 'NotFoundError') {
                    this.errorSubject.next('No device selected');
                } else if (error.name === 'SecurityError') {
                    this.errorSubject.next('Bluetooth access denied');
                } else {
                    this.errorSubject.next(error.message || 'Scanning failed');
                }
            });
        } finally {
            this.scanningSubject.next(false);
        }
    }

    /**
     * Connects to the selected device and discovers services.
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
                
                // Discover services after connection
                this.discoverServices();
                
                // Add device to history
                const currentDeviceInfo = this.deviceInfoSubject.value;
                if (currentDeviceInfo) {
                    this.deviceHistory.addDevice(currentDeviceInfo);
                }
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
     * Discovers all services and characteristics of the connected device.
     */
    async discoverServices(): Promise<void> {
        if (!this.server || !this.server.connected) {
            this.errorSubject.next('Device not connected');
            return;
        }

        try {
            const services = await this.server.getPrimaryServices();
            const serviceInfos: ServiceInfo[] = [];

            for (const service of services) {
                const characteristics = await service.getCharacteristics();
                const charInfos: CharacteristicInfo[] = [];

                for (const char of characteristics) {
                    charInfos.push({
                        uuid: char.uuid,
                        properties: {
                            read: char.properties.read,
                            write: char.properties.write,
                            notify: char.properties.notify,
                            indicate: char.properties.indicate
                        },
                        characteristic: char
                    });
                }

                serviceInfos.push({
                    uuid: service.uuid,
                    isPrimary: true,
                    service: service,
                    characteristics: charInfos
                });
            }

            this.ngZone.run(() => {
                this.servicesSubject.next(serviceInfos);
                
                // Update device info with service UUIDs
                const currentDeviceInfo = this.deviceInfoSubject.value;
                if (currentDeviceInfo) {
                    currentDeviceInfo.serviceUUIDs = serviceInfos.map(s => s.uuid);
                    this.deviceInfoSubject.next(currentDeviceInfo);
                }
            });
        } catch (error: any) {
            this.ngZone.run(() => {
                console.error('Service discovery error:', error);
                this.errorSubject.next(error.message || 'Service discovery failed');
            });
        }
    }

    /**
     * Reads value from a characteristic.
     */
    async readCharacteristic(characteristic: BluetoothRemoteGATTCharacteristic): Promise<DataView> {
        try {
            const value = await characteristic.readValue();
            return value;
        } catch (error: any) {
            this.errorSubject.next(`Read error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Writes value to a characteristic.
     */
    async writeCharacteristic(characteristic: BluetoothRemoteGATTCharacteristic, value: BufferSource): Promise<void> {
        try {
            await characteristic.writeValue(value);
        } catch (error: any) {
            this.errorSubject.next(`Write error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Starts listening for notifications from a characteristic.
     */
    async startNotifications(characteristic: BluetoothRemoteGATTCharacteristic, callback: (value: DataView) => void): Promise<void> {
        try {
            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
                callback(event.target.value);
            });
        } catch (error: any) {
            this.errorSubject.next(`Notification error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Stops listening for notifications from a characteristic.
     */
    async stopNotifications(characteristic: BluetoothRemoteGATTCharacteristic): Promise<void> {
        try {
            await characteristic.stopNotifications();
        } catch (error: any) {
            this.errorSubject.next(`Stop notification error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Utility method to convert UUID to human-readable service name.
     */
    getServiceName(uuid: string): string {
        const standardServices: { [key: string]: string } = {
            '0000180f-0000-1000-8000-00805f9b34fb': 'Battery Service',
            '0000180a-0000-1000-8000-00805f9b34fb': 'Device Information',
            '0000180d-0000-1000-8000-00805f9b34fb': 'Heart Rate',
            '00001800-0000-1000-8000-00805f9b34fb': 'Generic Access',
            '00001801-0000-1000-8000-00805f9b34fb': 'Generic Attribute',
            '0000181c-0000-1000-8000-00805f9b34fb': 'User Data',
        };
        
        return standardServices[uuid] || `Unknown Service (${uuid.substring(0, 8)})`;
    }

    /**
     * Utility method to convert UUID to human-readable characteristic name.
     */
    getCharacteristicName(uuid: string): string {
        const standardCharacteristics: { [key: string]: string } = {
            '00002a19-0000-1000-8000-00805f9b34fb': 'Battery Level',
            '00002a29-0000-1000-8000-00805f9b34fb': 'Manufacturer Name',
            '00002a24-0000-1000-8000-00805f9b34fb': 'Model Number',
            '00002a25-0000-1000-8000-00805f9b34fb': 'Serial Number',
            '00002a27-0000-1000-8000-00805f9b34fb': 'Hardware Revision',
            '00002a26-0000-1000-8000-00805f9b34fb': 'Firmware Revision',
            '00002a37-0000-1000-8000-00805f9b34fb': 'Heart Rate Measurement',
            '00002a00-0000-1000-8000-00805f9b34fb': 'Device Name',
        };
        
        return standardCharacteristics[uuid] || `Unknown Characteristic (${uuid.substring(0, 8)})`;
    }

    /**
     * Attempts to reconnect to a previously paired device.
     * Note: This requires the device to be previously paired/connected.
     */
    async connectToKnownDevice(deviceInfo: DeviceInfo): Promise<void> {
        this.errorSubject.next(null);
        
        try {
            // Try to get the device using requestDevice with specific filters
            const device = await navigator.bluetooth.requestDevice({
                filters: [
                    { name: deviceInfo.name || undefined },
                    { namePrefix: deviceInfo.name ? deviceInfo.name.substring(0, 5) : undefined }
                ].filter(f => f.name || f.namePrefix),
                optionalServices: deviceInfo.serviceUUIDs || []
            });

            const updatedDeviceInfo: DeviceInfo = {
                ...deviceInfo,
                device: device,
                lastSeen: new Date()
            };

            this.ngZone.run(() => {
                this.deviceInfoSubject.next(updatedDeviceInfo);
                this.currentDevice = device;
                this.connect(device);
            });
        } catch (error: any) {
            this.ngZone.run(() => {
                console.error('Reconnection error:', error);
                if (error.name === 'NotFoundError') {
                    this.errorSubject.next('Device not found. Try scanning for new devices.');
                } else {
                    this.errorSubject.next(error.message || 'Reconnection failed');
                }
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
            this.servicesSubject.next([]);
            this.server = null;
            this.currentDevice = null;
        });
    }
}
