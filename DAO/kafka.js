import { Kafka } from 'kafkajs';

// Define Kafka broker(s)
const kafka = new Kafka({
  clientId: 'kafka',
  brokers: ['localhost:9092'] //todo : put on env
});

// Create a Kafka producer
const producer = kafka.producer();

// Function to send messages
const sendMessage = async (topic, message) => {
  try {
    await producer.send({
      topic,
      messages: [
        { value: message }
      ]
    });
    console.log('Message sent successfully:', message);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Connect to Kafka broker and send messages
const run = async () => {
  await producer.connect();

  // Send a sample message
  await sendMessage('my-topic', 'Hello Kafka!');

  // Close the producer after sending messages
  await producer.disconnect();
}

// Run the producer
run().catch(console.error);

