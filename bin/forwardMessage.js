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
exports.forwardMessage = void 0;
const Discord = require("discord.js");
const webhookManager_1 = require("./webhookManager");
const newFeatures_1 = require("./newFeatures");
function forwardMessage(channel, message, options, edit) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    return __awaiter(this, void 0, void 0, function* () {
        let hook = options.webhook && (yield (0, webhookManager_1.fetchWebhook)(channel));
        if (options.webhook && !hook) {
            return forwardMessageWebhookFailed(channel, message, options, edit);
        }
        let { author, attachments } = message;
        let { username } = author;
        let avatarURL = (_c = (_b = (_a = options.avatars) === null || _a === void 0 ? void 0 : _a[channel.id]) !== null && _b !== void 0 ? _b : options.webhookAvatarURL) !== null && _c !== void 0 ? _c : author.displayAvatarURL();
        let content = "";
        let embeds = [];
        let allowedMentions = { users: [] };
        if (options.allowMentions) {
            allowedMentions = undefined;
        }
        if (!((_d = options.copyAttachments) !== null && _d !== void 0 ? _d : true)) {
            attachments = new Discord.Collection();
        }
        if ((_e = options.copyEmbed) !== null && _e !== void 0 ? _e : true) {
            embeds.push(...message.embeds);
        }
        if (options.embed) {
            let embed = new Discord.MessageEmbed()
                .setColor((_f = options.embed.color) !== null && _f !== void 0 ? _f : "#2F3136")
                .setTitle((_g = options.embed.title) !== null && _g !== void 0 ? _g : "Forwarded message:")
                .setDescription(message.content);
            ((_h = options.embed) === null || _h === void 0 ? void 0 : _h.timestamp) && embed.setTimestamp(message.createdAt);
            ((_j = options.embed) === null || _j === void 0 ? void 0 : _j.author) && embed.setAuthor(username + "#" + author.discriminator, avatarURL, message.url);
            ((_l = (_k = options.embed) === null || _k === void 0 ? void 0 : _k.fields) === null || _l === void 0 ? void 0 : _l.author) && embed.addField('Author', "<@" + author.id + ">", true);
            ((_o = (_m = options.embed) === null || _m === void 0 ? void 0 : _m.fields) === null || _o === void 0 ? void 0 : _o.server) && embed.addField('Server', message.guild.name, true);
            ((_q = (_p = options.embed) === null || _p === void 0 ? void 0 : _p.fields) === null || _q === void 0 ? void 0 : _q.channel) && embed.addField('Channel', "#" + message.channel.name, true);
            embeds.push(embed);
        }
        else {
            content = message.content;
            if (options.includeAuthorAsEmbed) {
                embeds.push(new Discord.MessageEmbed()
                    .setColor("#2F3136")
                    .setAuthor(username + "#" + author.discriminator, avatarURL, message.url));
            }
        }
        let embedLimit = hook ? 10 : 1;
        if (embeds.length > embedLimit) {
            console.error("Too many embeds! Removing last embeds: " + embeds.length + " > " + embedLimit);
            embeds = embeds.slice(0, embedLimit);
        }
        if (options.includeAuthor || options.includeAuthorTag || options.includeChannel) {
            content += "\n\n";
        }
        if (options.includeAuthor) {
            content += " *" + username + "#" + author.discriminator + "*";
        }
        if (options.includeAuthorTag) {
            content += " <@" + author.id + ">";
        }
        if (options.includeChannel) {
            content += " in *#" + message.channel.name + "*";
        }
        let files = Array.from(attachments.values());
        const { link1, link2, blockedUser = [], texts = [], onlyBot, removeMedia } = options.filters || {};
        if (link1 && (0, newFeatures_1.hasHttpLinks)(content)) {
            console.log("IGNORED MESSAGE CAUSE filter link1");
            return;
        }
        if (link2) {
            content = (0, newFeatures_1.removeHttpLinks)(content);
        }
        if ((blockedUser === null || blockedUser === void 0 ? void 0 : blockedUser.length) && blockedUser.includes(message.author.username)) {
            console.log('USER BLOCKED', blockedUser);
            return;
        }
        if (texts === null || texts === void 0 ? void 0 : texts.length) {
            for (let text of texts) {
                if (content.includes(text)) {
                    console.log("BLOCKED CONTENT: ", text);
                    return;
                }
            }
        }
        if (onlyBot && !(message.author.bot || !!message.webhookID)) {
            console.log("IGNORED MESSAGE: only bot acceptable");
            return;
        }
        if (removeMedia === null || removeMedia === void 0 ? void 0 : removeMedia.length) {
            const formats = removeMedia.map(media => {
                return {
                    "image": ['webp', 'jpg', 'jpeg', 'png'],
                    'gif': ['gif'],
                    'video': ['mp4', 'mkv', 'avi', 'mov']
                }[media];
            }).flat();
            files = files.filter(f => {
                const format = (f.name + "").split(".").pop();
                return !formats.includes(format);
            });
        }
        if (hook) {
            let sendHook = () => __awaiter(this, void 0, void 0, function* () {
                var _r;
                if (!hook)
                    throw "Not hook";
                let usernameDisplay = ((_r = options.webhookUsername) !== null && _r !== void 0 ? _r : username) + (options.webhookUsernameChannel ? " - #" + message.channel.name : "");
                if (!edit) {
                    return {
                        msg: yield hook.send(content, {
                            files,
                            embeds,
                            username: usernameDisplay,
                            avatarURL,
                            allowedMentions
                        }),
                        options
                    };
                }
                else {
                    yield edit.edit(content, { files, embeds, username: usernameDisplay, avatarURL, allowedMentions });
                    return { msg: edit, options };
                }
            });
            try {
                return yield sendHook();
            }
            catch (e) {
                console.error("Failed to " + (edit ? "edit" : "send") + " hook message! Retrying in 15 seconds.");
                yield sleep(15000);
                try {
                    return yield sendHook();
                }
                catch (e) {
                    if (edit) {
                        console.error("Failed to edit webhook message. Skipping this message.");
                        throw "Failed to edit webhook message";
                    }
                    console.error("Failed to send hook message again! Sending without webhook.");
                    return yield forwardMessageWebhookFailed(channel, message, options, edit);
                }
            }
        }
        if (!edit) {
            return {
                msg: yield channel.send(content, { files, embed: embeds[0], allowedMentions }),
                options
            };
        }
        else {
            yield edit.edit(content, { files, embed: embeds[0] });
            return { msg: edit, options };
        }
    });
}
exports.forwardMessage = forwardMessage;
function forwardMessageWebhookFailed(channel, message, options, edit) {
    let includeAuthorAsEmbed = options.includeAuthorAsEmbed || !options.webhookUsername;
    if (options.includeAuthor || options.includeAuthorTag) {
        includeAuthorAsEmbed = false;
    }
    return forwardMessage(channel, message, Object.assign(Object.assign({}, options), { webhook: false, includeAuthorAsEmbed }), edit);
}
let sleep = (ms) => new Promise(res => setTimeout(res, ms));
//# sourceMappingURL=forwardMessage.js.map