
import  {printingProcess, printer,serialCamera, rejector} from '../../../../index.js';
import printerTemplate from '../../../../utils/printerTemplates.js';
import fs from 'fs';
import { problematicPeripheral } from '../../../../init.js';
// import serCam from '../../../../DAO/serCamDao.js';
const pipePath = '/tmp/middleware-failsafe-pipe'



const stopPrinting = async (req, res) => {
   
    try {
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
        // printingProcess.full_code_queue.clear();
        await printer.send(12)
        console.log("printer is successfully stopped by the BE")
        printer.isOccupied=false;
        res.status(200).send({message:"printer is successfully stopped"})
    } catch (err) {
        res.status(500).send({error:err})
    }

    // await printer.send(21)

}

const toggleToNotReceive = async (req, res) =>{
    printer.notReceiving=!printer.notReceiving
    console.log("not receiving set to be ", printer.notReceiving)
    res.status(200).send({simulating:printer.notReceiving})
}

const startPrinting = async (req, res) => {
    let missingBody=""
    console.log("start printing called by BE")
    console.log("per :" , problematicPeripheral)
    
    try {
      if (problematicPeripheral){
        throw new Error (`${problematicPeripheral} is not ready`)
      }
      if(req.body.threshold ){
          if(typeof req.body.threshold  !== 'number' || isNaN(req.body.threshold)){
              throw new Error ("threshold value must be a number")
          
      }else{
          serialCamera.accuracyThreshold=req.body.threshold
      }
      }
      if(req.body.work_order_id){
          printingProcess.work_order_id = req.body.work_order_id
      }else{missingBody="work_order_id"}
      if(req.body.assignment_id){
          printingProcess.assignment_id = req.body.assignment_id
      }else{missingBody=missingBody+" and assignment_id"}
  
      if (missingBody!=""){
          return res.status(400).send({message: `Missing mandatory payload in request body. (${missingBody})`})
      }
  
      if((req.body.templateName) && req.body.templateName  in printerTemplate){
          return res.status(404).send({message: `The template Name=${req.body.templateName} does not exist`})
      }
      if (printer.isOccupied===true){
          return res.status(409).send({message: `This printer is occupied for workOrderId=${printingProcess.work_order_id} and assignmentId =${printingProcess.assignment_id}`})
      }
  
      if (printer.running===false){
          console.log("[startPrinting API] Cannot connect to the printer")
          return res.status(500).send({message: "Cannot connect to the printer" })
      }
        if (await printingProcess.printSetupChecks()==="success"){
            // printingProcess.print().then(() =>{})
            console.log("success")
            fs.open(pipePath, 'w', (err, fd) => {
                if (err) {
                  console.error('Failed to open named pipe:', err);
                  return;
                }
              
                fs.write(fd, 'on', (err) => {
                  if (err) {
                    console.error('Failed to write to named pipe:', err);
                  } else {
                    console.log('Message sent: on');
                  }
              
                  fs.close(fd, (err) => {
                    if (err) {
                      console.error('Failed to close named pipe:', err);
                    }
                  });
                });
              });
              rejector.rejectCounter=0;
              serialCamera.passCounter=0;
            res.status(200).send({message:`Printing Process with assignment Id = ${printingProcess.assignment_id}, work order Id =${printingProcess.work_order_id}, and template Id = ${printingProcess.templateId} started`})
            
        }else{

            return res.status(500).send({message:"unknown issue, printer is not started"})
        }
    }catch(err){
        console.log(err)
        res.status(500).send({error:err})
    }
    
}



export default {startPrinting, stopPrinting, toggleToNotReceive}