import WebSocket from 'ws';

class WebSocketClient {
  constructor(ip, port, clientId) {
    this.ip = ip;
    this.port = port;
    this.clientId = clientId;
    this.status = 'disconnected';
    this.ws = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const url = `ws://${this.ip}:${this.port}`;
      const headers = {
        'Client-ID': this.clientId
      };

      this.ws = new WebSocket(url, { headers });

      this.ws.on('open', () => {
        this.status = 'connected';
        resolve();
      });

      this.ws.on('error', (error) => {
        this.status = 'disconnected';
        reject(error);
      });

      this.ws.on('close', () => {
        this.status = 'disconnected';
      });
    });
  }

  sendMessage(message) {
    if (this.ws && this.status === 'connected') {
      this.ws.send(message);
    } else {
      console.error('WebSocket is not connected.');
    }
  }

  receiveMessage(callback) {
    if (this.ws) {
      this.ws.on('message', callback);
    } else {
      console.error('WebSocket is not initialized.');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.status = 'disconnected';
    } else {
      console.error('WebSocket is not initialized.');
    }
  }
}

export default WebSocketClient;
