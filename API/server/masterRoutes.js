
import qrCsvRoutes from "./routes/qrCsvRoutes.js";
//import testRoute from "./routes/testRoute.js"
import printRoute from "./routes/serPrinterRoutes.js"

export default function initializeRoutes(app) {
    qrCsvRoutes(app);
    //testRoute(app);
    printRoute(app);

}
