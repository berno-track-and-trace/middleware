import { printingProcess, printer, serialCamera, rejector, masterConfig} from "../../../../index.js";
import printerTemplate from "../../../../utils/printerTemplates.js";

// TODO: store in disk/not volatile memory (Done)

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
                parameter_name: "TEMPLATE_NAME",
                parameter_value: printingProcess.templateName,
                parameter_unit: null
            },
            {
                parameter_name: "REJECTOR_DELAY",
                parameter_value: rejector.delay,
                parameter_unit: "ms"
            }
        ];
        res.status(200).send(parameters);
    } catch (err) {
        console.error(err);
        res.status(500).send({ status: "FAILED", message: "Internal Server Error" });
    }
};


export default { changeParameter, getConfigParameterByKey, getAllConfigParameters};
