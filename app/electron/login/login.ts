// /workspaces/downkyicore/DownKyi/ViewModels/ViewLoginViewModel.cs
const LoginQR = require('../../common/login/login-qr.js');
const LoginHelper = require('../../common/login/login-helper.js');
// const { PropertyChangeAsync, ExecuteBackSpace, console, DictionaryResource } = require('./utils');

class LoginService {
    declare qrcodeElement;
    declare labelElement;
    declare logoutElement;
    declare pollId;

    constructor(element) {
        // this.eventAggregator = new EventEmitter();
        this.pollId = 0;
        this.qrcodeElement = element.querySelector('img');
        this.labelElement = element.querySelector('label');
        this.logoutElement = document.getElementById('logout');
    }

    // 标记为已登录，并显示「退出登录」链接
    setLoggedIn() {
        this.qrcodeElement.style.display = 'none';
        this.labelElement.textContent = '已登录';
        this.logoutElement?.classList.remove('d-none');
    }

    // 重置为未登录状态，重新显示二维码
    async logout() {
        LoginHelper.logout();
        this.logoutElement?.classList.add('d-none');
        this.labelElement.textContent = '请先使用App扫码登录，才能下载高清视频';
        this.qrcodeElement.style.display = 'none'; // 新二维码生成后再显示
        await this.login();
    }

    async login() {
        try {
            // 已有有效的登录信息时，无需再扫码
            if (LoginHelper.getLoginInfoCookies()) {
                this.setLoggedIn();
                return;
            }

            // 每次登录递增代际号，使旧的轮询循环自行退出
            const pollId = ++this.pollId;

            const loginUrl = await LoginQR.getLoginUrl();
            if (!loginUrl || loginUrl.code !== 0 || !loginUrl.data || !loginUrl.data.url) {
                this.labelElement.textContent = '获取二维码失败，正在重试…';
                setTimeout(() => {
                    if (this.pollId === pollId) {
                        this.login();
                    }
                }, 5000);
                return;
            }

            const qrCode = await LoginQR.getLoginQRCodeFromUrl(loginUrl.data.url);
            if (!qrCode) {
                this.labelElement.textContent = '二维码生成失败，正在重试…';
                setTimeout(() => {
                    if (this.pollId === pollId) {
                        this.login();
                    }
                }, 5000);
                return;
            }
            this.qrcodeElement.src = qrCode;
            this.qrcodeElement.style.display = '';
            this.labelElement.textContent = '请先使用App扫码登录，才能下载高清视频';

            // console.log(loginUrl.data.url + '\n');
            // console.debug('Login', loginUrl.data.url);

            const loggedIn = await this.getLoginStatus(loginUrl.data.qrcode_key, pollId);

            // 仅在真正扫码成功时显示「已登录」；二维码过期时已由 getLoginStatus 自行安排重试
            if (loggedIn) {
                this.setLoggedIn();
            }
        } catch (e) {
            console.error(`Login()发生异常: ${e}`);
            console.error('Login', e);
        }
    }

    // 轮询扫码状态，返回是否登录成功；二维码过期时自行安排重试并返回 false
    async getLoginStatus(oauthKey, pollId) {
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            // 已有新一轮登录流程，退出过期的轮询
            if (this.pollId !== pollId) {
                return false;
            }
            try {
                const loginStatus = await LoginQR.getLoginStatus(oauthKey);
                if (!loginStatus || !loginStatus.data) {
                    continue;
                }

                console.log(`${loginStatus.data.code}\n${loginStatus.data.message}\n${loginStatus.data.url}\n`);

                switch (loginStatus.data.code) {
                    case 86038:
                        // 二维码已过期，重新获取；返回 false，不显示「已登录」
                        this.qrcodeElement.style.display = 'none';
                        this.labelElement.textContent = '二维码已过期，正在刷新…';
                        setTimeout(() => {
                            // 若期间用户退出登录或已有新流程，不再重试
                            if (this.pollId === pollId) {
                                this.login();
                            }
                        }, 1000);
                        return false;

                    case 86101:
                        // 未扫码
                        break;

                    case 86090:
                        // 已扫码，未确认
                        this.labelElement.textContent = '已扫码，请在手机上确认';
                        break;

                    case 0: {
                        // 确认登录；保存失败时显示原因并刷新二维码，不能假装已登录
                        let saved = false;
                        let reason = '';
                        try {
                            saved = await LoginHelper.saveLoginInfoCookies(loginStatus.data.url);
                        } catch (e) {
                            console.error(`PageLogin 保存登录信息发生异常: ${e}`);
                            reason = e instanceof Error ? e.message : String(e);
                        }
                        if (!saved) {
                            this.qrcodeElement.style.display = 'none'; // 旧二维码已失效
                            this.labelElement.textContent = `登录信息保存失败：${reason}。正在刷新二维码…`;
                            setTimeout(() => {
                                if (this.pollId === pollId) {
                                    this.login();
                                }
                            }, 2000);
                            return false;
                        }
                        return true;
                    }
                }
            } catch (error) {
                console.error(`GetLoginStatus()发生异常: ${error}`);
            }
        }
    }
}

module.exports = LoginService;

export {};
