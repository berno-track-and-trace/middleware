import serCamController from '../controllers/serCam/serCamController.js'

/**
 * @param {e.Application} app
 */
export default function qrCsvRoutes(app) {
    app.route("/v1/sercam/:workstationId/accuracylevel/:accuracy")
        .put(serCamController.setAccuracyThreshold)
    
}
