import pkg from 'node-libgpiod';
const { version, Chip, Line } = pkg;

export default class LED {
  constructor(gpioPin) {
    this.chip = new Chip(4);
    this.line = new Line(this.chip, gpioPin);
    this.line.requestOutputMode();
    this.blinkingTimes = Infinity;
    this.state = 'off';
    this.blinkInterval = null;
    this.currentInterval = null;

    this.startStateMachine();
  }

  startStateMachine() {
    setInterval(() => {
      switch (this.state) {
        case 'off':
          this.stopBlinking();
          this.line.setValue(1);
          break;
        case 'on':
          this.stopBlinking();
          this.line.setValue(0);
          break;
        case 'blinkSlow':
          if (this.currentInterval !== 1000) {
            this.blink(1000);
          }
          break;
        case 'blinkFast':
          if (this.currentInterval !== 200) {
            this.blink(200);
          }
          break;
        default:
          this.stopBlinking();
          this.line.setValue(0);
          break;
      }
    }, 50);
  }

  blink(interval) {
    this.stopBlinking();
    
    let blinkCount = 0;
    this.currentInterval = interval;
    

    this.blinkInterval = setInterval(() => {
      this.line.setValue(this.line.getValue() === 0 ? 1 : 0);
      blinkCount++;
      
      if (blinkCount >= this.blinkingTimes * 2) { // *2 because each blink involves two toggles (on/off)
        this.stopBlinking();
        this.setState('off'); // Set state to 'off' to stop blinking
       
      }
    }, interval);
  }

  stopBlinking() {
    if (this.blinkInterval) {
      clearInterval(this.blinkInterval);
      this.blinkInterval = null;
      this.currentInterval = null;
    }
  }

  setState(state, blinkingTimes = Infinity) {
    if (['off', 'on', 'blinkSlow', 'blinkFast'].includes(state)) {
      this.state = state;
      this.blinkingTimes = blinkingTimes;
      // console.log(this.blinkingTimes)
      if (state !== 'blinkSlow' && state !== 'blinkFast') {
        this.stopBlinking();
      }
    } else {
      console.error(`Invalid state: ${state}`);
    }
  }

  cleanup() {
    this.stopBlinking();
    this.line.setValue(0);
  }
}

// Example usage:
// const gpioPin = process.env.LED_PIN;  // Replace with the actual GPIO pin number
// const led = new LED(gpioPin);

// // Set the LED to blink fast for 5 times
// led.setState('blinkFast', 5);

// // Change the state to light up after 5 seconds
// setTimeout(() => {
//   led.setState('on');
// }, 5000);

// // Change the state to blink slow after 10 seconds
// setTimeout(() => {
//   led.setState('blinkSlow', 10);
// }, 10000);

// // Turn off the LED after 15 seconds
// setTimeout(() => {
//   led.setState('off');
// }, 15000);

// process.on('SIGINT', () => {
//   led.cleanup();
//   process.exit();
// });
