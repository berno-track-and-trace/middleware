


import printRoutes from "./routes/serPrinterRoutes.js"
import masterConfigRoutes from "./routes/masterConfigRoutes.js";
import weighingscaleRoutes from "./routes/weighingScaleRoutes.js";

export default function initializeRoutes(app) {

    masterConfigRoutes(app);
    printRoutes(app);
    weighingscaleRoutes(app);

}
