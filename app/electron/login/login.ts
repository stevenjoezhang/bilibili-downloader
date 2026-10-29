// /workspaces/downkyicore/DownKyi/ViewModels/ViewLoginViewModel.cs
const LoginQR = require('../../common/login/login-qr.js');
const LoginHelper = require('../../common/login/login-helper.js');
// const { PropertyChangeAsync, ExecuteBackSpace, console, DictionaryResource } = require('./utils');

class LoginService {
    declare tokenSource;
    declare qrcodeElement;
    declare labelElement;
    declare logoutElement;

    constructor(element) {
        // this.eventAggregator = new EventEmitter();
        this.tokenSource = { token: false };
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
        this.qrcodeElement.style.display = '';
        await this.login();
    }

    async login() {
        try {
            // 已有有效的登录信息时，无需再扫码
            if (LoginHelper.getLoginInfoCookies()) {
                this.setLoggedIn();
                return;
            }

            const loginUrl = await LoginQR.getLoginUrl();
            if (!loginUrl || loginUrl.code !== 0) {
                // ExecuteBackSpace();
                return;
            }

            if (!loginUrl.data || !loginUrl.data.url) {
                // this.eventAggregator.emit('message', DictionaryResource.getString('GetLoginUrlFailed'));
                return;
            }

            // await PropertyChangeAsync(async () => {
            //     this.loginQrCode = await LoginQR.getLoginQRCodeFromUrl(loginUrl.data.url);
            // });
            this.qrcodeElement.src = await LoginQR.getLoginQRCodeFromUrl(loginUrl.data.url);

            // console.log(loginUrl.data.url + '\n');
            // console.debug('Login', loginUrl.data.url);

            await this.getLoginStatus(loginUrl.data.qrcode_key);

            this.setLoggedIn();
        } catch (e) {
            console.error(`Login()发生异常: ${e}`);
            console.error('Login', e);
        }
    }

    async getLoginStatus(oauthKey) {
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
                const loginStatus = await LoginQR.getLoginStatus(oauthKey);
                if (!loginStatus) {
                    continue;
                }

                console.log(`${loginStatus.data.code}\n${loginStatus.data.message}\n${loginStatus.data.url}\n`);

                switch (loginStatus.data.code) {
                    case 86038:
                        // 二维码已过期，重新获取，避免误显示「登录成功」
                        this.tokenSource.token = true;
                        this.qrcodeElement.style.display = 'none';
                        this.labelElement.textContent = '二维码已过期，正在刷新…';
                        setTimeout(() => this.login(), 1000);
                        break;

                    case 86101:
                        // 未扫码
                        break;

                    case 86090:
                        // 已扫码，未确认
                        // await PropertyChangeAsync(() => {
                        //     this.loginQrCodeStatus = true;
                        //     this.loginQrCodeOpacity = 0.3;
                        // });
                        break;

                    case 0:
                        // 确认登录
                        // this.eventAggregator.emit('message', '登陆成功');

                        try {
                            const isSucceed = await LoginHelper.saveLoginInfoCookies(loginStatus.data.url);
                            if (!isSucceed) {
                                // this.eventAggregator.emit('message', DictionaryResource.getString('LoginFailed'));
                                // console.error('Login', DictionaryResource.getString('LoginFailed'));
                            }
                        } catch (e) {
                            console.error(`PageLogin 保存登录信息发生异常: ${e}`);
                            console.error(e);
                            // this.eventAggregator.emit('message', DictionaryResource.getString('LoginFailed'));
                        }

                        // await new Promise(resolve => setTimeout(resolve, 3000));
                        // await PropertyChangeAsync(ExecuteBackSpace);
                        break;
                }

                if (this.tokenSource.token) {
                    console.log('停止Login线程，跳出while循环');
                    console.debug('Login', '登录操作结束');
                    break;
                }
            } catch (error) {
                console.error(`GetLoginStatus()发生异常: ${error}`);
            }
        }
    }
}

module.exports = LoginService;

export {};
