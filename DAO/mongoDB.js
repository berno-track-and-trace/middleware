import { MongoClient } from 'mongodb';

export default class MongoDB {
    constructor(uri, databaseName){
        this.client = new MongoClient(uri)
        this.db = null
        this.databaseName = databaseName
    }
    async connect() {
        try {
            console.log("connecting...")
            await this.client.connect();
            console.log('Connected to the database');
            this.client.db(this.databaseName)
        } catch (err) {
            console.error('Error connecting to the database:', err);
            throw err;
        }
    }
    
    async  close() {
        try {
            await client.close();
            console.log('Connection to the database closed');
        } catch (err) {
            console.error('Error closing the database connection:', err);
        }
    }
    
    async  update(collectionName, id, field, newItem) {
        try {
            const collection = db.collection(collectionName);
            
            const result = await collection.updateOne({ _id: id }, { $set: { [field]: newItem } });
            
            if (result.modifiedCount === 0) {
                throw new Error('Document not found or field not modified');
            }
            
            console.log(`Field '${field}' updated successfully for document with id '${id}'`);
        } catch (err) {
            console.error('Error updating document:', err);
            throw err;
        }
    }
    
}