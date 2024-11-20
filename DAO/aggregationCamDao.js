import { sendDataToAPI } from "../API/APICall/apiCall.js";
class AggregationCam {
    constructor(webSocketClient) {
      this.webSocketClient = webSocketClient;
      // this.webSocketClient.connect().then(() => {
      //   console.log('WebSocket connected');
      // }).catch((error) => {
      //   console.error('WebSocket connection failed:', error);
      // });
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
      });
    }
  
    getData() {
      this.webSocketClient.sendMessage('get_data');
    }

    async handleMessage(message) {
      this.receivedMessages.push(message);
      if (this.receivedMessages.length === 3) {
        // this.webSocketClient.ws.off('message', handleMessage); // Stop listening for more messages
        const result = this.mergeResponses(this.receivedMessages);
        const codes= result.scans.map((value) => {
          return value.code
        })
        
        await sendDataToAPI(`v1/work-order/active-job/aggregation`,{ // TODO: what if its not reaching the API
          serialization_codes:codes
          
      }) 
      }
    };
  
    mergeResponses(messages) {
      
     

      let combinedData = {};
  
      messages.forEach((message) => {
        const messageStr = message.toString(); // Convert Buffer to string

        const pairs = messageStr.split(';');
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
  