import { MongoClient } from 'mongodb';
import { needToReInit } from '../utils/globalEventEmitter.js';
// import { clear } from 'winston';

export default class MongoDB {
    constructor(uri, databaseName, options = {}) {
        this.uri = uri;
        this.databaseName = databaseName;
        this.client = new MongoClient(uri, options);
        this.db = null;
        this.isConnected = false;
        this.normalOperationFlag= false;
        this.healthCheckInterval=null;
        this.healthCheckTime= 5000 // The time for interval on healthcheck
        this.healthCheckTimeTolerance=300 // tolerance for redundance
        // this.reconnectTries = options.reconnectTries || 5;
        // this.reconnectInterval = options.reconnectInterval || 5000;
        
        // this.client.on('serverClosed', this.handleDisconnect.bind(this));
        // this.client.on('topologyClosed', this.handleDisconnect.bind(this));
        // this.client.on('error', this.handleDisconnect.bind(this));
        // this.client.on('timeout', this.handleDisconnect.bind(this));
    }

    setHealthCheck(){
        try {
            
            this.healthCheckInterval = setInterval(async ()=>{
                let timeout = setTimeout(()=>{
                    needToReInit.emit("pleaseReInit", "MongoDB")
                    console.log ("waiting for health check response is timed out")
                }, 1000)
                const serverStatus =  await this.client.db('admin').command({ serverStatus: 1 }); // only for health check, checking if the collection is exist
                clearTimeout(timeout);
                if (serverStatus.ok!=1){throw new Error ("[MongdoDB] mongodb is unhealthy")}
                // console.log("[MongdoDB] mongodb is healthy")
            }, this.normalOperationFlag?this.healthCheckTime+this.healthCheckTimeTolerance:this.healthCheckTime);
            this.normalOperationFlag=false;
            
        } catch (error) {//TODO: add clearTimeout(timeout);
            needToReInit.emit("pleaseReInit", "MongoDB")
            console.log("[MongoDB] health check error : ", error)
            this.normalOperationFlag=false;
        }

    }

    async connect() {
        try {
            console.log("[MongoDB] connecting to MongoDB...");
            await this.client.connect();
            console.log('[MongoDB] Connected to the MongoDB');
            this.db = this.client.db(this.databaseName);
            this.isConnected = true;
            this.setHealthCheck()
        } catch (err) {
            console.error('[MongoDB] Error connecting to the MongoDB, error:', err);
            this.isConnected = false;
            throw err;
        }
    }

    async close() {
        try {
            await this.client.close();
            console.log('[MongoDB] Connection to the database closed');
            this.isConnected = false;
        } catch (err) {
            console.error('[MongoDB] Error closing the database connection:', err);
        }
    }

    async reconnect() {
        let tries = 0;
        while (!this.isConnected && tries < this.reconnectTries) {
            try {
                console.log(`[MongoDB] Attempting to reconnect... (${tries + 1}/${this.reconnectTries})`);
                await this.connect();
                if (this.isConnected) {
                    console.log('[MongoDB] Reconnected successfully');
                    break;
                }
            } catch (err) {
                console.error('[MongoDB] Reconnection attempt failed, error:', err);
                await new Promise(resolve => setTimeout(resolve, this.reconnectInterval));
            }
            tries++;
        }

        if (!this.isConnected) {
            console.error('[MongoDB] Failed to reconnect after multiple attempts');
        }
    }

    handleDisconnect() {
        console.log('[MongoDB] Disconnected from MongoDB');
        this.isConnected = false;
        this.reconnect();
    }

    async update(collectionName, id, field, newItem) {
        try {
            const collection = this.db.collection(collectionName);

            const result = await collection.updateOne({ _id: id }, { $set: { [field]: newItem } });

            if (result.modifiedCount === 0) {
                throw new Error('Document not found or field not modified');
            }

            console.log(`Field '${field}' updated successfully for document with id '${id}'`);
        } catch (err) {
            throw new Error('[MongoDB] Error updating document:', err);
        }
    }
}
