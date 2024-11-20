import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

class LowDB {
  constructor(JSONFilePath) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const file = resolve(__dirname, JSONFilePath);
    const adapter = new JSONFile(file);

    this.db = new Low(adapter, {
        printerProcess:{
            TEMPLATE_NAME:"template2"
        },
        serCam:{
            ACCURACY_THRESHOLD:0
        },
        rejector:{
            REJECTOR_DELAY1:20,
            REJECTOR_DELAY2:85
        }
    });

    
  }

  async init() {
    try {
      // Read data from JSON file
      await this.db.read();

      console.log("[LowDB] initializing is completed")
    } catch (error) {
      console.error('[LowDB] Error initializing the database:', error);
    }
  }

  // Function to get a configuration value
  getConfig(key) {
    try {
      return this.db.data[key];
    } catch (error) {
      console.error(`[LowDB] Error getting config value for key "${key}":`, error);
    }
  }

  // Function to set a configuration value
  async setConfig(key, value) {
    try {
      this.db.data[key] = value;
      await this.db.write();
    } catch (error) {
      console.error(`[LowDB] Error setting config value for key "${key}":`, error);
    }
  }

  // Function to get all configuration values
  getAllConfig() {
    try {
      return this.db.data;
    } catch (error) {
      console.error('[LowDB] Error getting all config values:', error);
    }
  }
}

export default LowDB;
