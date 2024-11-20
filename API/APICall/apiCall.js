import axios, { HttpStatusCode } from 'axios';

import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { needToReInit } from '../../utils/globalEventEmitter.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });


let hcInterval= null;
const hcIntervalTime=5000;
const hcIntervalTolerance = 1000;
let normalProcessFlag=false;

function setHCInterval(){
  hcInterval=setInterval(async ()=>{
    try {
      // const response = await axios.get(url+"health-check")
      // rizal change start
      const res = await axios.get(process.env.API_URL+"health-check")
      // rizal change end
      if(res==null || res.status!=HttpStatusCode.Ok){
        throw new Error("Server is not ready")
      }
      console.log("[API Call] BE server is healthy")

      
    } catch (error) {

        console.log("[API Call] the server is unhealthy : ",error);
        needToReInit.emit("pleaseReInit", "HTTP Server")
      
    }
    
    normalProcessFlag=false;

  }
    ,normalProcessFlag?hcIntervalTime+hcIntervalTolerance:hcIntervalTime)
}

  export async function postDataToAPI(route, data) {
  try {
    clearInterval(hcInterval)
    const response = await axios.post(process.env.API_URL+route, data, 
    {
      headers: {
      'X-AUTH-BASIC': 'Basic c2VyYXRvbmljOjUzcjR0MG4xYw=='
    }
  })
    normalProcessFlag=true;
    setHCInterval();
    console.log('[API Call] Req POST Body : ', data)
    console.log(`[API Call] Req ID : ${response.headers['x-request-id']}, POST response:`, response.data);
    
  } catch (error) {
    console.error(`[API Call] Error on POST data to API : `, error.message);
   
  }
}

export async function putDataToAPI(route, data) {
  try {
    clearInterval(hcInterval)
    const response = await axios.put(process.env.API_URL+route, data, 
    {
      headers: {
      'X-AUTH-BASIC': 'Basic c2VyYXRvbmljOjUzcjR0MG4xYw=='
    }
  })
    normalProcessFlag=true;
    setHCInterval();
    console.log('[API Call] Req PUT Body : ', data)
    console.log(`[API Call] Req ID : ${response}, PUT response:`, response.data);
  } catch (error) {
    console.error(`[API Call] Error on PUT data to API : `, error.message);
    
  }
}
export async function getDataToAPI(route, data) {
  const url = process.env.API_URL+route
  console.log("Get req to : ",url)
  
  try {
    clearInterval(hcInterval)
    const response = await axios.get(url)
    normalProcessFlag=true;
    setHCInterval();
    return  response

  } catch (error) {
    console.error(`[API Call] Error on GET data to API : `, error.message);
    
    return null;
    
  }
}



