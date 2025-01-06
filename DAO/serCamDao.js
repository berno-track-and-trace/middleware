import net from 'net';
import { postDataToAPI } from '../API/APICall/apiCall.js';
import { printingProcess } from '../index.js';
import {
  needToReInit,
  printingScanning,
  subsequenceReject,
} from '../utils/globalEventEmitter.js';
import { EventEmitter } from 'events';
import Queue from '../utils/queue.js';
import { serCamLogger } from '../utils/logger.js';


function removeSpacesAndNewlines(inputString) {
  return inputString.replace(/\s+/g, '');
}
let normalOperationFlag = false; //normal operation flag for healthcheck
let printedTimeOutFlag = false;
let waitingForResponseFlag = false;

export default class serCam {
  constructor(ip, port, rejector, sensor) {
    this.init = null;
    this.ip = ip;
    this.port = port;
    this.running = false;
    this.socket = null;
    this.listenerThread = null;
    this.rejector = rejector;
    this.accuracyThreshold = 0.0
    this.active = false;
    this.rejection = new EventEmitter();
    this.hcTimeInterval = 10000;
    this.hcTimeTolerance = 500;
    this.healthCheckInterval = null;
    this.healthCheckTimeout = null;
    this.sensorReadingInterval = null;
    this.subsequenceReject = 3;


    this.rejectTimeOut = null;

    this.passCounter = 0;

    this.start_time = null;

    this.printedTimeOutQueue = new Queue();
    this.currentPrintedCode = null;

    this.sensor = sensor;
    this.boxIsDetected = false;

    this.rejectCounter = 0;

    this.sensorToRejectTravelTime = 270; // berno 242
  }
  addPrintedTimeOut(printedData) {
    // for detecting failure on conection between camera trigger sensor and GPIO
    this.printedTimeOutQueue.enqueue({
      printedData: printedData,
      timeOut: setTimeout(async () => {
        
        if (!printedTimeOutFlag) {
          printedTimeOutFlag = true;
          this.printedTimeOutQueue.dequeue();

          const currentPrintSignalCount = this.printedTimeOutQueue.size();
          await new Promise((resolve) => setTimeout(resolve, 5000));
          if (currentPrintSignalCount < this.printedTimeOutQueue.size()) { // still in trial
            serCamLogger.error(
              '[SerCam] The camera sensor might be disconnected from GPIO, please check the connection'
            );
            // needToReInit.emit("pleaseReInit", "ERR_SERIALIZATION_CAM", "sensor might be disconnected to GPIO", true);
          } else {
            serCamLogger.warn(
              '[SerCam] The camera sensor might be disconnected from GPIO or the conveyor is not running'
            );
          }
          while (!this.printedTimeOutQueue.isEmpty()) {
            const data = this.printedTimeOutQueue.dequeue();
            clearTimeout(data.timeOut);
          }
          printedTimeOutFlag = false;
        }
      }, 5000),
    });
  }

  async serialization() {
   
       clearTimeout(this.rejectTimeOut);
    this.rejection.removeAllListeners();
    serCamLogger.info('Sensor is triggered');

    let printed = null;
    if (!this.printedTimeOutQueue.isEmpty()) {
      printed = this.printedTimeOutQueue.dequeue();
      clearTimeout(printed.timeOut);
    }
    waitingForResponseFlag = true;
    this.rejectTimeOut = setTimeout(async () => {
      serCamLogger.error('Time out occurred while waiting data from camera');
      if (printingProcess.printer.isOccupied) {
        this.rejectCounter++;
      }

      this.rejector.reject(0);
      while (this.boxIsDetected === true) {
        this.rejector.reject(0);
      }

      postDataToAPI(
        `v1/work-order/${printingProcess.work_order_id}/assignment/${printingProcess.assignment_id}/serialization/validate`,
        {
          accuracy: 0,
          status: 'rejected',
          code: null,
          reason: 'CAM_ERROR',
          event_time: Date.now(),
        }
      );

      this.rejection.removeAllListeners();
    }, this.sensorToRejectTravelTime);

    this.rejection.once('reject', async () => {
      if (printingProcess.printer.isOccupied) {
        this.rejectCounter++;
      }

      this.rejector.reject();

      this.rejection.removeAllListeners();
 

      console.log('reject counts', this.rejectCounter);
      if (this.rejectCounter >= this.subsequenceReject) {
        subsequenceReject.emit('subsequenceReject');
        serCamLogger.info('subsequenceReject emitted');
        this.rejectCounter = 0;
      }
    });

    this.rejection.once('pass', async () => {
      serCamLogger.info('An object is passed');
      this.rejectCounter = 0;
      this.rejection.removeAllListeners();
 
    });
  }

  async setHealthCheckInterval() {
    // this.healthCheckInterval = setInterval(
    //   () => {
    //     try {
    //       if (this.socket) {
    //         const message = 'ERRSTAT\r'; // sendinf command ERRSTAT
    //         // this.socket.write(message, 'utf8'); // Sending as UTF-8 encoded string
    //         // this.healthCheckTimeout = setTimeout(() => {
    //         //   this.running = false;
    //         //   needToReInit.emit(
    //         //     'pleaseReInit',
    //         //     'ERR_SERIALIZATION_CAM',
    //         //     'timed out occured on health check'
    //         //   ); // ask to re-init
    //         //   serCamLogger.error('timed out occured on health check');
    //         // }, 500);
    //       }
    //     } catch (error) {
    //       serCamLogger.error(`Healthcheck error : ${err}`);
    //     }
    //   },
    //   normalOperationFlag
    //     ? this.hcTimeInterval + this.hcTimeTolerance
    //     : this.hcTimeInterval
    // );
    // normalOperationFlag = false;
  }
  connect() {
    return new Promise((resolve, reject) => {
      try {
        if (this.socket) {
          clearInterval(this.healthCheckInterval);
          this.socket.removeAllListeners();
          this.socket.destroy();
        }
        printingScanning.removeAllListeners();
        printingScanning.on('printed', (data) => {
          this.addPrintedTimeOut(data);
        });
        this.socket = new net.Socket();
        // this.socket.setKeepAlive(true, 1000);
        this.socket.connect(this.port, this.ip, () => {
          this.running = true;
          this.active = true;
          this.socket.removeAllListeners();
          this.listenerThread = this.listenForResponses();
          this.setHealthCheckInterval();
          serCamLogger.info(
            `The Socket established on ${this.ip} : ${this.port}`
          );
          resolve();
        });
        this.socket.once('error', (err) => {
          this.running = false;
          this.active = false;

          reject(`[Ser Cam] Connection error: ${err.message}`);
        });
        this.socket.once('close', (err) => {
          this.running = false;
          this.active = false;

          reject(`[Ser Cam] Connection error: ${err.message}`);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  disconnect() {
    this.running = false;
    this.socket.removeAllListeners();
    this.socket.destroy();
    serCamLogger.info('Disconnected');
  }
  separateStringToObject(input) {
    // Split the input string by ":"

    const parts = input.split(':');
    const code = parts[0];
    const accuracy = parts.length > 1 ? parseInt(parts[1]) : 0;

    // Create and return the resulting object
    return {
      code: removeSpacesAndNewlines(code),
      accuracy: accuracy,
    };
  }
  listenForResponses() {
    this.socket.on('data', (response) => {
  

      clearTimeout(this.rejectTimeOut);
      clearInterval(this.healthCheckInterval);

      if (!response) {
        return;
      }

      let responseString = response.toString('utf8');
      const isHealthCheckResponse = responseString.startsWith('OK,ERRSTAT,');
      if (isHealthCheckResponse) {
        clearTimeout(this.healthCheckTimeout);

        const healthCheckResponses = responseString.split(',');
        const healthCheckSuccess =
          removeSpacesAndNewlines(healthCheckResponses[2]) === 'none';
        if (!healthCheckSuccess) {
          serCamLogger.error(
            `[Ser Cam] Camera error code found: ${healthCheckResponses[2]}`
          );
        }

        this.setHealthCheckInterval();
        return;
      }

      normalOperationFlag = true;
  

      if (waitingForResponseFlag) {
        waitingForResponseFlag = false;
        responseString = this.separateStringToObject(responseString);
        this.receiveData(responseString);
      } else {
        serCamLogger.info(
          `got the data but already rejected due to timeout (code: ${responseString}).`
        );
      }
      this.setHealthCheckInterval();
    });

    this.socket.on('error', (err) => {
      clearInterval(this.healthCheckInterval);
      needToReInit.emit(
        'pleaseReInit',
        'ERR_SERIALIZATION_CAM',
        'Error listening for responses'
      );
      serCamLogger.error(`Error listening for responses: ${err}`);
    });

    this.socket.on('close', () => {
      clearInterval(this.healthCheckInterval);
      needToReInit.emit(
        'pleaseReInit',
        'ERR_SERIALIZATION_CAM',
        'serialization Camera TCP Listener is stopped'
      );
      serCamLogger.info('[Ser Cam] Listening stopped');
      this.running = false;
    });
  }

  checkFormat(data) {
    const identifikasi_pattern = /^\(90\)[A-Za-z0-9]{1,16}\(91\)\d{1,10}$/;
    const otentifikasi_pattern1 =
      /^\(90\)[A-Za-z0-9]{1,16}\(10\)[A-Za-z0-9]{1,20}\(17\)\d{1,6}\(21\)[A-Za-z0-9]{1,20}$/;
    const otentifikasi_pattern2 =
      /^\(01\)[A-Za-z0-9]{14}\(10\)[A-Za-z0-9]{1,20}\(17\)\d{1,6}\(21\)[A-Za-z0-9]{1,20}$/;
    let result = false;
    let reason = 'success';
    let code = data.code;
    if (
      identifikasi_pattern.test(code) ||
      otentifikasi_pattern1.test(code) ||
      otentifikasi_pattern2.test(code)
    ) {

      if (this.accuracyThreshold <= data.accuracy) {
        result = true;
      } else {
        result = false;
        reason = 'LOW_ACCURACY';
      }
    } else {
      if (code === 'ERROR;' || code === null) {
        code = null;
        reason = 'QR_NOT_FOUND';
      } else {
        reason = 'PATTERN_MISMATCH';
      }
      serCamLogger.info(`Data is in bad format or ERROR: ${reason} on scanned code: ${code}`);
      result = false;
    }
    serCamLogger.info({
      result: result,
      reason: reason,
      code: code,
      accuracy: data.accuracy,
    });

    return { result, reason, code };
  }

  async receiveData(data) {
    // console.log("String2 : ",data) // uncomment this for debugging
    try {
      const check = this.checkFormat(data);

      const emitMessage = !check.result ? 'reject' : 'pass';
      this.rejection.emit(emitMessage);

      postDataToAPI(
        `v1/work-order/${printingProcess.work_order_id}/assignment/${printingProcess.assignment_id}/serialization/validate`,
        {
          accuracy: isNaN(data.accuracy) ? 0 : data.accuracy,
          status: check.result ? 'passed' : 'rejected',
          code: data.code,
          reason: check.reason,
          event_time: Date.now(),
        }
      );
    } catch (error) {
      serCamLogger.error('error after receiving data: ', error);
    }
  }
}