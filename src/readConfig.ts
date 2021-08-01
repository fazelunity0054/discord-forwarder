import * as fs from "fs-extra";
import { Config } from "./types";

export async function readConfig() {
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
    if(config.redirects.length == 0) throw "config: `redirects` is empty";
    
    return config;
}