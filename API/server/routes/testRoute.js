import testLahController from '../controllers/testLah/testLahController.js'

/**
 * @param {e.Application} app
 */
export default function testRoute(app) {
    app.route("/v1/test/setlen/:length")
        .post(testLahController.setLength)
    app.route("/v1/test/start")
        .post(testLahController.startLoop)   
    app.route("/v1/test/stop")
        .post(testLahController.stopLoop) 
    app.route("/v1/test/count")
        .get(testLahController.getCount)
}
