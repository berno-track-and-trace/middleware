import masterConfigController from '../controllers/master-config/masterConfigController.js'

/**
 * @param {e.Application} app
 */
export default function masterConfigRoutes(app) {
    app.route("/v1/master-config")
        .get(masterConfigController.getAllConfigParameters)
        .put(masterConfigController.setConfig)
    app.route("/v1/master-config/set-job-details")
        .put(masterConfigController.setJobDetails)
    app.route("/v1/master-config/clear-job-details")
        .put(masterConfigController.clearJobDetails)
    app.route("/v1/master-config:KEY")
        .get(masterConfigController.getConfigParameterByKey)

}