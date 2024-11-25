// import axios, { HttpStatusCode } from 'axios';

// import dotenv from 'dotenv';
// import { resolve, dirname } from 'path';
// import { fileURLToPath } from 'url';

// import { needToReInit } from '../../utils/globalEventEmitter.js';
// import { apiCallLogger } from '../../utils/logger.js';
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);
// const envPath = resolve(__dirname, '../../.env');
// dotenv.config({ path: envPath });


// let hcInterval= null;
// const hcIntervalTime=5000;
// const hcIntervalTolerance = 1000;
// let normalProcessFlag=false;

// function setHCInterval(){
//   hcInterval=setInterval(async ()=>{
//     try {
//       const res = await axios.get(process.env.API_URL+"health-check")
//       if(res==null || res.status!=HttpStatusCode.Ok){
//         throw new Error("Server is not ready")
//       }
//       apiCallLogger.info("Normal Healthcheck : BE server is healthy")


//     } catch (error) {

//         apiCallLogger.error(`Normal Healthcheck:  the server is unhealthy : ${error}`);
//         needToReInit.emit("pleaseReInit", "HTTP Server", error)

//     }

//     normalProcessFlag=false;

//   }
//     ,normalProcessFlag?hcIntervalTime+hcIntervalTolerance:hcIntervalTime)
// }

//   export async function postDataToAPI(route, data) {
//   try {
//     clearInterval(hcInterval)
//     const response = await axios.post(process.env.API_URL+route, data, 
//     {
//       headers: {
//       'X-AUTH-BASIC': 'Basic c2VyYXRvbmljOjUzcjR0MG4xYw=='
//     }
//   })
//     normalProcessFlag=true;
//     setHCInterval();
//     apiCallLogger.info(`[API Call] Req POST Body : ${data}`)

//     apiCallLogger.info({
//       'method':"POST",
//       'body':data,
//       'ReqID':response.headers['x-request-id'],
//       'response':response.data
//     })


//   } catch (error) {
//     apiCallLogger.error(`Error on POST data to API : ${error.message}`);

//   }
// }

// export async function putDataToAPI(route, data) {
//   try {
//     clearInterval(hcInterval)
//     const response = await axios.put(process.env.API_URL+route, data, 
//     {
//       headers: {
//       'X-AUTH-BASIC': 'Basic c2VyYXRvbmljOjUzcjR0MG4xYw=='
//     }
//   })
//     normalProcessFlag=true;
//     setHCInterval();
//     apiCallLogger.info({
//       'method':"PUT",
//       'body':data,
//       'ReqID':response.headers['x-request-id'],
//       'response':response.data
//     })
//     // console.log('[API Call] Req PUT Body : ', data)
//     // console.log(`[API Call] Req ID : ${response}, PUT response:`, response.data);
//   } catch (error) {
//     apiCallLogger.error(`[API Call] Error on PUT data to API : ${ error.message}`);

//   }
// }
// export async function getDataToAPI(route, data=null) {
//   const url = process.env.API_URL+route
//   // console.log("Get req to : ",url)

//   try {
//     clearInterval(hcInterval)
//     const response = await axios.get(url)
//     normalProcessFlag=true;
//     setHCInterval();
//     const jsonRes = {
//       'method':"GET",
//       // 'body':data,
//       // 'ReqID':response.headers['x-request-id'],
//       // 'response':response
//     }
//     // console.log(jsonRes)

//     const msg = JSON.stringify(jsonRes)
//     // console.log(msg)
//     apiCallLogger.info(jsonRes)

//     return  response

//   } catch (error) {
//     apiCallLogger.error(`[API Call] Error on GET data to API : ${error.message}`);

//     return null;

//   }
// }



import axios, { HttpStatusCode } from 'axios';

import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Mutex } from 'async-mutex';

import { needToReInit } from '../../utils/globalEventEmitter.js';
import { apiCallLogger } from '../../utils/logger.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const mutex = new Mutex();
const hcIntervalTime = 5000;
const hcIntervalTolerance = 1000;

let hcInterval = null;
let normalProcessFlag = false;

async function setHCInterval() {
  const release = await mutex.acquire();
  clearInterval(hcInterval)
  hcInterval = setInterval(async () => {
    try {
      const res = await axios.get(process.env.API_URL + "health-check")
      if (res == null || res.status != HttpStatusCode.Ok) {
        throw new Error("Server is not ready")
      }
      apiCallLogger.info("Normal Healthcheck : BE server is healthy")
    } catch (error) {
      apiCallLogger.error(`Normal Healthcheck:  the server is unhealthy : ${error}`);
      needToReInit.emit("pleaseReInit", "HTTP Server", error)
    }

    normalProcessFlag = false;
  }, normalProcessFlag ? hcIntervalTime + hcIntervalTolerance : hcIntervalTime)
  release();
}

export async function postDataToAPI(route, data) {
  try {
    clearInterval(hcInterval)
    const response = await axios.post(process.env.API_URL + route, data,
      {
        headers: {
          'X-AUTH-BASIC': 'Basic c2VyYXRvbmljOjUzcjR0MG4xYw=='
        }
      })
    normalProcessFlag = true;
    setHCInterval();
    apiCallLogger.info(`[API Call] Req POST Body : ${data}`)

    apiCallLogger.info({
      'method': "POST",
      'body': data,
      'ReqID': response.headers['x-request-id'],
      'response': response.data
    })
  } catch (error) {
    setHCInterval();
    apiCallLogger.error(`Error on POST data to API : ${error.message}`);
  }
}

export async function putDataToAPI(route, data) {
  try {
    clearInterval(hcInterval)
    const response = await axios.put(process.env.API_URL + route, data,
      {
        headers: {
          'X-AUTH-BASIC': 'Basic c2VyYXRvbmljOjUzcjR0MG4xYw=='
        }
      })
    normalProcessFlag = true;
    setHCInterval();
    apiCallLogger.info({
      'method': "PUT",
      'body': data,
      'ReqID': response.headers['x-request-id'],
      'response': response.data
    })
    // console.log('[API Call] Req PUT Body : ', data)
    // console.log(`[API Call] Req ID : ${response}, PUT response:`, response.data);
  } catch (error) {
    setHCInterval();
    apiCallLogger.error(`[API Call] Error on PUT data to API : ${error.message}`);
  }
}

export async function getDataToAPI(route, data = null) {
  const url = process.env.API_URL + route
  // console.log("Get req to : ",url)

  try {
    clearInterval(hcInterval)
    const response = await axios.get(url)
    normalProcessFlag = true;
    setHCInterval();
    const jsonRes = {
      'method': "GET",
      // 'body':data,
      // 'ReqID':response.headers['x-request-id'],
      // 'response':response
    }
    // console.log(jsonRes)

    const msg = JSON.stringify(jsonRes)
    apiCallLogger.info(jsonRes)

    return response
  } catch (error) {
    setHCInterval();
    apiCallLogger.error(`[API Call] Error on GET data to API : ${error.message}`);

    return null;
  }
}



