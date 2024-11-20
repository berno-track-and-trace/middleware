import weighingScaleDao from "./weighingScaleDao.js"

export default class HealthChecks{
    constructor(printer, serCam, aggCam, webSocketClient ){
        
        this.printer = printer
        this.serCam = serCam
        this.aggCam = aggCam
        this.webSocketClient = webSocketClient
        this.handleMessageData = this.handleMessageData.bind(this);
        this.webSocketClient.receiveMessage(this.handleMessageData, "HC");
        this.checkInterval = 20000 //five secs
    }
      async getStatus(peripheral) {
        let status = null;
        // let ip = null;
        // let template_id = null;
        let nozzle_list = [];
        let error_message = null;
    
        switch (peripheral) {
        case 'PRINTER':
            if (this.printer.running) {
                status = this.printer.isOccupied ? "OCCUPIED" : "IDLING";
            } else {
                status = "DISCONNECTED";
            }
            // ip = this.printer.ip;
            // template_id = this.printer.templateName;
            try {
                const ink_level_percentages = await this.printer.requestInkRemains();
                let idx=0;
                ink_level_percentages.forEach(element => {
                  nozzle_list.push({
                    nozzle_id:idx,
                    ink_level_percentage:element
                  })
                  idx++;
                  if (idx>3){
                    return;                  }
                });
            } catch (err) {
                status="ERROR"
                error_message = err.message;
            }
            break;
          case 'SER_CAM':
            status= this.serCam.running?"CONNECTED":"DISCONNECTED";
            // ip = this.aggCam.ip;
            break;
    
          case 'AGG_CAM':
            try{
                status = await this.aggCam.getStatus()
            }catch(err){
                status = "ERROR"
                error_message = err.message;
            }
            // ip = this.aggCam.webSocketClient.ip
            break;
          case 'WEIGHING_SCALE':
            try {
              await weighingScaleDao.readWeight()
              status= "OK"
            } catch (error) {
              status = "ERROR"
              error_message = error.message;
            }
            break;
    
          default:
            throw new Error(`[Health Checks] Unknown peripheral: ${peripheral}`);
        }
    
        return {
          status,
          // ip,
          // template_id,
          nozzle_list,
          error_message
        };
      }
      // async sendToKafka(peripheral) {
      //   const status = await this.getStatus(peripheral);
        
      //   const payload = {
      //     peripherals: peripheral,
      //     status: status.status,
      //     ip: status.ip,
      //     template_id: status.template_id,
      //     ink_level_percentage: status.ink_level_percentage,
      //     timestamp: new Date().toISOString(),
      //     message: status.message
      //   };
      //   console.log(payload)
      //   const message = JSON.stringify(payload);
    
      //   try {
      //     await this.kafkaProducer.sendMessage('health_checks', message);
      //   } catch (error) {
      //     console.error('[Health Checks] Error sending to Kafka:', error);
      //   }
      // }

      async sendToWS() {
        const printer = await this.getStatus("PRINTER");
        const serCam = await this.getStatus("SER_CAM");
        const aggCam = await this.getStatus("AGG_CAM");
        const weighingScale = await this.getStatus("WEIGHING_SCALE")
        
        const payload = {
          case : "HEALTH_CHECK",
          action: "HEALTH_CHECKING",
          message_code: "INFO_MIDDLEWARE_HEALTHCHECK",
          message_type: "SUCCESS",
          message:"success",
          data : {
              printer:{
                status : printer.status,
                nozzle_list :printer.nozzle_list,
                error_message: printer.error_message
              },
              aggregation_cam : {
                status: aggCam.status,
                error_message: aggCam.error_message
              },
              serialization_cam : {
                status: serCam.status	,
                error_message: serCam.error_message
              },
              weighing_scale : {
                status: weighingScale.status,
                error_message: weighingScale.error_message
              }
              
            }
              
          
          }
        // console.log(payload)
        const message = JSON.stringify(payload);
    
        try {
          await this.webSocketClient.sendMessage( message);
        } catch (error) {
          console.error('[Health Checks] Error sending to wesbsocket:', error);
        }
      }
    
      // run() {
      //   console.log("[Health Check] health check is running...")
      //   setInterval(() => this.sendToKafka('PRINTER'), this.checkInterval);
      //   setInterval(() => this.sendToKafka('SER_CAM'), this.checkInterval);
      //   setInterval(() => this.sendToKafka('AGG_CAM'), this.checkInterval);
      // }
      run() {
        console.log("[Health Check] health check is running...")
        setInterval(() => this.sendToWS(), this.checkInterval);
        // setInterval(() => this.sendToWS('SER_CAM'), this.checkInterval);
        // setInterval(() => this.sendToWS('AGG_CAM'), this.checkInterval);
      }
       async handleMessageData(message){
        // console.log("[Health Check] got data : ", message)
    
        try {
           await this.webSocketClient.sendMessage( message)
        } catch (error) {
          console.error('[Health Checks] Error sending to wesbsocket:', error);
        }
      }
    }
    
 
