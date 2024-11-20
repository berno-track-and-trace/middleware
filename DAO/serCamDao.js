import net from 'net';
import {sendDataToAPI} from '../API/APICall/apiCall.js'
import { printingProcess } from '../index.js';

function removeSpacesAndNewlines(inputString) {
    return inputString.replace(/\s+/g, '');
}

export default class serCam {
    constructor(ip, port, workstationId, queue) {
        this.ip = ip;
        this.port = port;
        this.workstationId = workstationId
        this.running = false;
        this.socket = null;
        this.listenerThread = null;
        this.window = [];
        this.errorCount = 0;
        this.repeatErrorCount = 0;
        this.accuracyThreshold =0.0
        this.queue=queue
    }
    connect() {
        this.socket = new net.Socket();
        this.socket.connect(this.port, this.ip, () => {
            this.running = true;
            this.listenerThread = this.listenForResponses();
            console.log("serCam Socket established");
        });

        this.socket.on('error', (err) => {
            console.error("Connection error:", err);
            this.running = false;
        });
    }
    disconnect() {
        this.running = false;
        this.socket.destroy();
        console.log("Disconnected");
    }
    separateStringToObject(input) {
        // Split the input string by ":"
        const parts = input.split(":");
        
        // Extract the code part
        const code = parts[0];
        
        // Extract the accuracy part and parse it as an integer
        const accuracy = parseInt(parts[1]);
    
        // Create and return the resulting object
        return {
            code: removeSpacesAndNewlines(code),
            accuracy: accuracy
        };
    }
    listenForResponses() {
        this.socket.on('data', (response) => {
            if (response) {
                
                const data = this.receiveData(this.separateStringToObject(response.toString('utf8')))
            }
        });

        this.socket.on('error', (err) => {
            console.error("Error listening for responses:", err);
        });

        this.socket.on('close', () => {
            console.log("Listening stopped");
        });
    }

    checkFormat(data) { //TODO : change reject status into more detail reasons
        const identifikasi_pattern = /^\(90\)[A-Za-z0-9]{1,16}\(91\)\d{1,10}$/;
        const otentifikasi_pattern1 = /^\(90\)[A-Za-z0-9]{1,16}\(10\)[A-Za-z0-9]{1,20}\(17\)\d{1,6}\(21\)[A-Za-z0-9]{1,20}$/;
        const otentifikasi_pattern2 = /^\(01\)[A-Za-z0-9]{14}\(10\)[A-Za-z0-9]{1,20}\(17\)\d{1,6}\(21\)[A-Za-z0-9]{1,20}$/;
        let result=false
        let reason=null
        let code = data.code
        // console.log(identifikasi_pattern.test(code), otentifikasi_pattern1.test(code), otentifikasi_pattern2.test(code))
        if (identifikasi_pattern.test(code) || otentifikasi_pattern1.test(code) || otentifikasi_pattern2.test(code)) {
            console.log("Data is in correct format:", code);
            console.log(data.accuracy)
            if (this.accuracyThreshold<=data.accuracy){
                result = true
                
            }else{
                result = false
                reason = "LOW_ACCURACY"
            }
            
        } else {
            console.log("Data is in bad format or ERROR:", code);
            if (code==="ERROR" || code===null){
                data.code=null
                reason = "QR_NOT_FOUND"
            }else{
                reason = "PATTERN_MISMATCH"
            }
            
        }

        return {result,reason,code}
    }

    async receiveData(data) {
        
        const check = this.checkFormat(data)
        this.queue.enqueue(check.result)
        await new Promise(resolve => setTimeout(resolve, 300)); 
        console.log(data)
        console.log(`work o id ${printingProcess.work_order_id}`)
        await sendDataToAPI(`v1/work-order/${printingProcess.work_order_id}/serialization/validate`,{ // TODO: what if its not reaching the API
            accuracy:data.accuracy,
            status:check.result?"pass":"rejected",
            code:data.code,
            reason:check.reason
            
        }) 
        
    }
        
}

