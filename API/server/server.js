import express from 'express';
import routesv1 from './masterRoutes.js';


const app = express();


// Middleware to parse JSON bodies
app.use(express.json());

// Define API routes
routesv1(app);

// Start the server
 function startHTTPServer(port) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
export {app, startHTTPServer};
