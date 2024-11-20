import dotenv from 'dotenv';
dotenv.config();

import startHTTPServer  from './API/server/server.js';
import printProcess from './DAO/printProcessDao.js';
import TIJPrinter from './DAO/TiJPrinterDao.js';
import serCam from './DAO/serCamDao.js';
import Queue from './utils/queue.js';
import pkg from 'node-libgpiod';
import Rejector from './DAO/rejectorDao.js'
import MongoDB from './DAO/mongoDB.js';
import WebSocketClient from './DAO/webSocketClient.js'
import AggregationCam from './DAO/aggregationCamDao.js';
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    // Handle the error gracefully or log it
});
const db = new MongoDB(process.env.MONGODB_URI, process.env.DATABASE_NAME)
db.connect()
const { version, Chip, Line } = pkg;
global.chip = new Chip(4)
global.output = new Line(chip, process.env.REJECTOR_OUTPUT_PIN); output.requestOutputMode();
global.input = new Line(chip, process.env.REJECTOR_INPUT_PIN); input.requestInputMode();
output.setValue(1)

const serQueue = new Queue();
const rejector = new Rejector(input,output, serQueue)
rejector.start()

const serialCamera =  new serCam(process.env.SERIALIZATION_CAM_IP,process.env.SERIALIZATION_CAM_PORT,"1",serQueue);
serialCamera.connect()

const printer = new TIJPrinter(process.env.TiJPrinter_IP, process.env.TiJPrinter_PORT,process.env.TiJPrinter_SLAVE_ADDRESS,"1")

printer.connect()
await new Promise(resolve => setTimeout(resolve, 500));
const printingProcess = new printProcess(printer)
const wsAggregation = new WebSocketClient(process.env.WS_IP,process.env.WS_PORT,"client2")
await wsAggregation.connect()
console.log(`[Websocket] status: ${wsAggregation.status}`)
const aggCam = new AggregationCam(wsAggregation)
export  {printingProcess,printer, serialCamera, serQueue}
startHTTPServer(process.env.SERVER_PORT)


await new Promise(resolve => setTimeout(resolve, 1000));


