import masterConfigController from '../controllers/master-config/masterConfigController.js'

/**
 * @param {e.Application} app
 */
export default function masterConfigRoutes(app) {
    app.route("/v1/master-config")
        .get(masterConfigController.getAllConfigParameters)
        .put(masterConfigController.changeParameter)
    app.route("/v1/master-config:KEY")
        .get(masterConfigController.getConfigParameterByKey)

}