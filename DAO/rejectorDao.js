import { masterConfig } from '../index.js';
export default class Rejection {
    constructor(switch1) {
        this.switch1 = switch1;
        this.switch1.setValue(1)
        this.flag = false;
        this.running = false; // Flag to track if the process is running
        this.waitDelay =masterConfig.getConfig('rejector').REJECTOR_DELAY1;// in ms - delay for : holding the time until the object is on the right position to start the rejection
        this.rejectDelay=masterConfig.getConfig('rejector').REJECTOR_DELAY2; // in ms - delay for : how long the valve opens
        this.rejectCounter=0;
    }

    // async start() {
        
    //     if (this.running){
    //         console.log("[Rejector] Rejector cannot be started twice") 
    //         return}; // Don't start if already running
    //     this.running = true; // Set running flag to true
    //     console.log("[Rejector] Rejector is started") 
    //     try { 
    //         this.flag = false;
    //         while (!this.flag) {
    //              await sleep(50); //sleep for: preventing high cost on cpu power
    //             let sensorValue = this.sensor.getValue();
    //             if (sensorValue === 1) {
    //                 console.log("[Rejector] an object is detected")
    //                 if (!this.responseQueue.isEmpty()) {
    //                     const getresponse = this.responseQueue.dequeue();
    //                     if (getresponse) {
    //                         while (sensorValue === 1) { // this while loop is to make sure the object is already gone, before proceeding the next object
    //                             await sleep(1); // sleep for: preventing high cost on cpu power while it is looping on reading the sensor
    //                             sensorValue = this.sensor.getValue();
    //                         }
    //                         console.log("[Rejector] an object is passed");
                           
    //                     } else {
    //                         await sleep(this.delay1); 
    //                         this.switch1.setValue(0); // Rejection happens here
    //                         await sleep(this.delay2); 
    //                         let switchOpened = true;
    //                         while (switchOpened) { 
    //                             this.switch1.setValue(1);
    //                             while (sensorValue === 1) { // this while loop is to make sure the object is already gone, before proceeding the next object
    //                                 await sleep(1); // sleep for: preventing high cost on cpu power while it is looping on reading the sensor (on rejection)
    //                                 sensorValue = this.sensor.getValue();
    //                             }
    //                             switchOpened = false;
    //                         }
    //                         console.log("[Rejector] an object is rejected");
    //                     }
    //                 }
    //             }
    //         }
    //     } catch (error) {
    //         console.log(`Error: ${error}`);
    //     } finally {
    //         this.running = false; // Set running flag to false when finished
    //     }
    // }
    async reject(waitTime=242){
        // await sleep(this.waitDelay);
        // await sleep(200); // Rizal Delay 1
        await sleep(waitTime); // Rizal 2nd Delay 1
        // console.log("Rejector delay value:" + this.waitDelay); // Rizal added wait delay print
        this.switch1.setValue(0);
        // await sleep(this.rejectDelay);
        await sleep(50); // rizal delay 2
        this.switch1.setValue(1);
        console.log("[Rejector] an object is rejected");
        
        
    }
    async test(){

        // this.switch1.setValue(0); // Rejection happens here
        // await sleep(50); 
        // this.switch1.setValue(1); 
        // await sleep(100);
        // this.switch1.setValue(0);
        // await sleep(50); 
        // this.switch1.setValue(1); 
    }
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
