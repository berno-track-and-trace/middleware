import { serialCamera } from "../../../../index";

const setAccuracyThreshold = (req, res) =>{
    try{
        if (req.params.workstationId!=serialCamera.workstationId){
            return res.status(404).send({message: "The work station id not found/recognized"})
        }
        if (!serialCamera.running){
            return res.status(500).send({message: "Serialization camera not detected"})
        }
        serialCamera.accuracyThreshold=req.body.accuracy
        res.status(200).send({message:`accuracy is changed to ${req.body.accuracy} successfully`})
    }
    catch(err){
        console.log(err)
        res.send(err)

    }
    

}
export default setAccuracyThreshold