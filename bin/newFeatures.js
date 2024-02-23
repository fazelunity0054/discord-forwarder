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
exports.removeHttpLinks = exports.hasHttpLinks = exports.setAvatar = void 0;
const fs = require("fs");
const hcaptcha = [
    `eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6ImVuLVVTIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzEyMS4wLjAuMCBTYWZhcmkvNTM3LjM2IiwiYnJvd3Nlcl92ZXJzaW9uIjoiMTIxLjAuMC4wIiwib3NfdmVyc2lvbiI6IjEwIiwicmVmZXJyZXIiOiJodHRwczovL21lZTYueHl6LyIsInJlZmVycmluZ19kb21haW4iOiJtZWU2Lnh5eiIsInJlZmVycmVyX2N1cnJlbnQiOiIiLCJyZWZlcnJpbmdfZG9tYWluX2N1cnJlbnQiOiIiLCJyZWxlYXNlX2NoYW5uZWwiOiJzdGFibGUiLCJjbGllbnRfYnVpbGRfbnVtYmVyIjoyNjcyMjAsImNsaWVudF9ldmVudF9zb3VyY2UiOm51bGx9`,
    `eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRGlzY29yZCBDbGllbnQiLCJyZWxlYXNlX2NoYW5uZWwiOiJzdGFibGUiLCJjbGllbnRfdmVyc2lvbiI6IjEuMC45MDIwIiwib3NfdmVyc2lvbiI6IjEwLjAuMTkwNDUiLCJvc19hcmNoIjoieDY0IiwiYXBwX2FyY2giOiJpYTMyIiwic3lzdGVtX2xvY2FsZSI6ImVuLVVTIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV09XNjQpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIGRpc2NvcmQvMS4wLjkwMjAgQ2hyb21lLzEwOC4wLjUzNTkuMjE1IEVsZWN0cm9uLzIyLjMuMjYgU2FmYXJpLzUzNy4zNiIsImJyb3dzZXJfdmVyc2lvbiI6IjIyLjMuMjYiLCJjbGllbnRfYnVpbGRfbnVtYmVyIjoyNDAyMzcsIm5hdGl2ZV9idWlsZF9udW1iZXIiOjM4NTE3LCJjbGllbnRfZXZlbnRfc291cmNlIjpudWxsLCJkZXNpZ25faWQiOjB9`
];
function setAvatar(token) {
    return __awaiter(this, void 0, void 0, function* () {
        const avatarPath = "avatar.png";
        if (!fs.existsSync(avatarPath))
            return;
        const avatar = fs.readFileSync(avatarPath);
        const base64 = Buffer.from(avatar).toString("base64");
        for (let captcha of hcaptcha) {
            const response = yield fetch("https://discord.com/api/v9/users/@me", {
                "headers": {
                    "accept": "*/*",
                    "accept-language": "en-US,en;q=0.9,fa-IR;q=0.8,fa;q=0.7",
                    "authorization": token,
                    "content-type": "application/json",
                    "sec-ch-ua": "\"Not A(Brand\";v=\"99\", \"Google Chrome\";v=\"121\", \"Chromium\";v=\"121\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "x-super-properties": captcha,
                    "sec-fetch-site": "same-origin",
                    "x-debug-options": "bugReporterEnabled",
                    "x-discord-locale": "en-US",
                    "x-discord-timezone": "Asia/Tehran",
                    "cookie": `__dcfduid=c6441fe018d811ee856129c67d9fb38b; __sdcfduid=c6441fe118d811ee856129c67d9fb38b4032aba62125f8d098a3dd6f00d2e179c5849ac3ab348db80195058f9dbf674c; _ga_XXP2R74F46=GS1.2.1698393879.2.0.1698393879.0.0.0; _ga=GA1.1.2012778669.1688458494; _ga_YL03HBJY7E=GS1.1.1702684402.3.1.1702684636.0.0.0; locale=en-US; OptanonConsent=isIABGlobal=false&datestamp=${encodeURIComponent(new Date().toString())}&version=6.33.0&hosts=&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A0%2CC0003%3A0&AwaitingReconsent=false; cf_clearance=PoMcMLVkybomvGN37SgpAvPBYuyRiBS7o3DocagQqWQ-1708482918-1.0-ARXflgf3jpIk+WOeTyRJJmj2nq54E5nIstQ5O1AK5yRzMxqmBEwjlyjXC8nfaz7nmjcP11YkQ/tDAWD/EYR1pe8=; __cfruid=0badbd4392c60b96104a9be97524797e5b787750-1708515749; _cfuvid=dt81QvKSQzJ.qf86LwWrZQ0tvX5ldP7VSayGHrLbpsQ-1708515749630-0.0-604800000`,
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
                },
                "body": `{"avatar":"data:image/png;base64,${base64}"}`,
                "method": "PATCH",
                "mode": "cors",
                "credentials": "include"
            }).then(r => r.json()).catch(console.log);
            if (response.code === 50035) {
                console.error('AVATAR RATE LIMIT');
            }
            else if (!!response.captcha_rqtoken) {
                console.error('CAPTCHA');
            }
            else {
                console.log("Avatar Set");
                break;
            }
        }
    });
}
exports.setAvatar = setAvatar;
function hasHttpLinks(text) {
    var httpRegex = /(?:https?|ftp):\/\/[\n\S]+/gi;
    return httpRegex.test(text);
}
exports.hasHttpLinks = hasHttpLinks;
function removeHttpLinks(text) {
    var httpRegex = /(?:https?|ftp):\/\/[\n\S]+/gi;
    return text.replace(httpRegex, '');
}
exports.removeHttpLinks = removeHttpLinks;
//# sourceMappingURL=newFeatures.js.map