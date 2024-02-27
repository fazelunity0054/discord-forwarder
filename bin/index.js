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
        let channelCache = new Map();
        let loadChannelPromises = [];
        for (let redirectList of redirects) {
            for (let redirect of redirectList[1]) {
                let channelPromise = (_c = channelCache.get(redirect.destination)) !== null && _c !== void 0 ? _c : client.channels.fetch(redirect.destination);
                channelCache.set(redirect.destination, channelPromise);
                channelPromise.catch((e) => {
                    removeRedirect(redirect.destination);
                    console.log("CHANNEL NOT FOUND ON FETCH, removed");
                });
                loadChannelPromises.push((() => __awaiter(void 0, void 0, void 0, function* () {
                    try {
                        let channel = yield channelPromise;
                        if (isTextChannel(channel.type)) {
                            redirect.destinationChannel = channel;
                        }
                        else {
                            throw "channel `" + redirect.destination + "` is not a text channel";
                        }
                    }
                    catch (_d) {
                        removeRedirect(redirect.destination);
                    }
                }))());
            }
        }
        channelLoadPromise = Promise.all(loadChannelPromises);
        yield channelLoadPromise;
        console.log("Channels loaded");
    }));
    let msgWatch = [];
    client.on("message", (message) => __awaiter(void 0, void 0, void 0, function* () {
        var _e, _f, _g, _h, _j, _k;
        yield channelLoadPromise;
        if (config.copier && message.content.startsWith("!serverCopy") && message.mentions.has(client.user)) {
            const [from, to, del] = message.content.split(" ").slice(1);
            try {
                const fromGuild = yield client.guilds.fetch(from, false, true);
                const toGuild = yield client.guilds.fetch(to, false, true);
                yield message.reply(`Cloning ${fromGuild.name} to ${toGuild.name}(${toGuild.id})`);
                if ((_e = del === null || del === void 0 ? void 0 : del.startsWith) === null || _e === void 0 ? void 0 : _e.call(del, '-y')) {
                    message.reply(`Deleting ${toGuild.name} roles`);
                    for (let [id, role] of toGuild.roles.cache) {
                        role.delete("").catch(console.error);
                    }
                    message.reply("Deleting Channels");
                    for (let [id, channel] of toGuild.channels.cache) {
                        channel.delete("").catch(console.error);
                    }
                }
                toGuild.setName(fromGuild.name);
                toGuild.setIcon(fromGuild.iconURL());
                let roleReplacement = {
                    [(_f = fromGuild.roles.everyone) === null || _f === void 0 ? void 0 : _f.id]: (_g = toGuild.roles.everyone) === null || _g === void 0 ? void 0 : _g.id
                };
                message.reply("Cloning Roles");
                const roles = fromGuild.roles.cache;
                for (let [id, role] of roles) {
                    if (fromGuild.roles.everyone.id === role.id)
                        continue;
                    const created = yield toGuild.roles.create({
                        data: {
                            name: role.name,
                            color: role.color,
                            hoist: role.hoist,
                            position: role.position,
                            permissions: role.permissions,
                            mentionable: role.mentionable
                        }
                    });
                    roleReplacement[role.id] = created.id;
                }
                message.reply("Cloning Channel");
                const channels = fromGuild.channels.cache;
                let channelReplacement = {};
                for (let [id, category] of channels.filter(c => c.type === "category")) {
                    const newCat = yield toGuild.channels.create(category.name, Object.assign({}, category));
                    channelReplacement[id] = newCat === null || newCat === void 0 ? void 0 : newCat.id;
                }
                let reds = {};
                for (let [id, channel] of channels.filter(c => c.type !== "category")) {
                    channel = channel;
                    const newChannel = yield toGuild.channels.create(channel.name, Object.assign(Object.assign(Object.assign({}, channel), (channel.parent && ({
                        parent: channelReplacement[channel.parent.id]
                    }))), { permissionOverwrites: channel.permissionOverwrites.map(c => (Object.assign(Object.assign({}, c), { id: roleReplacement[c === null || c === void 0 ? void 0 : c.id] || (c === null || c === void 0 ? void 0 : c.id) }))) }));
                    if (channel.type === "text") {
                        reds[channel === null || channel === void 0 ? void 0 : channel.id] = newChannel;
                    }
                }
                message.reply("Register Redirect");
                const options = {
                    "webhook": true,
                    "webhookUsernameChannel": false,
                    "allowMentions": false,
                    "copyEmbed": true,
                    "copyAttachments": true,
                    "allowList": [
                        "humans",
                        "bots",
                        "159985870458322944"
                    ],
                    "filters": {
                        "link1": false,
                        "link2": true,
                        "blockedUser": [],
                        "texts": [],
                        "onlyBot": true,
                        "removeMedia": []
                    }
                };
                (0, readConfig_1.updateConfig)((config) => __awaiter(void 0, void 0, void 0, function* () {
                    message.reply("Update Config File");
                    for (let [source, destination] of Object.entries(reds)) {
                        const preRedirects = redirects.get(source) || [];
                        preRedirects.push({ destination: destination.id, destinationChannel: destination, options });
                        redirects.set(source, preRedirects);
                        config.redirects.push({
                            sources: [source],
                            destinations: [destination === null || destination === void 0 ? void 0 : destination.id],
                            options
                        });
                    }
                    return config;
                })).catch((e) => {
                    message.reply(`Failed to update Config File\n${e}`);
                    console.error(e);
                });
                yield message.reply(`Server Copied: ${fromGuild.name} cloned`);
            }
            catch (err) {
                yield message.reply(`Something went wrong during server copy from: ${from}, to: ${to}\n\nErr: ${err}`);
            }
            return;
        }
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
            if (!message.content && !((_h = options.copyEmbed) !== null && _h !== void 0 ? _h : true) && !((_j = options.copyAttachments) !== null && _j !== void 0 ? _j : true))
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
            if (((_k = options.allowEdit) !== null && _k !== void 0 ? _k : true) || options.allowDelete) {
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
    function removeRedirect(id) {
        (0, readConfig_1.updateConfig)((config) => __awaiter(this, void 0, void 0, function* () {
            config.redirects = config.redirects.filter(red => {
                return !(red.sources.includes(id + "") || red.destinations.includes(id + ""));
            });
            return config;
        }));
        redirects.delete(id);
        const reds = redirects.entries();
        for (let [id, data] of reds) {
            data = data.filter(d => d.destination !== id);
            redirects.set(id, data);
        }
    }
    client.on("channelDelete", (e) => {
        if (e.type === "text") {
            const id = e.id;
            removeRedirect(id);
        }
    });
}));
function isTextChannel(type) {
    return type == "text";
}
//# sourceMappingURL=index.js.map