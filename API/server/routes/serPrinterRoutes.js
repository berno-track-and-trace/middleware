import printProcessController from '../controllers/serPrinter/printProcessController.js'
import TiJPrinterProcessController from '../controllers/serPrinter/TiJPrinterProcessController.js'

/**
 * @param {e.Application} app
 */
export default function printRoutes(app) {
    app.route("/v1/printer/start")
        .post(printProcessController.startPrinting)
    app.route("/v1/printer/stop")
        .post(printProcessController.stopPrinting)
    app.route("/v1/printer/toggletonotreceive")
        .post(printProcessController.toggleToNotReceive)
    app.route("/v1/printer/status")
        .get(TiJPrinterProcessController.getPriterStatus)

}
