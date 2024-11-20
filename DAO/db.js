// db.js
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';



dotenv.config();

const uri = process.env.MONGODB_URI; //TODO : put on .env
console.log(uri)
const client = new MongoClient(uri);

async function connect() {
    try {
        await client.connect();
        console.log('Connected to the database');
        return client.db('seratonic');
    } catch (err) {
        console.error('Error connecting to the database:', err);
        throw err;
    }
}

async function close() {
    try {
        await client.close();
        console.log('Connection to the database closed');
    } catch (err) {
        console.error('Error closing the database connection:', err);
    }
}

export { connect, close };
