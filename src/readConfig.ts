import * as fs from "fs-extra";
import { Config } from "./types";

export async function readConfig() {
    if (process.env.ECHOBOT_CONFIG_JSON) {
        return JSON.parse(process.env.ECHOBOT_CONFIG_JSON);
    }

    // check if file exists
    if(!(await fs.stat("./config.json")).isFile()) throw "config: file not found";

    let config = await fs.readJson("./config.json").catch(error => {
        // JSON is invalid
        console.error("config: check for syntax errors");
        throw error;
    }) as Config;

    // check main config values
    if(typeof config.token != "string") throw "config: `token` is missing";
    if(!Array.isArray(config.redirects)) throw "config: `redirects` is not an array or is undefined";

    return config;
}

export async function updateConfig(func: (config: Config) => Promise<Config>) {
    const configPath = process.cwd()+"/config.json";
    let config = JSON.parse(fs.readFileSync(configPath).toString() || "{}");
    const final = func(config);
    final.catch(console.error).then(config => {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
        console.log("Config Updated");
    })
}
