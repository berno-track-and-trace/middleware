
export default class Rejection {
    constructor(sensor, switch1, responseQueue) {
        this.sensor = sensor;
        this.switch1 = switch1;
        this.responseQueue = responseQueue;
        this.flag = false;
        this.running = false; // Flag to track if the process is running
        this.delay=85 //ms
    }

    async start() {
        
        if (this.running) return; // Don't start if already running
        this.running = true; // Set running flag to true

        try {
            this.flag = false;
            while (!this.flag) {
                await sleep(50)
                let sensorValue = this.sensor.getValue();
                if (sensorValue === 1) {
                    console.log("detected")
                    if (!this.responseQueue.isEmpty()) {
                        const getresponse = this.responseQueue.dequeue();
                        if (getresponse) {
                            while (sensorValue === 1) {
                                await sleep(1);
                                sensorValue = this.sensor.getValue();
                            }
                            await sleep(50);
                            console.log("Box Pass");
                        } else {
                            await sleep(20);
                            this.switch1.setValue(0);
                            await sleep(this.delay);
                            let switchOpened = true;
                            while (switchOpened) {
                                this.switch1.setValue(1);
                                while (sensorValue === 1) {
                                    await sleep(1);
                                    sensorValue = this.sensor.getValue();
                                }
                                switchOpened = false;
                            }
                            console.log("Rejected");

                            await sleep(50);
                        }
                    }
                }
            }
        } catch (error) {
            console.log(`Error: ${error}`);
        } finally {
            this.running = false; // Set running flag to false when finished
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
