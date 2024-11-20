import dotenv from 'dotenv';
dotenv.config();
import lowDB from './DAO/masterConfigDao.js';
import {startHTTPServer, app}  from './API/server/server.js';
import printProcess from './DAO/printProcessDao.js';
import TIJPrinter from './DAO/TiJPrinterDao.js';
import serCam from './DAO/serCamDao.js';
import Queue from './utils/queue.js';
import pkg from 'node-libgpiod';
import Rejector from './DAO/rejectorDao.js'
import MongoDB from './DAO/mongoDB.js';
import WebSocketClient from './DAO/webSocketClient.js'
import AggregationCam from './DAO/aggregationCamDao.js'; 

import HealthChecks from './DAO/healthCheck.js';
import Initialization from './init.js'
import Button from './DAO/buttonDao.js';
import LED from './DAO/ledDao.js';
// import printerTemplate from './utils/printerTemplates.js';
// import printerTemplate from './utils/printerTemplates.js';
console.log("Starting middleware...")
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    // Handle the error gracefully or log it
});


// const masterConfig = new lowDB('../utils/master-config.json')
// await masterConfig.init()
// console.log(`masterConfigs: ${masterConfig.getAllConfig()}`)
// const kafkaProdHC = new KafkaProducer("middleWare",process.env.KAFKA_BROKER_ENDPOINT)


const masterConfig = new lowDB('../utils/master-config.json');


(async () => {
  try {
    // Wait for initialization to complete
    await masterConfig.init();

    // Get all configuration values and convert to a JSON string
    //const allConfig = masterConfig.getAllConfig();
    console.log(`regex: ${JSON.stringify(masterConfig.getConfig('rejector').REGEX_PATTERNS, null, 2)}`);
  } catch (error) {
    console.error('Error in index.js:', error);
  }
})();
const mongoDB = new MongoDB(process.env.MONGODB_URI, process.env.DATABASE_NAME) // settiing up mongodb connection


const { version, Chip, Line } = pkg; //setting up GPIOs
global.chip = new Chip(4)
global.rejectorActuator = new Line(chip, process.env.REJECTOR_OUTPUT_PIN); rejectorActuator.requestOutputMode();
global.rizalLED = new Line(chip, process.env.AGGREGARTE_LIGHT_OUTPUT_PIN); rizalLED.requestOutputMode();
rizalLED.setValue(0);
const yellowButton = new Button(process.env.AGGREGATE_BUTTON_INPUT_PIN)
const greenButton = new Button(process.env.LABEL_PRINTER_INPUT_PIN)


const yellowLed = new LED(process.env.AGGREGARTE_BUTTON_LIGHT_OUTPUT_PIN)
const greenLed = new LED(process.env.LABEL_PRINTER_BUTTON_LIGHT_OUTPUT_PIN)

const printerSensor = new Button(17)
// const serCamSensor = new Button(5,0)



const rejector = new Rejector(rejectorActuator) //instancing Rejector class

const serialCamera =  new serCam(process.env.SERIALIZATION_CAM_IP,process.env.SERIALIZATION_CAM_PORT, rejector); //instancing serCam class for serialization Camera



const healthChecksWs = new WebSocketClient(process.env.HEALTH_CHECKS_WEBSOCKET_EP, null,"middleware", "HealthChekWS") // instancing websocket client class for healthCheks
healthChecksWs.autoReInit=true;

const AggCamWsData = new WebSocketClient(process.env.WS_IP, process.env.WS_PORT,"client2", "AggCamWsData") // instancing websocket client class for aggregation
// await AggCamWsData.connect()
const AggCamWsStatus = new WebSocketClient(process.env.WS_IP, process.env.WS_PORT,"client3", "AggCamWsStatus") // instancing websocket client class for aggregation


const aggCam = new AggregationCam(AggCamWsData, AggCamWsStatus, yellowButton)// instancing aggregation cam class using wsAggregation instance
// await AggCamWsData.connect()
// await AggCamWsStatus.connect()
// await aggCam.setCallBack();
// await new Promise(resolve => setTimeout(resolve, 10000));
// await aggCam.getStatus()
// await new Promise(resolve => setTimeout(resolve, 200));
// await aggCam.getStatus()
// await new Promise(resolve => setTimeout(resolve, 200));
// await aggCam.getStatus()
// await new Promise(resolve => setTimeout(resolve, 5000));
// await aggCam.getData()
// await aggCam.getStatus()
const printer = new TIJPrinter(process.env.TiJPrinter_IP, process.env.TiJPrinter_PORT,process.env.TiJPrinter_SLAVE_ADDRESS,"1")//instancing printer class 



// await kafkaProdHC.connect();
// const HC = new HealthChecks(printer, serialCamera,aggCam,kafkaProdHC)
// HC.run()



const init = new Initialization(mongoDB, AggCamWsData,AggCamWsStatus, aggCam, printer,serialCamera, rejector, yellowLed,greenLed,yellowButton,greenButton, healthChecksWs, printerSensor )
console.log("Initializing...")
await init.run();
// printer.init=init;
// aggCam.init=init;
// serialCamera.init=init;
console.log("Initialization is completed !")



// await printer.connect();
// const inks = await printer.requestInkRemains()
// console.log(inks[0]);

const printingProcess = new printProcess(printer, mongoDB, printerSensor) // instancing printing process class with printer and mongoDB instances as the constructor
serialCamera.printProcess=printingProcess
console.log(`test master : ${printingProcess.templateName}`)
// await healthChecksWs.connect();
// const healthChecks = new HealthChecks(printer, serialCamera,aggCam, healthChecksWs);


// healthChecks.run()
await new Promise(resolve => setTimeout(resolve, 1000));

// console.log("simulate printing...");

// const printingInterval = setInterval(()=>{
//    printer.requestInkRemains();//ceritanya ngeprint
// }, 5100)

// setTimeout(()=>{
//   console.log("printing simulation is finished");
//   clearInterval(printingInterval)
// },50000)
export  {printingProcess,printer, serialCamera, rejector, masterConfig}  
startHTTPServer(process.env.SERVER_PORT)


process.on('SIGTERM', () => {
  console.info('SIGTERM signal received.');
  console.log('Closing http server.');
  healthChecksWs.disconnect();
  app.close(() => {
    console.log('Http server closed.');
  });
});













// const details={
//   BN: "TPG12344",
//   MD: "13 JUN 24", 
//   ED: "30 JUN 24",
//   HET: "Rp. 555.55 / BOX"
// };


// await printer.startPrint()// start print
// await new Promise(resolve => setTimeout(resolve, 1000));
// await printer.clearBuffers() // clear buffer before start printing
// await new Promise(resolve => setTimeout(resolve, 1000));

// const msg =printerTemplate['template2'](details,"QR003") 


// await printer.send(msg)
// await new Promise(resolve => setTimeout(resolve, 1000));





// await printer.send("1E055152303033")

// await new Promise(resolve => setTimeout(resolve, 1000));
// await printer.send("01") 
// // console.log("response from sending 01", ress1)
// await new Promise(resolve => setTimeout(resolve, 1000));





// await printer.sendRemoteFieldData(['SN 123ABCDEFG123', '(90)123456790567898765678987656789(60)123ABCDEFG123']) // goes to printer buffer
// await new Promise(resolve => setTimeout(resolve, 1000));



// console.log("[Printer] printer is started")



// await new Promise(resolve => setTimeout(resolve, 1000));


