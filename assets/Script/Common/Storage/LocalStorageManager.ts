import Dictionary from "../../Struct/Dictionary";
import { PlatformSDK } from "../../SDK/PlatformSDK";
import { Debug } from "../Log/LogManager";

export default class LocalStorageManager {

    private static _instance: LocalStorageManager = null;

    static instance():LocalStorageManager {
        if (!this._instance)
            this._instance = new LocalStorageManager();
        return this._instance;
    }

    protected _storageItems: Dictionary;
    protected _TotalKeys: string[];
    protected _ModifyKeys: string[];

    private constructor() {

    }

    init() {
        this._storageItems = new Dictionary();
        this._ModifyKeys = [];
        this._TotalKeys = [];
    }

    public initStorageKeys(totalKeys: string[]) {
        this.loadAllStorageInfo(totalKeys);
    }
    public setStorageItem(key: string, value: any, isFlush: boolean = true) {
        this.setItem(key, value);
    }
    public getStorageItem(key: string, defaultValue?: any) {
        let value = this.getItem(key);
        if (value == null) {
            value = defaultValue;
        }
        return value;
    }
    public getStorageItemAsync(key: string, handler: (key: string, value: any) => void) {
        this.getItemAsync(key, handler);
    }

    loadAllStorageInfo(totalKeys: string[]) {

        let self = this;
        for (var index = 0, len = totalKeys.length; index < len; index++) {

            let targetKey = totalKeys[index]
            this._TotalKeys.push(targetKey)
            PlatformSDK.instance.getStorageASync(targetKey).then(
                function (res) {
                    self._storageItems.set(targetKey, res);
                }
            ).catch(
                function (res) {
                    Debug.Warning("_loadAllStorageInfo fail,key:", targetKey)
                }
            )
        }
    }

    /**
     * 保存对象
     * @param {string} key
     * @param value
     */
    public setItem(key: string, value: any, isFlush: boolean = true): void {
        this._storageItems.set(key, value);
        if (this._ModifyKeys.indexOf(key) == -1)
            this._ModifyKeys.push(key);
        if (this._TotalKeys.indexOf(key) == -1) {
            this._TotalKeys.push(key);
        }
        if (isFlush) {
            this.flush();
        }
    }

    /**
     * 同步获取存储对象
     * @param {string} key
     * @return {any}
     */
    public getItem(key: string): any {
        let value = this._storageItems.get(key);
        if (!value) {
            value = PlatformSDK.instance.getStorageSync(key);
            if (value != null && value != undefined) {
                this._storageItems.set(key, value);
            }
        }
        return value;
    }

    /**
     * 异步获取存储对象
     * @param {string} key
     * @param {FunctionWrapper<(key: string, value: any) => void>} handler
     */
    public async getItemAsync(key: string, handler: (key: string, value: any) => void) {
        let value = this._storageItems.get(key);
        if (!value) {
            try {
                value = await PlatformSDK.instance.getStorageASync(key);
            }
            catch (err) {
                value = null;
            }

            if (value != null && value != undefined) {
                this._storageItems.set(key, value);
            }
        }
        if (handler) {
            handler(key, value);
        }
        return value;
    }

    /**
     * 保存到本地
     */
    public flush(): void {
        for (let i = 0, len = this._ModifyKeys.length; i < len; i++) {
            PlatformSDK.instance.setStorageASync(this._ModifyKeys[i], this._storageItems.get(this._ModifyKeys[i]));
        }
        this._ModifyKeys.length = 0;
    }
}

export var store = LocalStorageManager.instance();
