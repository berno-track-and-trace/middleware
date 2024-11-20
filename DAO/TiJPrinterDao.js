import net from 'net';
import { EventEmitter } from 'events';
import { error } from 'console';
import createCustomLogger from '../utils/logging.js'
import { Mutex } from 'async-mutex';

import { needToReInit } from '../utils/globalEventEmitter.js';

import { exec } from 'child_process';
import { rejector } from '../index.js';



// // Example usage
// pingIP('8.8.8.8')
//   .then(response => console.log(response))
//   .catch(error => console.error(error));


const mutex = new Mutex();
let sendFlag = false;

function to16BitHex(value) {
    if (value >= 0) {
        return value < 32768 ? value.toString(16).padStart(4, '0') : "Value too large";
    } else {
        return ((1 << 16) + value).toString(16).padStart(4, '0');
    }
}


export default class TIJPrinter {
    constructor(ip, port, slaveAddress, workstationId) {
        this.init = null
        this.printerId = "printer1"
        this.workstationId = workstationId
        this.ip = ip;
        this.port = port;
        this.slaveAddress = slaveAddress;
        this.socket = null;
        this.listenerThread = null;
        this.running = false;
        this.printCount = 0;
        this.responseEvent = new EventEmitter();
        this.responseBuffer = null;
        this.isOccupied = false;
        this.printCallback = null
        this.noResponseCount = 0;
        this.sendingQueue = [];
        this.sendingLock = false;
        this.notReceiving = false;

        this.localBufferCount=0;
        this.logger = createCustomLogger("PRINTER")

        this.hcTimekInterval = 5000;
        this.hcTimeTolerance = 500;
        this.healthCheckInterval = null;

        this.aBoxIsPrintedCompletely = true;

        this.ESC = '1B';
        this.STX = '02';
        this.EXT = '03';
    }

    pingIP(ipAddress = this.ip) {
        return new Promise((resolve, reject) => {
            const command = `ping -c 1 -W 1 ${ipAddress}`;
            const timeout = setTimeout(() => {
                reject("ping timed out")
            }, 500)
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    clearTimeout(timeout)
                    reject(`Ping failed: ${stderr}`);
                } else if (stdout.includes('1 packets transmitted, 1 received')) {
                    clearTimeout(timeout)
                    resolve(`Ping to ${ipAddress} successful`);
                } else {
                    clearTimeout(timeout)
                    reject(`Ping to ${ipAddress} failed`);
                }
            });
        });
    };

    setPrintCallBack(callback) {
        this.printCallback = callback
    }

    // setHealthCheckInterval(){
    //     this.healthCheckInterval= setInterval(() => this.requestPrinterStatus(), sendFlag?this.hcTimekInterval+this.hcTimeTolerance:this.hcTimekInterval)
    //     sendFlag=false;
    // }
    setHealthCheckInterval() {
        this.healthCheckInterval = setInterval(() => {
            let rejectorCheck=false;
            this.pingIP()
                .then(response => console.log(response))
                .then(async () => {
                    if (this.isOccupied) {
                        console.log("cek buf")
                        const bufferCount= await this.getBufNum()
                        if (bufferCount<this.localBufferCount){
                            console.log("PB : ", bufferCount)
                            console.log(" LB: ", thid.localBufferCount)
                            rejectorCheck=true;
                            throw new Error("Middleware possibly can't get signal from printer sensor")
                        }
                    }
                }).catch(error => {
                    needToReInit.emit("pleaseReInit", "Printer",error)
                    this.disconnect();
                    clearInterval(this.healthCheckInterval)
                    console.log("[Printer] printer is not healthy : ", error,rejectorCheck)
                });
        }
            , sendFlag ? this.hcTimekInterval + this.hcTimeTolerance : this.hcTimekInterval)
        sendFlag = false;
    }
    connect() {
        return new Promise((res, rej) => {
            try {
                if (this.socket) {
                    this.socket.removeAllListeners();
                    this.responseEvent.removeAllListeners();
                    this.socket.destroy();
                    this.socket = null;
                }

                this.socket = new net.Socket();
                // this.socket.setKeepAlive(true, 1000);
                this.socket.connect(this.port, this.ip, () => {
                    this.running = true;
                    this.socket.removeAllListeners();
                    this.listenerThread = this.listenForResponses();
                    this.setHealthCheckInterval();
                    console.log(`[Printer] Socket established on port ${this.port} and IP ${this.ip}`);
                    this.logger.info(`Socket established on port ${this.port} and IP ${this.ip}`);
                    res();

                });

                this.socket.once('error', (err) => {
                    console.error("[Printer] Error listening for responses:", err);
                    this.logger.error("Error listening for responses:", err);
                    this.running = false;
                    // this.init?.reRun()
                    rej(new Error(`[Printer] Connection error: ${err}`))
                });

                this.socket.once('close', (err) => {
                    console.log("[Printer] Listening stopped");
                    this.logger.error("Error listening for responses:", err);
                    this.running = false;
                    // this.init?.reRun()
                    rej(new Error(`[Printer] Connection error: ${err}`))
                });

            } catch (error) {
                rej(err)
            }

        })

    }

    listenForResponses() {
        this.socket.on('data', (response) => {
            if (response) {
                if (this.isSolicitedResponse(response)) {
                    this.responseBuffer = response;

                    this.responseEvent.emit('responseReceived');
                } else {
                    this.handleUnsolicitedResponse(response);
                }
            }
        });

        this.socket.on('error', (err) => {
            console.error("[Printer] Error listening for responses:", err);
            clearInterval(this.healthCheckInterval)
            this.running = false;
            // this.init?.reRun();
            needToReInit.emit("pleaseReInit", "Printer")
        });

        this.socket.on('close', () => {
            console.log("[Printer] Listening stopped");
            clearInterval(this.healthCheckInterval)
            needToReInit.emit("pleaseReInit", "Printer")
            this.running = false;
            // this.init?.reRun();
        });
    }

    handleUnsolicitedResponse(response) {
        this.printCount++;
        // console.log(`print response: ${response.toString('utf8')}, PC: ${this.printCount}`);
        if (this.printCallback) {

            this.printCallback();
        }


    }

    //  _processQueue() {
    //     if (this.sendingQueue.length > 0) {
    //       const { data, commandName, resolve, reject } = this.printingQueue.shift();
    //       this.send(data, commandName).then(resolve).catch(reject);
    //     }
    //   }
    // async send(data, commandName=""){
    //     if (this.sendingLock) {
    //         return new Promise((resolve, reject) => {
    //           this.sendingQueue.push({ data, commandName, resolve, reject });
    //         });
    //       }
    //     this.sendingLock=true;
    //     try {
    //         const feedBack = await this._send(data, commandName);
    //         return feedBack;
    //       } catch (error) {
    //         throw new Error(error);
    //       } finally {
    //         this.sendingLock = false;
    //         this._processQueue();
    //       }
    // }

    async send(hexData, commandName) {
        const release = await mutex.acquire();
        return new Promise((resolve, reject) => {
            if (!this.running) {
                reject("[Printer] Not connected to a printer"); // Reject with error message directly
                // this.init?.reRun();
                this.running = false;
                release()
                return;
            }
            clearInterval(this.healthCheckInterval)
            const hexDataToSend = this.ESC + this.STX + this.slaveAddress + hexData + this.ESC + this.EXT;


            const hexBytes = Buffer.from(hexDataToSend, 'hex');
            const checksum = this.calculate2sComplementChecksum(hexBytes);
            const hexBytesWithChecksum = Buffer.concat([hexBytes, Buffer.from([checksum])]);


            this.socket.write(hexBytesWithChecksum);
            // console.log("HEX : ", hexBytesWithChecksum) //uncomment this for debugging

            let timeout = setTimeout(() => {
                this.noResponseCount++;
                sendFlag = true;
                this.setHealthCheckInterval();
                if (this.noResponseCount >= 3 && this.running === true) {
                    console.log("[Printer] too many no responses")
                    this.running = false;
                    // this.init?.reRun();
                    clearInterval(this.healthCheckInterval)
                    needToReInit.emit("pleaseReInit", "Printer")
                    this.noResponseCount = 0;
                }

                release();
                reject(`Timeout occurred. No response from printer. Sent Command : ${commandName} `); // Reject with error message directly
            }, 1500);

            // Event listener for when response is received
            this.responseEvent.once('responseReceived', () => {
                clearTimeout(timeout);
                // console.log("Reply :", this.responseBuffer); // Add this line for debugging
                this.noResponseCount = 0;
                sendFlag = true;
                this.setHealthCheckInterval(); //restart healthcheck interval
                release();
                resolve(this.responseBuffer);


            });
        });
    }



    disconnect() {
        this.running = false;
        this.socket.destroy();
        console.log("[Printer] Printer is Disconnected");
    }

    isSolicitedResponse(response) {
        const unsolicitedPosition = 3;
        // if (response.toString('utf8') === "PRI"){

        if (response.slice(unsolicitedPosition, unsolicitedPosition + 2).equals(Buffer.from([0x00, 0xaa]))) {
            return false;
        } else {
            return true;
        }
    }

    calculateModulus256Checksum(message) {
        return message.reduce((acc, val) => acc + val, 0) % 256;
    }

    calculate2sComplementChecksum(message) {
        const modulus2sChecksum = this.calculateModulus256Checksum([...message]);
        return 256 - modulus2sChecksum;
    }

    createMsg(obj, fileName) {
        const module = obj;
        const msgNameLen = fileName.length.toString(16).padStart(2, '0');
        const fileNameHex = Buffer.from(fileName).toString('hex');
        const numOfModule = module.length.toString(16).padStart(2, '0');

        let data = msgNameLen + fileNameHex + numOfModule;
        module.forEach(i => data += i);
        data = "1C" + (data.length / 2).toString(16).padStart(6, '0') + data;

        return data;
    }

    printerStatusRequest(command) {
        return command;
    }

    createModuleText(text, styling = true, x = 34, y = 28, rotation = 0, fontSize = 64, space = 0, fontName = "Lato") {
        const textLen = text.length.toString(16).padStart(2, '0');
        const textHex = Buffer.from(text).toString('hex');

        if (styling) {
            x = to16BitHex(x);
            y = to16BitHex(y);
            const rotData = { 0: "00", 90: "01", 180: "02", 270: "03" };
            rotation = rotData[rotation];
            const spaceData = { '30': '0000', '20': '0001', '10': '0002', '5': '0003', '2': '0004', '0': '0005', '-2': '0006', '-5': '0007', '-10': '0008', '-20': '0009', '-30': '000A' };

            space = spaceData[space.toString()];
            fontSize = fontSize.toString(16).padStart(4, '0');
            const fontLen = fontName.length.toString(16).padStart(2, '0');
            const fontNameHex = Buffer.from(fontName).toString('hex');
            return "01" + x + y + rotation + space + fontSize + fontLen + fontNameHex + textLen + textHex;
        } else {
            return '01' + textLen + textHex;
        }
    }

    createModuleQR(obj, x = 17, y = 33, scale = 3, rotation = 0, type = 'Data Matrix', faultToleranceLevel = 'H', size = 10, colorInverse = false, frameStyle = 'Blank', frameSize = 0) {
        const module = obj;
        x = to16BitHex(x);
        y = to16BitHex(y);
        scale = scale.toString(16).padStart(2, '0');
        const typeDict = { 'QRcode': '0', 'Data Matrix': '1', 'Micro QRcode': '2', 'PDF417': '3', 'PDF417TRUNG': '4', 'MicroPDF417': '5' };
        const toleranceDict = { 'L': '0', 'M': '1', 'Q': '2', 'H': '3' };
        type = typeDict[type];
        faultToleranceLevel = toleranceDict[faultToleranceLevel];
        size = size.toString(16).padStart(2, '0');
        const rotData = { 0: "0", 90: "1", 180: "2", 270: "3" };
        rotation = rotData[rotation];
        const colorInverseValue = colorInverse ? '1' : '0';
        const frameStyleDict = { 'Blank': '0', 'Top&bottom': '1' };
        frameStyle = frameStyleDict[frameStyle];
        const frameSizeHex = frameSize.toString(16).padStart(1, '0');
        const numOfModule = (module.length).toString(16).padStart(2, '0');

        let data = '04' + x + y + scale + type + faultToleranceLevel + size + rotation + colorInverseValue + frameStyle + frameSizeHex + numOfModule;
        module.forEach(i => data += i);

        return data;
    }
    createModuleField(x = 34, y = 28, rotation = 0, fontSize = 64, space = 0, fontName = "Lato", textLenght = 12, id = 1, source = 1, coder = 0, alignment = 0) {
        try {
            x = to16BitHex(x);
            y = to16BitHex(y);
            const rotData = { 0: "00", 90: "01", 180: "02", 270: "03" };
            rotation = rotData[rotation];
            const spaceData = { '30': '00', '20': '01', '10': '02', '5': '03', '2': '04', '0': '05', '-2': '06', '-5': '07', '-10': '08', '-20': '09', '-30': '0A' };
            space = spaceData[space.toString()];
            fontSize = fontSize.toString(16).padStart(4, '0');
            const fontLen = fontName.length.toString(16).padStart(2, '0');
            fontName = Buffer.from(fontName).toString('hex');
            source = source.toString(16).padStart(2, '0');
            coder = coder.toString(16).padStart(2, '0')
            alignment = alignment.toString(16).padStart(2, '0')
            id = id.toString(16).padStart(2, '0')
            textLenght = textLenght.toString(16).padStart(2, '0')
            const data = `03${x}${y}${rotation}${space}${fontSize}${fontLen}${fontName}${80}${id}${textLenght}`;
            console.log(`data field : ${data}`)
            return data
        } catch (err) {
            console.log(`[Printer] Create Module Field error: ${err}`)
            throw new Error
        }
    }

    async sendRemoteFieldData(messages) {
        // console.log(`messages ${messages}`)
        try {
            let numOfField = messages.length;
            let numOfFieldHex = numOfField.toString(16).padStart(2, '0');
            let data = "1d" + numOfFieldHex;

            for (let i = 0; i < numOfField; i++) {
                const fieldId = i.toString(16).padStart(2, '0');
                const lengthOfMessage = messages[i].length.toString(16).padStart(2, '0');
                const messageHex = Buffer.from(messages[i]).toString('hex');
                data = data + fieldId + lengthOfMessage + messageHex;
            }

            // console.log(`data : ${data}`);


            const response = await this.send(data, "Download Remote Field Data(1D)");

            if (this.notReceiving) {
                throw new Error("Timeout occurred. No response from printer. Sent Command : Download Remote Field Data(1D)")
            }
            if (response[1] === 0x06) {
                let P_status;
                switch (response[3]) {
                    case 0x00:
                        P_status = "no errors";
                        break;
                    case 0x42:
                        P_status = "now full";
                        break;
                    case 0x43:
                        P_status = "still full";
                        break;
                    case 0x01:
                        P_status = "one or more printer errors exist";
                        break;
                    case 0x12:
                        P_status = "print not started";
                        break;
                    default:
                        P_status = "unknown";
                }
                return P_status;
            } else {
                return "NAK";
            }
        } catch (error) {
            // console.log(err);
            throw new Error(`[Printer] Download Remote Field Data error: ${error}, the message was :`, messages);
        }
    }

    requestPrinterStatus() {
        this.send("14", "Request Printer Status(14)") // request status code
            .then(responseBuffer => {
                // console.log("Response received:", responseBuffer);

                // Extract printer status data from responseBuffer
                const statusData = responseBuffer.slice(4, -3); //  status data is between 4th and 3rd from the last bytes

                // Translate P_status
                let P_status;
                switch (statusData[1]) { // TODO : correction on response translations
                    case 0x00:
                        P_status = "normal";
                        break;
                    case 0x01:
                        P_status = "yellow or red status occur";
                        break;
                    case 0x12:
                        P_status = "Print not started";
                        break;
                    default:
                        P_status = "unknown";
                }
                // console.log("[Printer] Status is : ", P_status)

                // Translate ink_level
                const statusByte = statusData[1];
                const yellowBit = (statusByte >> 2) & 1; // Extracting status-10 bit
                const redBit = (statusByte >> 6) & 1; // Extracting status-14 bit

                let ink_level;
                if (yellowBit && redBit) {
                    ink_level = "red";
                } else if (yellowBit) {
                    ink_level = "yellow";
                } else {
                    ink_level = "safe";
                }

                // Create and return the result object
                const result = {
                    P_status: P_status,
                    ink_level: ink_level
                };
                return result;
            })
            .catch(error => {
                throw new Error(`[Printer] Request Printer Status error : ${error}`);
            });

    }


    async getBufNum() {
        try {
            const responseBuffer = await this.send("33", "Request the number of buffers of Remote Field(33)");
            // console.log(`Responseeee : ${responseBuffer.toString()}`);

            if (responseBuffer[1] === 6) {
                // const bufNum = Buffer.from(responseBuffer[4]).readUIntLE(0, 1);
                return responseBuffer[5];
            } else {
                throw new Error("got NACK");
            }
        } catch (err) {
            throw new Error(`[Printer] Request the number of buffers of Remote Field(33) error : ${err}`);
        }
    }



    async clearBuffers() {
        await this.send("21", "Clear Buffers of 1D(21)")
            .then(responseBuffer => {
                if (responseBuffer[1] === 0x06) {
                    console.log("[Printer] Buffers cleared")
                    return true
                } else {
                    throw new Error("got NACK")
                }
            }).catch((err) => {
                throw new Error(`[Printer] Clear Buffers of 1D(21) error : ${err}`);
            })
    }
    async startPrint() {

        await this.send("11", "Start Print(11)")
            .then(responseBuffer => {
                if (responseBuffer[1] === 0x06) {
                    switch (responseBuffer[3]) { // P_status
                        case 0x00:
                            console.log("[Printer] Print started successfully.")
                            return true;
                        case 0x01:
                            throw new Error("One or more printer errors exist.")
                        case 0x02:
                            console.log("[Printer] Print not idle. The print has been started already.")
                            break;
                        default:
                            throw new Error("unknown P_Status");
                    }

                } else {
                    throw new Error("got NACK)")
                }
            }).catch((err) => {
                throw new Error(`[Printer] Start Print(11) error : ${err}`);
            })
    }

    async stopPrint() {

        await this.send("12", "Stop Print(12)")
            .then(responseBuffer => {
                if (responseBuffer[1] === 0x06) {
                    switch (responseBuffer[3]) { // P_status
                        case 0x00:
                            console.log("[Printer] Print stopped successfully.")
                            return true;
                        case 0x12:
                            console.log("[Printer] Print not started. The print has been stopped.")
                            return true;
                        default:
                            throw new Error("unknown P_Status : ", responseBuffer[3]);
                    }

                } else {
                    throw new Error("got NACK")
                }
            }).catch((err) => {
                throw new Error(`[Printer] Stop Print(12) error : ${err}`);
            })
    }
    async requestInkRemains() {
        try {
            const responseBuffer = await this.send("26FF", "Request Ink Remains (26)");

            if (responseBuffer[1] === 0x06) {  // Check if ACK
                switch (responseBuffer[3]) {   // P_Status
                    case 0x00:
                    case 0x12: // Handle both 'No errors' and 'Succeeded but print not started'
                        const inkLevels = [];
                        // Loop through the ink level bytes (from 5th to the 3rd last byte)
                        for (let i = 5; i < responseBuffer.length - 3; i++) {
                            inkLevels.push(responseBuffer[i]); // Convert hex to decimal
                        }
                        // console.log("[Printer] Ink levels:", inkLevels);
                        return inkLevels;
                    case 0x01:
                        throw new Error("One or more printer errors exist.");
                    default:
                        throw new Error("unknown P_Status");
                }
            } else {
                throw new Error("got NACK");
            }
        } catch (err) {
            throw new Error(`[Printer] Request Ink Remains (26) error: ${err}`);
        }
    }


}


