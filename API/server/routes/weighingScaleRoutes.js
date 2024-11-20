import weightScaleController from "../controllers/weight/weightScaleController.js"

/**
 * @param {e.Application} app
 */
export default function weighingscaleRoutes(app) {
    app.route("/v1/weighingscale")
        .get(weightScaleController.getWeight)



}
