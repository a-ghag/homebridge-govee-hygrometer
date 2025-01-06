import noble from '@abandonware/noble';
import { isValidPeripheral } from './validation.js';
import { decodeAny } from './decode.js';
import { GoveeReading } from './goveeReading.js';
import {
  Logging,
} from 'homebridge';
  
process.env.NOBLE_REPORT_ALL_HCI_EVENTS = '1'; // needed on Linux including Raspberry Pi

const h5075_uuid = 'ec88';
const h5101_uuid = '0001';

let DEBUG = false;

let discoverCallback: undefined | ((reading: GoveeReading) => void);
let scanStartCallback: undefined | (() => void);
let scanStopCallback: undefined | (() => void);

noble.on('discover', async (peripheral) => {
  const { id, uuid, address, state, rssi, advertisement } = peripheral;
  if (DEBUG) {
    console.log('discovered', id, uuid, address, state, rssi);
  }

  if (!isValidPeripheral(peripheral)) {
    if (DEBUG) {
      let mfgData;
      if (advertisement.manufacturerData) {
        mfgData = advertisement.manufacturerData.toString('hex');
      }
      console.log(`invalid peripheral, manufacturerData=[${mfgData}]`);
    }
    return;
  }

  const { localName, manufacturerData } = advertisement;

  const streamUpdate = manufacturerData.toString('hex');

  if (DEBUG) {
    console.log(`${id}: ${streamUpdate}`);
  }

  const decodedValues = decodeAny(streamUpdate);

  const current: GoveeReading = {
    uuid,
    address,
    model: localName,
    battery: decodedValues.battery,
    humidity: decodedValues.humidity,
    tempInC: decodedValues.tempInC,
    tempInF: decodedValues.tempInF,
    rssi,
  };

  if (discoverCallback) {
    discoverCallback(current);
  }
});

noble.on('scanStart', () => {
  if (DEBUG) {
    console.log('scanStart');
  }
  if (scanStartCallback) {
    scanStartCallback();
  }
});

noble.on('scanStop', () => {
  if (DEBUG) {
    console.log('scanStop');
  }
  if (scanStopCallback) {
    scanStopCallback();
  }
});

export const debug = (on: boolean) => {
  DEBUG = on;
};

export const startDiscovery = async (
  callback: (reading: GoveeReading) => void, log: Logging,
) => {
  discoverCallback = callback;
  log.debug('startScanningAsync Start');
  await noble.startScanningAsync([h5075_uuid, h5101_uuid], true);
  log.debug('startScanningAsync End');
};

export const stopDiscovery = async () => {
  await noble.stopScanningAsync();

  discoverCallback = undefined;
  scanStartCallback = undefined;
  scanStopCallback = undefined;
};

export const registerScanStart = (callback: (() => void)) => {
  scanStartCallback = callback;
};

export const registerScanStop = (callback: (() => void)) => {
  scanStopCallback = callback;
};