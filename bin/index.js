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
(0, readConfig_1.readConfig)().then(handleBotStart);
function isTextChannel(type) {
    return type == "text";
}
const defaultOptions = {
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
        "link2": false,
        "blockedUser": [],
        "texts": [],
        
        "removeMedia": []
    }
};
function handleBotStart(config) {
    let client = new Discord.Client({});
    client.login(config.token);
    let redirects = new Map();
    (0, readConfig_1.updateConfig)((config) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
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
                            removeRedirect(source, config);
                            config.redirects.push({
                                sources: [source],
                                destinations: [destination],
                                options: options
                            });
                            continue skip;
                        }
                    }
                    data.push({ destination, options });
                    redirects.set(source, data);
                }
            }
        }
        return config;
    })).finally(() => {
        console.log("Duplicate Check finished");
    });
    let totalRedirects = 0;
    redirects.forEach(redirect => totalRedirects += redirect.length);
    console.debug("Redirects in total: " + totalRedirects);
    console.log("Discord.js is loading...");
    let channelLoadPromise;
    client.on("ready", () => __awaiter(this, void 0, void 0, function* () {
        var _c;
        console.log("Discord client is ready, loading channels...");
        console.log("LOGGED AS " + client.user.username);
        (0, newFeatures_1.registerConsoleLog)(client);
        if (!config.redirects.length) {
            console.log("NO REDIRECT FOUND");
            return;
        }
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
                loadChannelPromises.push((() => __awaiter(this, void 0, void 0, function* () {
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
    client.on("message", (message) => __awaiter(this, void 0, void 0, function* () {
        var _e, _f, _g, _h, _j, _k;
        try {
            if (channelLoadPromise)
                yield channelLoadPromise;
        }
        catch (e) {
            console.error(e);
        }
        if ((message.content.startsWith("!serverCopy") || message.content.startsWith("!optimize") || message.content.startsWith("!setRedirects") || message.content.startsWith("!details")) && message.mentions.has(client.user)) {
            const [command, from, to, del] = message.content.split(" ");
            try {
                const fromGuild = yield client.guilds.fetch(from, false, true);
                const toGuild = yield client.guilds.fetch(to, false, true);
                if (command === "!setRedirects") {
                    message.reply(`Setup message redirect from ${fromGuild.name} to ${toGuild.name}...`);
                    const textChannels = fromGuild.channels.cache.filter(c => c.type === "text");
                    let n = 0;
                    yield (0, readConfig_1.updateConfig)((config) => __awaiter(this, void 0, void 0, function* () {
                        for (let [id, channel] of textChannels) {
                            const created = toGuild.channels.cache.find(c => c.type === "text" && c.name === channel.name);
                            if (!created)
                                continue;
                            removeRedirect(id, config);
                            removeRedirect(created.id, config);
                            registerRedirect(channel.id, created, defaultOptions);
                            config.redirects.push({
                                sources: [channel.id],
                                destinations: [created.id],
                                options: defaultOptions
                            });
                            n++;
                        }
                        return config;
                    })).catch((e) => {
                        message.reply(`FAILED TO UPDATE CONFIG FILE\n${e}`);
                    });
                    message.reply("Setup Finished Total Redirects: " + n);
                    return;
                }
                if (command === '!details') {
                    const channel = message.channel;
                    const echo = (obj) => `${'```json\n'}${JSON.stringify(obj, null, 2)}${"\n```"}`;
                    let redirectsObj = {};
                    redirects.forEach((v, k) => {
                        redirectsObj[k] = v;
                    });
                    const source = redirectsObj[channel.id];
                    const destinations = Object.fromEntries(Object.entries(redirectsObj).filter(([key, value]) => {
                        return value.find(d => d.destination === channel.id);
                    }));
                    let content = `
					isSource: ${(!!source) + ""}
					become From: ${(yield Promise.all(Object.keys(destinations).map(id => client.channels.fetch(id, false, true).catch(() => false)))).filter(Boolean).map((c) => { var _a; return `${c === null || c === void 0 ? void 0 : c.name} => ${(_a = c === null || c === void 0 ? void 0 : c.guild) === null || _a === void 0 ? void 0 : _a.name}`; }).join("\n")}
					
					`;
                    yield message.channel.send(content);
                    return;
                }
                if (command === "!optimize") {
                    message.reply(`OPTIMIZE OPERATION STARTED [${fromGuild.name} with ${toGuild.name}]`);
                    let roleReplacement = {};
                    message.reply(`Optimize Positions...`);
                    for (let [id, role] of fromGuild.roles.cache.sort((a, b) => a.position > b.position ? -1 : 1)) {
                        const created = toGuild.roles.cache.find(r => r.name === role.name);
                        if (!created)
                            continue;
                        roleReplacement[id] = created.id;
                        try {
                            yield created.setPosition(role.position);
                        }
                        catch (_l) {
                        }
                    }
                    message.reply(`Optimize Overrides...`);
                    for (let [id, channel] of fromGuild.channels.cache) {
                        const created = toGuild.channels.cache.find(c => c.name === channel.name);
                        if (!created)
                            continue;
                        try {
                            yield created.overwritePermissions(channel.permissionOverwrites.map(c => (Object.assign(Object.assign({}, c), { id: roleReplacement[c === null || c === void 0 ? void 0 : c.id] || (c === null || c === void 0 ? void 0 : c.id) }))));
                        }
                        catch (e) {
                            console.error(e);
                        }
                    }
                    message.reply("Optimize Finished");
                    return;
                }
                yield message.reply(`Cloning ${fromGuild.name} to ${toGuild.name}(${toGuild.id})`);
                if ((_e = del === null || del === void 0 ? void 0 : del.startsWith) === null || _e === void 0 ? void 0 : _e.call(del, '-y')) {
                    message.reply(`Deleting ${toGuild.name} roles`);
                    for (let [id, role] of toGuild.roles.cache) {
                        try {
                            yield role.delete("").catch(console.error);
                        }
                        catch (_m) {
                        }
                    }
                    message.reply("Deleting Channels");
                    for (let [id, channel] of toGuild.channels.cache) {
                        try {
                            yield channel.delete("").catch(console.error);
                        }
                        catch (_o) {
                        }
                    }
                }
                toGuild.setName(fromGuild.name);
                toGuild.setIcon(fromGuild.iconURL());
                let roleReplacement = {
                    [(_f = fromGuild.roles.everyone) === null || _f === void 0 ? void 0 : _f.id]: (_g = toGuild.roles.everyone) === null || _g === void 0 ? void 0 : _g.id
                };
                message.reply("Cloning Roles");
                const roles = fromGuild.roles.cache;
                for (let [id, role] of roles.sort((a, b) => a.position < b.position ? 0 : 1)) {
                    if (fromGuild.roles.everyone.id === role.id)
                        continue;
                    console.log(`CREATING ROLE \`${role.name}\``);
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
                    console.log(`CREATING CATEGORY \`${category.name}\``);
                    const newCat = yield toGuild.channels.create(category.name, Object.assign({}, category));
                    channelReplacement[id] = newCat === null || newCat === void 0 ? void 0 : newCat.id;
                }
                let reds = {};
                for (let [id, channel] of channels.filter(c => c.type === "text" || c.type === "voice")) {
                    channel = channel;
                    console.log(`CREATING CHANNEL[${channel.type}] <#${id}>`);
                    try {
                        const newChannel = yield toGuild.channels.create(channel.name, Object.assign(Object.assign(Object.assign(Object.assign({}, channel), (channel.parent && ({
                            parent: channelReplacement[channel.parent.id]
                        }))), { permissionOverwrites: channel.permissionOverwrites.map(c => (Object.assign(Object.assign({}, c), { id: roleReplacement[c === null || c === void 0 ? void 0 : c.id] || (c === null || c === void 0 ? void 0 : c.id) }))) }), (channel.type === "voice" && ({
                            bitrate: 96000
                        }))));
                        if (channel.type === "text") {
                            reds[channel === null || channel === void 0 ? void 0 : channel.id] = newChannel;
                        }
                    }
                    catch (e) {
                        message.reply(`Failed to copy <#${channel.id}>\n\n${e}`);
                        console.error(e);
                    }
                }
                message.reply("Register Redirect");
                (0, readConfig_1.updateConfig)((config) => __awaiter(this, void 0, void 0, function* () {
                    message.reply("Update Config File");
                    for (let [source, destination] of Object.entries(reds)) {
                        registerRedirect(source, destination, defaultOptions);
                        config.redirects.push({
                            sources: [source],
                            destinations: [destination === null || destination === void 0 ? void 0 : destination.id],
                            options: defaultOptions
                        });
                    }
                    return config;
                })).catch((e) => {
                    message.reply(`Failed to update Config File\n${e}`);
                    console.error(e);
                });
                yield message.reply(`Server Copied: ${fromGuild.name} cloned`);
                message.channel.send(`!optimize ${fromGuild.id} ${toGuild.id} <@${client.user.id}>`);
            }
            catch (err) {
                console.error(err);
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
                    message.delete().catch(error => {
                    });
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
    function removeRedirect(id, config = {}) {
        if (Object.keys(config || {}).length) {
            config.redirects = config.redirects.filter(red => {
                return !(red.sources.includes(id + "") || red.destinations.includes(id + ""));
            });
        }
        else {
            (0, readConfig_1.updateConfig)((config) => __awaiter(this, void 0, void 0, function* () {
                config.redirects = config.redirects.filter(red => {
                    return !(red.sources.includes(id + "") || red.destinations.includes(id + ""));
                });
                return config;
            }));
        }
        redirects.delete(id);
        const reds = redirects.entries();
        for (let [id, data] of reds) {
            data = data.filter(d => d.destination !== id);
            redirects.set(id, data);
        }
    }
    function registerRedirect(source, destination, options) {
        const preRedirects = redirects.get(source) || [];
        preRedirects.push({ destination: destination.id, destinationChannel: destination, options });
        redirects.set(source, preRedirects);
    }
    client.on("channelDelete", (e) => {
        if (e.type === "text") {
            const id = e.id;
            removeRedirect(id);
        }
    });
    client.on('disconnect', () => {
        console.log('GOT DISCONNECTED AT', new Date().toLocaleString('fa'), new Date().toLocaleString());
        console.log("Retry...");
        handleBotStart(config);
    });
    client.on('error', console.log);
}
//# sourceMappingURL=index.js.map
