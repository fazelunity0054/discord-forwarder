import * as Discord from 'discord.js-self';
import { SendableChannel } from './types';

let cachedWebhooks: Map<string, Discord.Webhook> = new Map();

export async function fetchWebhook(channel: SendableChannel): Promise<Discord.Webhook | undefined> {
    let webhook: Discord.Webhook = cachedWebhooks.get(channel.id);
    if(webhook === null) return undefined;
    try{
        if(!webhook){
            let webhooks = await channel.fetchWebhooks();

            // use first webhook if it exists
            webhook = webhooks.first();
        }
    }catch(e){
        console.error("Couldn't fetch webhooks!");
        warnWebhooks();
        console.error(e);
        cachedWebhooks.set(channel.id, null);
        return undefined;
    }
    try{
        // try creating webhook
        if(!webhook){
            webhook = await channel.createWebhook("EchoBot Webhook");
        }
    }catch(e){
        console.error("Couldn't create webhook!");
        warnWebhooks();
        console.error(e);
        cachedWebhooks.set(channel.id, null);
        return undefined;
    }
    cachedWebhooks.set(channel.id, webhook ?? null);
    return webhook;
}

function warnWebhooks(){
    console.warn(
        "\nWebhooks warning:\n"+
        "\n"+
        "This channel does not support webhooks for some reason, I will instead send messages as a Discord user/bot instead.\n"+
        "You may want to send embeds instead of using webhooks in config.json, but it's up to you what you want to do.\n"+
        "\n"+
        ""
    )
}