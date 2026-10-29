// /workspaces/downkyicore/DownKyi.Core/BiliApi/Login/LoginHelper.cs
const fs = require('fs');
const path = require('path');
const { CookieJar, Cookie } = require('tough-cookie');

const LOCAL_LOGIN_INFO = path.join(__dirname, 'login_info');
const LEGACY_LOGIN_INFO = path.join(__dirname, '../../js/login/login_info');
// const SECRET_KEY = 'EsOat*^y1QR!&0J6';

class LoginHelper {
    // /workspaces/downkyicore/DownKyi.Core/Utils/ObjectHelper.cs
    static parseCookie(url) {
        const cookieJar = new CookieJar();

        if (!url) {
            return cookieJar;
        }

        const strList = url.split('?');
        if (strList.length < 2) {
            return cookieJar;
        }

        const strList2 = strList[1].split('&');
        if (strList2.length === 0) {
            return cookieJar;
        }

        // 获取expires（兼容参数名大小写，缺失时不设置过期时间）
        const expiresItem = strList2.find(it => /^expires=/i.test(it));
        const dateTime = expiresItem
            ? new Date(Date.now() + parseInt(expiresItem.split('=')[1]) * 1000)
            : undefined;

        for (const item of strList2) {
            const eq = item.indexOf('=');
            if (eq < 1) {
                continue;
            }

            const name = item.slice(0, eq);
            // 值中可能含有 '='，不能用 split('=')[1]
            const value = item.slice(eq + 1);

            // 不需要
            if (/^expires$/i.test(name) || name === 'gourl') {
                continue;
            }

            // 添加cookie
            cookieJar.setCookieSync(new Cookie({
                key: name,
                value: value.replace(',', '%2c'),
                domain: '.bilibili.com',
                path: '/',
                expires: dateTime
            }).toString(), 'http://.bilibili.com');
        }

        return cookieJar;
    }

    // 判断 cookie jar 中是否已包含 SESSDATA
    // 注意：Set-Cookie 若无 Domain 属性会按 host-only 存到具体主机名下，
    // 因此除了按域取值外，还要直接检查 jar 里的键
    static hasSessdata(cookieJar) {
        if (cookieJar.getCookieStringSync('https://www.bilibili.com/').includes('SESSDATA=')) {
            return true;
        }
        return cookieJar.toJSON().cookies.some(cookie => cookie.key === 'SESSDATA');
    }

    // 新版扫码接口只返回带 ticket 的 crossDomain 链接，
    // 需要请求该链接（跟随重定向）并从 Set-Cookie 响应头中换取登录 cookie
    static async exchangeTicketForCookies(url, cookieJar) {
        const { fetchUrl } = require('../modules.js');
        const debugLog = [];
        let currentUrl = url;
        // 跟随最多 5 次重定向，逐跳收集 Set-Cookie
        for (let i = 0; i < 5; i++) {
            const response = await fetchUrl(currentUrl, {
                redirect: 'manual',
                headers: {
                    Cookie: cookieJar.getCookieStringSync(currentUrl),
                    // B 站接口通常要求浏览器特征头
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                    'Referer': 'https://www.bilibili.com/'
                }
            });
            const setCookies = response.headers.raw()['set-cookie'] || [];
            debugLog.push(`[${i}] ${response.status} ${currentUrl}\n    set-cookie: ${JSON.stringify(setCookies)}`);
            for (const cookie of setCookies) {
                try {
                    // SSO 跳转链的每一站都把 cookie 写在自己域下（biligame.com 等），
                    // 但 cookie 值全域通用，改写到 bilibili.com 域保存
                    const parsed = Cookie.parse(cookie);
                    if (parsed) {
                        parsed.domain = 'bilibili.com';
                        cookieJar.setCookieSync(parsed.toString(), 'https://www.bilibili.com/');
                    }
                } catch (e) {
                    debugLog.push(`    REJECTED: ${cookie} => ${e.message}`);
                }
            }
            if (response.status < 300 || response.status >= 400) {
                break;
            }
            const location = response.headers.get('location');
            if (!location) {
                break;
            }
            currentUrl = new URL(location, currentUrl).href;
        }
        // 写入调试日志，便于排查换取失败的原因
        try {
            fs.writeFileSync(path.join(__dirname, 'exchange-debug.log'), debugLog.join('\n') + '\n');
        } catch (e) { /* 忽略日志写入失败 */ }
        return cookieJar;
    }

    static async saveLoginInfoCookies(url) {
        const tempFile = `${LOCAL_LOGIN_INFO}-${Date.now()}`;
        let cookieJar = LoginHelper.parseCookie(url);

        // 旧版接口直接在链接参数中携带 cookie；新版只携带 ticket
        if (!LoginHelper.hasSessdata(cookieJar)) {
            cookieJar = await LoginHelper.exchangeTicketForCookies(url, cookieJar);
        }

        // 登录链接解析异常时，宁可失败也不要存下空凭证
        if (!LoginHelper.hasSessdata(cookieJar)) {
            throw new Error(`登录链接中未解析到 SESSDATA: ${url}`);
        }

        try {
            console.log(url)
            const cookieJSON = JSON.stringify(cookieJar.toJSON());
            fs.writeFileSync(tempFile, cookieJSON);
            fs.copyFileSync(tempFile, LOCAL_LOGIN_INFO);
            fs.unlinkSync(tempFile);
            return true;
        } catch (err) {
            console.error('SaveLoginInfoCookies()发生异常:', err);
            throw err;
        }
    }

    // 删除本地登录信息，退出登录
    static logout() {
        for (const file of [LOCAL_LOGIN_INFO, LEGACY_LOGIN_INFO]) {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        }
    }

    static getLoginInfoCookies() {
        const loginInfoFile = fs.existsSync(LOCAL_LOGIN_INFO) ? LOCAL_LOGIN_INFO : LEGACY_LOGIN_INFO;
        if (!fs.existsSync(loginInfoFile)) {
            return null;
        }

        const tempFile = `${LOCAL_LOGIN_INFO}-${Date.now()}`;
        fs.copyFileSync(loginInfoFile, tempFile);

        const cookieJar = CookieJar.fromJSON(fs.readFileSync(tempFile, 'utf-8'));
        fs.unlinkSync(tempFile);
        return cookieJar;
    }
}

module.exports = LoginHelper;

export {};
