import net from 'net';
import { EventEmitter } from 'events';
import { error } from 'console';



function to16BitHex(value) {
    if (value >= 0) {
        return value < 32768 ? value.toString(16).padStart(4, '0') : "Value too large";
    } else {
        return ((1 << 16) + value).toString(16).padStart(4, '0');
    }
}


export default class TIJPrinter {
    constructor(ip, port, slaveAddress, workstationId) {
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
        this.printCallback=null

        this.ESC = '1B';
        this.STX = '02';
        this.EXT = '03';
    }

    setPrintCallBack(callback) {
        this.printCallback = callback
    } 

    connect() {
        this.socket = new net.Socket();
        this.socket.connect(this.port, this.ip, () => {
            this.running = true;
            this.listenerThread = this.listenForResponses();
            console.log(`[Printer] Socket established on port ${this.port} and IP ${this.ip}`);
        });

        this.socket.on('error', (err) => {
            console.error("[Printer] Connection error:", err);
            this.running = false;
        });
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
        });

        this.socket.on('close', () => {
            console.log("[Printer] Listening stopped");
        });
    }

    handleUnsolicitedResponse(response) {
        this.printCount++;
        console.log(`print response: ${response.toString('utf8')}, PC: ${this.printCount}`);
         if (this.printCallback) {
        
        this.printCallback();
    }
        

    }

    send(hexData, reshandler = () => {}, commandName="") {
        return new Promise((resolve, reject) => {
            if (!this.running) {
                reject("Not connected to a printer"); // Reject with error message directly
                return;
            }
    
            const hexDataToSend = this.ESC + this.STX + this.slaveAddress + hexData + this.ESC + this.EXT;
            console.log(hexDataToSend);
    
            const hexBytes = Buffer.from(hexDataToSend, 'hex');
            const checksum = this.calculate2sComplementChecksum(hexBytes);
            const hexBytesWithChecksum = Buffer.concat([hexBytes, Buffer.from([checksum])]);
            console.log(hexBytesWithChecksum);
            this.socket.write(hexBytesWithChecksum);
    
            let timeout = setTimeout(() => {
                reject(`[Printer]Timeout occurred. No response from printer. Sent Command : ${commandName} `); // Reject with error message directly
            }, 2000);
    
            // Event listener for when response is received
            this.responseEvent.once('responseReceived', () => {
                clearTimeout(timeout);
                // console.log("Response received:", this.responseBuffer); // Add this line for debugging
                resolve(this.responseBuffer);
                reshandler(this.responseBuffer);
            });
        });
    }
    
    

    disconnect() {
        this.running = false;
        this.socket.destroy();
        console.log("Disconnected");
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
                    const spaceData = {'30': '0000','20': '0001','10': '0002','5': '0003','2': '0004','0': '0005','-2': '0006','-5': '0007','-10': '0008','-20': '0009','-30': '000A'};
                    
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
            createModuleField(x = 34, y = 28, rotation = 0, fontSize = 64, space = 0, fontName = "Lato", textLenght=12, id=1, source=1, coder=0, alignment=0){
                
                x = to16BitHex(x);
                y = to16BitHex(y);
                const rotData = { 0: "00", 90: "01", 180: "02", 270: "03" };
                rotation = rotData[rotation];
                const spaceData = {'30': '00','20': '01','10': '02','5': '03','2': '04','0': '05','-2': '06','-5': '07','-10': '08','-20': '09','-30': '0A'};
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
            }

            async sendRemoteFieldData(messages) {
                console.log(`messages ${messages}`)
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
            
                try {
                    const response = await this.send(data);
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
                } catch (err) {
                    console.log(err);
                    throw err;
                }
            }
            
            requestPrinterStatus() {
                this.send("14") // request status code
                    .then(responseBuffer => {
                        // console.log("Response received:", responseBuffer);
            
                        // Extract printer status data from responseBuffer
                        const statusData = responseBuffer.slice(4, -3); //  status data is between 4th and 3rd from the last bytes
                        
                        // Translate P_status
                        let P_status;
                        switch (statusData[1]) {
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
                        // Handle errors
                        console.error("Error:", error);
                        // Additional error handling here
                        throw error; 
                    });

            }
            // uploadTemplateMSG(msg, fileName){
                
            // }

            async getBufNum(){
               await this.send("33")
                .then(responseBuffer => {
                    if (responseBuffer[1] === 0x06){
                        const bufNum = Buffer.from(responseBuffer[4]).readUIntLE(0, 1)
                        return 
                    }else{
                        throw new Error("got Nack")
                    }
                })
            }
    
        }

