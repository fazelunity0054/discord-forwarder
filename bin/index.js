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
const Discord = require("discord.js");
const readConfig_1 = require("./readConfig");
const webServer_1 = require("./webServer");
const forwardMessage_1 = require("./forwardMessage");
const newFeatures_1 = require("./newFeatures");
(0, webServer_1.startWebServer)();
(0, readConfig_1.readConfig)().then((config) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    let client = new Discord.Client({});
    client.login(config.token);
    let redirects = new Map();
    for (let redirect of config.redirects) {
        if (!Array.isArray(redirect.sources))
            throw "config: redirect has no defined `sources`";
        if (!Array.isArray(redirect.destinations))
            throw "config: redirect has no defined `destinations`";
        if (redirect.sources.length == 0)
            throw "config: redirect has no `sources`";
        if (redirect.destinations.length == 0)
            throw "config: redirect has no `destinations`";
        let options = (_a = redirect.options) !== null && _a !== void 0 ? _a : {};
        for (let source of redirect.sources) {
            skip: for (let destination of redirect.destinations) {
                let data = (_b = redirects.get(source)) !== null && _b !== void 0 ? _b : [];
                for (let dataCheck of data) {
                    if (dataCheck.destination == destination) {
                        console.warn("config: redirect from `" + source + "` to `" + destination + "` is a duplicate, I will accept the only the first redirect to avoid duplicate redirects");
                        continue skip;
                    }
                }
                data.push({ destination, options });
                redirects.set(source, data);
            }
        }
    }
    let totalRedirects = 0;
    redirects.forEach(redirect => totalRedirects += redirect.length);
    console.debug("Redirects in total: " + totalRedirects);
    console.log("Discord.js is loading...");
    let channelLoadPromise;
    client.on("ready", () => __awaiter(void 0, void 0, void 0, function* () {
        var _c;
        console.log("Discord client is ready, loading channels...");
        console.log("LOGGED AS " + client.user.username);
        (0, newFeatures_1.setAvatar)(config.token);
        let channelCache = new Map();
        let loadChannelPromises = [];
        for (let redirectList of redirects) {
            for (let redirect of redirectList[1]) {
                let channelPromise = (_c = channelCache.get(redirect.destination)) !== null && _c !== void 0 ? _c : client.channels.fetch(redirect.destination);
                channelCache.set(redirect.destination, channelPromise);
                loadChannelPromises.push((() => __awaiter(void 0, void 0, void 0, function* () {
                    let channel = yield channelPromise;
                    if (isTextChannel(channel.type)) {
                        redirect.destinationChannel = channel;
                    }
                    else {
                        throw "channel `" + redirect.destination + "` is not a text channel";
                    }
                }))());
            }
            ;
        }
        ;
        channelLoadPromise = Promise.all(loadChannelPromises);
        yield channelLoadPromise;
        console.log("Channels loaded");
    }));
    let msgWatch = [];
    client.on("message", (message) => __awaiter(void 0, void 0, void 0, function* () {
        var _d, _e, _f;
        yield channelLoadPromise;
        let id = message.channel.id;
        if (message.author.id == client.user.id)
            return;
        if (message.type != "DEFAULT")
            return;
        let redirectList = redirects.get(id);
        if (!redirectList)
            return;
        let promisesMsgs = [];
        for (let { destinationChannel, options } of redirectList) {
            if (options.minLength &&
                message.content.length < options.minLength &&
                message.content.length != 0 &&
                message.attachments.size == 0)
                continue;
            if (!message.content && !((_d = options.copyEmbed) !== null && _d !== void 0 ? _d : true) && !((_e = options.copyAttachments) !== null && _e !== void 0 ? _e : true))
                continue;
            let whitelisted = false;
            if (options.allowList) {
                for (let allowed of options.allowList) {
                    if (message.author.bot) {
                        whitelisted || (whitelisted = allowed == "bot");
                        whitelisted || (whitelisted = allowed == "bots");
                    }
                    else {
                        whitelisted || (whitelisted = allowed == "human");
                        whitelisted || (whitelisted = allowed == "humans");
                    }
                    whitelisted || (whitelisted = message.author.id == allowed);
                }
            }
            else {
                whitelisted = true;
            }
            if (options.denyList) {
                for (let deny of options.denyList) {
                    if (message.author.bot) {
                        whitelisted && (whitelisted = deny != "bot");
                        whitelisted && (whitelisted = deny != "bots");
                    }
                    else {
                        whitelisted && (whitelisted = deny != "human");
                        whitelisted && (whitelisted = deny != "humans");
                    }
                    whitelisted && (whitelisted = message.author.id != deny);
                }
            }
            if (!whitelisted)
                continue;
            promisesMsgs.push({
                promise: (0, forwardMessage_1.forwardMessage)(destinationChannel, message, options, false),
                originalMessage: message
            });
        }
        for (let { promise, originalMessage } of promisesMsgs) {
            let promiseAnswer = yield promise.catch(error => {
                console.error(error);
            });
            if (!promiseAnswer)
                continue;
            let { msg, options } = promiseAnswer;
            if (((_f = options.allowEdit) !== null && _f !== void 0 ? _f : true) || options.allowDelete) {
                msgWatch.push({ message: msg, originalMessage, options });
                if (msgWatch.length > 1000) {
                    msgWatch.shift();
                }
            }
        }
    }));
    client.on("messageDelete", msg => {
        for (let { message, options, originalMessage } of msgWatch) {
            if (originalMessage.id == msg.id && originalMessage.channel.id == msg.channel.id) {
                if (options.allowDelete && message.deletable) {
                    message.delete().catch(error => { });
                }
            }
        }
    });
    client.on("messageUpdate", (oldMsg, msg) => {
        var _a;
        for (let { message, options, originalMessage } of msgWatch) {
            if (originalMessage.id == msg.id && originalMessage.channel.id == msg.channel.id) {
                if (((_a = options.allowEdit) !== null && _a !== void 0 ? _a : true) && message.editable) {
                    (0, forwardMessage_1.forwardMessage)(msg.channel, originalMessage, options, message).catch(error => {
                        console.error(error);
                    });
                }
            }
        }
    });
}));
function isTextChannel(type) {
    return type == "text";
}
//# sourceMappingURL=index.js.map