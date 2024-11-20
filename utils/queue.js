export default class Queue {
    constructor() {
      this.items = [];
    }
  
    // Add an element to the queue
    enqueue(element) {
      this.items.push(element);
      
    }
    copy(newQueue){
      console.log("new queue" ,newQueue)
      for (let i=0; i < newQueue.size(); i++){
        this.items.push(newQueue[i]);
      }
    }
    // Remove an element from the queue
    dequeue() {
      if (this.isEmpty()) {
        return "Underflow";
      }
      return this.items.shift();
    }
  
    // Get and remove the front element of the queue
    front() {
      if (this.isEmpty()) {
        return "No elements in Queue";
      }
      return this.dequeue();
    }
  
    // Check if the queue is empty
    isEmpty() {
      return this.items.length === 0;
    }
  
    // Get the size of the queue
    size() {
      return this.items.length;
    }
  
    // Print the queue elements
    printQueue() {
      let str = "";
      for (let i = 0; i < this.items.length; i++) {
        str += this.items[i] + " ";
      }
      return str;
    }
    clear(){
      this.items=[];
    }
  }

  
  // Example usage:
  // const queue = new Queue();
  // queue.enqueue(10);
  // queue.enqueue(20);
  // queue.enqueue(30);
  // console.log("Queue elements: " + queue.printQueue()); // Output: Queue elements: 10 20 30
  // console.log("Front element and dequeued: " + queue.front()); // Output: Front element and dequeued: 10
  // console.log("Queue elements after accessing front: " + queue.printQueue()); // Output: Queue elements after accessing front: 20 30
  // console.log("Size of queue: " + queue.size()); // Output: Size of queue: 2
  