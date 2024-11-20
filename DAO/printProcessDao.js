
import fs from 'fs';
const pipePath = '/tmp/middleware-failsafe-pipe'
import {Mutex} from 'async-mutex';
const mutex = new Mutex();

function dateToYYMMDD (originalDate){
        console.log(originalDate)
        var year = originalDate.getFullYear().toString().slice(2); // Get last two digits of the year
        var month = (originalDate.getMonth() + 1).toString().padStart(2, '0'); // Month is zero-based, so add 1
        var day = originalDate.getDate().toString().padStart(2, '0');

        // Form the YYDDMM formatted string
        var formattedDateString = year + day + month;
        return formattedDateString
}
function formatDate(date) {
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);

    return `${day} ${month} ${year}`;
}
// function removeSpacesAndNewlines(inputString) { //Incase needed
//     return inputString.replace(/\s+/g, '');
// }
function formatCurrencyIDR(amount, locale = 'id-ID') {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(amount);
}
import Queue from '../utils/queue.js';
import printerTemplate from '../utils/printerTemplates.js';
import {postDataToAPI, putDataToAPI} from '../API/APICall/apiCall.js';
import { masterConfig } from '../index.js';
import { clearInterval } from 'timers';
import { clear, time } from 'console';
import { needToReInit, printingScanning } from '../utils/globalEventEmitter.js';
// import { emit } from 'process';
export default class printProcess {
    constructor(printer, mongoDB, sensor) {
        this.printer = printer;
        this.fileNames = [];
        this.mongoDB=mongoDB
        this.db=this.mongoDB.db
        this.sensor= sensor;
        // console.log(db)
        this.work_order_id=null
        this.assignment_id=null
        this.printPCtarget=0
        this.lowest_id=null
        this.details=null
        this.fileNamesIdx=0
        this.sampling = false
        this.templateName=masterConfig.getConfig('printerProcess').TEMPLATE_NAME;
        this.waitPrint=false
        this.full_code_queue = new Queue()
        this.error_full_code_queue = new Queue();
        this.completion = false;

        this.serializationQueue1= new Queue();
        this.serializationQueue2= new Queue();

        this.lastSerId=null;

        
        
    }
    async getCodeDetails(db) {
        try {
            if (this.mongoDB.healthCheckInterval){
                clearInterval(this.mongoDB.healthCheckInterval)
                this.mongoDB.normalOperationFlag=true;
            }
            let timeout= setTimeout(()=>{
                throw new Error("time out occurred")
            },1000)
            const work_order = await db.collection('work_order').findOne({ external_id: this.work_order_id });
            clearTimeout(timeout)
            if (!work_order) {
                throw new Error(`Work order ${this.work_order_id} not found`);
            }
    
            const product = await db.collection('product').findOne({ external_id: work_order.product_id });
            if (!product) {
                throw new Error(`Product ID ${this.product_id} not found `);
            }

            console.log(JSON.stringify(work_order))
            this.mongoDB.setHealthCheck();
            return {
                NIE: product.nie,
                BN: work_order.batch_no,
                MD: formatDate(work_order.manufacture_date), 
                ED: formatDate(work_order.expiry_date),
                HET: product.het.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
                UNIT:work_order.unit_per_box
            };
        } catch (err) {
            console.error('Error getting code details:', err);
            
            return err;
        }
    }
    
    async getDataBySmallestId(db, maxRetries = 2, retryDelay = 500) {
        let attempts = 0;
    
        while (attempts < maxRetries) {
            try {
                if (this.mongoDB.healthCheckInterval) {
                    clearInterval(this.mongoDB.healthCheckInterval);
                    this.mongoDB.normalOperationFlag = true;
                }
    
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("timed out on retrieving data from mongoDB")), 1000)
                );
    
                const queryPromise = db.collection('serialization').aggregate(
                    [
                        {
                            '$sort': {
                                '_id': 1
                            }
                        }, 
                        {
                            '$match': {
                                'status': 'SENT_TO_PRINTER',
                                'type': "PRIMARY",
                                'work_order_id': this.work_order_id, 
                                'assignment_id': this.assignment_id
                            }
                        }, 
                        {
                            '$limit': 1
                        }
                    ]
                ).toArray();
    
                const result = await Promise.race([queryPromise, timeoutPromise]);
    
                this.mongoDB.setHealthCheck();
                // console.log(result.length)
                if (result.length === 1) {
                    
                    return { id: result[0]._id, full_code: result[0].full_code, SN: result[0].code };
                } else {
                    return { status: 'no_data_found' }; // No data found in the database
                }
    
            } catch (error) {
                console.log(`[Print Process] Attempt ${attempts + 1} failed:`, error);
                attempts++;
    
                if (attempts >= maxRetries) {
                    console.log("[Print Process] Max retries reached. Error on getting data by smallest id:", error);
                    // this.dbManualHealthCheck();
                    return { status: 'max_retries_reached', error }; // Max retries reached
                }
    
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    
        return { status: 'max_retries_reached' }; // Fallback if all retries failed
    }

    
    async updateStatus(db, serializationId, status = "PRINTING", maxRetries = 2, retryDelay = 500) {
        let attempts = 0;
        if (this.mongoDB.healthCheckInterval){
            clearInterval(this.mongoDB.healthCheckInterval)
            this.mongoDB.normalOperationFlag=true;
        }
        while (attempts < maxRetries) {
            try {
                const timeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Update operation timed out")), 1000)
                );
    
                const updateOperation = db.collection('serialization').updateOne(
                    { _id: serializationId }, 
                    { $set: { status: status } }
                );
    
                const result = await Promise.race([updateOperation, timeout]);
                this.mongoDB.setHealthCheck();
                if (result.modifiedCount === 1) {
                    console.log(`Successfully updated status to '${status}' for document with id: ${serializationId}`);
                    return { status: 'success', updatedId: serializationId };
                } else {
                    console.log(`No document found with id: ${serializationId} to update.`);
                    return { status: 'not_found', updatedId: serializationId };
                }
    
            } catch (error) {
                console.log(`[Update Status] Attempt ${attempts + 1} failed:`, error);
                attempts++;
    
                if (attempts >= maxRetries) {
                    console.log(`[Update Status] Max retries reached. Error updating status for id: ${serializationId}`, error);
                    return { status: 'max_retries_reached', error };
                }
    
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    
        return { status: 'max_retries_reached' }; // Fallback if all retries failed
    }
    async  fetchDataStartingFromId(db, startingId, maxResults = 10) {
        let results = [];
        let currentId = startingId;
        let attempts = 0;
        const maxRetries = 1;
        const retryDelay = 1000;
        console.log("fetching data after id : ", startingId)
        while (attempts < maxRetries) {
            try {
                if (this.mongoDB.healthCheckInterval) {
                    clearInterval(this.mongoDB.healthCheckInterval);
                    this.mongoDB.normalOperationFlag = true;
                }
                // Adjusted query to start fetching data from the next available ID after the inputted startingId
                const limit = maxResults
                console.log(`Fetching new List GT: ${currentId} with limit ${limit}`)
                const queryPromise = db.collection('serialization').aggregate(
                    [
                        {
                            '$match': {
                                '_id': { '$gt': currentId }, // Fetch IDs greater than the startingId
                                'status': 'SENT_TO_PRINTER', 
                                'work_order_id': this.work_order_id, 
                                'assignment_id': this.assignment_id
                            }
                        },
                        {
                            '$sort': {
                                '_id': 1
                            }
                        }, 
                        {
                            '$limit':limit 
                        }
                    ]
                ).toArray();
        
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("timed out on retrieving data from mongoDB")), 1000)
                );
    
                const queryResult = await Promise.race([queryPromise, timeoutPromise]);
    
                if (queryResult.length > 0) {
                    // Push results to the list and update currentId to the last fetched _id
                    results.push(...queryResult.map(item => ({
                        id: item._id,
                        full_code: item.full_code,
                        SN: item.code
                    })));
                    
                    currentId = queryResult[queryResult.length - 1]._id;
                    this.lastSerId=currentId
                    break;
                } else {
                    // If no data found, exit the loop
                    console.log('No more data available starting from the given ID.');
                    break;
                }
            } catch (error) {
                console.log(`[Fetch Data] Attempt ${attempts + 1} failed:`, error);
                attempts++;
        
                if (attempts >= maxRetries) {
                    console.log("[Fetch Data] Max retries reached. Exiting the loop.");
                    return { status: 'max_retries_reached', error };

                }
        
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    
        if (results.length === 0) {
            
            return { status: 'no_data_found' };
        }
        this.mongoDB.setHealthCheck()
    
        return { status: 'success', data: results };
    }
    
    
    async dbManualHealthCheck() {
        try {
            let timeout = setTimeout(()=>{
                console.log("[Print Process] timed out occured while trying to do health check manually")
                needToReInit.emit("pleaseReInit","MongoDB")
                this.printer.isOccupied=false;
            }, 1000)
            const serverStatus =  await this.client.db('admin').command({ serverStatus: 1 }); // only for health check, checking if the collection is exist
            clearTimeout(timeout);
            
        } catch (error) {
            console.log("[Print Process] Error out occured while trying to do health check manually ",error)
        }
        
    }
    async processAndEnqueueData(db, startingId, queue) {
        // Fetch the data starting from a specific ID
        
        const fetchResult = await this.fetchDataStartingFromId(db, startingId);
    
        if (fetchResult.status === 'success') {
            // Enqueue each serialization data object into the queue
            fetchResult.data.forEach(serialization => {
                queue.enqueue(serialization);
            });
            // if (queue.size()<10){this.completion=true;}
            console.log("[Printing Process] Data enqueued successfully.");
        } else if (fetchResult.status === 'no_data_found') {
            console.log("[Printing Process] No data found to enqueue.");
            this.serializationQueue2.clear()
            // this.completion=true;
        } else if (fetchResult.status === 'max_retries_reached') {
            console.error("[Printing Process] Failed to fetch data after maximum retries.");
            this.abort()
        }
    }
    // async getSmallestId(db) {
    //     const result = await db.collection('serialization').findOne(
    //         {
    //             status: "PRINTING", //this.sampling?"SAMPLING":
    //             work_order_id:this.work_order_id,
    //             assignment_id:this.assignment_id
    //         },
    //         {
    //             sort: { _id: 1 },
    //             projection: { _id: 1 }
    //         }
    //     );
       
    //     if (result) {
    //         console.log(result)
    //         return result._id;
    //     } else {
    //         console.log(`[Printer Process] No (or no more) document found matching the criteria of the working order id :${this.work_order_id} and assignment id :${this.assignment_id} `);
    //         return null;
    //     }
    // }
 
   
     convertToHex(str) {
        // Get the length of the string in hexadecimal
        const lengthHex = str.length.toString(16).padStart(2, '0');
    
        // Convert the string to hexadecimal
        const hexString = Array.from(str, c => c.charCodeAt(0).toString(16)).join('');
    
        // Concatenate the length and the hexadecimal string
        return lengthHex + hexString;
    }
    async printSetupChecks() {
        try {
            this.error_full_code_queue.clear();
            this.serializationQueue1.clear();
            this.serializationQueue2.clear();
            this.completion = false;
            this.full_code_queue.clear();
            this.details = null
            this.details = await this.getCodeDetails(this.db)
            if (this.details===null){
                throw new Error(`no details with assignment Id = ${this.assignment_id}, work order Id =${this.work_order_id} found`)
            }

            let serialization = await this.getDataBySmallestId(this.db)
            if(serialization == false) {
                throw new Error(`No printing data can be found in serialization table  with assignment Id = ${this.assignment_id}, work order Id =${this.work_order_id}`);
            }
            let P_status ="no errors"

            await this.printer.clearBuffers() // clear buffer before start printing
            await new Promise(resolve => setTimeout(resolve, 1000));

            const msg =printerTemplate[this.templateName](this.details,"QR003") 
            console.log("template name : ", this.templateName)
            
            await this.printer.send(msg)
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.printer.startPrint()// start print
            await new Promise(resolve => setTimeout(resolve, 1000));

            


            const ress = await this.printer.send("1E055152303033")
            console.log("response from sending 1E", ress)
            await new Promise(resolve => setTimeout(resolve, 1000));

            const ress1 = await this.printer.send("01") 
            console.log("response from sending 01", ress1)
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log("[Printing Process] filling up the first 10 buffers...")
            while (serialization.status === undefined && (P_status === "no errors" || P_status=== "still full")){ // filling up the buffer first
                const messages = [`SN ${serialization.SN}`, serialization.full_code]
                console.log("[Printing Process] messages to be sent", messages)
                P_status = await this.printer.sendRemoteFieldData(messages) // goes to printer buffer
                this.expectedBufferCount++;
                let updateTimeOut = setTimeout(()=>{
                    this.dbManualHealthCheck()
                },1000)
                
                await this.db.collection('serialization')
        
                .updateOne( { _id: serialization.id}, 
                            { $set: { status : this.sampling?"SAMPLING":"PRINTING", update_at: Date.now()} } // update the status of the printed code upon pusing to buffer 
                            )
                this.full_code_queue.enqueue(serialization.full_code)
                // this.serializationQueue1.enqueue(serialization)
                this.lastSerId = serialization.id
                clearTimeout(updateTimeOut)
                serialization = await this.getDataBySmallestId(this.db)
                if (P_status === "now full"){

                    break;
                }
            }
            // await this.processAndEnqueueData(this.db,this.lastSerId,this.serializationQueue1)
            await this.processAndEnqueueData(this.db,this.lastSerId,this.serializationQueue2)
            console.log("BUF NUM : ",await this.printer.getBufNum())
            this.printer.isOccupied = true;
            this.printer.localBufferCount= this.full_code_queue.size();
            this.sensor.setInstantCallback( ()=> {
                // console.log(this, this.print3)
                this.printer.aBoxIsPrintedCompletely=false;
                this.print3();
            })
            this.sensor.setFallingEdgeCallback(()=> {
                this.printer.aBoxIsPrintedCompletely=true;
            })
            
            return "success"
        }catch(err){
            console.log(err)
            return err
        }
    }
    async abort(reason="reason undifined"){
        while(this.printer.aBoxIsPrintedCompletely===false){
            await new Promise(resolve => setTimeout(resolve, 100))
        }
        fs.open(pipePath, 'w', (err, fd) => {
            if (err) {
              console.error('Failed to open named pipe:', err);
              return;
            }
          
            fs.write(fd, 'off', (err) => {
              if (err) {
                console.error('Failed to write to named pipe:', err);
              } else {
                console.log('Message sent: off');
              }
          
              fs.close(fd, (err) => {
                if (err) {
                  console.error('Failed to close named pipe:', err);
                }
              });
            });
          });
          this.printer.stopPrint();
          needToReInit.emit("pleaseReInit", "Printing Process", reason)
          this.printer.isOccupied=false;
          
    }
    async print4(){
        const release =  await mutex.acquire();
        console.log("[Printing Process] an object is passing the printer sensor")
        if (this.printer.isOccupied){
            console.log("still occupied")
            if(!this.completion){ 
                console.log("still not completion")
            
                const serialization = await this.getDataBySmallestId(this.db);

                if (serialization.status === 'no_data_found') {
                    console.log("[Printing Process] entering completion phase");
                    this.completion=true;
                    
                } else if (serialization.status === 'max_retries_reached') {
                    console.error("[Printing Process] Aborting...Failed to retrieve data after maximum retries:", result.error);
                    this.abort();
                    release();
                    return false;
                } else {
                    console.log("[Printing Process] Data retrieved:", serialization.SN);
                
                    try {
                        P_status = await this.printer.sendRemoteFieldData([`SN ${serialization.SN}`, serialization.full_code])
                        if (P_status==="now full" ||P_status==="no errors"  ){
                            if (!this.error_full_code_queue.isEmpty() && P_status==="now full"){
                                const error_full_code = this.error_full_code_queue.dequeue()
                                this.full_code_queue.enqueue(error_full_code)
                            }else if(!this.error_full_code_queue.isEmpty() && P_status==="no errors"){
                                console.log("[Printing Process] the previous error code was not entered to buffer")
                                this.error_full_code_queue.dequeue();
                            }
                            this.full_code_queue.enqueue(serialization.full_code)
                            const updateResult = await this.updateStatus(this.db, serialization.id);
                            if (updateResult.status === 'success') {
                                console.log("Status updated successfully.");
                            } else if (updateResult.status === 'not_found') {
                                console.log("Document not found, no status update performed.");
                                this.abort();
                                release();
                                return false;
                            } else if (updateResult.status === 'max_retries_reached') {
                                console.error("Failed to update status after maximum retries:", updateResult.error);
                                this.abort();
                                release();
                                return false;
                            }
                        }
                    } catch (error) {
                        console.log("[Printing Process] an error occured on pushing data to buffer", error)
                        const updateResult = await this.updateStatus(this.db, serialization.id, "ERROR_OCCURED");
                        if (updateResult.status === 'success') {
                            console.log("Status updated successfully.");
                        } else if (updateResult.status === 'not_found') {
                            console.log("Document not found, no status update performed.");
                            this.abort();
                            release();
                            return false;
                        } else if (updateResult.status === 'max_retries_reached') {
                            console.error("Failed to update status after maximum retries:", updateResult.error);
                            this.abort();
                            release();
                            return false;
                        }
                    }
                        
                }
            }
            try {
                const printed = this.full_code_queue.dequeue();
                
                if(this.full_code_queue.isEmpty()){
                    while(this.printer.aBoxIsPrintedCompletely=false){
                        await new Promise(resolve => setTimeout(resolve, 100))
                    }
                    fs.open(pipePath, 'w', (err, fd) => {
                        if (err) {
                          console.error('Failed to open named pipe:', err);
                          return;
                        }
                      
                        fs.write(fd, 'off', (err) => {
                          if (err) {
                            console.error('Failed to write to named pipe:', err);
                          } else {
                            console.log('Message sent: off');
                          }
                      
                          fs.close(fd, (err) => {
                            if (err) {
                              console.error('Failed to close named pipe:', err);
                            }
                          });
                        });
                      });
                    await this.printer.clearBuffers()
                    await putDataToAPI(`v1/work-order/${this.work_order_id}/assignment/${this.assignment_id}/serialization/printed`,{ 
                        full_code:printed,
                    }) 
                    this.printer.isOccupied=false
                    console.log(`[Printing Process] printing process with assignment Id = ${this.assignment_id}, work order Id =${this.work_order_id} is completed! $`)
                    
                    await this.printer.stopPrint();
                    await postDataToAPI('v1/work-order/active-job/complete-print',{})  
                }else{
                    await putDataToAPI(`v1/work-order/${this.work_order_id}/assignment/${this.assignment_id}/serialization/printed`,{ 
                        full_code:printed,
                    }) 
                }
               
            } catch (error) {
                console.log("[Printing Process] error on update to API", error)
            }
            
        }
        release();
    }

   async getPrinterBuffNumWithRetries(currentRetry){
    try {
        return await this.printer.getBufNum()
    } catch (error) {
        if(currentRetry<3){
            currentRetry++;
            await new Promise(resolve => setTimeout(resolve, 300));
            return await this.getPrinterBuffNumWithRetries(currentRetry)
        }else{
            throw new Error("unable get the buffer number")
        }
       
    }
   }
    async print3(){
        const release =  await mutex.acquire();
        console.log("[Printing Process] an object is passing the printer sensor")
        if (this.printer.isOccupied){
            console.log("still occupied")
            if(!this.completion){ 
                console.log("still not completion")
                // console.log("queue1 :", this.serializationQueue1)
                // console.log("queue2 :", this.serializationQueue2)
                let refillFlag= false;
                if(this.serializationQueue1.isEmpty()){
                    console.log("SerQueue1 needs to be filled")
                    // console.time('Spread Operator');
                    // console.log("Queue 2 size ", this.serializationQueue2.size())
                    // console.log("queue2 before deq :",this.serializationQueue2)
                    if (!this.serializationQueue2.isEmpty()){ 
                        const queueLen = this.serializationQueue2.size();
                        for(let i =0 ; i<queueLen ;i++){
                            this.serializationQueue1.enqueue(this.serializationQueue2.dequeue())
                        }
                    }else{
                        console.log("serQueue2 is empty too, means no data left in db")
                    }
                    
                    // console.log("queue2 after dqe :",this.serializationQueue2)
                    // console.timeEnd('Spread Operator');
                    this.serializationQueue2.clear()
                    refillFlag=true;
                    this.processAndEnqueueData(this.db,this.lastSerId,this.serializationQueue2)
                }
                // console.log("queue1 after copy :",this.serializationQueue1) // after coppying the 
                if (this.serializationQueue1.isEmpty() && refillFlag===true) {
                    
                    console.log("[Printing Process] entering completion phase, SerQueue1 is still empty after filled with serQueue2");
                    this.completion=true;
                    
                    

                } else {
                    let serialization=this.serializationQueue1.dequeue()
                    console.log("[Printing Process] Data retrieved:", serialization);
                
                    try {
                        let P_status = await this.printer.sendRemoteFieldData([`SN ${serialization.SN}`, serialization.full_code])
                        if (P_status==="now full" ||P_status==="no errors"  ){
                            if (!this.error_full_code_queue.isEmpty() && P_status==="now full"){
                                const error_full_code = this.error_full_code_queue.dequeue()
                                this.full_code_queue.enqueue(error_full_code)
                                console.log("[Printing Process] error upon pushing data to buffer previously, but the previous code was entered to buffer")
                            }else if(this.error_full_code_queue.size()===1 && P_status==="no errors"){
                                console.log("[Printing Process] error upon pushing data to buffer previously, and the previous code was NOT entered to buffer")
                                this.error_full_code_queue.dequeue();
                            }else if(this.error_full_code_queue.size()>2 ){
                                this.abort("consequtive error on pushing data to buffer")
                                
                            }
                            this.full_code_queue.enqueue(serialization.full_code)
                            const updateResult = await this.updateStatus(this.db, serialization.id);
                            if (updateResult.status === 'success') {
                                console.log("Status updated successfully.");
                            } else if (updateResult.status === 'not_found') {
                                console.log("Document not found, no status update performed.");
                                this.abort();
                                release();
                                return false;
                            } else if (updateResult.status === 'max_retries_reached') {
                                console.error("Failed to update status after maximum retries:", updateResult.error);
                                this.abort("Failed to update status after maximum retries:", updateResult.error);
                                release();
                                return false;
                            }
                        }
                    } catch (error) {
                        console.log("[Printing Process] an error occured on pushing data to buffer", error)
                        this.error_full_code_queue.enqueue(serialization.full_code)
                        const updateResult = await this.updateStatus(this.db, serialization.id, "PENDING_VALIDATION");
                        if (updateResult.status === 'success') {
                            console.log("Status updated successfully.");
                        } else if (updateResult.status === 'not_found') {
                            console.log("Document not found, no status update performed.");
                            this.abort("Document not found, no status update performed.");
                            release();
                            return false;
                        } else if (updateResult.status === 'max_retries_reached') {
                            console.error("Failed to update status after maximum retries:", updateResult.error);
                            this.abort("Failed to update status after maximum retries:", updateResult.error);
                            
                            release();
                            return false;
                        }
                    }
                        
                }
            } // end of not-completion phase
            

                if(this.error_full_code_queue.size()===1 && this.completion){
                    try {

                        let buffNum=  await this.getPrinterBuffNumWithRetries(0)
                        console.log("printer buffer :",  buffNum)
                        console.log("local buffer :",  this.full_code_queue.size())

                        if(this.full_code_queue.size()<=buffNum){
                            console.log("[Printing Process] error upon pushing data to buffer previously, but the previous code was entered")
                        }else{
                            console.log("[Printing Process] error upon pushing data to buffer previously, and the previous code was NOT entered")
                        }
                    } catch (error) {
                        needToReInit.emit("pleaseReInit","Printing Process", error)
                    }
                }
            
            try {
                
                const printed = this.full_code_queue.dequeue();
                this.printer.localBufferCount= this.full_code_queue.size()
                printingScanning.emit("printed",printed);
                if(this.full_code_queue.isEmpty()){
                    while(this.printer.aBoxIsPrintedCompletely===false){
                        // console.log("[printing process] waiting a box to be completely printed...")
                        await new Promise(resolve => setTimeout(resolve, 100)) // waiting for the last box to be completely printed
                    }
                    console.log("printing is completed")
                    fs.open(pipePath, 'w', (err, fd) => {
                        if (err) {
                          console.error('Failed to open named pipe:', err);
                          return;
                        }
                      
                        fs.write(fd, 'off', (err) => {
                          if (err) {
                            console.error('Failed to write to named pipe:', err);
                          } else {
                            console.log('Message sent: off');
                          }
                      
                          fs.close(fd, (err) => {
                            if (err) {
                              console.error('Failed to close named pipe:', err);
                            }
                          });
                        });
                      });
                    await this.printer.clearBuffers()
                    await putDataToAPI(`v1/work-order/${this.work_order_id}/assignment/${this.assignment_id}/serialization/printed`,{ 
                        full_code:printed,
                    }) 
                    this.printer.isOccupied=false
                    console.log(`[Printing Process] printing process with assignment Id = ${this.assignment_id}, work order Id =${this.work_order_id} is completed! $`)
                    
                    this.printer.stopPrint();
                    await postDataToAPI('v1/work-order/active-job/complete-print',{})  
                }else{
                    await putDataToAPI(`v1/work-order/${this.work_order_id}/assignment/${this.assignment_id}/serialization/printed`,{ 
                        full_code:printed,
                    }) 
                }
               
            } catch (error) {
                console.log("[Printing Process] error on update to API", error)
            }
            
        }
        release();
    }

    // async print2(){
    //     while (this.printer.isOccupied){
    //         if(this.sensorTriggered){
    //             this.sensorTriggered=false;
                
            
    //             let serialization=null
    //             try {
    //                 serialization = await this.getDataBySmallestId(this.db);

    //             } catch (error) {
    //                 try {
    //                     serialization = await this.getDataBySmallestId(this.db);
                        
    //                 } catch (error) {
    //                     try {
    //                         serialization = await this.getDataBySmallestId(this.db);
    //                     } catch (error) {
    //                         console.log("error on getting small data from db, aborting...")
    //                         this.abort();
    //                         return;
    //                     }
    //                 }
    //             }
                
    //             let P_status = null;
    //             let bufferCount=0;
    //             try {
    //                 P_status = await this.printer.sendRemoteFieldData([`SN ${serialization.SN}`, serialization.full_code])
    //             } catch (error) {
    //                 try {
    //                     bufferCount= await this.printer.getBufNum()
    //                 } catch (error) {
    //                     try {
    //                         bufferCount= await this.printer.getBufNum()
    //                     } catch (error) {
    //                         try {
    //                             bufferCount= await this.printer.getBufNum()
    //                         } catch (error) {
    //                             this.abort();
    //                             return;
    //                         }
    //                     }
                        
    //                 }
    //             }
                
    //             let updateTimeOut = setTimeout(()=>{
    //                 this.dbManualHealthCheck()
    //             },1000)
                
    //             await this.db.collection('serialization')
    //             .updateOne( { _id: serialization.id}, 
    //             { $set: { status : "PRINTING"} } // update the status of the printed code upon pusing to buffer 
    //             )
    //             clearTimeout(updateTimeOut)
    //             this.full_code_queue.enqueue(serialization.full_code)
    //             const printed = this.full_code_queue.dequeue();
    //             await putDataToAPI(`v1/work-order/${this.work_order_id}/assignment/${this.assignment_id}/serialization/printed`,{ 
    //             full_code:printed,
    //             })
    //         }
    //     }
    // }

    async print(){ 
        let delayTime=2500; // initial delay time
        let fistPrintedFlag=false; //flag for telling that a first object has been printed
        let filledBufNum=0;
        let P_status="no errors"
        let waitingForCompletion=false;
        let oldvalue=null; // rey
        let rey_flag=false; //rey
        let flag_escape=0;
        console.log("[Printer Process] waiting object to be printed")
        while (this.printer.isOccupied){
            
            while(true){ // filling up the buffer
                let serialization = await this.getDataBySmallestId(this.db);
                // rey start here (check buffer before sending FOR YUSUF LATER)
                if (oldvalue != null && oldvalue.id == serialization.id)
                    {
                        console.log("rey flag entered QR has not changed");
                        console.log(oldvalue.id,serialization.id,P_status);
                        rey_flag=true;
                        flag_escape++;
                        if (flag_escape > 3) // exit infinite while loop
                            {
                                let updateTimeOut = setTimeout(()=>{
                                    this.dbManualHealthCheck()
                                },1000)
                                
                                await this.db.collection('serialization')
                                .updateOne( { _id: serialization.id}, 
                                { $set: { status : "PRINTING"} } // update the status of the printed code upon pusing to buffer 
                                )
                                clearTimeout(updateTimeOut)
                                this.full_code_queue.enqueue(serialization.full_code)
                                const printed = this.full_code_queue.dequeue();
                                await putDataToAPI(`v1/work-order/${this.work_order_id}/assignment/${this.assignment_id}/serialization/printed`,{ 
                                full_code:printed,
                                })
                                flag_escape=0;
                            }
                    }
                    else
                    {
                        console.log("rey flag false entered QR has changed")
                        oldvalue=serialization;
                        rey_flag=false;
                        flag_escape=0;
                    }
                // rey end here REYNOLD
                if (!serialization){ // no more data on database
                    waitingForCompletion=true;
                    console.log("[Printing Process] no more data on database is found, entering completion phase")
                    break;
                }
                try {
                    // rey code
                    if (P_status=== "still full")
                        {
                            P_status="full attempt to send";
                            flag_escape=0;
                        }
                    else if (P_status=== "full attempt to send")
                    {
                        P_status="failed to update to DB";                        
                    }
                    if (!rey_flag || P_status === "full attempt to send")
                        {
                            P_status = await this.printer.sendRemoteFieldData([`SN ${serialization.SN}`, serialization.full_code]) 
                        }
                        else
                        {
                            rey_flag=false;
                        }
                } catch (err) {
                    console.log("[Printer Process] - Failed sending buffer to printer, ", err);
                    let updateTimeOut = setTimeout(()=>{
                        this.dbManualHealthCheck()
                    },1000)
                    
                    await this.db.collection('serialization')
                     .updateOne( { _id: serialization.id}, 
                    { $set: { status : "ERROR_OCCURED"} } // update the status of the printed code upon pusing to buffer 
                    )
                    clearTimeout(updateTimeOut)
                    this.full_code_queue.enqueue(serialization.full_code) 
                }       
                if (P_status === "no errors" || P_status ==="now full" || P_status==="full attempt to send" || P_status==="failed to updated to DB") {
                    let updateTimeOut = setTimeout(()=>{
                        this.dbManualHealthCheck()
                    },1000)
                    await this.db.collection('serialization')
                     .updateOne( { _id: serialization.id}, 
                    { $set: { status : "PRINTING"} } // update the status of the printed code upon pusing to buffer 
                    )
                    clearTimeout(updateTimeOut)
                    this.full_code_queue.enqueue(serialization.full_code) // yusuf: this will be called twice if failed to upddate db 
                    const printed = this.full_code_queue.dequeue();
                    await putDataToAPI(`v1/work-order/${this.work_order_id}/assignment/${this.assignment_id}/serialization/printed`,{ 
                        full_code:printed,
                    }) 
                    filledBufNum++;
                    fistPrintedFlag=true
                } else if (P_status === "still full") {
                    break;
                }
            }
            if (fistPrintedFlag){ //apply dynamic delay time logic
                const delTtemp = delayTime;
                if (filledBufNum>0){delayTime = (delayTime-(filledBufNum-1)*100) }// targeting 9 items on buffer, if less than 9 substract by x*100 ms
                filledBufNum=0;
                if (delayTime<delTtemp){
                    console.log(`[Printing Process] delay time has reduced to ${delayTime}`);
                }
            }
            if (waitingForCompletion){
                let bufferCount = await this.printer.getBufNum()
                while(!this.full_code_queue.isEmpty() && this.printer.isOccupied){ // this while loop is useful if no printing happening while waiting for completion
                    while(this.full_code_queue.size()>bufferCount){ // keep dequeuing until it matches the number of buffer left
                        console.log(`[Printing Process] buffer count :${bufferCount} vs que size: ${this.full_code_queue.size()}`)
                        const printed = this.full_code_queue.dequeue();
                        await putDataToAPI(`v1/work-order/${this.work_order_id}/assignment/${this.assignment_id}/serialization/printed`,{ 
                            full_code:printed,
                        })
                        
                    }
                    bufferCount = await this.printer.getBufNum() // update the bufferCount number
                    // await new Promise(resolve => setTimeout(resolve, delayTime))
                    await new Promise(resolve => setTimeout(resolve, 600))

                }
                
                fs.open(pipePath, 'w', (err, fd) => {
                    if (err) {
                      console.error('Failed to open named pipe:', err);
                      return;
                    }
                  
                    fs.write(fd, 'off', (err) => {
                      if (err) {
                        console.error('Failed to write to named pipe:', err);
                      } else {
                        console.log('Message sent: off');
                      }
                  
                      fs.close(fd, (err) => {
                        if (err) {
                          console.error('Failed to close named pipe:', err);
                        }
                      });
                    });
                  });
                await this.printer.clearBuffers()
                this.printer.isOccupied=false
                console.log(`[Printing Process] printing process with assignment Id = ${this.assignment_id}, work order Id =${this.work_order_id} is completed! $`)
                
                await this.printer.stopPrint();
                await postDataToAPI('v1/work-order/active-job/complete-print',{})
            }
            if (P_status==="still full" || P_status==="now full")
                {
                    delayTime=10000;
                }
                else if (rey_flag || P_status === "full attempt to send")
                    {
                        delayTime=5000;
                    }
                else if (P_status === "no errors") 
                {
                    delayTime=2500;
                }
                else {
                    delayTime=5000;
                }
            await new Promise(resolve => setTimeout(resolve, delayTime)) // The delay


        }
       
    }
    

}


 