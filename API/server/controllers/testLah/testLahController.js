import {testInstance} from "../../../../index.js";

const setLength =(req, res)=>{
    const len = req.params.length
    console.log(req.body)
    testInstance.setLength(len)
    res.status(200).send(`lenght set to ${len}`)
}
const startLoop =async (req, res) => {
    res.status(200).send("is running")
    await testInstance.startLoop()
    
}
const stopLoop = (req,res) => {
    res.status(200).send("is running")
    res.status(200).send("is stopped")

}
const getCount = (req,res) => {
    res.send(`${testInstance.count}`)
}

export default {setLength, startLoop, stopLoop, getCount}