import net from 'net';
import {postDataToAPI} from '../API/APICall/apiCall.js'
import { printingProcess } from '../index.js';
import { needToReInit, printingScanning } from '../utils/globalEventEmitter.js';
import { EventEmitter } from 'events';
import pkg from 'node-libgpiod';
import Queue from '../utils/queue.js';

const { version, Chip, Line } = pkg;
// import { eventNames } from 'process';
import { clear } from 'console';
function removeSpacesAndNewlines(inputString) {
    return inputString.replace(/\s+/g, '');
}
let normalOperationFlag = false; //normal operation flag for healthcheck
let printedTimeOutFlag = false;
export default class serCam {
    constructor(ip, port, rejector) {
        this.init=null;
        this.ip = ip;
        this.port = port;
        this.running = false;
        this.socket = null;
        this.listenerThread = null;
        this.rejector= rejector;
        this.accuracyThreshold =0.0 // need discussion
        this.active=false
        // this.sensor = sensor;
        this.rejection = new EventEmitter()
        this.hcTimeInterval = 10000;
        this.hcTimeTolerance= 500;
        this.healthCheckInterval=null;
        this.healthCheckTimeout=null;
        this.sensorReadingInterval=null;
        // this.setSensorCallBack();

        this.chip = new Chip(4);
        this.line = new Line(this.chip, 5);
        this.line.requestInputMode();

        this.setIntervalSensorReading(50);
        
        
        this.rejectTimeOut=null

        this.passCounter=0;

        this.start_time=null;

        this.printedTimeOutQueue=new Queue();
        this.currentPrintedCode=null;

        this.printProcess = null;

    }
    addPrintedTimeOut(printedData){
        this.printedTimeOutQueue.enqueue({
            printedData: printedData,
            timeOut:setTimeout(async ()=>{
                // this.printedTimeOutQueue.dequeue();
                if(!printedTimeOutFlag){
                    printedTimeOutFlag=true; 
                    this.printedTimeOutQueue.dequeue();
                       
                    const currentPrintSignalCount = this.printedTimeOutQueue.size()
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    if (currentPrintSignalCount<this.printedTimeOutQueue.size()){
                        console.log("[SerCam] The camera sensor might be disconnected from GPIO, please check the connection")
                        needToReInit.emit("pleaseReInit", "serCam", "sensor might be disconnected to GPIO", true); 
                    }else{
                        console.log("[SerCam] The camera sensor might be disconnected from GPIO or the conveyor is not running")
                    }
                    while(!this.printedTimeOutQueue.isEmpty()){
                        const data = this.printedTimeOutQueue.dequeue()
                        clearTimeout(data.timeOut)
                    }
                    printedTimeOutFlag=false;
                }  
                
            },2000)
         
        })
            
    }
    setIntervalSensorReading(timeInterval){
        this.sensorReadingInterval = setInterval(()=>{
            if(this.line.getValue()===1){
                
                clearTimeout(this.rejectTimeOut)
                clearInterval(this.sensorReadingInterval)
                this.rejection.removeAllListeners()
                console.log("[serCam] sensor triggered")
                let printed=null;
                if(!this.printedTimeOutQueue.isEmpty()){
                    printed = this.printedTimeOutQueue.dequeue();
                    clearTimeout(printed.timeOut)
                }
                this.rejectTimeOut = setTimeout( async ()=>{
                    console.log("rejector got time out")
                    // let printed=null;
                    // if(!this.printedTimeOutQueue.isEmpty()){
                    //     printed = this.printedTimeOutQueue.dequeue();
                    //     clearTimeout(printed.timeOut)
                    //     printed = printed.printedData;
                    // }
                    //else{
                    //     if (!this.printProcess.full_code_queue.isEmpty()){
                    //         printed=this.printProcess.full_code_queue.dequeue()
                    //     }
                        
                    //     console.log("[serCam] the code wasn't detected as printed : ", printed)
                    // }

                    

                    await this.rejector.reject(0)
                    while(this.line.getValue===1){
                        await this.rejector.reject(0)
                    }
                    await postDataToAPI(`v1/work-order/${printingProcess.work_order_id}/assignment/${printingProcess.assignment_id}/serialization/validate`,{ 
                        accuracy:0,
                        status:"rejected",
                        code:null,
                        reason:"CAM_ERROR",
                        event_time:Date.now()
                    }) 
                    while(this.line.getValue===1){
                        await this.rejector.reject(242)
                    }
                    this.rejection.removeAllListeners()
                    this.setIntervalSensorReading(50);
                }, 242)

                this.rejection.once("reject", async ()=>{
                    
                    await this.rejector.reject()
                    // if(this.start_time){
                        
                    //     let process_time= process.hrtime(this.start_time);
                    //     // console.log(process_time)
                    //     console.log("process time for reject: ", process_time[0] * 1000 + process_time[1] / 1000000)
                    //     this.start_time=null;
                        
                    // }else{
                    //     console.log("overlapping happens")
                    // }
                    // console.log("[SerCam] an object is rejected")
                    
                    this.rejection.removeAllListeners()
                    while(this.line.getValue()===1){
                        await this.rejector.reject()
                    }
                    this.setIntervalSensorReading(50);
                })
                this.rejection.once("pass", async ()=>{

                    // if(this.start_time){
                    //     let process_time= process.hrtime(this.start_time);
                    //     // console.log(process_time)
                    //     console.log("process time for passed: ", process_time[0] * 1000 + process_time[1] / 1000000)
                    //     this.start_time=null;
                    //     console.log("[SerCam] an object is rejected")
                    // }else{
                    //     console.log("overlapping happens")
                    // }
                    console.log("[SerCam] an object is passed")

                    this.rejection.removeAllListeners()
                    while(this.line.getValue()===1){
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    this.setIntervalSensorReading(50);
                    
                    
                })
            }

        
        },timeInterval)
    }
    
    // setSensorCallBack() {
    //     console.log("sercam sensor callback assigned")
    //     this.sensor.setShortPressCallback(()=>{
    //         clearTimeout(this.rejectTimeOut)
    //         this.rejection.removeAllListeners()
    //         console.log("sensor triggered")
    //         this.rejectTimeOut = setTimeout( ()=>{
    //             console.log("rejector got time out")
    //             this.rejector.reject(0)
    //             // await postDataToAPI(`v1/work-order/${printingProcess.work_order_id}/assignment/${printingProcess.assignment_id}/serialization/validate`,{ 
    //             //     accuracy:0,
    //             //     status:"rejected",
    //             //     code:null,
    //             //     reason:"CAM_ERROR",
    //             //     event_time:Date.now()
    //             // }) 
    //             this.rejection.removeAllListeners()
    //         }, 500)
    //         this.rejection.once("reject", ()=>{
                
    //             this.rejector.reject()
    //             console.log("[Rejector] an object is rejected")
    //             this.rejection.removeAllListeners()
    //         })
    //         this.rejection.once("pass", ()=>{
    //             console.log("[Rejector] an object is passed")
    //             this.rejection.removeAllListeners()
                
    //         })
    //     })
    // }
   async setHealthCheckInterval(){
        this.healthCheckInterval= setInterval(() => {
            try {
                if(this.socket){
                    const message = "ERRSTAT\r";  // sendinf command ERRSTAT
                    this.socket.write(message, 'utf8');  // Sending as UTF-8 encoded string
                    this.healthCheckTimeout = setTimeout(()=>{
                    this.running = false;
                    needToReInit.emit("pleaseReInit", "serCam", "timed out"); // ask to re-init
                    },500);

                }
            } catch (error) {   
                console.log("[serCam] healthchek error : ", error)
            }
            
        }, normalOperationFlag?this.hcTimeInterval+this.hcTimeTolerance:this.hcTimeInterval)
        normalOperationFlag=false;
    }
    connect() {
        return new Promise((resolve, reject) =>{
            try {
                if(this.socket){
                    clearInterval(this.healthCheckInterval);
                    this.socket.removeAllListeners();
                    this.socket.destroy();
                }
                printingScanning.removeAllListeners();
                printingScanning.on("printed", (data)=>{
                    this.addPrintedTimeOut(data)
                })
                this.socket = new net.Socket();
                // this.socket.setKeepAlive(true, 1000);
                this.socket.connect(this.port, this.ip, () => {
                    this.running = true;
                    this.active = true; 
                    this.socket.removeAllListeners();
                    this.listenerThread = this.listenForResponses();
                    this.setHealthCheckInterval();
                    console.log("[Ser Cam] Socket established");
                    resolve();
                });
                    this.socket.once('error', (err) => {
                    this.running = false;
                    this.active=false;
                    
                    reject(`[Ser Cam] Connection error: ${err.message}`)
                    
                });
                this.socket.once('close', (err) => {
                    this.running = false;
                    this.active=false;

                    reject(`[Ser Cam] Connection error: ${err.message}`);
                    
                });
            } catch (error) {
                reject(error)
            }

        })
        
    }
    disconnect() {
        this.running = false;
        this.socket.removeAllListeners();
        this.socket.destroy();
        console.log("[Ser Cam] Disconnected");
    }
    separateStringToObject(input) {
        // Split the input string by ":"
        
        const parts = input.split(":");
        const code = parts[0];
        let accuracy=0;
        if (parts.length>1){

            // Extract the accuracy part and parse it as an integer
            accuracy = parseInt(parts[1]);
  
        }
      
        // Create and return the resulting object
        return {
            code: removeSpacesAndNewlines(code),
            accuracy: accuracy
        };
    }
    listenForResponses() {
        this.socket.on('data', (response) => {
            // this.start_time= process.hrtime();
            
            clearTimeout(this.rejectTimeOut)
            clearInterval(this.healthCheckInterval);
            // let printed=null;
            if (response) {
                let responseString = response.toString('utf8')
                if (responseString.startsWith("OK,ERRSTAT,")){
                    clearTimeout(this.healthCheckTimeout);
                    responseString=responseString.split(",")
                    if(removeSpacesAndNewlines(responseString[2])==="none"){
                        // console.log("[Ser Cam] Status is ok")
                    }else{

                        console.log("[Ser Cam] Camera error code found : ", responseString[2])
                        needToReInit.emit("pleaseReInit", "serCam");
                    }
                }
                else{
                    // if(!this.printedTimeOutQueue.isEmpty()){
                    //     printed = this.printedTimeOutQueue.dequeue();
                    //     clearTimeout(printed.timeOut)
                    //     // printed = printed.printedData;
                    // }
                    // else{
                    //     printed = this.printProcess.full_code_queue.dequeue()
                    //     console.log("[serCam] the code wasn't detected as printed : ", printed)
                    // }
                    
                    normalOperationFlag=true;
                    responseString = this.separateStringToObject(responseString)
                    
                    const data = this.receiveData(responseString)
                }
                
            }
            this.setHealthCheckInterval();
        });
        

        this.socket.on('error', (err) => {
            clearInterval(this.healthCheckInterval);
            needToReInit.emit("pleaseReInit", "serCam");
            console.error("[Ser Cam] Error listening for responses:", err);
        });

        this.socket.on('close', () => {
            clearInterval(this.healthCheckInterval);
            needToReInit.emit("pleaseReInit", "serCam")
            console.log("[Ser Cam] Listening stopped");
            this.running = false;
        });
    }

    checkFormat(data) { 
        const identifikasi_pattern = /^\(90\)[A-Za-z0-9]{1,16}\(91\)\d{1,10}$/;
        const otentifikasi_pattern1 = /^\(90\)[A-Za-z0-9]{1,16}\(10\)[A-Za-z0-9]{1,20}\(17\)\d{1,6}\(21\)[A-Za-z0-9]{1,20}$/;
        const otentifikasi_pattern2 = /^\(01\)[A-Za-z0-9]{14}\(10\)[A-Za-z0-9]{1,20}\(17\)\d{1,6}\(21\)[A-Za-z0-9]{1,20}$/;
        let result=false
        let reason="success"
        let code = data.code
        if (identifikasi_pattern.test(code) || otentifikasi_pattern1.test(code) || otentifikasi_pattern2.test(code)) {
            console.log("[Ser Cam] Data is in a correct format:", code);
            console.log(data.accuracy)
            if (this.accuracyThreshold<=data.accuracy){
                result = true
                
            }else{
                result = false
                reason = "LOW_ACCURACY"
            }
            
        } else {
            if (code==="ERROR;" || code===null){
                data.code=null
                reason = "QR_NOT_FOUND"
            }else{
                reason = "PATTERN_MISMATCH"
            }
            console.log(`[Ser Cam] Data is in bad format or ERROR: ${reason} on scanned code: ${code}`);
            result = false;
            
        }

        return {result,reason,code}
    }

    async receiveData(data, printed) {
        
        // console.log("String2 : ",data)
        const check = this.checkFormat(data)
        
            if(!check.result){
                
                this.rejection.emit("reject")
                console.log("emit reject")
            }else{

                this.rejection.emit("pass")
                // this.passCounter++;
                // console.log("passed object counts: ", this.passCounter)
            }
            await postDataToAPI(`v1/work-order/${printingProcess.work_order_id}/assignment/${printingProcess.assignment_id}/serialization/validate`,{ 
                accuracy:isNaN(data.accuracy)?0:data.accuracy,
                status:check.result?"passed":"rejected",
                code:data.code,
                reason:check.reason,
                event_time:Date.now()
            }) 
    
    }
    
        
}

