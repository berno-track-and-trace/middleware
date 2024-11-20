
import  {printingProcess, printer,serialCamera, rejector} from '../../../../index.js';
import printerTemplate from '../../../../utils/printerTemplates.js';
import fs from 'fs';
import { problematicPeripheral } from '../../../../init.js';
// import serCam from '../../../../DAO/serCamDao.js';
// const pipePath = '/tmp/middleware-failsafe-pipe'



const getPriterStatus = async (req, res) =>{
    try {
      let nozzle_list = [];
        const ink_level_percentages = await printer.requestInkRemains();
        ink_level_percentages.forEach((v, idx, element) => {
          nozzle_list.push({
            nozzle_id:idx,
            ink_level_percentage:v
          })
          
          if (idx>3){
              return;                
            }
        });

        res.status(200).send({
            printer_status : 'Ok',
            nozzle_list
        })
    } catch (error) {
        console.log(error)
        res.status(500).send(error)
    }
}


export default {getPriterStatus}