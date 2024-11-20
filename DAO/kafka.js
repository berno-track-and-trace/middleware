import { Kafka } from 'kafkajs';

export default class KafkaProducer {
  constructor(clientId, brokers) {
    this.kafka = new Kafka({
      clientId:clientId,
      brokers:[brokers]
    });
    this.producer = this.kafka.producer();
  }

  async connect() {
    try {
      console.log("[Kafka] Connecting...")
      await this.producer.connect();
      console.log('[Kafka] Connected to Kafka broker.');
    } catch (error) {
      console.error('[Kafka] Error connecting to Kafka broker:', error);
    }
  }

  async sendMessage(topic, message) {
    try {
      await this.producer.send({
        topic,
        messages: [{ value: message }]
      });
      console.log('Message sent successfully:', message);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  async disconnect() {
    try {
      await this.producer.disconnect();
      console.log('Producer disconnected.');
    } catch (error) {
      console.error('Error disconnecting producer:', error);
    }
  }

  async run(topic, message) {
    try {
      await this.connect();
      await this.sendMessage(topic, message);
    } finally {
      await this.disconnect();
    }
  }
}