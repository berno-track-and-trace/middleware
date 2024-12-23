// import printProcess from "../../../../DAO/printProcessDao.js";
import { printingProcess, printer, serialCamera, rejector, masterConfig} from "../../../../index.js";
import { apiServerLogger } from "../../../../utils/logger.js";
import printerTemplate from "../../../../utils/printerTemplates.js";

// const setPrintDetailsReqs = { //TODO : define body checks using joi
    
// }
// Function to set accuracy threshold for serial camera
const setAccuracyThreshold = async (req, res) => {
    try {
        const parameter_value = req.body.parameter_value;
        if (!serialCamera.running) {
            return res.status(500).send({ message: "Serial camera not detected" });
        }
        serialCamera.accuracyThreshold = parameter_value;
        await masterConfig.setConfig('serCam', { ACCURACY_THRESHOLD: parameter_value})
        res.status(200).send({ message: `Accuracy threshold is changed to ${parameter_value} successfully` });
    } catch (err) {
        console.error(err);
        res.status(500).send({ status: "FAILED", message: "Internal Server Error" });
    }
};

// Function to set rejector delay
const setRejectorDelay = async (req, res) => {
    try {
        const parameter_value = req.body.parameter_value;
        const param_name=req.body.param_name
        
        if (param_name==="REJECTOR_DELAY1"){
            rejector.delay1 = parameter_value;
            await masterConfig.setConfig('rejector', { REJECTOR_DELAY1: parameter_value})
        }else{
            rejector.delay2 = parameter_value;
            await masterConfig.setConfig('rejector', { REJECTOR_DELAY2: parameter_value})
        }
        res.status(200).send({ message: `${param_name} is changed to ${parameter_value} successfully` });
    } catch (err) {
        console.error(err);
        res.status(500).send({ status: "FAILED", message: "Internal Server Error" });
    }
};

// Function to set printer template name
const setPrinterTemplateName = async (req, res) => {
    try {
        const parameter_value = req.body.parameter_value;

        if (!printer.running) {
            return res.status(500).send({ message: "Printer is not connected" });
        }
        if (parameter_value in printerTemplate) {
            printingProcess.templateName = parameter_value;
            await masterConfig.setConfig('printerProcess', { TEMPLATE_NAME: parameter_value});
            res.status(200).send({ message: `Template name is changed to ${parameter_value} successfully` });
        } else {
            return res.status(400).send({ status: "FAILED", message: `TEMPLATE_NAME = ${parameter_value} not found` });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send({ status: "FAILED", message: "Internal Server Error" });
    }
};
// Function to direct to another function
const changeParameter = (req, res) =>{
    const param_name = req.body.param_name
    if(param_name==="ACCURACY_THRESHOLD"){
        setAccuracyThreshold(req,res)
    }else if(param_name==="REJECTOR_DELAY1" ||param_name==="REJECTOR_DELAY2" ){
        setRejectorDelay(req,res)
    }else if(param_name==="TEMPLATE_NAME"){
        setPrinterTemplateName(req,res)
    }else{
        return res.status(404).send({ status: "FAILED", message: `Config = ${param_name} not found` });
    }
}
// Controller to get configuration parameter by key
const getConfigParameterByKey = (req, res) => {
    try {
        const key = req.query.KEY;
        if (!key) {
            return res.status(400).send({ status: "FAILED", message: "Key is required" });
        }
        let parameter;
        if (key === "REJECTOR_DELAY") {
            parameter = {
                parameter_name: "REJECTOR_DELAY",
                parameter_value: rejector.delay,
                parameter_unit: "ms"
            };
        } else if (key === "TEMPLATE_NAME") {
            parameter = {
                parameter_name: "TEMPLATE_NAME",
                parameter_value: printingProcess.templateName,
                parameter_unit: "string"
            };
        } else {
            return res.status(404).send({ status: "FAILED", message: `Config = ${key} not found` });
        }
        res.status(200).send(parameter);
    } catch (err) {
        console.error(err);
        res.status(500).send({ status: "FAILED", message: "Internal Server Error" });
    }
};

// Controller to get all configuration parameters
const getAllConfigParameters = (req, res) => {
    try {
        const parameters = [
            {
                parameter_name: "work_order_id",
                parameter_value: printingProcess.work_order_id,
                parameter_unit: 'number'
            },
            {
                parameter_name: "assignment_id",
                parameter_value: printingProcess.assignment_id,
                parameter_unit: 'number'
            },
            {
                parameter_name: "template_name",
                parameter_value: printingProcess.templateName,
                parameter_unit: "string"
            },
            // {
            //     parameter_name: "rejector_delay",
            //     parameter_value: rejector.delay,
            //     parameter_unit: "milliseconds"
            // },
            {
                parameter_name: "accuracy_threshold",
                parameter_value: serialCamera.accuracyThreshold,
                parameter_unit: 'number'
            },
            {
                parameter_name: "subsequence_reject",
                parameter_value: serialCamera.subsequenceReject,
                parameter_unit: 'integer_number'
            }
            
        ];
        res.status(200).send(parameters);
    } catch (err) {
        console.error(err);
        res.status(500).send({ status: "FAILED", message: "Internal Server Error" });
    }


};

const setConfig = (req, res) =>{
    try {
        let changes = []
        if (req.body.template_name){
            let templateName= req.body.template_name
            if (typeof templateName === 'string' || templateName instanceof String){
                changes.push({
                    variable_name : "template_name",
                    previous_value: printingProcess.templateName,
                    current_value: templateName
                })
                printingProcess.templateName = templateName;
            }else{
                res.status(400).send({message: "template_name must be a string"})
            }
        }
        if (req.body.template_name){
            let subsequenceReject= req.body.subsequence_reject
            if (Number.isInteger(subsequenceReject) && subsequenceReject > 0){
                changes.push({
                    variable_name : "subsequence_reject",
                    previous_value: serialCamera.subsequenceReject,
                    current_value: subsequenceReject
                })
                serialCamera.subsequenceReject = subsequenceReject;
            }else{
            res.status(400).send({message: "subsequence_reject must be a positive number"})
            }
        }
        if (req.body.accuracy_threshold){
            let accuracyThreshold= req.body.accuracy_threshold
            if (Number.isInteger(accuracyThreshold) && accuracyThreshold > 0){
                changes.push({
                    variable_name : "accuracy_threshold",
                    previous_value: serialCamera.accuracyThreshold,
                    current_value: accuracyThreshold
                })
                serialCamera.accuracyThreshold = accuracyThreshold;
            }else{
                res.status(400).send({message:"accuracy_threshold must be a positive number"})
            }
        }
        if (changes===null){
            res.status(400).send({message:"please check the given body, nothing is changed"})
        }else{
            res.status(200).send({message: "success", changes: changes})
        }
    } catch (error) {
        res.status(500).send(`Internal Error : ${error}`)
        apiServerLogger.error(error)
    }
}

const setJobDetails = async (req, res) =>{
    try {
        // console.log(printingProcess)
        if(req.body.work_order_id){
            printingProcess.work_order_id= req.body.work_order_id
        }else{
            res.status(400).send({message: "missing body : work_order_id"})
        }
        if(req.body.assignment_id){
            printingProcess.assignment_id= req.body.assignment_id
        }else{
            res.status(400).send({message: "missing body : assignment_id"})
        }
        let details=null;
        try {
            details = await printingProcess.getCodeDetails(printingProcess.db)
                // checks details here
            printingProcess.details= details;
            apiServerLogger.info(details)
            res.status(200).send(details)
        } catch (error) {
            res.status(400).send({error: error})
            console.log(error)
        }
        
       
        
    } catch (error) {
        res.status(500).send({error:error})
        apiServerLogger.error(error)
        
    }
};

const clearJobDetails = async (req, res) =>{
    try {
       
        printingProcess.details= null;
        printingProcess.work_order_id=null;
        printingProcess.assignment_id=null;
        apiServerLogger.info("current job details is cleared")
        res.status(200).send({message:'Job detail successfully cleared'})
        
    } catch (error) {
        res.status(500).send({error:error})
    }
}



export default { changeParameter, getConfigParameterByKey, getAllConfigParameters, setConfig, clearJobDetails, setJobDetails};
