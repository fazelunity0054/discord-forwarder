import * as Discord from 'discord.js';
import {readConfig, updateConfig} from "./readConfig";
import {Config, ConfigOptions, SendableChannel} from "./types";
import {startWebServer} from "./webServer";
import {forwardMessage} from "./forwardMessage";
import {registerConsoleLog, setAvatar} from "./newFeatures";
import {TextChannel, VoiceChannel} from "discord.js";
import * as fs from "fs";

startWebServer();

readConfig().then(handleBotStart);

function isTextChannel(type: string) {
	// return type == "GUILD_PUBLIC_THREAD" || type == "GUILD_PRIVATE_THREAD" || type == "DM" || type == "GUILD_TEXT" || type == "GROUP_DM" || type == "GUILD_NEWS";
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


function handleBotStart(config: Config) {
	let client = new Discord.Client({});
	client.login(config.token).catch((e) => {
		console.error('LOGIN FAILED', e);
		handleBotStart(config);
	});

	let redirects: Map<
		string, // source channel
		Array<{
			destination: string
			destinationChannel?: SendableChannel
			options: ConfigOptions
		}>
	> = new Map();

	// loop through redirects and put them in a Map
	updateConfig(async (config) => {
		for (let redirect of config.redirects) {

			// check if redirect is valid
			if (!Array.isArray(redirect.sources)) throw "config: redirect has no defined `sources`";
			if (!Array.isArray(redirect.destinations)) throw "config: redirect has no defined `destinations`";
			if (redirect.sources.length == 0) throw "config: redirect has no `sources`";
			if (redirect.destinations.length == 0) throw "config: redirect has no `destinations`";


			let options: ConfigOptions = redirect.options ?? {};
			for (let source of redirect.sources) {
				skip: for (let destination of redirect.destinations) {
					let data = redirects.get(source) ?? [];

					// skip duplicate redirects
					for (let dataCheck of data) {
						if (dataCheck.destination == destination) {
							console.log("config: redirect from `" + source + "` to `" + destination + "` is a duplicate, I will accept the only the first redirect to avoid duplicate redirects");
							continue skip;
						}
					}

					data.push({destination, options});
					redirects.set(source, data);
				}
			}
		}
		return config;
	}).finally(() => {
		console.log("Duplicate Check finished")
	})
	// count redirects (optional code)
	let totalRedirects = 0;
	redirects.forEach(redirect => totalRedirects += redirect.length);
	console.debug("Redirects in total: " + totalRedirects);

	// wait until Discord client loads
	console.log("Discord.js is loading...");
	let channelLoadPromise: Promise<void[]>;
	client.on("ready", async () => {
		setTimeout(() => {
			console.log('destroy')
			client.destroy();
			handleBotStart(config);
		}, 10 * 60 * 1000);
		console.log("Discord client is ready, loading channels...");
		console.log("LOGGED AS " + client.user.username)
		registerConsoleLog(client)
		if (!config.redirects.length) {
			console.log("NO REDIRECT FOUND");
			return;
		}
		// we need this since we disabled all discord.js caching
		let channelCache: Map<string, Promise<SendableChannel>> = new Map();

		// this is meant for loading channels if used cache-less discord.js
		let loadChannelPromises: Promise<void>[] = [];
		for (let redirectList of redirects) {
			for (let redirect of redirectList[1]) {

				let channelPromise = channelCache.get(redirect.destination) ?? client.channels.fetch(redirect.destination);
				channelCache.set(redirect.destination, channelPromise as Promise<SendableChannel>);
				channelPromise.catch((e) => {
					console.log("CHANNEL NOT FOUND ON FETCH");
				})
				loadChannelPromises.push((async () => {
					try {
						let channel = await channelPromise;
						if (isTextChannel(channel.type)) {
							redirect.destinationChannel = channel as Discord.TextChannel;
						} else {
							throw "channel `" + redirect.destination + "` is not a text channel";
						}
					} catch {
						console.log("CHANNEL NOT FOUND ON FETCH [2]");
					}
				})());

			}
		}
		channelLoadPromise = Promise.all(loadChannelPromises);
		await channelLoadPromise;
		console.log("Channels loaded");
	});

	// watch messages for edits and deletions
	let msgWatch: { message: Discord.Message, originalMessage: Discord.Message, options: ConfigOptions }[] = [];
	client.on("message", async message => {
		try {
			// wait while channels are still loading
			if (channelLoadPromise) await channelLoadPromise;
		} catch (e) {
			console.error(e);
		}

		if ((message.content.startsWith("!serverCopy") || message.content.startsWith("!optimize") || message.content.startsWith("!forward") || message.content.startsWith("!setRedirects") || message.content.startsWith("!details")) && message.mentions.has(client.user)) {
			const [command, from, to, del] = message.content.split(" ");
			try {
				if (command === '!details') {
					const channel = message.channel
					type VType = ReturnType<typeof redirects.get>;
					const echo = (obj: any) => `${'```json\n'}${JSON.stringify(obj, null, 2)}${"\n```"}`;

					let redirectsObj: {
						[key: string]: VType
					} = {};
					redirects.forEach((v, k) => {
						redirectsObj[k] = v;
					})

					const source = redirectsObj[channel.id];
					const destinations = Object.fromEntries(Object.entries(redirectsObj).filter(([key, value]: [string, VType]) => {
						return value.find(d => d.destination === channel.id)
					}))
					let content = `
					isSource: ${(!!source) + ""}
					become From: ${(await Promise.all(Object.keys(destinations).map(id => client.channels.fetch(id, false, true).catch(() => false)))).filter(Boolean).map((c: Discord.TextChannel) => `${c?.name}(<#${c.id}>) => ${c?.guild?.name}(${c?.guild?.id})`).join("\n")}
					
					`

					await message.channel.send(content);
					return;
				}
				if (command === "!forward") {
					let txt = message.content;
					let msg = "INIT\n";
					const inside = (symbol1 = '[', symbol2 = ']') =>
						txt.substring(txt.indexOf(symbol1) + symbol1.length, txt.indexOf(symbol2)).replaceAll("\n", " ")

					let from = inside().split(" ").filter(Boolean);
					let to = inside("{","}").split(" ").filter(Boolean);

					await updateConfig(async config => {
						let channels: {
							[key: string]: TextChannel
						} = {}

						for (let channelId of [...from, ...to]) {
							try {
								const fetch = await client.channels.fetch(channelId);
								if (fetch.type !== 'text') throw("INVALID CHANNEL TYPE");
								channels[channelId] = fetch as TextChannel;
							} catch (e: any) {
								to = to.filter(id => id !== channelId);
								from = from.filter(id => id !== channelId);
								console.error(e);
								msg += `FAIL TO REGISTER REDIRECT[${channelId}]: ${e?.message ?? e}\n`
							}
						}

						for (let sourceId of from) {
							const source = channels[sourceId];
							if (!source) {
								msg+=`SOURCE NOT FOND[${sourceId}]\n`
								continue;
							}
							for (let destinationId of to) {
								const destination = channels[destinationId];
								if (!destination) {
									msg += `DESTINATION NOT FOUND[${destinationId}]\n`
									continue;
								}

								registerRedirect(sourceId, destination, defaultOptions);
								msg += `RED F:${source.name} D:${destination.name} ✅\n`
							}
						}

						config.redirects.push({
							sources: from,
							destinations: to
						})
						await message.reply(msg.slice(0, 1800));
						return config;
					})
					return;
				}

				const fromGuild = await client.guilds.fetch(from, false, true);
				const toGuild = await client.guilds.fetch(to, false, true);

				if (command === "!setRedirects") {
					message.reply(`Setup message redirect from ${fromGuild.name} to ${toGuild.name}...`)

					const textChannels = fromGuild.channels.cache.filter(c => c.type === "text");

					let n = 0;
					await updateConfig(async config => {
						for (let [id, channel] of textChannels) {
							const created = toGuild.channels.cache.find(c => c.type === "text" && c.name === channel.name);
							if (!created) continue;

							registerRedirect(channel.id, created as TextChannel, defaultOptions);
							config.redirects.push({
								sources: [channel.id],
								destinations: [created.id],
								options: defaultOptions
							});
							n++;
						}

						return config;
					}).catch((e) => {
						message.reply(`FAILED TO UPDATE CONFIG FILE\n${e}`)

					})

					message.reply("Setup Finished Total Redirects: " + n);

					return;
				}

				if (command === "!optimize") {
					message.reply(`OPTIMIZE OPERATION STARTED [${fromGuild.name} with ${toGuild.name}]`)

					let roleReplacement = {};
					message.reply(`Optimize Positions...`);
					for (let [id, role] of fromGuild.roles.cache.sort((a, b) => a.position > b.position ? -1 : 1)) {
						const created = toGuild.roles.cache.find(r => r.name === role.name);
						if (!created) continue;
						roleReplacement[id] = created.id;

						try {
							await created.setPosition(role.position);
						} catch {
						}
					}

					message.reply(`Optimize Overrides...`);
					for (let [id, channel] of fromGuild.channels.cache) {
						const created = toGuild.channels.cache.find(c => c.name === channel.name);
						if (!created) continue;

						try {
							await created.overwritePermissions(channel.permissionOverwrites.map(c => ({
								...c,
								id: roleReplacement[c?.id] || c?.id
							})));
						} catch (e) {
							console.error(e);
						}
					}
					message.reply("Optimize Finished");
					return;
				}

				await message.reply(`Cloning ${fromGuild.name} to ${toGuild.name}(${toGuild.id})`)

				if (del?.startsWith?.('-y')) {
					message.reply(`Deleting ${toGuild.name} roles`);
					for (let [id, role] of toGuild.roles.cache) {
						try {
							await role.delete("").catch(console.error);
						} catch {
						}
					}
					message.reply("Deleting Channels")
					for (let [id, channel] of toGuild.channels.cache) {
						try {
							await channel.delete("").catch(console.error);
						} catch {
						}
					}
				}

				toGuild.setName(fromGuild.name);
				toGuild.setIcon(fromGuild.iconURL());

				let roleReplacement = {
					[fromGuild.roles.everyone?.id]: toGuild.roles.everyone?.id
				};
				message.reply("Cloning Roles")
				const roles = fromGuild.roles.cache;
				for (let [id, role] of roles.sort((a, b) => a.position < b.position ? 0 : 1)) {
					if (fromGuild.roles.everyone.id === role.id) continue;

					console.log(`CREATING ROLE \`${role.name}\``)
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
					console.log(`CREATING CATEGORY \`${category.name}\``)
					const newCat = await toGuild.channels.create(category.name, {
						...category
					});
					channelReplacement[id] = newCat?.id;
				}

				let reds = {};
				for (let [id, channel] of channels.filter(c => c.type === "text" || c.type === "voice")) {
					channel = channel as TextChannel | VoiceChannel;
					console.log(`CREATING CHANNEL[${channel.type}] <#${id}>`)
					try {
						const newChannel = await toGuild.channels.create(channel.name, {
							...channel,
							...(channel.parent && ({
								parent: channelReplacement[channel.parent.id]
							})),
							permissionOverwrites: channel.permissionOverwrites.map(c => ({
								...c,
								id: roleReplacement[c?.id] || c?.id
							})),
							...(channel.type === "voice" && ({
								bitrate: 96000
							}))
						})

						if (channel.type === "text") {
							reds[channel?.id] = newChannel;
						}
					} catch (e) {
						message.reply(`Failed to copy <#${channel.id}>\n\n${e}`);
						console.error(e);
					}
				}

				message.reply("Register Redirect");

				updateConfig(async config => {
					message.reply("Update Config File");

					for (let [source, destination] of Object.entries(reds)) {
						registerRedirect(source, destination as TextChannel, defaultOptions);

						config.redirects.push({
							sources: [source],
							//@ts-ignore
							destinations: [destination?.id],
							options: defaultOptions
						});
					}

					return config;
				}).catch((e) => {
					message.reply(`Failed to update Config File\n${e}`)
					console.error(e);
				})

				await message.reply(`Server Copied: ${fromGuild.name} cloned`);
				message.channel.send(`!optimize ${fromGuild.id} ${toGuild.id} <@${client.user.id}>`)
			} catch (err) {
				console.error(err);
				await message.reply(`Something went wrong during server copy from: ${from}, to: ${to}\n\nErr: ${err}`);
			}

			return;
		}

		let id = message.channel.id;

		// skip our messages
		if (message.author.id == client.user.id) return;

		// ignore other types of messages (pinned, joined user)
		if (message.type != "DEFAULT") return;

		// get redirects for channel ID
		let redirectList = redirects.get(id);

		// skip if redirects does not exist
		if (!redirectList) return;


		// loop through redirects
		let promisesMsgs: {
			promise: Promise<{ msg: Discord.Message, options: ConfigOptions }>,
			originalMessage: Discord.Message
		}[] = [];
		for (let {destinationChannel, options} of redirectList) {
			if (
				options.minLength &&
				message.content.length < options.minLength &&
				message.content.length != 0 &&
				message.attachments.size == 0
			) continue;
			if (!message.content && !(options.copyEmbed ?? true) && !(options.copyAttachments ?? true)) continue;
			let whitelisted = false;
			if (options.allowList) {
				for (let allowed of options.allowList) {
					if (message.author.bot) {
						whitelisted ||= allowed == "bot";
						whitelisted ||= allowed == "bots";
					} else {
						whitelisted ||= allowed == "human";
						whitelisted ||= allowed == "humans";
					}
					whitelisted ||= message.author.id == allowed;
				}
			} else {
				whitelisted = true;
			}
			if (options.denyList) {
				for (let deny of options.denyList) {
					if (message.author.bot) {
						whitelisted &&= deny != "bot";
						whitelisted &&= deny != "bots";
					} else {
						whitelisted &&= deny != "human";
						whitelisted &&= deny != "humans";
					}
					whitelisted &&= message.author.id != deny;
				}
			}
			if (!whitelisted) continue;

			if (message.content.includes("<")) {
				const from = await message.guild.fetch();
				const to = await destinationChannel.guild.fetch();

				for (let [_, role] of from.roles.cache) {
					const target = to.roles.cache.find(r => r.name === role.name);

					if (target) message.content = message.content.replaceAll(role.id, target.id);
				}

				for (let [_, channel] of from.channels.cache) {
					const target = to.channels.cache.find(c => c.name === channel.name);

					if (target) message.content = message.content.replaceAll(channel.id, target.id);
				}
			}


			promisesMsgs.push({
				promise: forwardMessage(destinationChannel, message, options, false),
				originalMessage: message as Discord.Message
			});
		}

		for (let {promise, originalMessage} of promisesMsgs) {
			let promiseAnswer = await promise.catch(error => {
				// oh no, let's better not crash whole discord bot and just catch the error
				console.error(error);
			});
			if (!promiseAnswer) continue;
			let {msg, options} = promiseAnswer;
			if ((options.allowEdit ?? true) || options.allowDelete) {
				// add to edit events
				msgWatch.push({message: msg, originalMessage, options});
				if (msgWatch.length > 1000) {
					msgWatch.shift();
				}
			}
		}

	});

	client.on("messageDelete", msg => {
		for (let {message, options, originalMessage} of msgWatch) {
			if (originalMessage.id == msg.id && originalMessage.channel.id == msg.channel.id) {
				if (options.allowDelete && message.deletable) {
					message.delete().catch(error => {
					});
				}
			}
		}
	});

	client.on("messageUpdate", (oldMsg, msg) => {
		for (let {message, options, originalMessage} of msgWatch) {
			if (originalMessage.id == msg.id && originalMessage.channel.id == msg.channel.id) {
				if ((options.allowEdit ?? true) && message.editable) {
					forwardMessage(msg.channel as SendableChannel, originalMessage, options, message as Discord.Message).catch(error => {
						// oh no, let's better not crash whole discord bot and just catch the error
						console.error(error);
					});
				}
			}
		}
	});

	function removeRedirect(id: string, config: Partial<Config> = {}) {
		if (Object.keys(config || {}).length) {
			config.redirects = config.redirects.filter(red => {
				return !(red.sources.includes(id + "") || red.destinations.includes(id + ""))
			})
		} else {
			updateConfig(async config => {
				config.redirects = config.redirects.filter(red => {
					return !(red.sources.includes(id + "") || red.destinations.includes(id + ""))
				})
				return config;
			});
		}

		redirects.delete(id);

		const reds = redirects.entries();
		for (let [id, data] of reds) {
			data = data.filter(d => d.destination !== id);
			redirects.set(id, data);
		}
	}

	function registerRedirect(source: string, destination: TextChannel, options: Partial<ConfigOptions>) {
		const preRedirects = redirects.get(source) || [];
		preRedirects.push({destination: destination.id, destinationChannel: destination, options} as any);
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
		console.log("Retry...")
		handleBotStart(config);
	})
	client.on('error', console.log)

}
