import WebSocket from 'ws';
import { needToReInit } from '../utils/globalEventEmitter.js';
class WebSocketClient {
  constructor(ip, port, clientId,clientName="websocket") {
    this.ip = ip;
    this.port = port;
    this.clientId = clientId;
    this.status = 'disconnected';
    this.ws = null;
    this.clientName=clientName
    this.autoReInit = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        if(this.ws){
          
          this.ws.removeAllListeners();
          this.ws.terminate();
          this.ws.close();
          
        }
        this.ws = null;
        const url = this.port===null?this.ip:`ws://${this.ip}:${this.port}`;
        console.log(`[${this.clientName}] url :`, url)
        const headers = {
          'Client-ID': this.clientId
        };
  
        this.ws = new WebSocket(url, { headers });
  
        this.ws.once('open', () => {
          this.status = 'connected';
          this.ws.once('error', (error) => {
            // console.log(`[${this.clientName}] disconnected with error`, error)
            this.status = 'disconnected';
            if(this.autoReInit){
              needToReInit.emit("pleaseReInit", this.clientName, error)
            }
            
          });
    
          this.ws.once('close', () => {
            console.log(`[${this.clientName}] disconnected`)
            this.status = 'disconnected';
            if(this.autoReInit){
              needToReInit.emit("pleaseReInit", this.clientName, "Disconnected")
            }
          });
          resolve();
        });
  
        this.ws.once('error', (error) => {
          console.log(`[${this.clientName}] disconnected with error`, error)
          this.status = 'disconnected';
          
          reject(error);
        });
   
      } catch (error) {
        reject(error)
      }
    });
  }

  sendMessage(message) {
    if (this.ws && this.status === 'connected') {
      this.ws.send(message);
    } else {
      console.error('WebSocket is not connected.');
    }
  }

  receiveMessage(callback, name="") {
    console.log("assining callback ws")
    if (this.ws) {
      this.ws.on('message', callback);
      console.log("callback ws assigned by ",name )
    } else {
      console.error(`[${this.clientName}] WebSocket is not initialized.`);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      
      this.status = 'disconnected';
    } else {
      console.error(`[${this.clientName}] WebSocket is not initialized.`);
    }
  }
}

export default WebSocketClient;
