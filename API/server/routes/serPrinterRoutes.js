import printProcessController from '../controllers/serPrinter/printProcessController.js'

/**
 * @param {e.Application} app
 */
export default function printRoute(app) {
    app.route("/v1/printer/start")
        .post(printProcessController.startPrinting)
    app.route("/v1/printer/stop")
        .post(printProcessController.stopPrinting)
    app.route('/v1/printer')
        .get(printProcessController.printerDetails)

}
