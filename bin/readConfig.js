"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateConfig = exports.readConfig = void 0;
const fs = require("fs-extra");
function readConfig() {
    return __awaiter(this, void 0, void 0, function* () {
        if (process.env.ECHOBOT_CONFIG_JSON) {
            return JSON.parse(process.env.ECHOBOT_CONFIG_JSON);
        }
        if (!(yield fs.stat("./config.json")).isFile())
            throw "config: file not found";
        let config = yield fs.readJson("./config.json").catch(error => {
            console.error("config: check for syntax errors");
            throw error;
        });
        if (typeof config.token != "string")
            throw "config: `token` is missing";
        if (!Array.isArray(config.redirects))
            throw "config: `redirects` is not an array or is undefined";
        return config;
    });
}
exports.readConfig = readConfig;
function updateConfig(func) {
    return __awaiter(this, void 0, void 0, function* () {
        const configPath = process.cwd() + "/config.json";
        let config = JSON.parse(fs.readFileSync(configPath).toString() || "{}");
        const final = func(config);
        final.catch(console.error).then(config => {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log("Config Updated");
        });
    });
}
exports.updateConfig = updateConfig;
//# sourceMappingURL=readConfig.js.map