// test.js

import { MongoClient } from 'mongodb';

const uri = 'mongodb://seratonic:53r4t0n1cm0n90@139.59.103.181:27017/?directConnection=true';

async function fetchData() {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        console.log('Connected to the database');

        const database = client.db('seratonic'); // Specify the database name
        const collection = database.collection('serialization'); // Specify the collection name

        const result = await collection.findOne({ _id: 158 });

        if (result) {
            console.log('Data found:', result);
        } else {
            console.log('No data found for _id: 255');
        }
    } catch (error) {
        console.error('Error fetching data:', error);
    } finally {
        await client.close();
        console.log('Connection closed');
    }
}

fetchData();
