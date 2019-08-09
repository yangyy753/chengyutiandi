import { PlatformSDK, PlatformSysSettingKeys } from "../../SDK/PlatformSDK";
import Dictionary from "../../Struct/Dictionary";
import TMap from "../../Struct/TMap";
import AssetDownloader from "./AssetDownloader";
import { functionWrapper } from "../../Struct/FunctionWrapper";
import { Debug } from "../Log/LogManager";
import VirtualTask from "../Task/VirtualTask";
import { store } from "../LocalStorageManager";

export const NODE_KEY_SOURCE_ASSET_ID = "__src_asset_uuid__";
let Old_CC_instantiate = cc.instantiate;
let New_CC_instantiate = function (original: cc.Prefab) {
    let node = Old_CC_instantiate.apply(null, arguments);
    if (node) {
        node[NODE_KEY_SOURCE_ASSET_ID] = original["_uuid"];
    }
    return node;
}
New_CC_instantiate["_clone"] = cc.instantiate["_clone"];
cc.instantiate = New_CC_instantiate;

//外部资源包存放根目录
const AssetBundleRootPath = "asset-bundle/";
class AssetVersionPipe {
    id: string;
    constructor() {
        this.id = "AssetVersionPipe";
    }
    handle(item, callback) {

        do {
            if (item.url.startsWith("http") || (item.url.startsWith(PlatformSDK.instance.getUserRootPath()) && PlatformSDK.instance.getUserRootPath() != "")) {
                break;
            }
            let arr: string[] = item.url.split("/");
            if (arr.length >= 2) {
                let bundleName = arr[0];
                if (bundleName == "res" || bundleName == "embedRes") {//cocos生成的资源路径 
                    break;
                }
                let fileName = arr.slice(1).join("/");
                // fileName = asset.getExternalAssetPath(bundleName, fileName);
                item.url = asset.getExternalAssetPath(bundleName, fileName);//cc.path.join(AssetBundleRootPath, bundleName, fileName);
                console.log("asset version:", bundleName, fileName, item.url);
            }
        } while (false);
        // console.log( "AssetVersionPipe:",item );
        callback(null, null);
    }
}

export type AssetLoadGroup = { assets: string[], progress: (completedCount: number, totalCount: number, item: any) => void, complete: (error: Error, resource: any[]) => void }

export default class AssetManager extends cc.EventTarget {

    private static _instance: AssetManager = null;

    static instance(): AssetManager {
        if (!this._instance)
            this._instance = new AssetManager();
        return this._instance;
    }

    public static Event_Inited = "AssetManager:Event_Inited";

    protected _totalSceneAssets: string[];

    protected _waitSyncScenes: string[];

    protected _assetReferenceMap: Dictionary;

    protected _spriteFrameAssetTypeCache: any;

    protected _staticRetainAssets: cc.Asset[];

    protected _unuseSceneAssetList: string[];

    protected _externalBundleMap: TMap<string, AssetBundle>;

    protected _isInited: boolean;

    protected _downloader: AssetDownloader;

    private constructor() {
        super();
    }

    init() {
        this._totalSceneAssets = [];
        this._assetReferenceMap = new Dictionary();

        this._spriteFrameAssetTypeCache = {};

        this._staticRetainAssets = [];
        this._waitSyncScenes = [];
        this._unuseSceneAssetList = [];
        this._isInited = false;

        this._externalBundleMap = new TMap<string, AssetBundle>();
        this._downloader = new AssetDownloader();
        this._downloader.on(AssetDownloader.Event_Success, this.onAssetDownloadSuccess, this);
        this._downloader.on(AssetDownloader.Event_Fail, this.onAssetDownloadFail, this);
        this._downloader.on(AssetDownloader.Event_GroupComplete, this.onAssetGroupDownloadComplete, this);
        this._downloader.on(AssetDownloader.Event_GroupProgress, this.onAssetGroupDownloadProgress, this);
    }

    get isInited() {
        return this._isInited;
    }
    get assetDownloader() {
        return this._downloader;
    }
    protected onAssetDownloadSuccess(assetURL: string, localFullPath: string) {//某个资源下载完成

    }
    protected onAssetDownloadFail(assetURL: string) {//某个资源下载失败

    }
    protected onAssetGroupDownloadComplete(groupName: string, fileList: string) {//某组资源下载完成

    }
    protected onAssetGroupDownloadProgress(groupName: string, progress: number) {//某组资源下载进度

    }

    public downloadExternalAssetBundle(bundleName: string) {
        let bundle: AssetBundle = this._externalBundleMap.get(bundleName);
        if (bundle) {
            bundle.preDownload();
        }
    }
    /**
     * 
     * @param bundleName 
     * @param fileName 
     */
    public getExternalAssetPath(bundleName: string, fileName: string) {
        fileName = asset.getExternalAssetVersionName(bundleName, fileName);

        let pathName = cc.path.join(AssetBundleRootPath, bundleName, fileName);

        if (!PlatformSDK.instance.isFileSync(pathName)) {  //如果本地不存在此路径，则直接从cdn拉取
            pathName = PlatformSDK.instance.settingData[PlatformSysSettingKeys.CDN] + pathName
        }

        return pathName;
    }
    public getExternalAssetVersionName(bundleName: string, fileName: string) {
        let bundle: AssetBundle = this._externalBundleMap.get(bundleName);
        if (bundle) {
            return bundle.getAssetVersionPath(fileName);
        }
        return fileName;
    }
    public getExternalAssetVersion(bundleName: string, fileName: string) {
        let bundle: AssetBundle = this._externalBundleMap.get(bundleName);
        if (bundle) {
            return bundle.getAssetFileVersion(fileName);
        }
        return 0;
    }

    /**
     * 初始化资源组
     * 先加载必选资源，在加载延迟资源，再静默去下载所有场景到本地
     * @param requiredAssets 必选资源组，必须加载完才能进入游戏，一般为第一个场景，各种通用弹窗
     * @param optionalAssets 延迟加载资源，这部分资源会延迟加载到内存
     */
    syncAssetGroup() {
        let self = this;
        this.startSyncCocosAssets();
    }

    protected onAssetTotalInited(task: ExternalAssetSyncTask) {
        this._isInited = true;
        this._externalBundleMap = task.bundleMap;
        this.emit(AssetManager.Event_Inited);
        //继续同步cocos资源
        this.startSyncCocosAssets();

    }

    protected startSyncCocosAssets() {
        let cocosAssetSyncTask = new CocosAssetSyncTask("CocosAssetSyncTask");
        cocosAssetSyncTask.begin(null, null, null);
    }

    public regitserStaticAsset(asset: cc.Asset) {
        if (asset) {
            console.log("注册静态资源:", asset.name);
            let index = this._staticRetainAssets.indexOf(asset);
            if (index < 0) {
                this._staticRetainAssets.push(asset);
            }
        }

    }
    public unregisterStaticAsset(asset: cc.Asset) {
        console.log("取消注册静态资源:", asset.name);
        let index = this._staticRetainAssets.indexOf(asset);
        if (index >= 0) {
            this._staticRetainAssets.splice(index, 1);
        }
    }

    public useingScene(sceneName: string) {
        console.log("场景使用中:", sceneName);
        let index = this._unuseSceneAssetList.indexOf(sceneName);
        if (index >= 0) {
            this._unuseSceneAssetList.splice(index, 1);
        }
        this.reatinAssetReference(sceneName, cc.Prefab);
    }

    public unuseScene(sceneName: string) {
        console.log("场景停止使用:", sceneName);
        let index = this._unuseSceneAssetList.indexOf(sceneName);
        if (index < 0) {
            this._unuseSceneAssetList.push(sceneName);
        }
        this.releaseAssetReference(sceneName, cc.Prefab);
    }

    public getUnuseSceneList() {
        return this._unuseSceneAssetList.slice();
    }

    /**
     * 未使用场景数量
     */
    get unuseSceneLength() {
        return this._unuseSceneAssetList.length;
    }

    /**
     * 保留某个资源的引用（引用计数加1），阻止它在场景资源释放过程中被删除
     */
    public reatinAssetReference(asset: string, assetType: Function) {
        console.log("添加资源引用:", asset);
        let reference = 0;
        if (this._assetReferenceMap.has(asset)) {
            reference = this._assetReferenceMap.get(asset);
            reference++;
        }
        else {
            reference = 1;
        }
        this._assetReferenceMap.set(asset, reference);
        if (assetType == cc.SpriteFrame) {
            this._spriteFrameAssetTypeCache[asset] = true;
        }
        console.log("添加资源引用:", asset, reference);
    }
    /**
     * 取消某个资源的引用,引用计数减1
     * @param asset 
     */
    public releaseAssetReference(asset: string, assetType) {
        if (this._assetReferenceMap.has(asset)) {
            let reference = this._assetReferenceMap.get(asset);
            reference--;
            if (reference < 0) {
                reference = 0;
            }
            this._assetReferenceMap.set(asset, reference);
            console.log("减少资源引用:", asset, reference);
        }
        else {
            this._assetReferenceMap.set(asset, 0);
            console.log("减少资源引用:", asset, 0);
        }
        if (assetType == cc.SpriteFrame) {
            this._spriteFrameAssetTypeCache[asset] = true;
        }
    }


    public registerSceneAsset(sceneAsset: string) {
        console.log("注册场景资源:", sceneAsset);
        if (this._totalSceneAssets.indexOf(sceneAsset) < 0)
            this._totalSceneAssets.push(sceneAsset);
    }

    /**
     * 释放未使用的资源
     */
    public releaseUnuseAssets() {
        console.log("删除未使用资源开始")

        //当前所有在使用的资源
        let useingAssets = {};
        let unuseAssets = {};

        let keys = this._assetReferenceMap.keys;

        // let usingSpriteFrame = [];
        let usingSpriteDepend = {};

        let unuseSpriteDepend = {};
        let totalFrameNames = [];

        let spriteUidMap = {};

        for (let i = 0, len = keys.length; i < len; i++) {
            let assetName = keys[i];
            let reference = this._assetReferenceMap.get(assetName);
            let dependAssets = cc.loader.getDependsRecursively(assetName);

            let targetMap = null;


            if (reference > 0) {
                targetMap = useingAssets;
                if (this._spriteFrameAssetTypeCache[assetName]) {
                    let uuid = cc.loader["_getResUuid"](assetName, cc.SpriteFrame);
                    totalFrameNames.push(uuid);
                    usingSpriteDepend[uuid] = dependAssets;
                    spriteUidMap[uuid] = assetName;
                }
            }
            else {
                targetMap = unuseAssets;
                //dependAssets.unshift( assetName );
                this._assetReferenceMap.delete(assetName);
                if (this._spriteFrameAssetTypeCache[assetName]) {
                    let uuid = cc.loader["_getResUuid"](assetName, cc.SpriteFrame);
                    totalFrameNames.push(uuid);
                    unuseSpriteDepend[uuid] = dependAssets;
                    spriteUidMap[uuid] = assetName;
                }
            }
            for (let j = 0, jlen = dependAssets.length; j < jlen; j++) {
                targetMap[dependAssets[j]] = true;
            }
        }

        for (let i = 0, len = this._staticRetainAssets.length; i < len; i++) {
            let dependAssets = cc.loader.getDependsRecursively(this._staticRetainAssets[i]);
            for (let j = 0, jlen = dependAssets.length; j < jlen; j++) {
                useingAssets[dependAssets[j]] = true;
            }
        }
        {
            for (let key in usingSpriteDepend) {
                let dependList: string[] = usingSpriteDepend[key];

                for (let j = 0, jlen = dependList.length; j < jlen; j++) {
                    let assetName = dependList[j];
                    useingAssets[assetName] = true;
                    unuseAssets[assetName] = false;
                }
            }


            let keys = Object.keys(unuseSpriteDepend);
            for (let i = 0, len = keys.length; i < len; i++) {
                let isUsing = false;
                let spruid = keys[i];
                let dependList: string[] = unuseSpriteDepend[spruid];
                for (let j = 0, jlen = dependList.length; j < jlen; j++) {
                    let assetName = dependList[j];
                    if (useingAssets[assetName]) {//还在继续使用
                        isUsing = true;
                        break;
                    }
                }
                if (isUsing) {//还在使用中
                    usingSpriteDepend[spruid] = dependList;
                    delete unuseSpriteDepend[spruid];
                    for (let j = 0, jlen = dependList.length; j < jlen; j++) {
                        let assetName = dependList[j];
                        useingAssets[assetName] = true;
                        unuseAssets[assetName] = false;
                    }
                }
                else {//所有的依赖项都是无用的
                    unuseAssets[spruid] = true;
                }
            }
        }

        console.log("使用资源列表:", Object.keys(useingAssets).length);
        console.log("未使用资源列表:", Object.keys(unuseAssets).length);
        let usingFrameNames = Object.keys(usingSpriteDepend);
        let unuseFrame = [];
        for (let key in unuseAssets) {
            if (useingAssets[key]) {
                continue;
            }
            let isRelease = true;
            {
                for (let i = 0, len = totalFrameNames.length; i < len; i++) {
                    if (key.indexOf(totalFrameNames[i]) >= 0) {//删除的资源里有该spriteframe
                        isRelease = false;
                        if (usingFrameNames.indexOf(totalFrameNames[i]) < 0 && unuseFrame.indexOf(totalFrameNames[i]) < 0)
                            unuseFrame.push(totalFrameNames[i]);
                        break;
                    }
                }
            }

            if (isRelease) {
                cc.loader.release(key);
                // console.log( "移除未使用资源:" + key );
            }
        }
        for (let i = 0, len = unuseFrame.length; i < len; i++) {
            let frameName = spriteUidMap[unuseFrame[i]];
            // console.log( "完全移除spriteframe：" +frameName  );
            cc.loader.releaseRes(frameName, cc.SpriteFrame);
        }
        console.log("资源释放完成");
        this._unuseSceneAssetList.splice(0, this._unuseSceneAssetList.length);
    }
}


class AssetBundle extends cc.EventTarget {
    public static Event_Inited: string = "AssetBundle:Inited"
    protected _rootPath: string;
    protected _localVersion: number;
    protected _fileMap: {};
    protected _name: string;
    protected _newVersion: number;
    protected _isInited: boolean;

    protected _preloadList: string[];

    protected _isNeedCheckDiscardFile: boolean;

    constructor(name: string) {
        super();
        this._isInited = false;
        this._name = name;
        this._newVersion = 0;
        this._localVersion = -1;
        this._fileMap = {};
        this._isNeedCheckDiscardFile = false;
    }

    // protected init() 
    // {
    //     //尝试读取本地索引文件
    //     PlatformSDK.instance.readFileAsync( AssetBundleRootPath + this._name,this.onLocalIndexReadSuccess.bind(this),this.onLocalIndexReadFail.bind(this),"utf-8" );

    // }
    get isInited() {
        return this._isInited;
    }

    //销毁
    public destory() {
        //删除本地文件夹
        PlatformSDK.instance.rmdir(AssetBundleRootPath + this._name, null, null);
    }
    //更新
    public update(newVersion: number) {
        this._newVersion = newVersion;

        PlatformSDK.instance.readFileAsync(AssetBundleRootPath + this._name + "/index.json", this.onLocalIndexReadSuccess.bind(this), this.onLocalIndexReadFail.bind(this), "utf-8");
        // if( this._fileMap )
        // {//本地缓存已经读取过了
        //     this.checkUpdate();
        // }
    }
    protected parseIndexJson(index: string | any) {
        if (cc.js.isString(index)) {
            try {
                index = JSON.parse(index);
            }
            catch (err) {

                this._localVersion = -1;
                this._fileMap = {};
                this._preloadList = [];
                return;
            }
        }
        this._localVersion = index["version"] ? index["version"] : -1;
        this._fileMap = index["fileMap"] ? index["fileMap"] : null;
        if (index["isRequired"]) {
            this._preloadList = Object.keys(this._fileMap);
        }
        else {
            this._preloadList = index["preloadAssets"] ? index["preloadAssets"] : [];
        }
    }

    protected onLocalIndexReadSuccess(data: string) {
        this.parseIndexJson(data);
        let isNeedUpdate = this._localVersion < this._newVersion;
        // this._isInited = true;
        if (this._localVersion < 0 || !this._fileMap) {//本地没有该资源包索引或者该索引文件已经损坏
            isNeedUpdate = true;
            //已经丢失了本地文件的版本号记录
            //全部删除了事
            this._isNeedCheckDiscardFile = true;

            // PlatformSDK.instance.cleardir(AssetBundleRootPath + this._name, null, null);
        }
        if (isNeedUpdate) {
            this.needUpdate();
        }
        else {
            //下载预加载资源
            this.downloadPreloadAsset();


            // this._isInited = true;
            // this.emit ( AssetBundle.Event_Inited );
        }
    }

    protected downloadPreloadAsset() {
        if (this._preloadList && this._preloadList.length > 0) {
            let assetList = [];
            for (let i = 0, len = this._preloadList.length; i < len; i++) {
                let key = this._preloadList[i];
                let verPath = this.getAssetVersionPath(key, this._fileMap[key]);
                assetList.push(cc.path.join(AssetBundleRootPath, this._name, verPath));
            }
            asset.assetDownloader.on(AssetDownloader.Event_GroupComplete, this.onPreloadAssetDownloadComplete, this)
            asset.assetDownloader.downloadAssetGroup("AssetBundle-" + this._name, assetList, true);
        }
        else {
            this.onPreloadAssetDownloadComplete(this._name);

        }
    }

    protected onPreloadAssetDownloadComplete(bundleName: string) {

        if (bundleName == "AssetBundle-" + this._name) {
            console.log("onPreloadAssetDownloadComplete,name:" + this._name)
            asset.assetDownloader.off(AssetDownloader.Event_GroupComplete, this.onPreloadAssetDownloadComplete, this)
            this._isInited = true;
            this.emit(AssetBundle.Event_Inited);


            if (this._isNeedCheckDiscardFile) {//删除多余的文件

                PlatformSDK.instance.walkDirectory(AssetBundleRootPath + this._name, function (dir: string, fileList: string[]) {
                    let indexPath = cc.path.join(AssetBundleRootPath + this._name, "index.json")
                    let index = fileList.indexOf(indexPath);
                    {
                        if (index >= 0) {
                            fileList.splice(index, 1);
                        }
                    }
                    for (let key in this._fileMap) {
                        let fullPath = cc.path.join(AssetBundleRootPath + this._name, this.getAssetVersionPath(key, this._fileMap[key]));
                        let index = fileList.indexOf(fullPath);
                        if (index >= 0) {
                            fileList.splice(index, 1);
                        }
                    }
                    if (fileList.length > 0) {
                        PlatformSDK.instance.unlinks(fileList, null);
                    }
                }.bind(this))
            }
        }
    }


    protected onLocalIndexReadFail(errMsg: string) {
        //本地没有该索引文件
        //已经丢失了本地文件的版本号记录
        //全部删除了事
        this._isNeedCheckDiscardFile = true;
        // PlatformSDK.instance.cleardir(AssetBundleRootPath + this._name, null, null);
        this.needUpdate();
    }

    protected needUpdate() {
        //拉去最新版本的索引文件
        cc.loader.load(cc.path.join(PlatformSDK.instance.settingData[PlatformSysSettingKeys.CDN], AssetBundleRootPath, this._name, "index.json?" + this._newVersion), this.onIndexDownloaded.bind(this));
    }

    protected onIndexDownloaded(err: any, data: any) {
        if (err || !data) {
            console.warn("download asset bundle index fail:" + this._name, err);
            //一秒钟后重新加载
            //TODO:需要实现下载列表，在失败时反复重试
            setTimeout(this.needUpdate.bind(this), 1000);

            // this._isInited = true;
            // //先行通知初始化完成
            // this.emit( AssetBundle.Event_Inited,this._name );
            return;
        }
        let discardFiles = [];

        if (this._fileMap) {
            let localFileList = Object.keys(this._fileMap);
            for (let index in localFileList) {
                let key = localFileList[index];
                if (!data["fileMap"][key]) {//该文件已经被废弃
                    discardFiles.push(cc.path.join(AssetBundleRootPath + this._name, this.getAssetVersionPath(key, this._fileMap[key])));
                    delete this._fileMap[key];
                }
            }
        }
        else {
            this._fileMap = {};
        }
        let newFileList = [];
        //删除过期文件
        for (let key in data["fileMap"]) {
            let newVersion = data["fileMap"][key];
            if (this._fileMap[key]) {
                let localVersion = this._fileMap[key] ? this._fileMap[key] : -1;

                if (localVersion < newVersion) {//本地该文件已经废弃
                    discardFiles.push(cc.path.join(AssetBundleRootPath + this._name, this.getAssetVersionPath(key, localVersion)));
                    newFileList.push(key);
                }
                this._fileMap[key] = newVersion;
            }
            else {//新增了文件
                this._fileMap[key] = newVersion;
                newFileList.push(key);
            }
        }
        if (data["isRequired"]) {//整个资源包都是必须
            this._preloadList = Object.keys(this._fileMap);
        }
        else {//某些文件需要在进入游戏之前预先加载
            this._preloadList = data["preloadAssets"] ? data["preloadAssets"] : [];
        }
        //去下载预加载资源
        this.downloadPreloadAsset();
        // this._isInited = true;
        // //先行通知初始化完成
        // this.emit( AssetBundle.Event_Inited,this._name );
        let self = this;
        //开始删除本地的废弃文件
        if (discardFiles.length > 0) {
            PlatformSDK.instance.unlinks(discardFiles, function (failList: string[]) {
                //删除废弃文件完成
                //有可能会删除失败

            });
        }
        PlatformSDK.instance.writeFile(cc.path.join(AssetBundleRootPath + self._name, "index.json"), JSON.stringify(data), function (isSuccess: boolean, localFullPath: string) {
            //写入最新索引文件完成
            if (isSuccess) {//写入索引文件成功
                console.warn("save asset bundle index file success:" + self._name);
            }
            else {//写入失败了
                console.warn("save asset bundle index file fail:" + self._name);
            }
            self._isInited = true;

        }, "utf-8");
        //写入最新的索引文件
    }
    getAssetVersionPath(fileName: string, version?: number) {
        let mainFileName: string = cc.path.mainFileName(fileName);
        let exname = cc.path.extname(fileName);
        if (version === undefined || version === null) {
            version = this.getAssetFileVersion(fileName);
        }

        fileName = mainFileName + "_v" + version + (exname ? exname : "");
        return fileName;
    }

    /**
     * 预下载
     */
    preDownload() {
        let assetList = [];
        for (let key in this._fileMap) {
            let verPath = this.getAssetVersionPath(key, this._fileMap[key]);
            assetList.push(cc.path.join(AssetBundleRootPath, this._name, verPath));
            if (!PlatformSDK.instance.access(verPath)) {
                PlatformSDK.instance.downloadAsset(cc.path.join(AssetBundleRootPath, this._name, verPath), null);
            }
        }
        asset.assetDownloader.downloadAssetGroup("AssetBundle-" + this._name, assetList, true);
    }


    // appendVersionToFilePath( fileName:string,version?:number )
    // {
    //     let mainFileName:string = cc.path.mainFileName(fileName );
    //     let exname = cc.path.extname(fileName);
    //     if( version === undefined || version === null )
    //     {
    //         version = this.getAssetFileVersion( fileName );
    //     }

    //     fileName = mainFileName + "_v" + version + ( exname ? exname : "" );
    //     return fileName;
    // }
    getAssetFileVersion(fileName: string) {
        if (this._fileMap && (fileName in this._fileMap)) {
            return this._fileMap[fileName];
        }
        console.warn("not find asset version,bundleName:" + this._name + "fileName:" + fileName);
        //没有该资源的记录
        return 10000;
    }
}

class CocosAssetSyncTask extends VirtualTask {
    private _totalLocalFileList: string[];
    private _totalRemoteFileList: string[];
    private _removeDiscardFileComplete: boolean;
    private _downloadNewFileComplete: boolean;

    onBegin() {
        this._removeDiscardFileComplete = false;
        this._downloadNewFileComplete = false;

        if (!cc.sys.isBrowser && !CC_JSB)
        {
            let lastSyncVersion = store.getStorageItem("LastSyncVersion");
            console.log("上次同步的版本号：" + lastSyncVersion);
            console.log("最新的版本号：" + AppDefines.APP_VERSION_NAME + "." + AppDefines.Build_Version);

            if (lastSyncVersion != (AppDefines.APP_VERSION_NAME + "." + AppDefines.Build_Version)) {//需要剔除多余资源
                PlatformSDK.instance.walkDirectory("res", this.onWalkCocosDirectoryComplete.bind(this));
                cc.loader.load("res/AssetMap_" + AppDefines.APP_VERSION_NAME + "." + AppDefines.Build_Version + "_.json", this.onAssetMapLoadComplete.bind(this));
            }
        }
        else {
            this.onTaskSuccess();
        }
    }
    protected onAssetMapLoadComplete(err: Error, res: any) {
        if (!res) {
            console.warn("asset map load fail,err=", err);
            this.onTaskFail();
            return;
        }
        this._totalRemoteFileList = res;
        console.log("asset map load complete,file count=" + this._totalRemoteFileList.length);
        if (this._totalLocalFileList) {
            this.comparisonAssetFiles(this._totalLocalFileList, this._totalRemoteFileList);
        }
    }
    protected onWalkCocosDirectoryComplete(dir: string, fileList: string[]) {
        this._totalLocalFileList = fileList;
        if (this._totalRemoteFileList) {
            this.comparisonAssetFiles(this._totalLocalFileList, this._totalRemoteFileList);
        }
    }
    protected comparisonAssetFiles(localFileList: string[], remoteFileList: string[]) {
        console.log("比较资源库开始");
        localFileList = localFileList.concat();
        remoteFileList = remoteFileList.concat();
        for (let i = localFileList.length - 1; i >= 0; i--) {
            let fileName = localFileList[i];

            let index = remoteFileList.indexOf(fileName);
            if (index >= 0) {//远程也存在该本地文件
                remoteFileList.splice(index, 1);
                localFileList.splice(i, 1);
                continue;
            }
            else {//该本地文件已经被废弃

            }
        }
        for (let i = remoteFileList.length - 1; i >= 0; i--) {
            let index = localFileList.indexOf(remoteFileList[i]);
            if (index >= 0) {//本地存在该远程文件
                localFileList.splice(index, 1);
                remoteFileList.splice(i, 1);
                continue;
            }
            else {//新增文件

            }
        }
        console.log("废弃文件列表:", localFileList.length);
        console.log("新增文件列表:", remoteFileList.length);
        console.log("比较资源库结束");
        if (localFileList.length == 0 && remoteFileList.length == 0) {
            this.onSyncAssetComplete();
            return;
        }

        if (localFileList.length > 0) {
            PlatformSDK.instance.unlinks(localFileList, this.onRemoveDiscardFileComplete.bind(this));
        }
        else {
            this._removeDiscardFileComplete = true;
        }
        if (remoteFileList.length > 0) {
            asset.assetDownloader.setMaxConnectCount(2);
            asset.assetDownloader.on(AssetDownloader.Event_GroupComplete, this.onAssetDonwloadComplete, this)
            asset.assetDownloader.downloadAssetGroup("cocosAssetSync", remoteFileList);
        }
        else {
            this._downloadNewFileComplete = true;
        }
        if (this._downloadNewFileComplete && this._removeDiscardFileComplete) {
            this.onSyncAssetComplete();
        }
    }
    protected onAssetDonwloadComplete() {
        console.log("total cocos asset download complete!");

        this._downloadNewFileComplete = true;
        if (this._removeDiscardFileComplete) {
            this.onSyncAssetComplete();
        }
    }
    protected onRemoveDiscardFileComplete(failFileList: string[]) {
        console.log("删除废弃文件完成:");
        this._removeDiscardFileComplete = true;
        if (this._downloadNewFileComplete) {
            this.onSyncAssetComplete();
        }
    }

    protected onSyncAssetComplete() {
        store.setStorageItem("LastSyncVersion", AppDefines.APP_VERSION_NAME + "." + AppDefines.Build_Version);
        PlatformSDK.instance.writeFile("res/AssetMap_" + AppDefines.APP_VERSION_NAME + "." + AppDefines.Build_Version + "_.json", JSON.stringify(this._totalRemoteFileList), null, "utf-8");
        this.onTaskSuccess();
    }

    protected onTaskComplete() {
        super.onTaskComplete();
        asset.assetDownloader.off(AssetDownloader.Event_GroupComplete, this.onAssetDonwloadComplete, this)
    }
}

class ExternalAssetSyncTask extends VirtualTask {
    protected _externalBundleMap: TMap<string, AssetBundle>;

    get bundleMap() {
        return this._externalBundleMap;
    }
    async onBegin() {

        //如果本地路径不为空，则设置超时20秒，否则设置为1秒
        if (PlatformSDK.instance.getUserRootPath() != "") {
            Debug.Log("外部资源下载时间设置为20秒")
            this.setTaskTimeout(20000);
        } else {
            Debug.Log("外部资源下载时间设置为1秒")
            this.setTaskTimeout(1000);
        }


        asset.assetDownloader.setMaxConnectCount(5);
        this._externalBundleMap = new TMap<string, AssetBundle>();
        //读取本地扩展资源包根路径
        let localFileList = await PlatformSDK.instance.readdirAsync(AssetBundleRootPath);
        if (localFileList && localFileList.length > 0) {//本地路径下存在
            for (let i = 0, len = localFileList.length; i < len; i++) {
                let bundleName = localFileList[i];
                if (bundleName == "index.json") {//索引文件
                    continue;
                }
                let bundle = new AssetBundle(bundleName);
                this._externalBundleMap.set(bundleName, bundle);
            }
        }

        let indexURL = cc.path.join(PlatformSDK.instance.settingData[PlatformSysSettingKeys.CDN], AssetBundleRootPath, "index.json" + "?" + cc.sys.now())

        let downloadIndexFileComplete = function (err: any, data: any) {
            if (!err && data) {
                this.onBundleIndexFileLoaded(data);
            }
            else {
                console.warn("download asset bundle total index fail:", err);
                setTimeout(function () {
                    cc.loader.load(indexURL, downloadIndexFileComplete);
                }, 500);
            }
        }.bind(this);
        //先删除文本index文件，不管成功失败，都去拉去最新的index文件
        // PlatformSDK.instance.unlink( AssetBundleRootPath + "index.json",downloadIndexFile,downloadIndexFile );
        //2.下载最新资源包索引文件
        cc.loader.load(indexURL, downloadIndexFileComplete);
    }
    //资源包总索引文件加载完成
    protected onBundleIndexFileLoaded(res: any) {
        this._externalBundleMap.eachRemove(function (key: string, value: AssetBundle) {//删除本地废弃的资源包
            if (!res[key]) {//销毁该资源包
                value.destory();
                return true;
            }
            return false;
        });

        for (let key in res) {
            let newVersion = res[key];
            let localItem: AssetBundle = this._externalBundleMap.get(key);
            if (!localItem) {
                localItem = new AssetBundle(key);
                this._externalBundleMap.set(key, localItem);
            }
            localItem.update(newVersion);
            localItem.once(AssetBundle.Event_Inited, this.onAssetBundleInited.bind(this));
        }
    }
    protected onAssetBundleInited(bundleName: string) {
        let isTotalInited = true;
        this._externalBundleMap.each(function (key: string, value: AssetBundle) {
            if (!value.isInited) {
                isTotalInited = false;
                return true;
            }
            return false;
        });
        if (isTotalInited) {//全部资源包已经初始化完成
            // console.log( "外部资源包索引初始化完成" )
            this.onTaskSuccess();
        }
    }
    protected onTaskComplete() {
        asset.assetDownloader.setMaxConnectCount(2);
        super.onTaskComplete();
    }
}

class AssetSyncTask extends VirtualTask {
    async onBegin() {
        let childTask = new ExternalAssetSyncTask("ExternalAssetSyncTask");
        childTask.begin(functionWrapper(this.onExternalAssetSyncSuccess, this), null, null);
    }

    /**
     * 扩展资源同步完成
     * @param task 
     */
    protected async onExternalAssetSyncSuccess(task: ExternalAssetSyncTask) {
        console.log("external asset sync complete !");
        this.onTaskSuccess();
        let cocosAssetMapFilePath = "res/AssetMap_" + AppDefines.APP_VERSION_NAME + "." + AppDefines.Build_Version + "_.json";
        if (await PlatformSDK.instance.access(cocosAssetMapFilePath)) {//已经存在最新版本的资源文件了
            //不管上次是否已经同步完，不再进行同步
            //也就是说，如果还有未下载的本地的资源也不进行下载
            //后续将cocos的资源抽象为资源包模式，以资源包为单位进行同步
            console.log("cocos asset sync ignore !");
        }
        else {
            let cocosSyncTaks = new CocosAssetSyncTask("CocosAssetSyncTask");
            cocosSyncTaks.begin(functionWrapper(this.onCocosAssetSyncSuccess, this));
        }
    }
    /**
     * cocos资源同步完成
     * @param task 
     */
    protected onCocosAssetSyncSuccess(task: CocosAssetSyncTask) {
        console.log("cocos asset sync complete !");
    }

}

export var asset = AssetManager.instance();
