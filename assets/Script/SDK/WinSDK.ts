import { PlatformSDK, PublishPlatform } from "./PlatformSDK";

export type WinLoginData = { sAccessToken: string, sPayToken: string, sPf: string, sPfKey: string, openID: string }

export default class WinSDK extends PlatformSDK {
    constructor() {
        super(PublishPlatform.PC);
    }

    public initSDK(): void {

    }
    public isFileSync(filePath: string): boolean {
        return false
    }
    getLanuchQuery() {
        let result = {};
        let search = window.location.search;
        if (search && search.length) {
            let arr = search.split("&");
            for (let i = 0, len = arr.length; i < len; i++) {
                let item = arr[i].split("=");
                result[item[0]] = item[1];
            }
        }
        return { "query": result };
    }

    isSuportVideoAd() {
        return true
    }
    isSuportPayment() {  //是否支持充值
        return false
    }

    public writeGameLoginRequest(loginReq: TRequestLogin) {
        let localLoginData: { sAccessToken: string, sPayToken: string, sPf: string, sPfKey: string, openID: string } = this._loginData;
        loginReq.sAccessToken = localLoginData.sAccessToken;
        loginReq.sPayToken = localLoginData.sPayToken;
        loginReq.sPf = localLoginData.sPf;
        loginReq.sPfKey = localLoginData.sPfKey;
    }

    /**
     * pc端登录
     *
     * @param {FunctionWrapper<(err: any, data: WinLoginData) => void>} handler
     */
    public platformLogin(): void {
        super.platformLogin();
        let openID = "test";
        let accessKey = "test";
        let pf = "test";
        let pfKey = "pfkey";

        this._platformOpenID = openID;
        this.onLoginSuccess({ sAccessToken: accessKey, sPayToken: "", sPf: pf, sPfKey: pfKey, openID: openID });
    }
    public requestPayment(diamondNum: number, sandBoxID: number): Promise<any> {
        return new Promise((resolve, reject) => {
            reject({ errcode: 4 });
        })
    }

    toTempFilePath(...params: any[]) {
        throw new Error("Method not implemented.");
    }
    public readFile(filePath: string, encoding: string): string | ArrayBuffer {
        throw new Error("Method not implemented.");
    }
    public rmdir(dir: string, success: () => void, fail: (errMsg: string) => void) {
        throw new Error("Method not implemented.");
    }
    
    public writeTokenRefreshRequest(tokenData: any, refreshRequest: any) {
        throw new Error("Method not implemented.");
    }
}

if (!CC_EDITOR && cc.sys.isBrowser && !window["FBInstant"])
    PlatformSDK.instance = new WinSDK();
