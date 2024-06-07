// /workspaces/downkyicore/DownKyi/ViewModels/ViewLoginViewModel.cs
const LoginQR = require('./login-qr');
const LoginHelper = require('./login-helper');
// const { PropertyChangeAsync, ExecuteBackSpace, console, DictionaryResource } = require('./utils');

class LoginService {
    constructor(img) {
        // this.eventAggregator = new EventEmitter();
        this.tokenSource = { token: false };
        this.element = img;
    }

    async login() {
        try {
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
            this.element.src = await LoginQR.getLoginQRCodeFromUrl(loginUrl.data.url);

            console.log(loginUrl.data.url + '\n');
            console.debug('Login', loginUrl.data.url);

            this.getLoginStatus(loginUrl.data.qrcode_key);
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
                        // this.eventAggregator.emit('message', DictionaryResource.getString('LoginTimeOut'));
                        // console.info('Login', DictionaryResource.getString('LoginTimeOut'));

                        this.tokenSource.token = true;

                        // await PropertyChangeAsync(async () => {
                        //     this.tokenSource.token = false;
                        //     await this.login();
                        // });
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

                        await new Promise(resolve => setTimeout(resolve, 3000));
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
