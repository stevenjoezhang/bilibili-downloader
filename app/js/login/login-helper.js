// /workspaces/downkyicore/DownKyi.Core/BiliApi/Login/LoginHelper.cs
const fs = require('fs');
// Required to use response.headers.raw
const fetch = require('node-fetch');
const path = require('path');
const { CookieJar, Cookie } = require('tough-cookie');

const LOCAL_LOGIN_INFO = path.join(__dirname, 'login_info');
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

        // 获取expires
        const expires = strList2.find(it => it.includes('Expires')).split('=')[1];
        const dateTime = new Date(Date.now() + parseInt(expires) * 1000);

        for (const item of strList2) {
            const strList3 = item.split('=');
            if (strList3.length < 2) {
                continue;
            }

            const name = strList3[0];
            const value = strList3[1];

            // 不需要
            if (name === 'Expires' || name === 'gourl') {
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

    static async saveLoginInfoCookies(url) {
        const tempFile = `${LOCAL_LOGIN_INFO}-${Date.now()}`;
        const cookieJar = LoginHelper.parseCookie(url);

        try {
            console.log(url)
            // const response = await fetch(url, { headers: { Cookie: cookieJar.getCookieStringSync(url) } });
            // const setCookieHeader = response.headers.raw()['set-cookie'];
            // window.setCookieHeader = response.headers;
            // if (setCookieHeader) {
            //     setCookieHeader.forEach(cookie => {
            //         cookieJar.setCookieSync(cookie, url);
            //     });
            // }
            const cookieJSON = JSON.stringify(cookieJar.toJSON());
            fs.writeFileSync(tempFile, cookieJSON);
            fs.copyFileSync(tempFile, LOCAL_LOGIN_INFO);
            fs.unlinkSync(tempFile);
        } catch (err) {
            console.error('SaveLoginInfoCookies()发生异常:', err);
        }
    }

    static getLoginInfoCookies() {
        if (!fs.existsSync(LOCAL_LOGIN_INFO)) {
            return null;
        }

        const tempFile = `${LOCAL_LOGIN_INFO}-${Date.now()}`;
        fs.copyFileSync(LOCAL_LOGIN_INFO, tempFile);

        const cookieJar = CookieJar.fromJSON(fs.readFileSync(tempFile, 'utf-8'));
        fs.unlinkSync(tempFile);
        return cookieJar;
    }
}

module.exports = LoginHelper;
