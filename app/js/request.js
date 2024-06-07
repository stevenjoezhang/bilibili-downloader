// /workspaces/downkyicore/DownKyi.Core/BiliApi/WebClient.cs
const fetch = require('node-fetch');
const { CookieJar } = require('tough-cookie');
// const zlib = require('zlib');
// const { promisify } = require('util');
// const stream = require('stream');
// const pipeline = promisify(stream.pipeline);
const LoginHelper = require('./login/login-helper');
// const { getRandomBuvid3 } = require('./utils');

async function requestWeb(url, referer = null, method = 'GET', parameters = null, retry = 3, needRandomBvuid3 = false) {
    if (retry <= 0) {
        return '';
    }

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36', // replace with actual user agent
        'accept-language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'accept-encoding': 'gzip, deflate, br'
    };

    if (referer) {
        headers.Referer = referer;
    }

    if (!url.includes('getLogin')) {
        headers.origin = 'https://m.bilibili.com';

        const cookies = LoginHelper.getLoginInfoCookies();
        if (cookies) {
            headers.Cookie = cookies.getCookieStringSync(url);
        } else {
            const cookieJar = new CookieJar();
            if (needRandomBvuid3) {
                cookieJar.setCookieSync(`buvid3=${getRandomBuvid3()}; Domain=.bilibili.com; Path=/`, url);
            }
            headers.Cookie = cookieJar.getCookieStringSync(url);
        }
    }

    let requestOptions = { method, headers };

    if (method === 'POST' && parameters) {
        const searchParams = new URLSearchParams();
        for (const key in parameters) {
            searchParams.append(key, parameters[key]);
        }
        url += '?' + searchParams.toString();
    }

    try {
        const response = await fetch(url, requestOptions);

        let html = await response.text();

        return html;
    } catch (error) {
        console.error(`RequestWeb()发生异常: ${error}`);
        return requestWeb(url, referer, method, parameters, retry - 1, needRandomBvuid3);
    }
}

async function main() {
    const referer = 'https://www.bilibili.com';
    const response = await requestWeb('https://www.bilibili.com/video/BV1vU411o7nj/?vd_source=46135795e0d52f89ece55c6549e47fb2', referer);
    // console.log(response);
    const regex_initial_state = /__INITIAL_STATE__=(.*?);\(function\(\)/;
    const initial_state = response.match(regex_initial_state)[1];
    console.log(JSON.stringify(JSON.parse(initial_state), null, 2));
    const regex = /<script>window\.__playinfo__=(.*?)<\/script>/;
    const match = response.match(regex);
    let playUrl = null;

    if (match) {
        playUrl = JSON.parse(match[1]);
    }

    console.log(JSON.stringify(playUrl, null, 2));

    if (!playUrl) {
        return null;
    } else if (playUrl.data) {
        return playUrl.data;
    } else if (playUrl.result) {
        return playUrl.result;
    } else {
        return null;
    }
    // console.log(result);
}

main();

module.exports = { requestWeb };
