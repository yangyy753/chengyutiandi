import { PlatformSDK } from "../../SDK/PlatformSDK";
import { timer } from "../Time/TimerManager";
import { functionWrapper } from "../../Struct/FunctionWrapper";

//
/**
 * 资源下载配置参数
 * @param url
 * @param retryTimes 下载失败之后的重试次数,0:不尝试,-1:无限尝试
 */
export type AssetDownloadItem = { groupList: [] }
const enum DownloadStates {
    WAIT = 1,
    LOADING = 2,
    LOADED = 3,
    FAIL = 4
}
export type AssetDownloadGroup = { waitAssetList: string[], loadingList: string[], successList: string[], failList: string[] }
/**
 * 资源文件加载器
 * 资源文件表示是游戏所必须的文件，而不是头像之类的一次性文件。
 * 所以默认加载失败后，会无限重试。
 * 当下载失败时会检测网络状况，如果无网会暂停下载，当网络恢复后再继续下载。
 * 只是下载，加载到内存中，请使用cc.loader.load
 * 
 * 
 */
export default class AssetDownloader extends cc.EventTarget {

    public static Event_Success: string = "AssetDownloader:Success";
    public static Event_Fail: string = "AssetDownloader:Fail";
    public static Event_GroupProgress: string = "AssetDownloader:GroupProgress";
    public static Event_GroupComplete: string = "AssetDownloader:GroupComplete";

    private static _GroupName_Default: string = "__default_download_group__";

    protected _waitAssetGroupList: any;
    protected _loadingAssetList: string[];
    //最大并发数
    protected _maxConnectionCount = 2;


    protected _totalLoadingQueue: string[];

    protected _networkCheckTimer: number;
    protected _isPause: boolean;
    constructor() {
        super();
        this._loadingAssetList = [];
        this._waitAssetGroupList = {};
        this._totalLoadingQueue = [];
        this._maxConnectionCount = 2;
        this._networkCheckTimer = -1;
        this._isPause = false;

    }
    public setMaxConnectCount(count: number) {
        if (this._maxConnectionCount != count) {
            this._maxConnectionCount = count;
            this.checkBeginDownload();
        }
    }
    /**
     * 下载资源文件
     * @param assetList 资源路径，该路径相对于CDN根路径，下载完成后也会使用该路径保存到本地（如果平台支持保存）
     * @param isImmediately 是否立即开始，true：将优先下载该批次的资源
     */
    async downloadAsset(asset: string | string[], isImmediately: boolean = false) {
        let assetList = Array.isArray(asset) ? asset : [asset];
        let oldPause = this._isPause;
        this._isPause = true;
        for (let i = 0, len = assetList.length; i < len; i++) {
            let assetURL = assetList[i];
            let isExist = await PlatformSDK.instance.access(assetURL);
            if (isExist) {//本地已经存在该文件
                this.onAssetLoadComplete(true, assetURL, cc.path.join(PlatformSDK.instance.getUserRootPath(), assetURL));
            }
            else {
                if (isImmediately) {
                    this._totalLoadingQueue.unshift(assetURL);
                }
                else {
                    this._totalLoadingQueue.push(assetURL);
                }
            }
        }
        this._isPause = oldPause;
        this.checkBeginDownload();
    }

    protected onAssetBeginDownload(url: string) {
        for (let key in this._waitAssetGroupList) {
            let group = this._waitAssetGroupList[key];
            if (url in group) {
                group[url] = DownloadStates.LOADING;
            }
        }
    }



    protected checkBeginDownload() {
        while (!this._isPause && this._loadingAssetList.length < this._maxConnectionCount && this._totalLoadingQueue.length > 0) {
            let assetURL: string = this._totalLoadingQueue.shift();
            if (this._loadingAssetList.indexOf(assetURL) < 0) {
                this._loadingAssetList.push(assetURL)
                PlatformSDK.instance.downloadAsset(assetURL, this.onAssetLoadComplete.bind(this));
                this.onAssetBeginDownload(assetURL);
            }
        }
    }

    protected onAssetLoadComplete(isSuccess: boolean, url: string, saveFullPath: string) {

        if (isSuccess) {//下载成功
            let index = this._loadingAssetList.indexOf(url);
            if (index >= 0) {
                this._loadingAssetList.splice(index, 1);
            }
            this.emit(AssetDownloader.Event_Success, url, saveFullPath);
        }
        else {
            this.emit(AssetDownloader.Event_Fail, url);
            if (!PlatformSDK.instance.isNetworkConnected) {
                this._isPause = true;
                PlatformSDK.instance.updateCurrNetworkStatus(null);
            }
            if (this._networkCheckTimer == -1) {//启动网络恢复检测
                this._networkCheckTimer = timer.setInterval(functionWrapper(this.onCheckNetworkTimer, this), 500);
            }
        }
        let totalGroup: string[] = Object.keys(this._waitAssetGroupList);
        for (let i in totalGroup) {
            let groupName = totalGroup[i];
            let assetGroup = this._waitAssetGroupList[groupName];

            if (url in assetGroup) {
                assetGroup[url] = isSuccess ? DownloadStates.LOADED : DownloadStates.FAIL;
                if (isSuccess) {
                    let totalCount = 0;
                    let loadedCount = 0;
                    let totalFileList = Object.keys(assetGroup);
                    if (totalFileList.length > 0) {
                        for (let j in totalFileList) {
                            let assetURL = totalFileList[j];
                            totalCount++;
                            if (assetGroup[assetURL] == DownloadStates.LOADED) {
                                loadedCount++;
                                break;
                            }
                        }
                        let progress = Math.floor((loadedCount / totalCount) * 100);
                        this.emit(AssetDownloader.Event_GroupProgress, groupName, progress);
                    }

                    if (loadedCount == totalCount) {//该组已经完成
                        delete this._waitAssetGroupList[groupName];
                        this.emit(AssetDownloader.Event_GroupComplete, groupName, totalFileList);
                    }
                }
            }
        }

        this.checkBeginDownload();
    }

    protected onCheckNetworkTimer(tiggerCount: number, totalDuration: number) {
        let isNetworkConnected = PlatformSDK.instance.isNetworkConnected;
        if (isNetworkConnected) {//网络已经连接了
            timer.clearInterval(this._networkCheckTimer);
            this._networkCheckTimer = -1;
            this.checkBeginDownload();
            this._isPause = false;
        }
        else {//网络还没恢复
            this._isPause = true;
            if ((tiggerCount % 3) == 0) {//每3次去刷新下网络状态
                PlatformSDK.instance.updateCurrNetworkStatus(null);
            }
            if (totalDuration >= 5000) {//超过10秒后还没网
                //强行去尝试下载一波
                timer.clearInterval(this._networkCheckTimer);
                this._networkCheckTimer = -1;
                this.checkBeginDownload();
                this._isPause = false;
            }
        }
    }
    /**
     * 下载一组资源
     * @param groupName 当前下载批次的名字
     * @param itemList 资源列表
     * @param isImmediately 是否立即开始（下载优先级最高）
     */
    downloadAssetGroup(groupName: string, itemList: string[], isImmediately: boolean = false) {
        if (!itemList || itemList.length == 0) {
            this.emit(AssetDownloader.Event_GroupComplete, groupName, []);
            return;
        }
        let targetGroup = this._waitAssetGroupList[groupName];
        if (targetGroup) {
            for (let i = 0, len = itemList.length; i < len; i++) {
                let url = itemList[i];
                if (!(url in targetGroup)) {
                    targetGroup[url] = DownloadStates.WAIT;
                }
            }
        }
        else {
            let targetGroup = {};
            for (let i = 0, len = itemList.length; i < len; i++) {
                let url = itemList[i];
                targetGroup[url] = DownloadStates.WAIT;
            }
            this._waitAssetGroupList[groupName] = targetGroup;
        }
        this.downloadAsset(itemList, isImmediately);
    }


}