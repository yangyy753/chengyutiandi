import Dictionary from "../Struct/Dictionary";
import { NetWorkStatusInfo } from "../Net/Network";
import { NetworkTypes } from "../Net/NetworkTypes";
import { Debug } from "../Common/Log/LogManager";
import TMap from "../Struct/TMap";
import ShareConfigItem from "./Share/ShareConfigItem";
import ShareCard from "./Share/ShareCard";
import { gameGlobal, I18n } from "../GameGlobal";
import { msg } from "../Common/Message/MessageManager";

export const enum PlatformEventTypes {
    NETWORK_CHANGED = "platform-NETWORK_CHANGED",
    PLATFORM_LOGIN_COMPLETE = "PLATFORM_LOGIN_COMPLETE",
    PLATFORM_TOKEN_REFRESH = "PLATFORM_TOKEN_REFRESH",
}

export const enum PlatfromParamKeys {
    WX_USER_BUTTON_RECT = "WX_USER_BUTTON_RECT",
    WX_USER_BUTTON_CALLBACK = "WX_USER_BUTTON_CALLBACK",
}

export const enum PlatformSysSettingKeys {
    CDN = "CDN",
    PAY_Sandbox = "PAY_Sandbox",
    ENV = "env",
    AVATAR_HOST = "AVATAR_HOST",
    QIPU_HOST = "QIPU_HOST",
}

export enum PublishPlatform {
    DEV = 0,
    WX_GAME = 1,
    FB_GAME = 2,
    ANDROID = 3,
    IOS = 4,
    PC = 5
}

export abstract class PlatformSDK extends cc.EventTarget {
    public static instance: PlatformSDK = null;

    protected _appParams: Dictionary;

    protected _currPlatform: PublishPlatform;

    protected _settingData: any;

    protected _isLoginInit: boolean = false;

    protected _currNetworkStatus: NetWorkStatusInfo;

    protected currWorker: Worker = null;

    protected _loginData: any;

    protected _lastLoginSuccessTime: number;

    protected _loginStatusPeriod: number;

    protected _platformOpenID: string;

    protected _isPlatformLogining: boolean;

    protected _shareConfigMap: TMap<string, ShareConfigItem[]>;

    constructor(platType) {
        super();
        this._appParams = new Dictionary();
        this._currPlatform = platType;
        this._lastLoginSuccessTime = 0;
        this._loginStatusPeriod = 0;
        this._loginData = null;
        this._platformOpenID = "";
        this._currNetworkStatus = { isConnected: true, networkType: NetworkTypes.WIFI };
        this._isPlatformLogining = false;
    }

    get isLogining() {
        return this._isPlatformLogining;
    }

    get currPlatform() {
        return this._currPlatform;
    }

    get deviceModel() {
        return "";
    }

    public initSDK(): void {
        this.createWorker("workers/AI/AIEngine.js", "AIEngine");
    }

    get platformOpenID() {
        return this._platformOpenID;
    }

    getAvailableWindowSize(): { width: number, height: number } {
        return cc.view.getFrameSize();
    }

    get isSupportWorker() {
        return !CC_DEV && (typeof (Worker) !== 'undefined');
    }

    createWorker(jsPathOrFunc: string | Function, name?: string): Worker {
        if (this.isSupportWorker) {
            Debug.Log("preLoad AI Engine");
            let worker = this._creatorWorkerInstance(jsPathOrFunc, name);
            return worker;
        }
        else {
            return null;
        }
    }

    protected _creatorWorkerInstance(jsPathOrFunc: string | Function, name?: string): Worker {
        if (!this.currWorker) {
            if (typeof (jsPathOrFunc) === "function") {
                var code = '(' + jsPathOrFunc.toString() + ')(true)\n\n';
                var blob = new Blob([code], { type: 'application/javascript' });
                let scriptURL = URL.createObjectURL(blob);
                this.currWorker = new Worker(scriptURL, name ? { "name": name } : null);
            }
            else {
                this.currWorker = new Worker(jsPathOrFunc, name ? { "name": name } : null);
            }
        }

        return this.currWorker;
    }

    public setPlatformSetting(settingData): void {
        this._settingData = settingData;
    }

    get settingData() {
        return this._settingData;
    }

    public setAppParams(key: string, value: any): void {
        this._appParams.set(key, value);
    }

    public getAppParams(key: string): any | null {
        return this._appParams.get(key);
    }

    public removeAppParams(key: string): void {
        this._appParams.delete(key);
    }

    public callPlatformMethod(methodName: string, ...params: any[]): boolean {
        return false;
    }

    public getPlatformUserData(): { gameID: number, clientType: number, openPlatformType: number } {
        return null;
    }

    public getLocaleLanguage(): string {
        return 'zh';
    }

    get isLogined() {
        if (!this._loginData) {
            return false;
        }
        let currTime = cc.sys.now();
        if ((currTime - this._lastLoginSuccessTime) > (this._loginStatusPeriod * 1000)) {//登录态已经过期
            return false;
        }
        return true;
    }

    get platformLoginResult() {
        return this._loginData;
    }

    public platformLogin(...params): void {
        this._isPlatformLogining = true;
    }

    public platformLogout(...params): void {//退出平台登录
        this._isPlatformLogining = false;
        this._loginData = null;
        this._lastLoginSuccessTime = 0;
    }

    public abstract writeGameLoginRequest(loginRequest: TRequestLogin);
    public abstract writeTokenRefreshRequest(tokenData: any, refreshRequest: TRequestRefreshToken);


    protected onLoginSuccess(loginData: any) {
        this._isPlatformLogining = false;
        this._loginData = loginData;
        this._lastLoginSuccessTime = cc.sys.now();
        this.emit(PlatformEventTypes.PLATFORM_LOGIN_COMPLETE, true, loginData);
    }

    protected onLoginFail(errCode: number, errReason: string, isBreakGame: boolean, platformParams?: any) {
        this._isPlatformLogining = false;
        this._lastLoginSuccessTime = 0;
        this.emit(PlatformEventTypes.PLATFORM_LOGIN_COMPLETE, false, errCode, errReason, isBreakGame, platformParams);
    }

    protected onRefreshToken(loginData: any) {
        this.emit(PlatformEventTypes.PLATFORM_TOKEN_REFRESH, loginData);
    }

    public checkUpdate(): void {

    }
    public gameLoginReport(userInfo: any): void {
    }

    public gameLogoutReport(userInfo: any): void {
    }

    public getLanuchQuery(): any {
        return null;
    }

    createRewardedVideoAd(playSuccFun: Function, playErrFun: Function) {
    }

    getRewardedVedioAd() {
        return false;
    }

    showRewardedVideoAd(playSuccFun?: Function, playErrFun?: Function) {
    }

    isSuportVideoAd() {
        return false
    }

    isSuportPayment() {
        return false
    }

    public exitGame(): void {
    }

    public getStorageASync(key: string): Promise<object> {
        return new Promise((resolve, reject) => {
            let data = cc.sys.localStorage.getItem(key);

            if (data == "[object Object]") {
                Debug.Warning("Data error, set null", key);
                cc.sys.localStorage.setItem(key, null)
                data = null
            }

            let resultData = (data != null && data != undefined) ? JSON.parse(data) : null;
            resolve(resultData)
        })
    }

    public setStorageASync(key: string, value: any): Promise<object> {
        return new Promise((resolve, reject) => {
            let resultData = JSON.stringify(value)
            cc.sys.localStorage.setItem(key, resultData);
            resolve(value)
        })
    }
    public getStorageSync(key: string): any {
        let data = cc.sys.localStorage.getItem(key);
        if (data == "[object Object]") {
            Debug.Warning("Data error, set null", key);
            cc.sys.localStorage.setItem(key, null);
            data = null;
        }

        let resultData = (data != null && data != undefined) ? JSON.parse(data) : null;
        return resultData;
    }

    public navigateToMiniProgram(appid?: string, evn?: string, path?: string): void {
    }


    public openCustomerServiceConversation(): void {
    }

    public toTempFilePathSync(canvas): string {
        return canvas.toDataURL();
    }

    abstract async toTempFilePath(...params: any[])

    public screenshot(targetNode: cc.Node): void {
    }


    public async createSharePotho(shareNode: cc.Node) {
    }

    public isShowCopyright() {
        return true;
    }
    public triggerGC(): void {

    }

    //#region Payment
    public requestPayment(buyItemData: any, sandBoxID: number): Promise<any> {
        return new Promise((resolve, reject) => {
            reject();
        });
    }
    //#endregion

    get isNetworkConnected() {
        return this._currNetworkStatus.isConnected;
    }

    public getCurrNetworkType(): NetWorkStatusInfo {
        let currNetwork = cc.sys.getNetworkType();
        this._currNetworkStatus.isConnected = currNetwork != cc.NetworkType.NONE;
        this._currNetworkStatus.networkType = currNetwork == cc.NetworkType.NONE ? NetworkTypes.NONE : (
            currNetwork == cc.NetworkType.LAN ? NetworkTypes.WIFI : NetworkTypes._4G
        );
        return this._currNetworkStatus;
    }

    public updateCurrNetworkStatus(success: (res: NetWorkStatusInfo) => void) {
        let currNetwork = cc.sys.getNetworkType();
        let netEnum = cc.NetworkType;
        this._currNetworkStatus.isConnected = currNetwork != netEnum.NONE;
        this._currNetworkStatus.networkType = currNetwork == netEnum.NONE ? NetworkTypes.NONE : (
            currNetwork == netEnum.LAN ? NetworkTypes.WIFI : NetworkTypes._4G
        );
        if (success) {
            success(this._currNetworkStatus);
        }
    }

    public async readdirAsync(dir: string): Promise<string[]> {
        return [];
    }

    public async walkUserDirectory(callFunc: (dir: string, fileList: string[]) => void) {
        if (callFunc)
            callFunc("", []);
        return [];
    }
    public async walkDirectory(dir: string, completeFun: (dir: string, fileList: string[]) => void) {
        if (completeFun)
            completeFun(dir, []);
        return [];
    }
    public getUserRootPath(): string {
        return "";
    }
    public readFileAsync(filePath: string, success: (data: string | ArrayBuffer) => void, fail: (errMsg: string) => void, encoding: string) {
        if (fail) {
            fail("Platform does not support : readFileAsync");
        }
    }
    public abstract readFile(filePath: string, encoding: string): string | ArrayBuffer;
    public abstract rmdir(dir: string, success: () => void, fail: (errMsg: string) => void);
    //删除某个目录内的全部文件和子目录
    public cleardir(dir: string, success: () => void, fail: (errMsg: string) => void) {
        if (fail) {
            fail("Platform does not support : cleardir");
        }
    }

    public unlink(filePath: string, success: () => void, fail: (errmsg: string) => void) {
        if (fail) {
            fail("Platform does not support : unlink");
        }
    }

    public unlinks(filePathList: string[], complete: (failList: string[]) => void) {
        if (complete) {
            complete(filePathList);
        }
    }
    public downloadAsset(relatUrl: string, complete: (isSuccess: boolean, localSavePth: string, localFullPath: string, assetContent: any) => void) {
        cc.loader.load(cc.path.join(this._settingData[PlatformSysSettingKeys.CDN], relatUrl), function (err: any, data: any) {
            let isSuccess = !err && data;
            if (complete) {
                complete(isSuccess, relatUrl, null, data);
            }
        });
    }

    public access(filePath: string): Promise<boolean> {
        return Promise.resolve(false);
    }

    public isFile(filePath: string): Promise<boolean> {
        return Promise.resolve(false);
    }

    public isDirecton(filePath: string): Promise<boolean> {
        return Promise.resolve(false);
    }

    public isFileSync(filePath: string): boolean {
        return false;
    }

    public isDirectonSync(filePath: string): boolean {
        return false;
    }

    public writeFile(filePath: string, content: string, complete: (isSuccess: boolean, localFullPath: string) => void, encoding: string) {
        if (complete) {
            complete(false, null);
        }
    }
    public uploadFile(localFilePath: string, fileName: string, remoteURL: string, complete: (isSuccess: boolean) => void) {

    }

    public hideKeyboard() {

    };

    public isDevTools() {
        return false;
    }

    public setClipboardData(value: string) {

    }
    public getClipboardData(cb: (data: string) => void) {
        cb(null);
    }

    //#region Share
    protected initShareConfigItemWithData(key, jsonObj): ShareConfigItem {

        let item = new ShareConfigItem();
        item.shareType = key;
        item.title = jsonObj["title"];
        item.imageURL = jsonObj["image"];
        item.reportType = jsonObj["reportType"];
        item.tag = jsonObj["tag"];
        item.dependImages = jsonObj["dependImages"];
        let platOps = jsonObj["platformParams"];
        if (platOps) {
            for (let platOpsKey in platOps) {
                item.platformOps.set(platOpsKey, platOps[platOpsKey]);
            }
        }
        return item
    }

    public setShareConfigDataWithObj(theData: Object) {
        this._shareConfigMap = new TMap<string, ShareConfigItem[]>();
        for (let key in theData) {
            let jsonObj = theData[key];

            let allItems = []

            if (Array.isArray(jsonObj)) {

                for (let index in jsonObj) {
                    let target = jsonObj[index]
                    let item = this.initShareConfigItemWithData(key, target)
                    allItems.push(item)
                }
            } else {
                let item = this.initShareConfigItemWithData(key, jsonObj)
                allItems.push(item)
            }

            this._shareConfigMap.set(key, allItems);
        }
    }

    public getShareConfigItem(shareType: string): ShareConfigItem {
        //所有配置
        let allResult = this._shareConfigMap ? this._shareConfigMap.get(shareType) : null;

        //随机配置
        let targetResult = null

        if (allResult) {

            let random = Math.floor(Math.random() * allResult.length)
            targetResult = allResult[random]
        }

        return targetResult
    }

    public async share(shareType: string, queryData: any, shareCard: ShareCard, titleParams?: any[], successCallback?: Function) {

        let shareConfig = PlatformSDK.instance.getShareConfigItem(shareType);
        if (shareConfig) {
            msg.Tips("正在加载中...", 5000, null, "ShareingDialog");
            let title = I18n.tWithZhText(shareConfig.title, titleParams);
            let queryString: string = "type=" + shareType + "&reportType=" + shareConfig.reportType;
            if (queryData) {
                for (let key in queryData) {
                    queryString += "&" + key + "=" + queryData[key];
                }
            }
            if (shareConfig.tag != undefined)
                queryString += "&" + "tag=" + shareConfig.tag;
            let platOps = shareConfig.getPlatOps(this._currPlatform);
            if (shareConfig.imageURL) {
                if (!shareCard) {
                    shareCard = new ShareCard();
                }
                shareCard.setFillImage(shareConfig.imageURL);
            }
            await shareCard.checkDraw(5);

            let self = this;
            return new Promise<boolean>((resolve, reject) => {
                Debug.Log("邀请信息:", queryString)
                self.platformShare(title, queryString, shareCard, platOps, function (isSuccess: boolean) {
                    gameGlobal.removePanelWithTag("ShareingDialog");
                    shareCard.destory();
                    if (isSuccess) {
                        if (successCallback)
                            successCallback();
                        msg.Tips("分享成功");
                    }
                    else {
                        msg.Tips("分享失败，请重试");
                    }
                    resolve(isSuccess);
                });
            })
        }
        else {
            return false;
        }
    }

    protected platformShare(title: string, queryData: string, shareNode: ShareCard, ops: Dictionary, successCallback?: (boolean) => void) {

    }
    //#endregion
}