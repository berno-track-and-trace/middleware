import net from 'net';
import { EventEmitter } from 'events';


function to16BitHex(value) {
    if (value >= 0) {
        return value < 32768 ? value.toString(16).padStart(4, '0') : "Value too large";
    } else {
        return ((1 << 16) + value).toString(16).padStart(4, '0');
    }
}

export default class TIJPrinter {
    constructor(ip, port, slaveAddress) {
        this.printerId = "printer1"
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

        this.ESC = '1B';
        this.STX = '02';
        this.EXT = '03';
    }

    connect() {
        this.socket = new net.Socket();
        this.socket.connect(this.port, this.ip, () => {
            this.running = true;
            this.listenerThread = this.listenForResponses();
            console.log("Socket established");
        });

        this.socket.on('error', (err) => {
            console.error("Connection error:", err);
            this.running = false;
        });
    }

    listenForResponses() {
        this.socket.on('data', (response) => {
            if (response) {
                if (this.isSolicitedResponse(response)) {
                    this.responseBuffer = response;
                    this.responseEvent.set();
                } else {
                    this.handleUnsolicitedResponse(response);
                }
            }
        });

        this.socket.on('error', (err) => {
            console.error("Error listening for responses:", err);
        });

        this.socket.on('close', () => {
            console.log("Listening stopped");
        });
    }

    handleUnsolicitedResponse(response) {
        this.printCount++;
        console.log(`print response: ${response}, PC: ${this.printCount}`);
    }

    send(hexData) {
        setTimeout(() => {
            if (!this.socket) {
                console.error("Not connected to a printer");
                return;
            }

            try {
                const hexDataToSend = this.ESC + this.STX + this.slaveAddress + hexData + this.ESC + this.EXT;
                console.log(hexDataToSend);

                const hexBytes = Buffer.from(hexDataToSend, 'hex');
                const checksum = this.calculate2sComplementChecksum(hexBytes);
                const hexBytesWithChecksum = Buffer.concat([hexBytes, Buffer.from([checksum])]);

                this.socket.write(hexBytesWithChecksum);
                this.responseEvent.clear();
                setTimeout(() => {
                    if (this.responseEvent.wait(1000)) {
                        console.log(this.responseBuffer);
                        return this.responseBuffer;
                    } else {
                        console.error("Timeout occurred. No response from slave address.");
                    }
                }, 200);
            } catch (err) {
                console.error("Socket error:", err);
            }
        }, 200);
    }



    disconnect() {
        this.running = false;
        this.socket.destroy();
        console.log("Disconnected");
    }

    isSolicitedResponse(response) {
        const unsolicitedPosition = 3;

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
        const module = [obj];
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

    static createModule = class {
        constructor() {
            this.x = 34;
            this.y = 28
            this.rotation = 0
            this.fontSize = 64
            this.space = 0,
            this.fontName = "Lato"
        }
        static text(text, styling = true, x = 34, y = 28, rotation = 0, fontSize = 64, space = 0, fontName = "Lato") {
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

        static qr(obj, x = 34, y = 28, scale = 25, rotation = 0, type = 'QRcode', faultToleranceLevel = 'H', size = 0, colorInverse = false, frameStyle = 'Blank', frameSize = 0) {
            const module = [obj];
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
            const numOfModule = module.length.toString(16).padStart(2, '0');

            let data = '04' + x + y + scale + type + faultToleranceLevel + size + rotation + colorInverseValue + frameStyle + frameSizeHex + numOfModule;
            module.forEach(i => data += i);

            return data;
        }
    }
}


