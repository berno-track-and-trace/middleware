import {printer} from '../index.js'

let printerTemplate = [
    function template1 (QRcode, details, fileName){
        const QRtext = printer.createModuleText(QRcode.full_code, false);
        const QR = printer.createModuleQR(QRtext);
        const BPOM = printer.createModuleText("BPOM RI", true, 25, 4, 0, 24, 0, "Arial")
        const BN = printer.createModuleText(`BN  ${details.BN}`,true, 164, 0, 0, 20, 0, "Arial"); 
        const MD = printer.createModuleText(`MD  ${details.MD}`,true, 164, 33, 0, 20, 0, "Arial");
        const ED = printer.createModuleText(`ED  ${details.ED}`,true, 164, 66, 0, 20, 0, "Arial");
        const HET = printer.createModuleText(`HET ${details.HET}`,true, 164,99, 0, 20, 0, "Arial");
        const SN = printer.createModuleText(`SN  ${QRcode.SN}`,true, 164, 129, 0, 20, 0, "Arial"); 
        const modules= [SN,QR,BPOM,BN,MD,ED,HET]
        const msg = printer.createMsg(modules, fileName);
        return msg
    },
    function template2 (details, fileName){
        //const QRtext = printer.createModuleText(QRcode.full_code, false);
        const field = printer.createModuleField(5,155,0,20,0,"Arial",15,0,1,0,0)
        const QRModule = ["0301"]
        const QR = printer.createModuleQR(QRModule);
        const BPOM = printer.createModuleText("BPOM RI", true, 25, 4, 0, 24, 0, "Arial",)
        const BN = printer.createModuleText(`BN  ${details.BN}`,true, 164, 0, 0, 20, 0, "Arial"); 
        const MD = printer.createModuleText(`MD  ${details.MD}`,true, 164, 33, 0, 20, 0, "Arial");
        const ED = printer.createModuleText(`ED  ${details.ED}`,true, 164, 66, 0, 20, 0, "Arial");
        const HET = printer.createModuleText(`HET ${details.HET}`,true, 164,99, 0, 20, 0, "Arial");
        //const SN = printer.createModuleText(`SN  ${QRcode.SN}`,true, 164, 129, 0, 20, 0, "Arial"); 
        const modules= [QR,BPOM]//,field]//BN,MD,ED,HET]
        const msg = printer.createMsg(modules, fileName);
        return msg
    }


]
export default printerTemplate