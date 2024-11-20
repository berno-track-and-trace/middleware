import {printer} from '../index.js'

const printerTemplate = {
    template1: function (QRcode, details, fileName) {
        const QRtext = printer.createModuleText(QRcode.full_code, false);
        const QR = printer.createModuleQR(QRtext);
        const BPOM = printer.createModuleText("BPOM RI", true, 25, 4, 0, 24, 0, "Arial");
        const BN = printer.createModuleText(`BN  ${details.BN}`, true, 164, 0, 0, 20, 0, "Arial"); 
        const MD = printer.createModuleText(`MD  ${details.MD}`, true, 164, 33, 0, 20, 0, "Arial");
        const ED = printer.createModuleText(`ED  ${details.ED}`, true, 164, 66, 0, 20, 0, "Arial");
        const HET = printer.createModuleText(`HET ${details.HET}`, true, 164, 99, 0, 20, 0, "Arial");
        const SN = printer.createModuleText(`SN  ${QRcode.SN}`, true, 164, 129, 0, 20, 0, "Arial"); 
        const modules= [SN, QR, BPOM, BN, MD, ED, HET];
        const msg = printer.createMsg(modules, fileName);
        return msg;
    },
    template2: function (details, fileName) {
        //const QRtext = printer.createModuleText(QRcode.full_code, false);
        
        const QRModule = ["0301"];// buffer's field 1
        // const BPOM = printer.createModuleText("       BPOM RI      ",  true, 10 ,3,  0,  17,  0,  "Arial");
        const BPOM = printer.createModuleText("      BPOM RI       ",  true, 10 ,3,  0,  17,  0,  "Arial");
        const QR = printer.createModuleQR(QRModule,  10,  18, 4,  0, 'Data Matrix', 'H',  10, false,  'Blank', 0);
        const BN = printer.createModuleText(`BN  ${details.BN}`,  true,  10,  154+3,  0,  22,  0,  "Arial"); 
        const MD = printer.createModuleText(`MD  ${details.MD}`,  true,  10,  178+3,  0,  22,  0,  "Arial");
        const ED = printer.createModuleText(`ED  ${details.ED}`,  true,  10,  206+3,  0,  22,  0,  "Arial");
        const HET = printer.createModuleText(`HET Rp ${details.HET} / ${details.UNIT.toUpperCase()}`,  true,  10,  234,  0,  22,  0,  "Arial");
        const field = printer.createModuleField(10, 264+3, 0, 22, -5, "Arial", 15, 0, 1, 0, 0); // SN
        //const modules= [QR, BPOM,field,BN, MD, ED, HET]
        const modules= [ BPOM,QR, field,BN, MD, ED, HET]
        const msg = printer.createMsg(modules, fileName);
        console.log("[PrinterTamplate] tamplate2 is chosen")
        return msg;
    },
    template3: function (details, fileName) {
        //const QRtext = printer.createModuleText(QRcode.full_code, false);
        
        const QRModule = ["0301"];// buffer's field 1
        // const BPOM = printer.createModuleText("       BPOM RI      ",  true, 10 ,3,  0,  17,  0,  "Arial");
        const BPOM = printer.createModuleText("      BPOM RI       ",  true, 10 ,3,  0,  17,  0,  "Arial");
        const QR = printer.createModuleQR(QRModule,  10,  50, 2,  0, 'Data Matrix', 'H',  10, false,  'Blank', 0);
        const BN = printer.createModuleText(`BN  ${details.BN}`,  true,  10,  154+3,  0,  22,  0,  "Arial"); 
        const MD = printer.createModuleText(`MD  ${details.MD}`,  true,  10,  178+3,  0,  22,  0,  "Arial");
        const ED = printer.createModuleText(`ED  ${details.ED}`,  true,  10,  206+3,  0,  22,  0,  "Arial");
        const HET = printer.createModuleText(`HET Rp ${details.HET} / ${details.UNIT.toUpperCase()}`,  true,  10,  234,  0,  22,  0,  "Arial");
        const field = printer.createModuleField(10, 264+3, 0, 22, -5, "Arial", 15, 0, 1, 0, 0); // SN
        //const modules= [QR, BPOM,field,BN, MD, ED, HET]
        const modules= [ BPOM,QR, field,BN, MD, ED, HET]
        const msg = printer.createMsg(modules, fileName);
        console.log("[PrinterTamplate] template3 is chosen")
        return msg;
    }
};
export default printerTemplate