"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWebServer = void 0;
const http = require("http");
function startWebServer() {
    if (!process.env.PORT || isNaN(Number.parseInt(process.env.PORT)))
        return;
    console.info("Starting web server on port " + process.env.PORT);
    http.createServer((req, res) => {
        res.write("pong");
        res.end();
    }).listen(process.env.PORT);
}
exports.startWebServer = startWebServer;
//# sourceMappingURL=webServer.js.map