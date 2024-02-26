import * as Discord from 'discord.js';
import { readConfig } from "./readConfig";
import {Config, ConfigOptions, SendableChannel} from "./types";
import { startWebServer } from "./webServer";
import { forwardMessage } from "./forwardMessage";
import {setAvatar} from "./newFeatures";
import {TextChannel, VoiceChannel} from "discord.js";
import * as fs from "fs";

startWebServer();

readConfig().then(async (config) => {

    // load Discord.js client
    let client = new Discord.Client({
    });
    client.login(config.token);

    let redirects: Map<
        string, // source channel
        Array<{
            destination: string
            destinationChannel?: SendableChannel
            options: ConfigOptions
        }>
    > = new Map();

    // loop through redirects and put them in a Map
    for(let redirect of config.redirects){

        // check if redirect is valid
        if(!Array.isArray(redirect.sources)) throw "config: redirect has no defined `sources`";
        if(!Array.isArray(redirect.destinations)) throw "config: redirect has no defined `destinations`";
        if(redirect.sources.length==0) throw "config: redirect has no `sources`";
        if(redirect.destinations.length==0) throw "config: redirect has no `destinations`";

        let options: ConfigOptions = redirect.options ?? {};
        for(let source of redirect.sources){
            skip: for(let destination of redirect.destinations){
                let data = redirects.get(source) ?? [];

                // skip duplicate redirects
                for(let dataCheck of data){
                    if(dataCheck.destination==destination){
                        console.warn("config: redirect from `"+source+"` to `"+destination+"` is a duplicate, I will accept the only the first redirect to avoid duplicate redirects");
                        continue skip;
                    }
                }

                data.push({ destination, options });
                redirects.set(source, data);
            }
        }
    }

    // count redirects (optional code)
    let totalRedirects = 0;
    redirects.forEach(redirect => totalRedirects += redirect.length);
    console.debug("Redirects in total: "+totalRedirects);

    // wait until Discord client loads
    console.log("Discord.js is loading...");
    let channelLoadPromise: Promise<void[]>;
    client.on("ready", async () => {
        console.log("Discord client is ready, loading channels...");
        console.log("LOGGED AS "+client.user.username)
        // we need this since we disabled all discord.js caching
        let channelCache: Map<string, Promise<SendableChannel>> = new Map();

        // this is meant for loading channels if used cache-less discord.js
        let loadChannelPromises: Promise<void>[] = [];
        for(let redirectList of redirects){
            for(let redirect of redirectList[1]){

                let channelPromise = channelCache.get(redirect.destination) ?? client.channels.fetch(redirect.destination);
                channelCache.set(redirect.destination, channelPromise as Promise<SendableChannel>);

                loadChannelPromises.push((async ()=>{
                    let channel = await channelPromise;
                    if (isTextChannel(channel.type)) {
                        redirect.destinationChannel = channel as Discord.TextChannel;
                    }else{
                        throw "channel `"+redirect.destination+"` is not a text channel";
                    }
                })());

            };
        };
        channelLoadPromise = Promise.all(loadChannelPromises);
        await channelLoadPromise;
        console.log("Channels loaded");
    });

    // watch messages for edits and deletions
    let msgWatch: { message: Discord.Message, originalMessage: Discord.Message, options: ConfigOptions }[] = [];
    client.on("message", async message => {
        // wait while channels are still loading
        await channelLoadPromise;

        if (config.copier && message.content.startsWith("!serverCopy")) {
            const [from, to] = message.content.split(" ").slice(1,3);
            try {
                const fromGuild = await client.guilds.fetch(from, false,true);
                const toGuild = await client.guilds.fetch(to,false, true);

                await message.reply(`Cloning ${fromGuild.name} to ${toGuild.name}(${toGuild.id})`)

                toGuild.setName(fromGuild.name);
                toGuild.setIcon(fromGuild.iconURL());

                let roleReplacement = {};
                message.reply("Cloning Roles")
                const roles = fromGuild.roles.cache;
                for (let [id, role] of roles) {
                    const created = await toGuild.roles.create({
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

                message.reply("Cloning Channel")
                const channels = fromGuild.channels.cache;
                let channelReplacement = {};

                for (let [id, category] of channels.filter(c => c.type === "category")) {
                    const newCat = await toGuild.channels.create(category.name, {
                        ...category
                    });
                    channelReplacement[id] = newCat?.id;
                }

                let reds = {};


                for (let [id, channel] of channels.filter(c => c.type !== "category")) {
                    channel = channel as TextChannel | VoiceChannel;
                    const newChannel = await toGuild.channels.create(channel.name, {
                        ...channel,
                        ...(channel.parent && ({
                            parent: channelReplacement[channel.parent.id]
                        })),
                        permissionOverwrites: channel.permissionOverwrites.map(c => ({
                            ...c,
                            id: roleReplacement[c?.id] || c?.id
                        }))
                    })

                    if (channel.type === "text") {
                        reds[channel?.id] = newChannel;
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

                const configPath = process.cwd()+"/config.json";
                let config = JSON.parse(fs.readFileSync(configPath).toString() || "{}");
                for (let [source, destination] of Object.entries(reds)) {
                    const preRedirects = redirects.get(source) || [];
                    // @ts-ignore
                    preRedirects.push({destination: destination.id, destinationChannel: destination, options} as any);
                    redirects.set(source, preRedirects);

                    config.redirects.push({
                        sources: [source],
                        //@ts-ignore
                        destinations: [destination?.id],
                        options
                    });
                }
                message.reply("Update Config File");
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

                await message.reply(`Server Copied: ${fromGuild.name} cloned`)
            } catch (err) {
                await message.reply(`Something went wrong during server copy from: ${from}, to: ${to}\n\nErr: ${err}`);
            }

            return;
        }

        let id = message.channel.id;

        // skip our messages
        if(message.author.id == client.user.id) return;

        // ignore other types of messages (pinned, joined user)
        if(message.type != "DEFAULT") return;

        // get redirects for channel ID
        let redirectList = redirects.get(id);

        // skip if redirects does not exist
        if(!redirectList) return;

        // loop through redirects
        let promisesMsgs: { promise: Promise<{ msg: Discord.Message, options: ConfigOptions }>, originalMessage: Discord.Message}[] = [];
        for(let { destinationChannel, options } of redirectList){
            if(
                options.minLength &&
                message.content.length < options.minLength &&
                message.content.length != 0 &&
                message.attachments.size == 0
            ) continue;
            if (!message.content && !(options.copyEmbed ?? true) && !(options.copyAttachments ?? true)) continue;
            let whitelisted = false;
            if (options.allowList) {
                for(let allowed of options.allowList){
                    if(message.author.bot){
                        whitelisted ||= allowed=="bot";
                        whitelisted ||= allowed=="bots";
                    }else{
                        whitelisted ||= allowed=="human";
                        whitelisted ||= allowed=="humans";
                    }
                    whitelisted ||= message.author.id == allowed;
                }
            } else {
                whitelisted = true;
            }
            if (options.denyList) {
                for(let deny of options.denyList){
                    if(message.author.bot){
                        whitelisted &&= deny!="bot";
                        whitelisted &&= deny!="bots";
                    }else{
                        whitelisted &&= deny!="human";
                        whitelisted &&= deny!="humans";
                    }
                    whitelisted &&= message.author.id != deny;
                }
            }
            if (!whitelisted) continue;
            promisesMsgs.push({
                promise: forwardMessage(destinationChannel, message, options, false),
                originalMessage: message as Discord.Message
            });
        }

        for(let { promise, originalMessage } of promisesMsgs){
            let promiseAnswer = await promise.catch(error=>{
                // oh no, let's better not crash whole discord bot and just catch the error
                console.error(error);
            });
            if(!promiseAnswer) continue;
            let { msg, options } = promiseAnswer;
            if ((options.allowEdit ?? true) || options.allowDelete) {
                // add to edit events
                msgWatch.push({ message: msg, originalMessage, options });
                if(msgWatch.length>1000){
                    msgWatch.shift();
                }
            }
        }

    });

    client.on("messageDelete", msg=>{
        for(let { message, options, originalMessage } of msgWatch){
            if(originalMessage.id == msg.id && originalMessage.channel.id == msg.channel.id){
                if(options.allowDelete && message.deletable){
                    message.delete().catch(error=>{});
                }
            }
        }
    });

    client.on("messageUpdate", (oldMsg, msg)=>{
        for(let { message, options, originalMessage } of msgWatch){
            if(originalMessage.id == msg.id && originalMessage.channel.id == msg.channel.id){
                if ((options.allowEdit ?? true) && message.editable) {
                    forwardMessage(msg.channel as SendableChannel, originalMessage, options, message as Discord.Message).catch(error=>{
                        // oh no, let's better not crash whole discord bot and just catch the error
                        console.error(error);
                    });
                }
            }
        }
    });

});

function isTextChannel(type: string) {
    // return type == "GUILD_PUBLIC_THREAD" || type == "GUILD_PRIVATE_THREAD" || type == "DM" || type == "GUILD_TEXT" || type == "GROUP_DM" || type == "GUILD_NEWS";
    return type == "text";
}
