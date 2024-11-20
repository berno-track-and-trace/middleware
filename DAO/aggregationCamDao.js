import { postDataToAPI } from "../API/APICall/apiCall.js";
import { EventEmitter } from 'events';
import { needToReInit } from "../utils/globalEventEmitter.js";
import { clearInterval } from "timers";
import { exec } from 'child_process';


class AggregationCam {
  constructor(wscForData,wscForStatus, aggButton) {
    this.init=null
    this.wscForData = wscForData;
    this.wscForStatus= wscForStatus;
    
    this.aggButton = aggButton;

    this.handleMessageData = this.handleMessageData.bind(this);
    this.wscForData.receiveMessage(this.handleMessageData);
    this.receivedMessages = [];

    this.handleMessageStatus = this.handleMessageStatus.bind(this);
    this.wscForStatus.receiveMessage(this.handleMessageStatus);
    this.status=null;

    this.responseEvent1 = new EventEmitter();
    this.responseEvent = new EventEmitter();
    this.timeout=null
    
    this.hcInterval=null;
    this.hcIntervalTime= 10000;
    this.hcIntervalTolerance=100;
    this.normalProcessFlag=false;
    
  }

  pingIP(ipAddress) {
    return new Promise((resolve, reject) => {
      const command = `ping -c 1 -W 1 ${ipAddress}`;
  
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(`Ping failed: ${stderr}`);
        } else if (stdout.includes('1 packets transmitted, 1 received')) {
          resolve(`Ping to ${ipAddress} successful`);
        } else {
          reject(`Ping to ${ipAddress} failed`);
        }
      });
    });
  };


  async setHCIinterval(){
      clearInterval(this.hcInterval)
      this.hcInterval=setInterval(async ()=>{

        try{
        // console.log("checking aggcam")
        const status = await this.getStatus()
        if (status!='Ok'){
          needToReInit.emit("pleaseReInit", "AggCam")
          await this.pingIP()
          clearInterval(this.hcInterval)
        }else{
          // console.log("agg cam is ok")
        }}
       catch (error) {
        needToReInit.emit("pleaseReInit", "AggCamWS", error)
        console.log("agg cam is not ok",error)
        clearInterval(this.hcInterval)
        this.normalOperationFlag=false;
      }

      },this.normalOperationFlag?this.hcIntervalTime+this.hcIntervalTolerance:this.hcIntervalTime)

  }
   setCallBack(){
      if (this.wscForData.ws) {
        this.wscForData.ws.removeListener('message', this.handleMessageData);
    }

    if (this.wscForStatus.ws) {
        this.wscForStatus.ws.removeListener('message', this.handleMessageStatus);
    }

    this.handleMessageData =  this.handleMessageData.bind(this);
    this.wscForData.receiveMessage(this.handleMessageData);
    this.receivedMessages = [];

    this.handleMessageStatus =  this.handleMessageStatus.bind(this);
     this.wscForStatus.receiveMessage(this.handleMessageStatus);
    this.status=null;
  }
  async getStatus() {
    
    return new Promise(async (resolve, reject) => {
      await this.wscForStatus.sendMessage('get_status');
      
      let timeout = setTimeout(() => {
        reject(`[Agg. Cam] Timeout occurred. No response from websocket`);
        
        // this.init?.reRun();
      }, 1000);
      this.responseEvent1.once('responseReceived', () => {
        clearTimeout(timeout); 
        console.log("Agg cam status : ",this.status)
        if(this.status!='Ok'){
          // this.init?.reRun();
        }
        resolve(this.status);
      })
      })
    .catch((err) => {
      console.log(`[Agg. Cam] Error on getting camera status: ${err}`)
      throw new Error(`[Agg. Cam] Error on getting camera status: ${err}`);
      
    });
  }

  async getData() {
    clearInterval(this.hcInterval)
    return new Promise(async (resolve, reject) => {
      this.receivedMessages = [];
      await this.wscForData.sendMessage('get_data');

      let timeout1 = setTimeout(() => {
        this.normalOperationFlag=true;
        this.setHCIinterval()

        reject(`[Agg. Cam] Timeout occurred. No response from websocket`);
      }, 2000);
      
      this.responseEvent.once('responseReceived', () => {
        clearTimeout(timeout1);
        this.normalOperationFlag=true;
        this.setHCIinterval()
        resolve();
        // const result = this.mergeResponses(this.receivedMessages);
        // this.receivedMessages = [];
        // resolve(async (result) => {
        //   try {
        //     console.log(result);
        //   } catch (err) {
        //     // Handle error
        //   }
        // });
      });
    });
  }

  async handleMessageData(message) {
    console.log(`[AggCam] incoming message`);
    this.receivedMessages.push(message);
    if (this.receivedMessages.length === 3) {
      this.responseEvent.emit('responseReceived')
      const result = this.mergeResponses(this.receivedMessages);
      console.log(`[AggCam] got 3 messages`);
      await postDataToAPI(`v1/work-order/active-job/aggregation`, {
        scanned_code_map: result
      });
      this.receivedMessages = [];
    }
  }
  async handleMessageStatus(message) {
    this.status=message.toString();
    this.responseEvent1.emit('responseReceived')
    

  }

  // mergeResponses(messages) {
  //   let combinedData = {};

  //   messages.forEach((message) => {
  //     const messageStr = message.toString(); // Convert Buffer to string
  //     const pairs = messageStr.split(';');
  //     pairs.forEach((pair) => {
  //       if (pair) {
  //         const [code, accuracy, x, y] = pair.split(':');

  //         if (combinedData[code]) {
  //           if (combinedData[code].accuracy < accuracy) {
  //             combinedData[code] = { accuracy: parseInt(accuracy, 10), x: parseInt(x, 10), y: parseInt(y, 10) };
  //           }
  //         } else {
  //           combinedData[code] = { accuracy: parseInt(accuracy, 10), x: parseInt(x, 10), y: parseInt(y, 10) };
  //         }
  //       }
  //     });
  //   });
  mergeResponses(messages) {
    let combinedData = {};

    messages.forEach((message) => {
        const messageStr = message.toString(); // Convert Buffer to string if necessary
        const pairs = messageStr.split(';');
        pairs.forEach((pair) => {
            if (pair) {
                const [code, accuracy, x, y, s] = pair.split(':');

                // Init an empty array for the code if not exist yet
                if (!combinedData[code]) {
                    combinedData[code] = [];
                }

                // Add each code with its accuracy, x, and y values
                combinedData[code].push({
                    accuracy: parseInt(accuracy, 10),
                    x: parseInt(x, 10),
                    y: parseInt(y, 10),
                    s:parseInt(s, 10),
                });
            }
        });
    });
    console.log(JSON.stringify(combinedData))
    return combinedData;
}

  runAggregateButton() {
    clearInterval(this.hcInterval)
    this.setHCIinterval();

    this.aggButton.setShortPressCallback(async () => {
      console.log('[AggCam] Yellow short press detected.');
      this.receivedMessages = [];
      try {
      await this.getData()
      // await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.log("[AggCam] error : ",error)
      }
      
    });
  }
}

export default AggregationCam;
