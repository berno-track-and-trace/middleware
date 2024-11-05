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
        // uncomment commands bellow to  put testing in action :
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
