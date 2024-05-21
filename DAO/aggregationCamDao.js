import { sendDataToAPI } from "../API/APICall/apiCall";
class AggregationCam {
    constructor(webSocketClient) {
      this.webSocketClient = webSocketClient;
      this.receivedMessages = [];
      this.handleMessage = this.handleMessage.bind(this);
      this.webSocketClient.receiveMessage(this.handleMessage)
    }
  
    getStatus() {
      return new Promise((resolve, reject) => {
        this.webSocketClient.sendMessage('get_status');
        this.webSocketClient.receiveMessage((message) => {
          resolve(message);
        });
      }).catch((err) =>{
        throw new Error(`[Agg Cam] Error on getting camera status: ${err}`)
      });
    }
  
    getData() {
      this.webSocketClient.sendMessage('get_data');
    }

    async handleMessage(message) {
      this.receivedMessages.push(message);
      if (this.receivedMessages.length === 3) {
        const result = this.mergeResponses(this.receivedMessages);
        const codes= result.scans.map((value) => {
          return value.code
        })
        
        await sendDataToAPI(`v1/work-order/active-job/aggregation`,{ 
          serialization_codes:codes
          
      }) 
      }
    };
  
    mergeResponses(messages) {
      console.log(messages)
     

      let combinedData = {};
  
      messages.forEach((message) => {
        const pairs = message.split(';');
        pairs.forEach((pair) => {
          if (pair) {
            const [code, accuracy] = pair.split(':');
            combinedData[code] = parseInt(accuracy, 10);
          }
        });
      });

      this.receivedMessages = [];
  
      const result = {
        scans: Object.entries(combinedData).map(([code, accuracy]) => ({ code, accuracy }))
      };
    
  
      return result;
    }

  }
  
  export default AggregationCam;
  