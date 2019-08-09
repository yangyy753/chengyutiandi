import CommonUtils from "../utils/CommonUtils";
import { Env } from "../../Struct/ConstEnum";
import { PlatformSDK } from "../../SDK/PlatformSDK";

var LOG_ITEM_MAX_COUNT = 1000;

export const enum LogLevels {
    INFO = 1,
    WARN = 2,
    ERROR = 4,
    ALL = 1 | 2 | 4
}

class LogItem {

    protected _Level: LogLevels;
    protected _Timestamp: number;
    protected _GroupName: string;
    protected _LogContent: string;
    protected _CreateTimeText: string;

    constructor(level: LogLevels, group: string, ...args: any[]) {
        this._Level = level;
        let currDate = new Date();
        this._Timestamp = currDate.getTime();

        let year = currDate.getFullYear();
        let month = (currDate.getMonth() + 1 < 10 ? '0' + (currDate.getMonth() + 1) : currDate.getMonth() + 1);
        let day = currDate.getDate();
        let hour = currDate.getHours();
        let minutes = currDate.getMinutes();
        let second = currDate.getSeconds();
        let ms = currDate.getMilliseconds();
        this._CreateTimeText = year + "-" + month + "-" + day + "-" + hour + ":" + minutes + ":" + second + "." + ms;

        this._LogContent = "(" + AppDefines.APP_VERSION_NAME + "." + AppDefines.Build_Version + ")";
        this._LogContent += this._CreateTimeText;
        switch (level) {
            case LogLevels.INFO:
                {
                    this._LogContent += "[I]";
                    break;
                }
            case LogLevels.WARN:
                {
                    this._LogContent += "[W]";
                    break;
                }
            case LogLevels.ERROR:
                {
                    this._LogContent += "[E]";
                    break;
                }
            default:
                {
                    this._LogContent += " [I] ";
                    break;
                }
        }
        if (group && CommonUtils.IsString(group)) {
            this._GroupName = group;
            this._LogContent += "(" + this._GroupName + ") ";
        }
        let contentStr = "";
        try {
            contentStr = JSON.stringify(args);
        }
        catch (err) {
            contentStr = "Object";
        }

        this._LogContent += contentStr;
        this._LogContent += '\n';
    }
    get contentText() {
        return this._LogContent;
    }
    get logLevel() {
        return this._Level;
    }
    get timestampText() {
        return this._CreateTimeText;
    }
}

export default class LogManager {
    private static _instance: LogManager = null;

    static instance(): LogManager {
        if (!this._instance)
            this._instance = new LogManager();
        return this._instance;
    }

    protected static _OriginalLogInterface: Function;
    protected static _OriginalWarnInterface: Function;
    protected static _OriginalErrorInterface: Function;
    protected _LogItemCount: number;
    protected _WarnItemCount: number;
    protected _ErrorItemCount: number;
    protected _LogItemList: LogItem[];

    constructor() {
        this._LogItemList = [];
        LogManager._OriginalLogInterface = console.log;
        LogManager._OriginalWarnInterface = console.warn;
        LogManager._OriginalErrorInterface = console.error;
        if (!CC_EDITOR) {
            console.log = this.Log.bind(this);
            console.warn = this.Warning.bind(this);
            console.error = this.Error.bind(this);
        }
    }

    /**
     * 
     * @param groupName 
     * @param message 
     */
    public Log_G(groupName: string, ...message: any[]) {
        let logItem = new LogItem(LogLevels.INFO, groupName, message);
        this.pushItem(logItem);

        let newArguments = [logItem.timestampText];
        newArguments.unshift("(" + AppDefines.APP_VERSION_NAME + "." + AppDefines.Build_Version + ")");
        for (let i = 0; i < arguments.length; i++) {
            newArguments.push(arguments[i]);
        }
        if (AppDefines.CURR_ENV != Env.RELEASE) {
            LogManager._OriginalLogInterface.apply(null, newArguments);
        }
    }

    /**
     @param {String} groupName 
     @param {...*} message
     */
    public Warning_G(groupName: string, ...message: any[]) {
        let logItem = new LogItem(LogLevels.WARN, groupName, message);
        this.pushItem(logItem);
        let newArguments = [logItem.timestampText];
        newArguments.unshift("(" + AppDefines.APP_VERSION_NAME + "." + AppDefines.Build_Version + ")");
        for (let i = 0; i < arguments.length; i++) {
            newArguments.push(arguments[i]);
        }
        if (AppDefines.CURR_ENV != Env.RELEASE) {
            LogManager._OriginalWarnInterface.apply(null, newArguments);
        }
    }

    /**
     @param {String} groupName
     @param {...*} message
     */
    public Error_G(groupName: string, ...message: any[]) {
        let logItem = new LogItem(LogLevels.ERROR, groupName, message);
        this.pushItem(logItem);
        let newArguments = [logItem.timestampText];
        newArguments.unshift("(" + AppDefines.APP_VERSION_NAME + "." + AppDefines.Build_Version + ")");
        for (let i = 0; i < arguments.length; i++) {
            newArguments.push(arguments[i]);
        }
        LogManager._OriginalErrorInterface.apply(null, newArguments);
    }
    /**
     @param {...*} message
     */
    public Log(...message: any[]) {
        let logItem = new LogItem(LogLevels.INFO, null, message);
        this.pushItem(logItem);
        let newArguments = message.slice();
        newArguments.unshift(logItem.timestampText);
        newArguments.unshift("(" + AppDefines.APP_VERSION_NAME + "." + AppDefines.Build_Version + ")");
        if (AppDefines.CURR_ENV != Env.RELEASE) {
            LogManager._OriginalLogInterface.apply(null, newArguments);
        }
    }

    /**
     @param {...*} message
     */
    public Warning(...message: any[]) {
        let logItem = new LogItem(LogLevels.WARN, null, message);
        this.pushItem(logItem);
        let newArguments = message.slice();
        newArguments.unshift(logItem.timestampText);
        newArguments.unshift("(" + AppDefines.APP_VERSION_NAME + "." + AppDefines.Build_Version + ")");
        if (AppDefines.CURR_ENV != Env.RELEASE) {
            LogManager._OriginalWarnInterface.apply(null, newArguments);
        }
    }

    /**
     @param {...*} message
     */
    public Error(...message: any[]) {
        let logItem = new LogItem(LogLevels.ERROR, null, message);
        this.pushItem(logItem);
        let newArguments = message.slice();
        newArguments.unshift(logItem.timestampText);
        newArguments.unshift("(" + AppDefines.APP_VERSION_NAME + "." + AppDefines.Build_Version + ")");
        LogManager._OriginalErrorInterface.apply(null, newArguments);
    }

    clear() {
        this._LogItemList = [];
        this._WarnItemCount = this._ErrorItemCount = this._LogItemCount = 0;
    }

    public pushItem(item: LogItem) {
        this._LogItemList.push(item);
        while (this._LogItemList.length >= LOG_ITEM_MAX_COUNT) {
            this._LogItemList.shift();
        }
    }

    public upload(tag: string = "", isShowTips: boolean = false) {
        let logText = "";
        for (let i = 0, len = this._LogItemList.length; i < len; i++) {
            logText += this._LogItemList[i].contentText;
        }

        this.uploadLog(logText, tag, isShowTips);
        this.clear();
    }

    uploadLog(logContext: string, logTag: string, isShowResultTips: boolean = true) {
        let savePath = "logs/";
        // let myPlayerInfo: PlayerInfo = fdk.getGlobalData(AppConfigUserKeys.MyUserInfo);
        let currDate = new Date();
        let year = currDate.getFullYear();
        let month = (currDate.getMonth() + 1 < 10 ? '0' + (currDate.getMonth() + 1) : currDate.getMonth() + 1);
        let day = currDate.getDate();
        let hour = currDate.getHours();
        let mminutes = currDate.getMinutes();
        let second = currDate.getSeconds();
        let ms = currDate.getMilliseconds();
        let timeText = year + "_" + month + "_" + day + "_" + hour + "_" + mminutes + "_" + second;

        savePath += "temp_upload.log";

        let uploadPath = AppDefines.CURR_ENV + "/" + AppDefines.APP_VERSION_NAME + "." + AppDefines.Build_Version + "/";
        uploadPath += (year + "_" + month + "_" + day) + "/";
        // uploadPath += "(" + (myPlayerInfo ? myPlayerInfo.uin : "00000") + ")_" + hour + "_" + mminutes + "_" + second + "_" + logTag + ".log";

        PlatformSDK.instance.writeFile(savePath, logContext, function (isSuccess: boolean, localFullPath: string) {
            if (isSuccess) {
                PlatformSDK.instance.uploadFile(localFullPath, uploadPath, AppDefines.LOG_UploadURL, function (isUploadSuccess: boolean) {
                    if (isUploadSuccess) {//上传成功
                        console.warn("上传log文件成功");
                        PlatformSDK.instance.unlink(localFullPath, null, null);
                        // if (isShowResultTips)
                            // showMessagePanel("上传log文件成功", 2000);
                    }
                    else {
                        console.warn("上传log文件失败");
                        // if (isShowResultTips)
                        //     showMessagePanel("上传log文件失败", 2000);
                    }
                });
            }
            else {
                console.warn("写入本地log文件失败");
                // if (isShowResultTips)
                //     showMessagePanel("上传log文件失败", 2000);
            }
        }, "utf-8");
    }
}

export var Debug = LogManager.instance();