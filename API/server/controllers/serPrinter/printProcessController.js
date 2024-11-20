// get process IDs (TODO later)
// start process with printer id + csv +
// end process
// get process details such as printing progress


import  {printingProcess, printer} from '../../../../index.js';
import printerTemplate from '../../../../utils/printerTemplates.js';


const setPrinterFormat = (req, res) => {
    let body = req.body
    if (body.x ) {
        printer.createModule.x=body.x
    }
    if (body.y ) {
        printer.createModule.y=body.y
    }
    if (body.rotation ) {
        printer.createModule.rotation=body.rotation
    }
    if (body.fontSize ) {
        printer.createModule.fontSize=body.fontSize
    }
    if (body.space ) {
        printer.createModule.space=body.space
    }
    if (body.fontName ) {
        printer.createModule.fontName=body.fontName
    }
    res.status(200).send({
        x: printer.createModule.x,
        y: printer.createModule.y,
        rotation: printer.createModule.rotation,
        fontSize: printer.createModule.fontSize,
        space: printer.createModule.space,
        fontName: printer.createModule.fontName
    })

}
const stopPrinting = async (req, res) => {
    printingProcess.isOccupied=false;
    await printer.send(12)
    await printer.send(21)
    console.log("printer is successfully stopped")
    res.status(200).send({message:"printer is successfully stopped"})
}

const startPrinting = async (req, res) => {
    let missingBody=""
    
    if(req.body.work_order_id){
        printingProcess.work_order_id = req.body.work_order_id
    }else{missingBody="work_order_id"}
    if(req.body.assignment_id){
        printingProcess.assignment_id = req.body.assignment_id
    }else{missingBody=missingBody+" and assignment_id"}

    if (missingBody!=""){
        return res.status(400).send({message: `Missing mandatory payload in request body. (${missingBody})`})
    }
    // if (printingProcess.workstationId!==req.params.workstationId){
    //     console.log(workstationId)
    //     return res.status(409).send({message: `The work station id not found/recognize  `})
    // }
    if((req.body.templateId) && req.body.templateId >printerTemplate.length){
        return res.status(404).send({message: `The templateId=${req.body.templateId} does not exist`})
    }
    if (printer.isOccupied===true){
        return res.status(409).send({message: `This printer is occupied for workOrderId=${printingProcess.work_order_id} and assignmentId =${printingProcess.assignment_id}`})
    }
    //TODO : ink leve is too low
    if (printer.running===false){
        return res.status(500).send({message: "Cannot connect to the printer" })
    }
    try {
        if (await printingProcess.printSetupChecks()==="success"){
            res.status(200).send({message:`Printing Process with assignment Id = ${printingProcess.assignment_id}, work order Id =${printingProcess.work_order_id}, and template Id = ${printingProcess.templateId} started`})
            printingProcess.print().then(() =>{console.log("printer is running")})
        }else{
            return res.status(500).send({message:"unknown issue, printer is not started"})
        }
        //await printingProcess.print()
    }catch(err){
        console.log(err)
        res.status(500).send({error:err})
    }
    
}

const printerDetails = (req, res) =>{
    // const workstationId = req.params.workstationId
    // if (printer.workstationId===workstationId){
        res.status(200).send({
            ipAddress:printer.ip,
            port:printer.port,
            isOccupied:printer.isOccupied,
            inkLevel:90, //TODO: get the real one
            templateId:0
        })
    // }else{
    //     res.status(404).send({message:"no printer assigned on this workstation"})
    // }
}
// const getInkStattus = (req, res) => {
//    let response = printer.send(PRINT_MASSGAE.InkStaus)
//     res.send(response)
// }
export default {startPrinting, printerDetails, stopPrinting}