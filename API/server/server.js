import express from 'express';
import routesv1 from './masterRoutes.js';
import { apiServerLogger } from '../../utils/logger.js';
import { beWS } from '../../utils/globalEventEmitter.js';

const app = express();


// Middleware to parse JSON bodies
app.use(express.json());

// Define API routes
routesv1(app);

// Start the server
 function startHTTPServer(port) {
  app.listen(port, () => {
    apiServerLogger.info(`Server is running on port ${port}`);
    beWS.emit('serverReady')
  });
}
export {app, startHTTPServer};
