import weighingScaleDao from "../../../../DAO/weighingScaleDao.js";

const getWeight = async (req,res) =>{
    try{
        clearInterval(weighingScaleDao.hcInterval);
        let weight= await weighingScaleDao._readWeight();
        for (let i =0 ; i<3;i++){
             weight = await weighingScaleDao._readWeight();
            
            if (typeof weight==='string' && i===2){
                throw new Error('Weighing scale is not stable')
            }else{
                break;
            }
        }
        weighingScaleDao.normalProcessFlag=true;
        weighingScaleDao.setHCweightInterval();
        res.status(200).send({weight:weight})
    }catch(err){
        console.log(err)
        res.status(500).send({error:err})
    }
}

export default {getWeight}