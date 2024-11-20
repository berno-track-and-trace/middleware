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
function removeSpacesAndNewlines(inputString) {
    return inputString.replace(/\s+/g, '');
}
function formatCurrencyIDR(amount, locale = 'id-ID') {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'IDR'
    }).format(amount);
}
import Queue from '../utils/queue.js';
import printerTemplate from '../utils/printerTemplates.js';
import { connect, close } from './db.js';
import {sendDataToAPI1} from '../API/APICall/apiCall.js';

export default class printProcess {
    constructor(printer) {
        this.printer = printer;
        this.fileNames = [];
        this.db=null
        this.work_order_id=5
        this.assignment_id=5
        this.printPCtarget=0
        this.lowest_id=null
        this.details=null
        this.fileNamesIdx=0
        this.sampling = false
        this.templateId=1 //default
        this.waitPrint=false
        this.full_code_queue = new Queue()

    }
    async getCodeDetails(db) {
        try {
            console.log(this.work_order_id)
            const work_order = await db.collection('work_order').findOne({ _id: this.work_order_id });
            if (!work_order) {
                throw new Error(`Work order ${this.work_order_id} not found`);
            }
    
            const product = await db.collection('product').findOne({ _id: work_order.product_id });
            if (!product) {
                throw new Error(`Product ID ${this.product_id} not found `);
            }
    
            return {
                NIE: product.nie,
                BN: work_order.batch_no,
                MD: formatDate(work_order.manufacture_date), 
                ED: formatDate(work_order.expiry_date),
                HET: formatCurrencyIDR(product.het)
            };
        } catch (err) {
            console.error('Error getting code details:', err);
            
            return err;
        }
    }
    
    async getDataBySmallestId(db) {
        const result = await db.collection('serialization').aggregate(
            [
                {
                  '$sort': {
                    '_id': 1
                  }
                }, {
                  '$match': {
                    'status': this.sampling?"SAMPLE_SENT_TO_PRINTER":'SENT_TO_PRINTER', 
                    'work_order_id': this.work_order_id, 
                    'assignment_id': this.assignment_id
                  }
                }, {
                  '$limit': 1
                }
              ]).toArray();
            if (result.length==1){
                return {id:result[0]._id,full_code:result[0].full_code,SN:result[0].code}
            } else {
                return false //no code found
            }
    }
  
    async getSmallestId(db) {
        const result = await db.collection('serialization').findOne(
            {
                status: this.sampling?"SAMPLING":"PRINTING",
                work_order_id:this.work_order_id,
                assignment_id:this.assignment_id
            },
            {
                sort: { _id: 1 },
                projection: { _id: 1 }
            }
        );
       
        if (result) {
            console.log(result)
            return result._id;
        } else {
            console.log("No document found matching the criteria");
            return null;
        }
    }
    async checkNGetCode(db, lastId) {
        const result = await db.collection('serialization').aggregate( 
            [
                {
                  '$sort': {
                    '_id': 1
                  }
                }, {
                  '$match': {
                    "_id": {
                        "$gt": lastId
                    },
                    'status': this.sampling?"SAMPLING":'PRINTING', 
                    'work_order_id': this.work_order_id, 
                    'assignment_id': this.assignment_id
                  }
                }, {
                  '$limit': 1
                }
              ]).toArray();
            if (result.length==1){
                return {id:result[0]._id,full_code:result[0].full_code,SN:result[0].code}
            }else {
                return false //no code found
            }
    }
    async checkNGetCode2(db) {
        const result = await db.collection('serialization').aggregate( 
            [
                {
                  '$sort': {
                    '_id': 1
                  }
                }, {
                  '$match': {
                    'status': this.sampling?"SAMPLE_SENT_TO_PRINTER":'SENT_TO_PRINTER', 
                    'work_order_id': this.work_order_id, 
                    'assignment_id': this.assignment_id
                  }
                }, {
                  '$limit': 1
                }
              ]).toArray();
            if (result.length==1){
                console.log(result[0]._id)
                return {id:result[0]._id,full_code:result[0].full_code,SN:result[0].code}
            }else {
                return false //no code found
            }
    }
   
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
            this.db = await connect() // TODO: use mongoDB.js
            this.details = null
            this.details = await this.getCodeDetails(this.db)
            if (this.details===null){
                console.log("no details")
                throw new Error(`no details with assignment Id = ${this.assignment_id}, work order Id =${this.work_order_id} found`)
            }

            let serialization = await this.getDataBySmallestId(this.db)
            if(serialization == false) {
                throw new Error(`can't get any data`);
            }
            let P_status ="no errors"

            await this.printer.send("21"); // clear buffer before start printing
            const msg =printerTemplate[1](this.details,"QR003") // sending 
            await this.printer.send(msg) 
            await this.printer.send("11")
            while (serialization != null && (P_status === "no errors" || P_status=== "still full")){ // filling up the buffer first
                // await new Promise(resolve => setTimeout(resolve, 5000));
                console.log(`serialization - ${serialization.id}`)
                P_status = await this.printer.sendRemoteFieldData([`SN ${serialization.SN}`, serialization.full_code]) // goes to buffer
                console.log(`p status : ${P_status}`)
                await this.db.collection('serialization')
        
                .updateOne( { _id: serialization.id}, 
                            { $set: { status : this.sampling?"SAMPLING":"PRINTING", update_at: Date.now()} } // update the status of the printed code upon pusing to buffer 
                            )
                this.full_code_queue.enqueue(serialization.full_code)
                serialization = await this.getDataBySmallestId(this.db)
                if (P_status === "now full"){

                    break;
                }
            }
            this.printer.isOccupied = true;
            return "success"
        }catch(err){
            console.log(err)
            return err
        }
    }

    async print(){
        let delayTime=5000;
        let fistPrintedFlag=false; //flag for telling that a first object has been printed
        let filledBufNum=0;
        let P_status="no errors"
        while (this.printer.isOccupied){
            
            while(true){
                let serialization = await this.getDataBySmallestId(this.db);
                P_status = await this.printer.sendRemoteFieldData([`SN ${serialization.SN}`, serialization.full_code]) //Todo error handling
                if (P_status === "no errors" || P_status ==="now full") {
                    await this.db.collection('serialization')
                     .updateOne( { _id: serialization.id}, 
                    { $set: { status : this.sampling?"SAMPLING":"PRINTING"} } // update the status of the printed code upon pusing to buffer 
                    )
                    this.full_code_queue.enqueue(serialization.full_code)
                    const printed = this.full_code_queue.dequeue();
                    await sendDataToAPI1(`v1/work-order/${this.work_order_id}/assignment/${this.assignment_id}/serialization/printed`,{ 
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
                if (delayTime!=delTtemp){
                    console.log(`delay time has reduced to ${delayTime}`);
                }
            }
            
            
            await new Promise(resolve => setTimeout(resolve, delayTime)) // The delay


        }
    }

}


 