import weighingScaleDao from "./DAO/weighingScaleDao.js";
import { getDataToAPI } from "./API/APICall/apiCall.js";
import { HttpStatusCode } from "axios";
import fs from 'fs';
import {Mutex} from 'async-mutex'
import { needToReInit } from "./utils/globalEventEmitter.js";
import * as child from 'node:child_process'
import crypto from "crypto"
import { initLogger, beWsLogger } from "./utils/logger.js";
// import initializeRoutes from "./API/server/masterRoutes.js";

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
    this.firstRun=false;
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
    initLogger.info(`${peripheral} is commiting a re-initialization. Reason : ${reason}` )
    problematicPeripheral =peripheral;
    try {

      const json = {
        "request_id": crypto.randomUUID(),
        "ERROR_CODE": peripheral.toUpperCase(),
        "MESSAGE": reason
      }
      const str = JSON.stringify(json)
      this.backEndWS.sendMessage(str)
      initLogger.info({
        'info': "A problem was raised to backend",
        'data':json
      })
    }catch(error){
      initLogger.error("Error on sending report to backend WS : ", error)
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
        initLogger.error('Failed to open named pipe:', err);
        return;
      }
    
      fs.write(fd, 'off', (err) => {
        if (err) {
          initLogger.error('Failed to write to named pipe:', err);
        } else {
          initLogger.info('Message sent to pipe: off');
        }
    
        fs.close(fd, (err) => {
          if (err) {
            initLogger.error('Failed to close named pipe:', err);
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
      initLogger.error("Error on stopping printer", error)
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
          initLogger.error('Error occurred: ',err)
          retryDelay=10;
        }

      }else if(this.state.connectingToWS){
        try{
          if (this.aggCamWsData.status==='disconnected'){
            initLogger.info("Connecting to Websocket For data...")
            await this.aggCamWsData.connect()
            initLogger.info("Connected to Websocket for data.")
          }
          if (this.aggCamWsStatus.status==='disconnected'){
            initLogger.info("Connecting to Websocket For status...")
            await this.aggCamWsStatus.connect()
            initLogger.info("Connected to Websocket for status.")  
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
              initLogger.warn(" RESTARTING WSANDAGG SERVICE")
              child.exec(`sudo systemctl restart wsAndAgg.service`)
              wsAndAggTimeOut=null;
            },60000)
          }
          
          initLogger.error('Error occurred: ',err)
          retryDelay=10;
        }

      }else if(this.state.connectingToAggCam){
        try{
            initLogger.info("Connecting to aggregation camera...")
            const AggCamStatus = await this.aggCam.getStatus()
            if (AggCamStatus==='Ok'){
              initLogger.info("Connected aggregation camera") 
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
              initLogger.error('Error occurred : agg cam is not connected');
              retryDelay=10;
            }
            
            
          }catch(err){
            this.state.connectingToAggCam = false;
            this.state.connectingToWS = true;
            this.yellowLed.setState('blinkFast',2);
            this.greenLed.setState('off');
            initLogger.error('Error occurred: ',err);
            retryDelay=10;
          }
            
      }else if(this.state.connectingToPrinter){
        try{
            if (!this.printer.running){
              initLogger.info("Connecting to printer...")
              await this.printer.connect();
              initLogger.info("Connected to printer")
            }
            try {
              await this.printer.stopPrint()
            } catch (error) {
              initLogger.error("Error on stopping printer", error)
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
            initLogger.error('Error occurred: ',err);
            retryDelay=10;
          }
      }else if(this.state.connectingToSerCam){
        try{
          if(!this.serCam.running){
            initLogger.info("Connecting to serialization camera...")
            await this.serCam.connect();
            initLogger.info("Connected to serialization camera")
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
          initLogger.info('Error occurred: ',err);
          retryDelay=10;
        }        
      }else if(this.state.weighingScaleCheck){
        try{
          initLogger.info("Connecting to weighing scale...")
          await weighingScaleDao.readWeight();
          initLogger.info("Connected to weighing scale")
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
          initLogger.error('Error occurred: ',err);
          retryDelay=10;
        }                
      }else if (this.state.rejectorCheck){
        this.yellowLed.setState('on');
        this.greenLed.setState('on');
        let greenButtonPressed=false
        this.greenButton.setShortPressCallback(() => {
          initLogger.info('Green short press detected.');
          greenButtonPressed=true
        });
        this.yellowButton.setShortPressCallback(async () => {
          initLogger.info('Yellow short press detected.');
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
          initLogger.info("Final checks")
          await sleep(10)
          if (this.MongoDB.isConnected ){
            initLogger.info("MongoDB connection is finalized")
            
          }else{throw new Error("MonggoDB")}
          if (this.aggCamWsData.status==='connected'){
            initLogger.info("Aggregation cam. websocoket for data connection is finalized")
          }else{throw new Error("Aggregation WS for data")}

            if(this.backEndWS.status==='disconnected'){
            try {
              initLogger.info("Connecting to backend's websocket")
              await this.backEndWS.connect()
            
            } catch (error) {
              initLogger.error("Error while connecting to backend websocket",error)
            }
            this.backEndWS.ws.on('message', (message)=>{
              const str = message.toString()
              beWsLogger.info("Incoming HealthCheck from BE :", str)
              try{
                this.backEndWS.sendMessage(str)
              }catch(err){
                beWsLogger.error(err)
              }
              
            })
           
          }
          if (this.backEndWS.status==='connected'){
            initLogger.info("BE's websocoket for data connection is finalized")
          }else{throw new Error("Aggregation WS for BE")}
          if(this.aggCamWsStatus.status==='connected'){
            initLogger.info("Aggregation cam. websocoket for status connection is finalized")
          }else{throw new Error("Aggregation WS for status")} 
          if (await this.aggCam.getStatus()==='Ok'){
            initLogger.info("Aggregation cam. connection is finalized")
          }else{throw new Error("Aggregation Camera")}
          if (this.printer.running){
            initLogger.info("Printer connection is finalized")
          }else{throw new Error("Printer")}
          if(this.serCam.running){
            initLogger.info("Serialization camera connection is finalized")
          }else{throw new Error("Serialization Camera")}
                
          await weighingScaleDao.readWeight();
          let res = await getDataToAPI("health-check");
          
          if(res==null || res.status!=HttpStatusCode.Ok){
            throw new Error("Server is not ready")
          }
          initLogger.info("Server connection is finalized")
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
            
            initLogger.error("Need to re initialize", error)
        }
        
      }

      await sleep(retryDelay)
      
    }
    this.serCam.sensor.setInstantCallback( ()=> {
        // console.log(this, this.print3)
        this.printer.boxIsDetected=true;
        this.serCam.serialization();
    })
    this.serCam.sensor.setFallingEdgeCallback(()=> {
        this.serCam.boxIsDetected=false;
    })
    needToReInit.removeAllListeners()
    needToReInit.once("pleaseReInit", (...args)=>{
      // console.log("arguments:",args);
      this.reRun(...args)})
    problematicPeripheral=null;
    initLogger.info("Inisialization has been completed")
  }

}
