import { PlatformSDK, PublishPlatform, PlatformEventTypes, PlatformSysSettingKeys } from "./PlatformSDK";
import { Debug } from "../Common/Log/LogManager";
import Dictionary from "../Struct/Dictionary";
import { msg } from "../Common/Message/MessageManager";
import { functionWrapper } from "../Struct/FunctionWrapper";
import { DialogDefaultOptionsTypes } from "../Common/Message/AbstractDialog";
import { NetWorkStatusInfo } from "../Net/Network";
import { NetworkTypes } from "../Net/NetworkTypes";
import ShareCard from "./Share/ShareCard";

type ToTempFilePathOption = { x?: number, y?: number, width?: number, height?: number, destWidth?: number, destHeight?: number, fileType?: string, quality?: number, success?: Function, fail?: Function, complete?: Function }


function compareWxVersion(v1, v2) {
    v1 = v1.split('.')
    v2 = v2.split('.')
    const len = Math.max(v1.length, v2.length)

    while (v1.length < len) {
        v1.push('0')
    }
    while (v2.length < len) {
        v2.push('0')
    }

    for (let i = 0; i < len; i++) {
        const num1 = parseInt(v1[i])
        const num2 = parseInt(v2[i])

        if (num1 > num2) {
            return 1
        } else if (num1 < num2) {
            return -1
        }
    }

    return 0
}


export const enum WxGender {
    UNKNOW = 0,
    MAN = 1,
    WOMEN = 2
}
export const enum WxLanguage {
    EN = "en",
    ZH_CN = "zh_CN",
    ZH_TW = "zh_TW"
}

export const enum WxAuthTypes {
    USER_INFO = "scope.userInfo",
    USER_LOCATION = "scope.userLocation",
    WE_RUN = "scope.werun",
    WRITE_PHOTO_ALBUM = "scope.writePhotosAlbum",
}


export type WxUserInfo = { nickName: string, avatarUrl: string, gender: WxGender, country: string, province: string, city: string, language: WxLanguage }
export type WxGetUserInfoResponse = { userInfo: WxUserInfo, rawData: string, signature: string, encryptedData: string, iv: string }
type AuthSetting = { "scope.userInfo": boolean, "scope.userLocation": boolean, "scope.werun": boolean, "scope.writePhotosAlbum": boolean }
type UserInfoButton = {
    type: "text" | "image", text: string, image: string,
    style: { left: number, top: number, width: number, height: number, backgroundColor?: number, borderColor?: number, borderWidth?: number, borderRadius?: number, textAlign?: "left" | "center" | "right", fontSize?: number, lineHeight?: number },
    show: () => void,
    hide: () => void,
    destroy: () => void,
    onTap: (callback: (res: WxGetUserInfoResponse) => void) => void,
    offTap: (callback: (res: WxGetUserInfoResponse) => void) => void
}
type Stats = { mode: string, size: number, lastAccessedTime: number, lastModifiedTime: string, isDirectory: () => boolean, isFile: () => boolean }

type WxSystemInfo = {
    brand: string, model: string, pixelRatio: string, screenWidth: number, screenHeight: number,
    windowWidth: number, windowHeight: number, statusBarHeight: number, language: string, version: string, system: string,
    platform: string, fontSizeSetting: number, SDKVersion: string, benchmarkLevel: number
}
export const enum WxSdkEvents {
    GET_USER_BUTTON_TAP = "WX-GET_USER_BUTTON_TAP",
    USER_INFO_UPDATE = "WX-USER_INFO_UPDATE",
    AUTH_SETTING_UPDATE = "WX-AUTH_SETTING_UPDATE",
}
// if( CC_WECHATGAME )
// {
export default class WxSDK extends PlatformSDK {
    public static USER_INFO_STORAGE_KEY: string = "UserInfo";
    public static wxAppid: string = "wx9e44d62c7ab75740";
    public static offerId: number = 1450018118;
    public static adUnitId: string = 'adunit-a65e9822c1a0dea7';//"adunit-4076182121c5eee0";
    public static navigateToID = "wx1ce18fe0bd4af481";
    public currLanuchQuery: any;

    /**
     * 顶部菜单的高度
     */
    protected _topMenuHeight: number;


    protected _authSetting: AuthSetting;

    protected _wxUserInfo: WxGetUserInfoResponse;
    protected _getUserInfoButton: UserInfoButton;

    protected _shareAppInviteType: string;

    protected _systemInfo: WxSystemInfo;
    protected _GameClubButton;
    protected _updateManager = null;   //更新管理器对象

    protected _shareCallbackFunc: (boolean) => void;
    protected _fileSystemManager: any;

    protected _videoSuccFunc: Function = null;
    protected _videoErrFunc: Function = null


    constructor() {
        super(PublishPlatform.WX_GAME);
        this._wxUserInfo = null;
        this._authSetting = null;
        //登录态5分钟过期
        this._loginStatusPeriod = 1 * 60;
        this._getUserInfoButton = null;
        this._shareCallbackFunc = null;

        window["wx"]["onError"](this.onWxErrorHandle.bind(this));
    }

    /**
     * 获取可用窗口尺寸,应对与刘海屏
     */
    getAvailableWindowSize(): { width: number, height: number } {
        return { width: this._systemInfo.windowWidth, height: this._systemInfo.windowHeight };
    }


    public async initSDK() {

        this._fileSystemManager = window["wx"]["getFileSystemManager"]();

        this.mkdir("res/import/");
        this.mkdir("res/raw-assets/");
        //保持屏幕唤醒
        window["wx"]["setKeepScreenOn"]({ "keepScreenOn": true });
        window["wx"]["showShareMenu"]({
            withShareTicket: true
        });


        window["wx"]["onShareAppMessage"](this.onShareAppMessage.bind(this));
        //首次启动时获取一次启动参数
        this.currLanuchQuery = window["wx"]["getLaunchOptionsSync"]();
        window["wx"]["onShow"](this.onWxShowHandle.bind(this));
        this._systemInfo = window["wx"]["getSystemInfoSync"]();
        console.warn("WX system info success: ", this._systemInfo);
        await this.refreshAuthSetting();
        if (this.hasUserAuth()) {
            this.refreshUserInfo();
        }

        window["wx"]["onNetworkStatusChange"](this.onNetworkStatusChange.bind(this));

        Debug.Log("获取微信用户信息:", this._wxUserInfo);
        window["wx"]["onMemoryWarning"](function (res) {
            console.warn("微信内存警告:", res);
            this.triggerGC();
        }.bind(this));

        this.createWorker("workers/AI/AIEngine.js", "AIEngine");
    }

    public isDevTools() {
        return this._systemInfo.platform == "devtools";
    }
    protected _lastCrashTime: number = 0;
    protected onWxErrorHandle(error) {
        let currTime = new Date().getTime();
        if ((currTime - this._lastCrashTime) < 60 * 1000) {//距离上一次上传crash时间小于一分钟
            return;
        }
        this._lastCrashTime = currTime;
        Debug.Warning(error["message"]);
        Debug.Warning(error["stack"]);
        let isUpload = true;
        let isShowTips: boolean = false;
        if (AppDefines.CURR_ENV == "public") {//是发布环境,10%的采样率
            isUpload = (Math.random() * 10) <= 1;
        }
        else {
            isShowTips = true;
        }

        if (isUpload) {
            let logTag = "crash";
            do {
                if (!error["message"]) {
                    break;
                }


                let stackList = error["message"].split("\n");
                for (let i = 0, len = stackList.length; i < len; i++) {
                    let msg = stackList[i];
                    //目前发现两种形式：
                    //1: at e.refreshList (https://usr/game.js:141:708600)
                    //2: setItemInfo@https://usr/game.js:141:395243
                    //3：at e.onRoomEvent (game.js:141:167056)
                    // msg = msg.replace(  / /g,'' );
                    let index = msg.indexOf(" (http");
                    if (index >= 0) {
                        let beginIndex = msg.indexOf("at ");
                        if (beginIndex < 0) {
                            continue;
                        }
                        logTag = msg.substring(beginIndex + 3, index);
                        break;
                    }
                    index = msg.indexOf("@http");
                    if (index >= 0) {
                        logTag = msg.substring(0, index);
                        break;
                    }
                    index = msg.indexOf(" (game.js:");
                    if (index >= 0) {
                        let beginIndex = msg.indexOf("at ");
                        if (beginIndex < 0) {
                            continue;
                        }
                        logTag = msg.substring(beginIndex + 3, index);
                        break;
                    }
                }
            } while (false);
            Debug.upload(logTag, isShowTips);
        }
    }

    public getUserRootPath() {
        return window["wx"]['env']['USER_DATA_PATH'];
    }
    public setPlatformSetting(settingData): void {
        super.setPlatformSetting(settingData);
        this.postMessage("InitSubAssets", { cdnPath: this.getUserRootPath() });
    }

    protected onShareAppMessage() {
        let shareConfig = this.getShareConfigItem(this._shareAppInviteType);
        if (!shareConfig) {
            return;
        }
        let realLoadURL;

        let originURL = shareConfig.imageURL

        //新增，如果是share开头的图片，则需要去找最新版本的share图片
        //let shareIndex = originURL.indexOf("share/")
        // if(shareIndex>=0){
        //     let fileName =  originURL.slice(shareIndex+"share/".length)
        //     originURL = fdk.$AssetManager.getExternalAssetPath("share",fileName)
        // }

        if (originURL.slice(0, "http".length) == "http" || originURL.slice(0, "wxfile".length) == "wxfile") {
            realLoadURL = originURL;
        } else if (this.isFileSync(originURL)) {
            realLoadURL = cc.path.join(this.getUserRootPath(), originURL);
        }
        else {
            realLoadURL = cc.path.join(this.settingData[PlatformSysSettingKeys.CDN], originURL);
        }
        return {
            title: shareConfig.title,
            imageUrl: realLoadURL,
            query: "",
        }
    }

    initShareAppConfigType(inviteType: string) {
        this._shareAppInviteType = inviteType;
    }

    /**
     * 获取设备型号
     */
    get deviceModel() {
        return this._systemInfo ? this._systemInfo.model : "";
    }

    get wxUserInfo() {
        return this._wxUserInfo ? this._wxUserInfo.userInfo : null;
    }

    protected async getAuthSetting(): Promise<AuthSetting> {
        return new Promise(function (resolve, reject) {
            window["wx"]["getSetting"]({
                success: function (res: { authSetting: AuthSetting }) {
                    resolve(res.authSetting);
                },
                fail: function (err: any) {
                    console.warn("WX getAuthSetting fail:", err);
                    resolve(null);
                }
            });
        });
    }

    public async refreshUserInfo() {
        let userInfo = await this.getWxUserInfo();
        if (userInfo) {
            this._wxUserInfo = userInfo;
            this.emit(WxSdkEvents.USER_INFO_UPDATE, this._wxUserInfo.userInfo);
        }
    }

    protected async refreshAuthSetting() {
        this._authSetting = await this.getAuthSetting();
    }

    public hasUserAuth(isRefresh: boolean = false) {
        if (isRefresh) {
            this.refreshAuthSetting();
        }
        return this._authSetting && this._authSetting["scope.userInfo"];
    }

    public async hasUserAuthAsync() {
        this._authSetting = await this.getAuthSetting();
        return this.hasUserAuth();
    }


    protected getMenuButtonBoundClientRect(): { width: number, height: number, top: number, right: number, bottom: number, left: number } {
        if (window["wx"]["getMenuButtonBoundingClientRect"]) {
            return window["wx"]["getMenuButtonBoundingClientRect"]();
        }
        return null;

    }

    public static ConvertWxPosToCocos(wxpos: { x: number, y: number }): { x: number, y: number } {
        let canvasWidth = screen.availWidth;
        let canvasHeight = screen.availHeight;
        let frameSize = cc.view.getFrameSize();
        let winsize = cc.Canvas.instance.designResolution;

        let sceneScale = 1;
        if (cc.Canvas.instance.fitHeight) {
            sceneScale = winsize.height / canvasHeight;
        } else {
            sceneScale = winsize.width / canvasWidth;
        }
        let target = { x: 0, y: 0 };
        target.x = wxpos.x * sceneScale;
        target.y = (canvasHeight - wxpos.y) * sceneScale;
        return target;
    }
    public static ConvertCocosPosToWx(pos: { x: number, y: number }): { x: number, y: number } {
        let canvasWidth = screen.availWidth;
        let canvasHeight = screen.availHeight;
        let frameSize = cc.view.getFrameSize();
        let winsize = cc.Canvas.instance.designResolution;

        let sceneScale = 1;
        if (cc.Canvas.instance.fitHeight) {
            sceneScale = winsize.height / canvasHeight;
        } else {
            sceneScale = winsize.width / canvasWidth;
        }
        let target = { x: 0, y: 0 };
        target.x = pos.x * sceneScale;
        target.y = (canvasHeight - pos.y) * sceneScale;
        return target;
    }
    public static ConvertCocosRectToWx(rect: { x: number, y: number, width: number, height: number }): { left: number, top: number, width: number, height: number } {
        let ccView = cc.view;
        let frameSize = ccView.getFrameSize();
        let visibleSize = ccView.getVisibleSize();

        let sceneScaleX = screen.availWidth / visibleSize.width;
        let sceneScaleY = screen.availHeight / visibleSize.height;

        let result = { left: 0, top: 0, width: 0, height: 0 };
        result.left = rect.x * sceneScaleX;
        result.top = rect.y * sceneScaleY;
        result.width = rect.width * sceneScaleX;
        result.height = rect.height * sceneScaleY;

        result.top = screen.height - result.top - result.height;
        return result;
    }

    protected onWxShowHandle(queryData: any) {
        console.warn("WXSDK:onWxShowHandle:", queryData);
        this.currLanuchQuery = queryData;

        if (this._shareCallbackFunc) {
            this._shareCallbackFunc(true);
            this._shareCallbackFunc = null;
        }
    }

    public getLanuchQuery() {
        return this.currLanuchQuery;
    }

    public callPlatformMethod(methodName: string, successFunc: Function, failFunc: Function, ...params: any[]): boolean {
        if (window["wx"][methodName]) {
            window["wx"][methodName].apply(null, params);
            return true;
        }
        return false;
    }

    public async toTempFilePath(wxCanvas?: any, options?: ToTempFilePathOption) {
        let canvas = cc.game.canvas;
        if (wxCanvas) {
            canvas = wxCanvas;
        } else {
            canvas = cc.game.canvas
        }
        return new Promise((resolve, reject) => {
            let params = {
                "success": (res) => {
                    resolve(res["tempFilePath"])
                },
                "fail": (res) => {
                    resolve(null)
                }
            }
            if (options) {
                for (let key in options) {
                    params[key] = options[key];
                }
            }
            canvas["toTempFilePath"](params)
        })
    };
    public toTempFilePathSync(canvas): string {
        try {
            let path = canvas['toTempFilePathSync']({
                "x": 0, "y": 0, fileType: "png", "width": canvas.width, "height": canvas.height, "destWidth": canvas.width, "destHeight": canvas.height
            });
            return path;
        } catch (e) {
            return null;
        }
    }

    protected platformShare(title: string, queryData: string, shareNode: ShareCard, ops: Dictionary, successCallback?: (boolean) => void) {
        let filePath = this.toTempFilePathSync(shareNode.getCanvas());
        Debug.Log("分享卡片图片生成:" + filePath);

        if (filePath) {
            this._shareCallbackFunc = successCallback;
            window["wx"]["shareAppMessage"]({
                "title": title,
                "imageUrl": filePath,
                "query": queryData,
            })
            return true;
        }
        else {
            if (successCallback) {
                successCallback(false);
            }
            return false;
        }
    }


    public async getWxUserInfo(): Promise<WxGetUserInfoResponse> {
        return new Promise(function (resolve, reject) {
            window["wx"]["getUserInfo"]({
                withCredentials: true,
                success: function (res: WxGetUserInfoResponse) {
                    resolve(res);
                },
                fail: function (err: any) {
                    Debug.Error("getUserInfo fail", err);
                    resolve(null);
                },
                complete: function () {
                    Debug.Log("getUserInfo complete", arguments);
                }
            });
        });
    }

    public async wxLogin(): Promise<string> {
        return new Promise(function (resolve, reject) {
            window["wx"]["login"]({
                timeout: 10000,
                success: function (res: { code: string }) {
                    console.warn("WX login success:", res);
                    resolve(res.code);
                },
                fail: function (err: any) {
                    console.warn("WX wxlogin fail:", err);
                    reject(err);
                }
            })
        });
    }

    public writeGameLoginRequest(loginReq: TRequestLogin) {
        let localLoginData: { userInfo: WxUserInfo, wxCode: string } = this._loginData;
        if (localLoginData.userInfo) {
            loginReq.sIconUrl = localLoginData.userInfo.avatarUrl;
            loginReq.iSex = localLoginData.userInfo.gender;
            loginReq.sNickName = localLoginData.userInfo.nickName;
            loginReq.sProvice = localLoginData.userInfo.province;
            loginReq.sCity = localLoginData.userInfo.city;
        }
        loginReq.sWXGameCode = localLoginData.wxCode;
        //使用过一次，立即失效
        this._loginData = null;
    }

    public async platformLogin() {
        // console.warn( "WXSDK platformLogin-->1" )
        super.platformLogin();
        try {
            // console.warn( "WXSDK platformLogin-->5,begin wx login" )
            let code = await this.wxLogin();
            // console.warn( "WXSDK platformLogin-->5,wx login complete,code=",code );
            if (this._wxUserInfo) {
                this.onLoginSuccess({ userInfo: this._wxUserInfo.userInfo, wxCode: code });
                // this.emit( PlatformEventTypes.PLATFORM_LOGIN_COMPLETE,true, {userInfo:this._wxUserInfo.userInfo,wxCode:code});
                // handler.execute( null,{userInfo:this._wxUserInfo.userInfo,wxCode:code} );
            }
            else {
                this.onLoginSuccess({ userInfo: null, wxCode: code });
                // this.emit( PlatformEventTypes.PLATFORM_LOGIN_COMPLETE,true, {userInfo:null,wxCode:code});
                // handler.execute( null,{userInfo:null,wxCode:code} );
            }
        }
        catch (err) {

            this.onLoginFail(-1, err.errMsg, true);
            // this.emit( PlatformEventTypes.PLATFORM_LOGIN_COMPLETE,false, err);
            // handler.execute( err,null);
        }
        if (!this._wxUserInfo) {
            // console.warn( "WXSDK platformLogin-->2" )
            let isUserAuth = await this.hasUserAuthAsync();
            // console.warn( "WXSDK platformLogin-->isUserAuth=",isUserAuth )
            if (isUserAuth) {
                this.refreshUserInfo();
                // console.warn( "WXSDK platformLogin-->4" )
            }
        }
    }

    // public requestPayment(itemData: TSaleGoodsInfo, sandBoxID: number): Promise<any> {

    //     // var isDebug = options.isDebug;
    //     // var amount = options.amount < 10 ? 10 : options.amount; //amount代表钻石数(1块钱=10钻石)，注意amount必须是10的整数倍
    //     // var offerId = options.offerId === undefined ? WxSDK.offerId : options.offerId;
    //     // var platform = options.platform === undefined ? "android" : options.platform;

    //     Debug.Log("发起充值:,", itemData, sandBoxID)

    //     return new Promise((resolve, reject) => {
    //         if (cc.sys.os == cc.sys.OS_IOS) {//IOS系统无法支付
    //             reject({ errcode: 4 });
    //             return;
    //         }
    //         window["wx"]["requestMidasPayment"]({
    //             "mode": 'game',
    //             "env": sandBoxID, //环境配置 1：米大师沙箱环境， 0 或不传：米大师正式环境
    //             "offerId": WxSDK.offerId,
    //             "currencyType": "CNY",
    //             "buyQuantity": itemData.uItemCount,
    //             "loginWXAppId": WxSDK.wxAppid,
    //             "changeWXOpenId": "1",
    //             "zoneId": "2",
    //             "platform": "android",//微信小游戏平台只支持android
    //             "success": (res) => { // 转发成功
    //                 resolve(res)
    //             },
    //             "fail": (res) => { // 转发失败
    //                 reject(res)
    //             }
    //         })
    //     })

    // }


    public hideGetUserInfoButton() {
        if (this._getUserInfoButton) {
            this._getUserInfoButton.hide();
        }
    }
    public destoryUserInfoButton() {
        if (this._getUserInfoButton) {
            this._getUserInfoButton.destroy();
            this._getUserInfoButton = null;
        }
    }

    public showFriendCircle(posNode: cc.Node) {

    }

    public showGetUserInfoButton(posNode: cc.Node) {

        this.destoryUserInfoButton();
        //获取世界坐标下的登录按钮的 rect
        let buttonWordRect = posNode.getBoundingBoxToWorld();
        //获取canvas坐标系下的rect
        let canvasRect = WxSDK.ConvertCocosRectToWx(buttonWordRect);

        if (window["wx"]["createUserInfoButton"]) {
            this._getUserInfoButton = window["wx"]["createUserInfoButton"]({
                type: 'text',
                text: "",
                style: {
                    //  backgroundColor: '#ff0000',
                    left: canvasRect.left,
                    top: canvasRect.top,
                    width: canvasRect.width,
                    height: canvasRect.height
                }
            });
            if (this._getUserInfoButton) {
                let self = this
                this._getUserInfoButton.onTap(this.onGetUserButtonTap.bind(this));
            }
        }

        if (this._getUserInfoButton) {
            this._getUserInfoButton.show();
        }
    }

    protected onGetUserButtonTap(res: WxGetUserInfoResponse) {
        Debug.Log("WX onGetUserButtonTap:res:", res);
        if (res && res.userInfo) {
            if (!this._authSetting) {
                this._authSetting = null;
                return;
            }
            this._authSetting[WxAuthTypes.USER_INFO] = true;
            this._wxUserInfo = res;
            this.emit(WxSdkEvents.USER_INFO_UPDATE, this._wxUserInfo.userInfo);
        }
        this.emit(WxSdkEvents.GET_USER_BUTTON_TAP, this._wxUserInfo ? this._wxUserInfo.userInfo : null);
    }

    public exitGame(): void {
        window["wx"]["exitMiniProgram"]({
            "success": function (res) {
                Debug.Log("退出游戏成功", res)
            },
            "fail": function (res) {
                Debug.Error("退出游戏失败", res)
            },
        });
    }

    public openCustomerServiceConversation(): void {
        //客服的入口接入
        //只需要打开客服会话窗口，不需要发送卡片点击重回游戏。
        //没有开通接口则弹窗显示即将开放消息
        if (window["wx"]["openCustomerServiceConversation"]) {
            window["wx"]["openCustomerServiceConversation"]({
                "sessionFrom": "", //会话框的来源
                "showMessageCard": false, //是否显示消息内会话卡片
                "sendMessageTitle": "", //会话内消息卡片的标题
                "sendMessagePath": "", //会话内消息卡片的路径
                "sendMessageImg": "", //会话内消息卡片的图片路径
                "success": function (res) { //接口调用成功的回调函数
                    Debug.Log("[Test] openCustomerServiceConversation:", res)
                },
                "fail": function (errorMsg) { //接口调用失败的回调函数
                    Debug.Log("[Test] openCustomerServiceConversation fail:", errorMsg)
                },
                "complete": function (msg) { //接口调用结束时的回调函数（无论失败成功）
                    Debug.Log("[Test]openCustomerServiceConversation:", msg)
                }
            });
        }
    }




    public getStorageASync(thekey: string): Promise<object> {
        return new Promise((resolve, reject) => {

            window["wx"]["getStorage"]({
                key: thekey,
                success: function (res) {
                    Debug.Log("获取本地数据成功", thekey, res.data)
                    resolve(res.data);
                },
                fail: function () {
                    Debug.Error("获取本地数据失败", thekey)
                    reject(null);
                }
            })


        })

    }
    public setStorageASync(key: string, value: any): Promise<object> {
        return new Promise((resolve, reject) => {
            window["wx"]["setStorage"]({
                key: key,
                data: value,
                success: function (res) {
                    Debug.Log("存储本地数据成功", key, res)
                    resolve(res);
                },
                fail: function (res) {
                    Debug.Error("存储本地数据失败", key, res)
                    reject(null);
                }
            })
        })
    }

    /**
     * 没有值时返回""
     * @param key 
     */
    public getStorageSync(key: string): any {
        let data = window["wx"]["getStorageSync"](key)
        Debug.Log("获取本地数据", key, data)
        return data
    }
    // 判断是否大于最低版本
    checkMinVersion(minVersion: number[]) {
        var bHighVersion = true;
        var SDKVersion: string = this._systemInfo.SDKVersion;
        let versionArr = SDKVersion ? SDKVersion.split(".") : [];
        for (var i = 0; i < versionArr.length; i++) {
            let ver = parseInt(versionArr[i]);
            if (ver > minVersion[i]) break; else if (ver < minVersion[i]) {
                bHighVersion = false;
                break;
            }
        }
        return bHighVersion;
    }
    protected _rewardedVideoAd: any = null;
    public getVedioAdSuccess: boolean = false;
    createRewardedVideoAd(playSuccFun: Function, playErrFun: Function) {
        if (this._rewardedVideoAd) {
            return;
        }

        this._videoSuccFunc = playSuccFun
        this._videoErrFunc = playErrFun

        //广告必须大于2 0 4
        if (!window["wx"]["createRewardedVideoAd"]) return;
        if (!this.checkMinVersion([2, 0, 4])) return;
        this._rewardedVideoAd = window["wx"]["createRewardedVideoAd"]({
            "adUnitId": WxSDK.adUnitId
        });
        let self = this;
        this._rewardedVideoAd.onLoad(function () {
            Debug.Log('激励视频 广告加载成功');
            self.getVedioAdSuccess = true;
        });
        this._rewardedVideoAd.onError(function (err) {
            Debug.Log("播放失败", err);
            msg.Tips("视频加载失败，请重试");
        });
    }

    showRewardedVideoAd(SuccFun?: Function, errFun?: Function) {
        if (!this.getVedioAdSuccess) {
            Debug.Log('激励视频 广告加载失败');
        }
        if (this._rewardedVideoAd) {
            let self = this
            this._rewardedVideoAd.onClose(function (res) {
                Debug.Log('监听用户点击关闭广告视频按钮事件');
                if (res && res.isEnded || res === undefined) {

                    //如果有动态的回调，则调用，否则调用预先设置好的回调函数
                    if (SuccFun) {
                        SuccFun();
                        SuccFun = null  //防止多次点击
                    } else if (self._videoSuccFunc) {
                        self._videoSuccFunc();
                    } else {
                        Debug.Error("广告播放成功回调 不存在")
                    }

                } else {

                    //如果有动态的回调，则调用，否则调用预先设置好的回调函数
                    if (errFun) {
                        errFun();
                    } else if (self._videoErrFunc) {
                        self._videoErrFunc();
                    } else {
                        Debug.Error("广告播放失败回调 不存在")
                    }
                }
            });



            this._rewardedVideoAd.show().catch(err => {
                this._rewardedVideoAd.load().then(() => this._rewardedVideoAd.show())
            })
        } else {
            console.warn(">> no this._rewardedVideoAd >> showRewardedVideoAd");
        }
    }
    getRewardedVedioAd() {
        return this.getVedioAdSuccess;
    }
    isSuportVideoAd() {
        return true
    }

    isSuportPayment() {
        return cc.sys.os != cc.sys.OS_IOS
    }

    navigateToMiniProgram(appid?: string, evn?: string, path?: string) {
        if (!window["wx"]["navigateToMiniProgram"]) {
            window["wx"]["showModal"]({
                title: '提示',
                content: '当前微信版本过低，无法使用该功能，请升级到最新微信版本后重试。'
            })
            return;
        }
        appid = appid ? appid : WxSDK.navigateToID
        evn = evn ? evn : "release"
        path = path ? path : ""

        window["wx"]["navigateToMiniProgram"]({
            appId: appid,
            path: path,
            extraData: {
                from: 'chess_Mini'
            },
            envVersion: evn,
            success(res) {
                // 打开成功
                Debug.Log("navigateToMiniProgram成功", res);
            },
            fail(res) {
                // 打开成功
                console.warn("navigateToMiniPrograms失败:", res)
            }

        })
    }
    getLocaleLanguage() {
        if (this._systemInfo.language.indexOf("zh") >= 0) {
            return "zh";
        }
        return "en";
    }

    postMessage(msgType: string, param: any = null) {
        window["wx"]["postMessage"]({ "type": msgType, "param": param });
    }


    protected onNetworkStatusChange(res: NetWorkStatusInfo) {
        Debug.Log("WX onNetworkStatusChange:", res);
        this._currNetworkStatus = res;
        this.emit(PlatformEventTypes.NETWORK_CHANGED, res);
    }

    public updateCurrNetworkStatus(success: (res: NetWorkStatusInfo) => void) {
        let self = this;
        window["wx"]["getNetworkType"]({
            success: function (res: { networkType: NetworkTypes }) {
                Debug.Log("WX getCurrNetworkType success:", res);
                self._currNetworkStatus.networkType = res.networkType;
                self._currNetworkStatus.isConnected = res.networkType != NetworkTypes.NONE;
                if (success) {
                    success({ isConnected: res.networkType != NetworkTypes.NONE, networkType: res.networkType });
                }
            },
            fail: function (err: any) {
                console.warn("WX getCurrNetworkType fail:", err);
            }
        });
    }

    public showGameClubButton(posNode: cc.Node): void {
        if (this._GameClubButton) {
            this._GameClubButton.show();
            return;
        }
        //获取世界坐标下的游戏圈按钮的 rect
        let buttonWordRect = cc.rect();// posNode.getBoundingBoxToWorld();
        let left_bottom = posNode.convertToWorldSpace(cc.v2(0, 0))
        let right_top = posNode.convertToWorldSpace(cc.v2(posNode.width, posNode.height));

        buttonWordRect.x = left_bottom.x;
        buttonWordRect.y = left_bottom.y;
        buttonWordRect.width = right_top.x - left_bottom.x;
        buttonWordRect.height = right_top.y - left_bottom.y;

        let offY = 0;
        let offHeight = 0;
        // if( compareWxVersion( this._systemInfo.SDKVersion,"2.6.4" ) == -1 && this._systemInfo.model.indexOf("iPhone X") >= 0 )
        // {
        //     offY += 5;
        //     offHeight+=20;
        // }


        //获取canvas坐标系下的rect
        let canvasRect = WxSDK.ConvertCocosRectToWx(buttonWordRect);
        Debug.Log("wx canvas 区域：", canvasRect)
        if (window["wx"]["createGameClubButton"]) {
            this._GameClubButton = window["wx"]["createGameClubButton"]({
                type: 'text',
                text: "",
                style: {
                    left: canvasRect.left,
                    top: canvasRect.top + offY,
                    width: canvasRect.width,
                    height: canvasRect.height + offHeight,
                    //backgroundColor: '#ff0000',
                }
            });
            this._GameClubButton.onTap((res) => { Debug.Log(res) })
            this._GameClubButton.show();


        }
    }
    public hideGameClubButton(): void {
        if (this._GameClubButton) {
            this._GameClubButton.hide();
        }
    }
    public readFileAsync(filePath: string, success: (data: string | ArrayBuffer) => void, fail: (errMsg: string) => void, encoding: string = "utf-8") {
        let fullPath = this.formatToFullPath(filePath);
        let fileSystem = this._fileSystemManager;
        fileSystem["readFile"]({
            "filePath": fullPath,
            "encoding": encoding,
            "success": function (res) {
                if (success) {
                    success(res["data"]);
                }
            },
            "fail": function (err) {
                if (fail) {
                    fail(err["errMsg"]);
                }
            }
        })
    }
    public readFile(filePath: string, encoding: string = "utf-8"): string | ArrayBuffer {
        let fullPath = this.formatToFullPath(filePath);
        let fileSystem = this._fileSystemManager;
        try {
            let data = fileSystem["readFileSync"](fullPath, encoding);
            return data;
        }
        catch (err) {
            console.warn("readFile fail:", err);
            return null;
        }
    }
    public async readdirAsync(dir: string): Promise<string[]> {
        let fullPath = this.formatToFullPath(dir);
        let fileSystem = this._fileSystemManager;
        return await new Promise(function (resolve, reject) {
            fileSystem["readdir"]({
                "dirPath": fullPath,
                "success": function (res) {
                    resolve(res["files"]);
                },
                "fail": function (err) {
                    console.warn("[Asset] readDir fail:", err);
                    resolve(null)
                }
            })
        });
    }


    public async walkUserDirectory(callFunc: (dir: string, fileList: string[]) => void) {
        return await this.walkDirectory("", callFunc);
    }

    public async walkDirectory(dir: string, completeFun: (dir: string, fileList: string[]) => void) {
        // let fullPath = this.formatToFullPath(dir );
        // let fileSystem = this._fileSystemManager;
        let files: string[] = await this.readdirAsync(dir);
        let fileList = [];

        if (files && files.length > 0) {
            for (let i = 0, len = files.length; i < len; i++) {
                let filePath = cc.path.join(dir, files[i])
                let stateInfo: Stats = await this.getFileStatSync(filePath);
                if (stateInfo && stateInfo.isDirectory()) {
                    let childFileList = await this.walkDirectory(filePath, null)
                    fileList.push.apply(fileList, childFileList);
                }
                else {
                    fileList.push(filePath);
                }
            }
        }
        if (completeFun) {
            completeFun(dir, fileList);
        }
        return fileList;
    }

    public async getFileStatASync(path: string): Promise<Stats> {
        let isExist = await this.access(path);
        if (!isExist) {
            return null;
        }
        let fullPath = this.formatToFullPath(path);
        let fileSystem = this._fileSystemManager;
        return new Promise(function (resolve, reject) {
            fileSystem["stat"]({
                "path": fullPath,
                "success": function (res) {
                    //Debug.Log( "[Asset] _unlink success:",res );
                    resolve(res["stats"]);
                },
                "fail": function (err) {
                    console.warn("[Asset] stat fail:", err);
                    resolve(null)
                }
            })
        });
    }


    public async  unlink(filePath: string, success: () => void, fail: (errmsg: string) => void): Promise<boolean> {
        let self = this;
        return new Promise(function (resolve, reject) {
            self._fileSystemManager["unlink"]({
                filePath: self.formatToFullPath(filePath),
                success: function () {
                    if (success) {
                        success();
                    }
                    resolve(true);
                },
                fail: function (res: any) {
                    if (fail) {
                        fail(res["errMsg"]);
                    }
                    console.warn("unlink file fail:" + res["errMsg"]);
                    resolve(false);
                }
            });
        });
    }

    public async unlinks(filePathList: string[], complete: (failList: string[]) => void) {
        let failList: string[] = [];
        for (let i = 0, len = filePathList.length; i < len; i++) {
            let isSuccess: boolean = await this.unlink(filePathList[i], null, null);
            if (!isSuccess) {
                failList.push(filePathList[i]);
            }

        }
        if (complete) {
            complete(failList);
        }
    }

    public async mkdir(filePath: string) {
        let self = this;

        filePath = this.formatToFullPath(filePath);
        return new Promise(function (resolve, reject) {
            self._fileSystemManager["mkdir"]({
                dirPath: filePath,
                recursive: true,
                success: function (res) {
                    resolve(true);
                },
                fail: function (res) {
                    Debug.Log("创建目录失败:", res);
                    resolve(false);
                }
            });
        });
    }
    public async cleardir(dir: string, success: () => void = null, fail: (errMsg: string) => void = null) {
        let fileList = await this.readdirAsync(dir);
        if (fileList && fileList.length > 0) {
            for (let i = 0, len = fileList.length; i < len; i++) {
                let childFilePath = cc.path.join(dir, fileList[i]);
                let isDir = await this.isDirecton(childFilePath);
                if (isDir) {
                    await this.rmdir(childFilePath, null, null)
                }
                else {
                    await this.unlink(childFilePath, null, null);
                }
            }
        }
    }

    /**
     * 删除一个目录
     * @param dir  路径
     * @param recursive 是否递归删除子目录以及文件
     */
    public async rmdir(dir: string, success: () => void = null, fail: (errMsg: string) => void = null) {
        let fullPath = this.formatToFullPath(dir);
        let fileSystem = this._fileSystemManager;
        if (compareWxVersion(this._systemInfo.SDKVersion, "2.3.0") >= 0) {
            return new Promise(function (resolve, reject) {
                fileSystem["rmdir"]({
                    "dirPath": fullPath,
                    "recursive": true,
                    "success": function () {
                        if (success) {
                            success();
                        }
                        resolve(true);
                    },
                    "fail": function (err) {
                        if (fail) {
                            fail(err["errMsg"]);
                        }
                        resolve(false);
                    }
                })
            });
        }
        else {
            let fileList = await this.readdirAsync(fullPath);
            if (fileList && fileList.length > 0) {
                for (let i = 0, len = fileList.length; i < len; i++) {
                    let childFilePath = cc.path.join(dir, fileList[i]);
                    let isDir = await this.isDirecton(childFilePath);
                    if (isDir) {
                        await this.rmdir(childFilePath, null, null)
                    }
                    else {
                        await this.unlink(childFilePath, null, null);
                    }
                }
            }
            fileSystem["rmdir"]({
                "dirPath": fullPath,
                "success": function () {
                    if (success) {
                        success();
                    }
                    Promise.resolve(true);
                },
                "fail": function (err) {
                    if (fail) {
                        fail(err["errMsg"]);
                    }
                    Promise.resolve(false);
                }
            })
        }

    }


    public async ensureDirFor(path: string) {
        // cc.log('mkdir:' + path)

        let ensureDir = path;
        let pathList = [];
        do {
            ensureDir = cc.path.dirname(ensureDir);
            if (!ensureDir || ensureDir.length == 0) {
                break;
            }
            pathList.unshift(ensureDir);

        } while (true);

        for (let i = 0, len = pathList.length; i < len; i++) {
            let state = await this.getFileStatASync(pathList[i]);
            if (!state || !state.isDirectory()) {
                await this.mkdir(pathList[i]);
            }
        }
    }
    public access(filePath: string): Promise<boolean> {
        let self = this;

        filePath = this.formatToFullPath(filePath);
        return new Promise(function (resolve, reject) {
            self._fileSystemManager["access"]({
                path: filePath,
                success: function () {
                    resolve(true);
                },
                fail: function () {
                    resolve(false);
                }
            });
        });
    }
    public accessSync(filePath: string): boolean {
        let self = this;

        filePath = this.formatToFullPath(filePath);
        try {
            this._fileSystemManager["accessSync"](filePath);
            return true;
        }
        catch (err) {
            return false;
        }

    }
    /**
     * 下载文件
     * @param relatUrl 相对于cdn目录的路径
     * @param ignoreCache 是否忽略缓存
     */
    public downloadFile(relatUrl: string, ignoreCache: boolean = false): Promise<string> {
        let self = this;


        let remoteUrl = cc.path.join(this.settingData[PlatformSysSettingKeys.CDN], relatUrl);
        if (!ignoreCache) {
            if (relatUrl.lastIndexOf("?") < 0) {
                remoteUrl += "?" + cc.sys.now();
            }
            else {
                remoteUrl += "&" + cc.sys.now();
            }
        }

        return new Promise(function (resolve, reject) {
            window["wx"]["downloadFile"]({
                url: remoteUrl,
                success: function (res) {
                    if (res.statusCode === 404) {
                        resolve(null);
                    }
                    else if (res.tempFilePath) {
                        resolve(res.tempFilePath);
                    }
                },
                fail: function (res) {
                    Debug.Error("downloadFile", res)
                    resolve(null);
                }
            });
        });
    }
    public async saveFile(tempFilePath: string, userPath: string): Promise<string> {
        var localPath = this.formatToFullPath(userPath);
        await this.ensureDirFor(userPath);
        return new Promise(function (resolve, reject) {
            window["wx"]["saveFile"]({
                tempFilePath: tempFilePath,
                filePath: localPath,
                success: function (res) {
                    resolve(localPath);
                },
                fail: function (res) {
                    Debug.Error("saveFile", res)
                    resolve(null);
                }
            })
        });

    }

    public async downloadAsset(relatUrl: string, complete: (isSuccess: boolean, localSavePth: string, localFullPath: string, assetContent: any) => void, ignoreCache: boolean = false) {
        let self = this;
        let realURL = relatUrl;
        if (relatUrl.indexOf("?") >= 0) {//url地址携带了参数
            realURL = relatUrl.split("?")[0];
        }
        let isExist = await this.access(realURL);
        if (!isExist) {
            let tempFilePath = await this.downloadFile(relatUrl);
            if (tempFilePath) {
                let newFilePath = await this.saveFile(tempFilePath, realURL);
                if (complete) {
                    complete(newFilePath != null, relatUrl, newFilePath, null);
                }
            }
            else {
                if (complete)
                    complete(false, relatUrl, null, null);
            }
        }
        else {
            if (complete)
                complete(true, relatUrl, cc.path.join(this.getUserRootPath(), realURL), null);
        }
    }


    public async isFile(filePath: string): Promise<boolean> {
        let state: Stats = await this.getFileStatASync(filePath);
        if (state && state.isFile()) {
            return true;
        }
        return false;
    }
    public async isDirecton(filePath: string): Promise<boolean> {
        let state: Stats = await this.getFileStatASync(filePath);
        if (state && state.isDirectory()) {
            return true;
        }
        return false;
    }

    public getFileStatSync(filePath: string): Stats {
        let isExist = this.accessSync(filePath);
        if (isExist) {
            let fullPath = this.formatToFullPath(filePath);
            let fileSystem = this._fileSystemManager;
            return fileSystem["statSync"](fullPath);
        }
        return null;

    }
    public isFileSync(filePath: string): boolean {
        let state: Stats = this.getFileStatSync(filePath);
        return state && state.isFile();
    }
    public isDirectonSync(filePath: string): boolean {
        let state: Stats = this.getFileStatSync(filePath);
        return state && state.isDirectory();

    }

    public formatToFullPath(filPath: string) {
        let usrRootPath = this.getUserRootPath();
        if (filPath.slice(0, usrRootPath.length) != usrRootPath)
            filPath = cc.path.join(usrRootPath, filPath);
        return filPath;
    }
    public async writeFile(filePath: string, content: string, complete: (isSuccess: boolean, localFullPath: string) => void, encoding: string = "utf-8") {
        let fullPath = this.formatToFullPath(filePath);
        await this.ensureDirFor(filePath);
        let self = this;
        let isSuccess = await new Promise<boolean>(function (resolve, reject) {
            self._fileSystemManager["writeFile"]({
                filePath: fullPath,
                data: content,
                "encoding": encoding,
                success: function (res) {
                    resolve(true);
                },
                fail: function (res) {
                    Debug.Error("saveFile fail:", res)
                    resolve(false);
                }
            })
        });
        if (complete) {
            complete(isSuccess, fullPath);
        }
        return isSuccess;
    }
    public checkUpdate() {
        if (typeof window["wx"]["getUpdateManager"] !== 'function') {
            return;
        }
        if (!this._updateManager) {
            this._updateManager = window["wx"]["getUpdateManager"]();
        }
        if (this._updateManager) {
            let self = this;
            this._updateManager["onCheckForUpdate"](function (res) {
                Debug.Log("微信更新检查结果:", res);
            });
            this._updateManager["onUpdateReady"](function (res) {
                Debug.Log("[Wx] update ready:", res);
                msg.AskDialog("新版本已经准备就绪，点击确定更新", functionWrapper(function (ops: string | number, dialog) {
                    if (ops == DialogDefaultOptionsTypes.DIALOG_OPTIONS_OK) {
                        if (this._updateManager) {
                            Debug.Log("强制重启更新游戏")
                            this._updateManager["applyUpdate"]();
                        }
                    }
                }, self));
            }, self);
            this._updateManager["onUpdateFailed"](function (res) {
                Debug.Log("[Wx] update error:", res);
            });
        }
    }
    public async uploadFile(localFilePath: string, fileName: string, remoteURL: string, complete: (isSuccess: boolean) => void) {
        var authorization = getAuthorization({
            "SecretId": AppDefines.COS_SecretId,
            "SecretKey": AppDefines.COS_SecretKey,
            "Method": 'post',
            "Key": ""
        });
        let self = this;
        let isSuccess = await new Promise<boolean>(function (resolve, reject) {
            window["wx"]["uploadFile"]({
                url: remoteURL,
                "name": 'file',
                "filePath": localFilePath,
                "formData": {
                    'key': fileName,
                    'success_action_status': 200,
                    'Signature': authorization
                },
                success: function (res) {
                    resolve(true);
                },
                fail: function (res) {
                    Debug.Error("saveFile fail:", res)
                    resolve(false);
                }
            })
        });

        if (complete) {
            complete(isSuccess);
        }
        return isSuccess;

    }

    triggerGC() {
        window["wx"]["triggerGC"]();
    }
    public hideKeyboard() {
        window["wx"]["hideKeyboard"]();
    }
    get isSupportWorker() {
        return window["wx"]["createWorker"] != undefined;
    }
    _creatorWorkerInstance(jsPath: string) {

        if (!this.currWorker) {
            this.currWorker = window["wx"]["createWorker"](jsPath);
        }

        return this.currWorker;
    }

    public setClipboardData(value: string) {
        window["wx"]["setClipboardData"]({
            data: value
        });
    }
    public getClipboardData(cb: (data: string) => void) {
        window["wx"]["getClipboardData"]({
            success: function (res) {
                cb(res.data);
            },
            fail: function () {
                cb(null);
            }

        })
    }
    
    public writeTokenRefreshRequest(tokenData: any, refreshRequest: any) {
        throw new Error("Method not implemented.");
    }
}

if (!CC_EDITOR && CC_WECHATGAME)
    PlatformSDK.instance = new WxSDK();