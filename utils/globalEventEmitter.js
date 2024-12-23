// define any global emmmiter here
import { EventEmitter } from 'events';

export  const needToReInit = new EventEmitter(); 
export const serverIsDead = new EventEmitter();
export const printingScanning=  new EventEmitter();
export const subsequenceReject = new EventEmitter();
export const beWS = new EventEmitter();