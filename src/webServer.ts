import * as http from "http";

/**
 * Starts the web server that accepts ping messages, if the PORT environment variable is defined.
 *
 * The purpose of this server is to allow the bot to be used on PaaS infrastructures like Heroku,
 * which expect applications to bind to a web port -- as well as allowing for uptime monitoring.
 */
export function startWebServer(): void {

    // Ensure PORT env var is defined.
    if (!process.env.PORT || isNaN(Number.parseInt(process.env.PORT)))
        return;

    console.info("Starting web server on port " + process.env.PORT);

    // Create a server and bind it to the environment variable PORT.
    http.createServer((req, res) => {
        res.write("pong");
        res.end();
    }).listen(process.env.PORT);
}