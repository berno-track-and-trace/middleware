import main from './index.js'

let testInstance;

async function setInstances() {
    testInstance = await main();
  }

setInstances();

export default testInstance
