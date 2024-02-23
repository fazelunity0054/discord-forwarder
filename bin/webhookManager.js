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
exports.fetchWebhook = void 0;
let cachedWebhooks = new Map();
function fetchWebhook(channel) {
    return __awaiter(this, void 0, void 0, function* () {
        let webhook = cachedWebhooks.get(channel.id);
        if (webhook === null)
            return undefined;
        try {
            if (!webhook) {
                let webhooks = yield channel.fetchWebhooks();
                webhook = webhooks.first();
            }
        }
        catch (e) {
            console.error("Couldn't fetch webhooks!");
            warnWebhooks();
            console.error(e);
            cachedWebhooks.set(channel.id, null);
            return undefined;
        }
        try {
            if (!webhook) {
                webhook = yield channel.createWebhook("EchoBot Webhook");
            }
        }
        catch (e) {
            console.error("Couldn't create webhook!");
            warnWebhooks();
            console.error(e);
            cachedWebhooks.set(channel.id, null);
            return undefined;
        }
        cachedWebhooks.set(channel.id, webhook !== null && webhook !== void 0 ? webhook : null);
        return webhook;
    });
}
exports.fetchWebhook = fetchWebhook;
function warnWebhooks() {
    console.warn("\nWebhooks warning:\n" +
        "\n" +
        "This channel does not support webhooks for some reason, I will instead send messages as a Discord user/bot instead.\n" +
        "You may want to send embeds instead of using webhooks in config.json, but it's up to you what you want to do.\n" +
        "\n" +
        "");
}
//# sourceMappingURL=webhookManager.js.map