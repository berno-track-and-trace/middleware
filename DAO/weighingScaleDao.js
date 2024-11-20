import { postDataToAPI } from '../API/APICall/apiCall.js';
import { SerialPort, ReadlineParser } from 'serialport';
import { Mutex } from 'async-mutex';
import { needToReInit } from '../utils/globalEventEmitter.js';
// let readingLock = false;
// let readingQueue = [];
const mutex = new Mutex();
let hcInterval = null;
const hcIntervalTime = 33800;
const hcIntervalTolerance = 1000;

let normalProcessFlag = false;
let errorOnReading = false;
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// async function checkWeigher(tryCount) {
//   try {
//     await readWeight()
//   } catch (error) {
//     console.log(`[Weighiscale] retrying for ${tryCount} healthcheck`)
//     if (tryCount >= 3) {
//       throw error
//     }
//     await sleep(1000)
//     await checkWeigher(tryCount+=1)
//   }
// }

function setHCweightInterval() {
  hcInterval = setInterval(async () => {
    try {
      console.log("HC weigher")
      // await checkWeigher(0)
      await readWeight()
    } catch (error) {
      if (errorOnReading) {
        console.log("[Weighing Scale] the weighing scale is unhealthy", error);
        needToReInit.emit("pleaseReInit", "weighingScale", error)
      }
    }
    errorOnReading = false;
    normalProcessFlag = false;

  }
    , normalProcessFlag ? hcIntervalTime + hcIntervalTolerance : hcIntervalTime)
}
// function _processQueue() {
//   if (readingQueue.length > 0) {
//     const { resolve, reject } = readingQueue.shift();
//     readWeight().then(resolve).catch(reject);
//   }
// }

// const readWeight = async () => {
//   if (readingLock) {
//     return new Promise((resolve, reject) => {
//       readingQueue.push({ resolve, reject });
//     });
//   }

//   readingLock = true;
//   try {
//     const weight = await _readWeight();
//     return weight;
//   } catch (error) {
//     throw new Error('[Weighing Scale] error:', error);
//   } finally {
//     readingLock = false;
//     _processQueue();
//   }
// }

async function readWeight(retries = 5, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const weight = await _readWeight();

      return weight; // Successfully read weight
    } catch (error) {
      console.log(`Attempt ${attempt} failed: ${error}`);
      if (attempt === retries) {
        // If the last retry fails, throw the error
        throw new Error(`All ${retries} attempts failed: ${error}`);
      }
      // Wait for the specified delay before retrying
      await sleep(delay);
    }
  }
}

let parser=null;

async function _readWeight() {
  const release = await mutex.acquire();
  return new Promise(async (resolve, reject) => {
    try {
      const ports = await SerialPort.list();
      let MYport = null;

      ports.forEach(port => {
        if (port.vendorId === '067b' && port.productId === '23a3') {
          // console.log('Found It');
          MYport = port.path;
        }
      });

      if (MYport) {
        const port = new SerialPort({
          path: MYport,
          baudRate: 9600,
          autoOpen: false
        });
        if(parser){
          parser.removeAllListeners('data');
        }
        parser = new ReadlineParser({ delimiter: '\n' });
        port.pipe(parser);

        port.open(err => {
          if (err) {
            errorOnReading = true;
            reject('Error opening port: ' + err.message);
          }
          // console.log('[Weiging Scale] Port opened');
        });

        let readings = [];
        const maxReadings = 5;
        let idx = 0;
        let nanCount = 0;
        let timeout = setTimeout(() => {
          errorOnReading = true;
          port.close(() => {
            return reject("no data is readable")
          });
          
        }, 500)
        parser.on('data', data => {
          clearTimeout(timeout);
          const weight = parseFloat(data.trim());
          console.log('Data:', weight);
          errorOnReading = true;

          if (!isNaN(weight)) {
            readings.push(weight);
            idx++;
          } else {
            nanCount++;
            if (nanCount > 10) {
              port.close(() => {
                errorOnReading = true;
                reject("too many NaNs");
              });
            }
          }

          if (readings.length > 1 && Math.abs(readings[idx - 1] - readings[idx - 2]) > 0.0005) {
            port.close(() => {
              errorOnReading=false;
              return reject('unstable');
            });
          }

          if (readings.length >= maxReadings) {
            const average = readings.reduce((sum, value) => sum + value, 0) / readings.length;
            // console.log('[Weighing Scale] Average weight:', average);

            port.close(err => {
              if (err) {
                console.log('[Weighing Scale] Error closing port: ', err.message);

                return reject(err);
              }
              // console.log('[Weighing Scale] Port closed successfully');
              resolve(average);
            });
          }
        });

        port.once('error', err => {
          console.log('Error: ', err.message);
          reject(err);
        });

        port.once('close', () => {
          // console.log('Port closed');
        });

      } else {
        errorOnReading = true

        reject('No matching port found');
      }
    } catch (err) {
      errorOnReading = true;
      console.error('Error listing ports: ', err);
      reject(err);
    }
  }).finally(() => {
    release();
  });
}
const readPrinterButton = (button) => {
  clearInterval(hcInterval)
  setHCweightInterval()
  button.setShortPressCallback(async () => {
    try {
      console.log("[Label Printer] Label Printer button is pressed.");
      await postDataToAPI('v1/work-order/active-job/trigger/weighing', {});
      await sleep(1000);
    } catch (err) {
      console.log("[Label Printer] error on: ", err);
    }
  });
}

export default { _readWeight,readWeight, readPrinterButton, hcInterval, setHCweightInterval, normalProcessFlag };
