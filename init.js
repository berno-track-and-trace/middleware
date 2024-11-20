import weighingScaleDao from "./DAO/weighingScaleDao.js";
import { getDataToAPI } from "./API/APICall/apiCall.js";
import { HttpStatusCode } from "axios";
import fs from 'fs';
import {Mutex} from 'async-mutex'
import { needToReInit } from "./utils/globalEventEmitter.js";
import * as child from 'node:child_process'
import crypto from "crypto"

let wsAndAggTimeOut = null
const mutex = new Mutex();
const pipePath = '/tmp/middleware-failsafe-pipe'
export let problematicPeripheral=null;
export default class Initialization {
  constructor(DB,aggCamWsData,aggCamWsStatus, aggCam, printer, serCam, rejector, yellowLed, greenLed, yellowButton, greenButton , backEndWS){
    this.MongoDB = DB
    this.aggCamWsData = aggCamWsData,
    this.aggCamWsStatus = aggCamWsStatus,
    this.aggCam = aggCam,
    this.printer = printer,
    this.serCam = serCam,
    this.rejector = rejector,
    this.yellowLed = yellowLed,
    this.greenLed = greenLed,
    this.yellowButton = yellowButton,
    this.greenButton = greenButton,
    this.backEndWS = backEndWS,
    this.reRunning = false;
    this.firstRun=true;
    this.state = {
      connectingToDB:false,
      connectingToWS:false,
      connectingToAggCam:false,
      connectingToPrinter:false,
      connectingToSerCam:false,
      weighingScaleCheck:false,
      rejectorCheck:true,
      finalChecks:false
    }
  
  }
  async reRun(peripheral,reason="no reason", rejectorCheck=false) {
    // const release = await mutex.acquire();
    console.log(`[Init] ${peripheral} is commiting a re-initialization. Reason`, reason)
    problematicPeripheral =peripheral;
    try {

      const json = {
        "request_id": crypto.randomUUID(),
        "ERROR_CODE": peripheral.toUpperCase(),
        "MESSAGE": reason
      }
      const str = JSON.stringify(json)
      this.backEndWS.sendMessage(str)
      console.log(str)
    }catch(error){
      console.log("[Init ] error on sending report to backend WS : ", error)
    }
   
    try {
      if (!this.reRunning) {
        this.reRunning = true;
        if(rejectorCheck){
          this.state.rejectorCheck = true;
          this.state.connectingToDB = false;
          this.firstRun = true;
          
        }else{
          this.state.rejectorCheck = false;
          this.state.connectingToDB = true;
        
        }
        this.printer.isOccupied=false;
        await this.run();
        this.reRunning = false;
      }
    } finally {
      // release(); // Ensure the mutex is always released
    }
  }
  async run(){
    let end = false 
    while(!this.printer.aBoxIsPrintedCompletely){
      await sleep(0.1)
    }
    fs.open(pipePath, 'w', (err, fd) => {
      if (err) {
        console.error('Failed to open named pipe:', err);
        return;
      }
    
      fs.write(fd, 'off', (err) => {
        if (err) {
          console.error('Failed to write to named pipe:', err);
        } else {
          console.log('Message sent: off');
        }
    
        fs.close(fd, (err) => {
          if (err) {
            console.error('Failed to close named pipe:', err);
          }
        });
      });
    });
  
    this.backEndWS.disconnect();
    let retryDelay =0;
    this.serCam.active=false;
    function sleep(s) {
      return new Promise(resolve => setTimeout(resolve, s*1000));
    }
    this.yellowLed.setState('blinkSlow')
    this.greenLed.setState('blinkSlow')
    try {
      await this.printer.stopPrint()
    } catch (error) {
      console.log("[Init] error on stopping printer", error)
    }
    while (!end){
      // await sleep(5)
      if (this.state.connectingToDB){
        try{
          if (!this.MongoDB.isConnected){
            await this.MongoDB.connect();
          }
          let res = await getDataToAPI("health-check");
          if(res==null || res.status!=HttpStatusCode.Ok){
            this.backEndWS.status='disconnected'
            throw new Error("Server is not ready")
          }
          // if(this.backEndWS.status==='disconnected'){
            
          //   await this.backEndWS.connect()
           
          // }
          

          
          this.state.connectingToDB=false;
          this.state.connectingToWS=true;
          if (retryDelay>0){
            retryDelay = 0;
            this.yellowLed.setState('blinkSlow')
            this.greenLed.setState('blinkSlow')
          }
          
        }catch(err){
          this.yellowLed.setState('blinkFast')
          this.greenLed.setState('blinkFast')
          console.log('[Init] error occurred: ',err)
          retryDelay=10;
        }

      }else if(this.state.connectingToWS){
        try{
          if (this.aggCamWsData.status==='disconnected'){
            console.log("[Init] connecting to Websocket For data...")
            await this.aggCamWsData.connect()
            console.log("[Init] connected to Websocket for data.")
          }
          if (this.aggCamWsStatus.status==='disconnected'){
            console.log("[Init] connecting to Websocket For status...")
            await this.aggCamWsStatus.connect()
            console.log("[Init] connected to Websocket for status.")  
          }
          clearTimeout(wsAndAggTimeOut)
          wsAndAggTimeOut=null;
          this.aggCam.setCallBack();
          this.state.connectingToWS=false
          this.state.connectingToAggCam=true;
          if (retryDelay>0){
            retryDelay = 0;
            this.yellowLed.setState('blinkSlow')
            this.greenLed.setState('blinkSlow')
          }
        }catch(err){
          this.yellowLed.setState('blinkFast')
          this.greenLed.setState('off')
          if (wsAndAggTimeOut===null){
            wsAndAggTimeOut=setTimeout(()=>{
              console.log("[Init] RESTARTING WSANDAGG SERVICE")
              child.exec(`sudo systemctl restart wsAndAgg.service`)
              wsAndAggTimeOut=null;
            },60000)
          }
          
          console.log('[Init] error occurred: ',err)
          retryDelay=10;
        }

      }else if(this.state.connectingToAggCam){
        try{
            console.log("[Init] connecting to aggregation camera...")
            const AggCamStatus = await this.aggCam.getStatus()
            if (AggCamStatus==='Ok'){
              console.log("[Init] connected aggregation camera") 
              this.state.connectingToAggCam = false;
            this.state.connectingToPrinter = true
          if (retryDelay>0){
              retryDelay = 0;
              this.yellowLed.blinkingTimes = Infinity;
              this.yellowLed.setState('blinkSlow')
              this.greenLed.setState('blinkSlow')

            }
            }else{
              this.yellowLed.setState('blinkFast',2);
              this.greenLed.setState('off');
              console.log('[Init] error occurred : agg cam is not connected');
              retryDelay=10;
            }
            
            
          }catch(err){
            this.state.connectingToAggCam = false;
            this.state.connectingToWS = true;
            this.yellowLed.setState('blinkFast',2);
            this.greenLed.setState('off');
            console.log('[Init] error occurred1: ',err);
            retryDelay=10;
          }
            
      }else if(this.state.connectingToPrinter){
        try{
            if (!this.printer.running){
              console.log("[Init] connecting to printer...")
              await this.printer.connect();
              console.log("[Init] connected to printer")
            }
            try {
              await this.printer.stopPrint()
            } catch (error) {
              console.log("[Init] error on stopping printer", error)
            }
            this.state.connectingToPrinter = false;
            this.state.connectingToSerCam = true;
            if (retryDelay>0){
                retryDelay = 0;
                this.yellowLed.blinkingTimes = Infinity;
                this.yellowLed.setState('blinkSlow')
                this.greenLed.setState('blinkSlow')

            }
          }catch(err){
            this.yellowLed.setState('blinkFast', 3);
            this.greenLed.setState('off');
            console.log('[Init] error occurred: ',err);
            retryDelay=10;
          }
      }else if(this.state.connectingToSerCam){
        try{
          if(!this.serCam.running){
            console.log("[Init] connecting to serialization camera...")
            await this.serCam.connect();
            console.log("[Init] connected to serialization camera")
          }
          
          this.state.connectingToSerCam = false;
          this.state.weighingScaleCheck = true;
            if (retryDelay>0){
                retryDelay = 0;
                this.yellowLed.blinkingTimes = Infinity;
                this.yellowLed.setState('blinkSlow')
                this.greenLed.setState('blinkSlow')

            }
        }catch(err){
          this.yellowLed.setState('blinkFast', 4);
          this.greenLed.setState('off');
          console.log('[Init] error occurred: ',err);
          retryDelay=10;
        }        
      }else if(this.state.weighingScaleCheck){
        try{
          console.log("[Init] connecting to weighing scale...")
          await weighingScaleDao.readWeight();
          console.log("[Init] connected to weighing scale")
          this.state.weighingScaleCheck = false;
          this.state.finalChecks = true;
            if (retryDelay>0){
                retryDelay = 0;
                this.yellowLed.blinkingTimes = Infinity;
                this.yellowLed.setState('blinkSlow')
                this.greenLed.setState('blinkSlow')

            }
        }catch(err){
          this.yellowLed.setState('blinkFast', 5);
          this.greenLed.setState('off');
          console.log('[Init] error occurred: ',err);
          retryDelay=10;
        }                
      }else if (this.state.rejectorCheck){
        this.yellowLed.setState('on');
        this.greenLed.setState('on');
        let greenButtonPressed=false
        this.greenButton.setShortPressCallback(() => {
          console.log('Green short press detected.');
          greenButtonPressed=true
        });
        this.yellowButton.setShortPressCallback(async () => {
          console.log('Yellow short press detected.');
          await this.rejector.test();
        });
        await this.rejector.test();
        while (!greenButtonPressed && this.firstRun===true){
          await sleep(1/10)
        }
        this.yellowLed.setState('blinkSlow')
        this.greenLed.setState('blinkSlow')
        this.state.rejectorCheck=false;
        this.state.connectingToDB=true;
        // greenButtonPressed=false
      }else if (this.state.finalChecks){
        
      // final checks
        
        try {
          console.log("[Init] final checks")
          await sleep(10)
          if (this.MongoDB.isConnected ){
            console.log("[Init] MongoDB connection is finalized")
            
          }else{throw new Error("MonggoDB")}
          if (this.aggCamWsData.status==='connected'){
            console.log("[Init] Aggregation cam. websocoket for data connection is finalized")
          }else{throw new Error("Aggregation WS for data")}

            if(this.backEndWS.status==='disconnected'){
            try {
              await this.backEndWS.connect()
              this.backEndWS.ws.on('message',(message)=>{
                const str = message.toString()
                console.log("Incoming HealthCheck from BE :", str)
                this.backEndWS.sendMessage(str)
              })
            } catch (error) {
              console.log("[Init] error while connecting to backend websocket",error)
            }
            
           
          }
          if (this.backEndWS.status==='connected'){
            console.log("[Init] BE's websocoket for data connection is finalized")
          }else{throw new Error("Aggregation WS for BE")}
          if(this.aggCamWsStatus.status==='connected'){
            console.log("[Init] Aggregation cam. websocoket for status connection is finalized")
          }else{throw new Error("Aggregation WS for status")} 
          if (await this.aggCam.getStatus()==='Ok'){
            console.log("[Init] Aggregation cam. connection is finalized")
          }else{throw new Error("Aggregation Camera")}
          if (this.printer.running){
            console.log("[Init] Printer connection is finalized")
          }else{throw new Error("Printer")}
          if(this.serCam.running){
            console.log("[Init] Serialization camera connection is finalized")
          }else{throw new Error("Serialization Camera")}
                
          await weighingScaleDao.readWeight();
          let res = await getDataToAPI("health-check");
          console.log(res.status)
          if(res==null || res.status!=HttpStatusCode.Ok){
            throw new Error("Server is not ready")
          }
          this.yellowLed.setState('blinkFast', 3)
          this.greenLed.setState('blinkFast', 3)
          this.state.rejectorCheck=false;
          this.aggCam.runAggregateButton();
          weighingScaleDao.readPrinterButton(this.greenButton);


          // fs.open(pipePath, 'w', (err, fd) => {
          //   if (err) {
          //     console.error('Failed to open named pipe:', err);
          //     return;
          //   }
          
          //   fs.write(fd, 'on', (err) => {
          //     if (err) {
          //       console.error('Failed to write to named pipe:', err);
          //     } else {
          //       console.log('Message sent: on');
          //     }
          
          //     fs.close(fd, (err) => {
          //       if (err) {
          //         console.error('Failed to close named pipe:', err);
          //       }
          //     });
          //   });
          // });
      
          
          
          end=true;  
          this.firstRun=false;
            
        } catch (error) {
            this.state.rejectorCheck=true;
            end=false;
            
          console.log("[Init] need to re initialize", error)
        }
        
      }

      await sleep(retryDelay)
      
    }
    needToReInit.removeAllListeners()
    needToReInit.once("pleaseReInit", (...args)=>{
      // console.log("arguments:",args);
      this.reRun(...args)})
    problematicPeripheral=null;
    console.log("[Initialisazion] inisialization has been completed")
  }

}
