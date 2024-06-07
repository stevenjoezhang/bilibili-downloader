// /workspaces/downkyicore/DownKyi.Core/BiliApi/Login/LoginHelper.cs
const QRCode = require('qrcode');

class LoginQR {
    static async getLoginUrl() {
        try {
            const response = await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/generate');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('GetLoginUrl()发生异常:', error);
            return null;
        }
    }

    static async getLoginStatus(qrcodeKey, goUrl = 'https://www.bilibili.com') {
        try {
            const response = await fetch(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${qrcodeKey}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('GetLoginStatus()发生异常:', error);
            return null;
        }
    }

    // static async getLoginQRCode() {
    //     try {
    //         const loginUrlOrigin = await this.getLoginUrl();
    //         return await this.getLoginQRCodeFromUrl(loginUrlOrigin.data.url);
    //     } catch (error) {
    //         console.error('GetLoginQRCode()发生异常:', error);
    //         return null;
    //     }
    // }

    static async getLoginQRCodeFromUrl(url) {
        try {
            const qrCode = await QRCode.toDataURL(url, { width: 200, height: 200 });
            return qrCode;
        } catch (error) {
            console.error('生成二维码发生异常:', error);
            return null;
        }
    }
}

module.exports = LoginQR;
