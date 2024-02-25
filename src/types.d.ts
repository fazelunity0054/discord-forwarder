import * as Discord from 'discord.js';
import {MessageAttachment} from "discord.js";
export type ConfigOptions = {
    webhook?: boolean
    webhookUsername?: string
    webhookUsernameChannel?: boolean
    webhookAvatarURL?: string
    embed?: {
        title?: string
        color?: Discord.ColorResolvable
        timestamp?: boolean
        author?: boolean
        fields?: {
            author?: boolean
            server?: boolean
            channel?: boolean
        }
    },
    includeAuthorTag?: boolean
    includeAuthorAsEmbed?: boolean
    includeAuthor?: boolean
    includeChannel?: boolean
    allowMentions?: boolean
    allowEdit?: boolean
    allowDelete?: boolean

    copyEmbed?: boolean
    copyAttachments?: boolean
    minLength?: number

    allowList?: []
    denyList?: [],
    filters: ConfigFilters,
    avatars: {
        [key: string]: string
    }
};

export type ConfigRedirect = {
    sources?: string[]
    destinations?: string[]
    options?: ConfigOptions
};


export type ConfigFilters = {
    link1?: boolean
    link2?: boolean,
    blockedUser: string[],
    texts: string[],
    onlyBot: boolean,
    removeMedia: ("image" | "video" | "gif")[]
}

export type Config = {
    token: string,
    redirects: ConfigRedirect[];
    copier?: boolean
};

export type SendableChannel = Discord.TextChannel | Discord.NewsChannel;
