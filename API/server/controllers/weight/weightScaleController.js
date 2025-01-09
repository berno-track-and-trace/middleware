import weighingScaleDao from "../../../../DAO/weighingScaleDao.js";
import { apiCallLogger } from "../../../../utils/logger.js";
// const getWeight = async (req,res) =>{
//     try{
//         clearInterval(weighingScaleDao.hcInterval);
//         let weight= await weighingScaleDao._readWeight();
//         for (let i =0 ; i<3;i++){
//              weight = await weighingScaleDao._readWeight();
            
//             if (typeof weight==='string' && i===2){
//                 throw new Error('Weighing scale is not stable')
//             }else{
//                 break;
//             }
//         }
//         weighingScaleDao.normalProcessFlag=true;
//         weighingScaleDao.setHCweightInterval();
//         res.status(200).send({weight:weight})
//     }catch(err){
//         console.log(err)
//         res.status(500).send({error:err})
//     }
// }

const getWeight = async (req,res) =>{
    try{
        
        // clearInterval(weighingScaleDao.hcInterval);
        apiCallLogger.info(`getWeight is called`);
        let weight= await getData()
        
        weighingScaleDao.normalProcessFlag=true;
        // weighingScaleDao.setHCweightInterval();
        apiCallLogger.info(`getWeight is called, the weight is ${weight}`);
        res.status(200).send({weight:weight})
    }catch(err){
        apiServerLogger.error(err)
        res.status(500).send({error:err})
    }
}


async function getData() {
    for (let i = 0; i < 5; i++) {
        
        try {
            let response = await weighingScaleDao._readWeight();
            return response;  // Return the response if resolved and exit the function
        } catch (error) {
            if (i === 4) {
                throw new Error(error);  // Throw the error if it's the last attempt
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            // Optionally handle error for cases other than the last attempt
        }
    }
}

export default {getWeight}