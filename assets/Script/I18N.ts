import { I18n, gameGlobal } from "./GameGlobal";
import { store } from "./Common/LocalStorageManager";
import StringUtils = require("./Common/Utils/StringUtils");
import { msg } from "./Common/Message/MessageManager";

const UserLanguageKey = "UserLanguage";
const LabelLanguageKey = "__LanguageKey__";

//匹配__T[ 和 ]T__包裹文本编号的文本项 
var _textIndexReg: RegExp = new RegExp("__T\\[\\d+\\]T__", "g");
//匹配__T[ 和 ]T__包裹实际文本的文本项
var _textContentReg: RegExp = new RegExp("__t\\[[\\s\\S]*\\]t__", "g");

function convertTextContentToIndex(text: string) {
    text = text.toString();
    let result = text.match(_textContentReg);
    if (result && result.length > 0) {
        let newText = text;
        for (let i = 0, len = result.length; i < len; i++) {
            let subText = result[i];
            let newSubText = subText.substring(4, subText.length - 4);
            let subIndex = I18n.getTextIndex(newSubText);
            if (subIndex >= 0) {
                newText = newText.replace(new RegExp(escapeRegExp(subText), "g"), "__T[" + subIndex + "]T__")
            }
        }
        return newText;
    }
    return text;
}

function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}
let label_language_key_Property = { enumerable: true, configurable: true };
{
    label_language_key_Property.get = function () {
        return this[LabelLanguageKey];
    };
    label_language_key_Property.set = function (value) {
        this[LabelLanguageKey] = value;
    };
    Object.defineProperty(cc.Label.prototype, "languageKey", label_language_key_Property);
}

let stringProperty = Object.getOwnPropertyDescriptor(cc.Label.prototype, "string");
let CCLabel_set_string_Old = stringProperty.set;
{
    stringProperty.set = function (text) {
        this._stringFormat = null;
        this._formatValus = null;
        text = convertTextContentToIndex(text);
        if (_textIndexReg.test(text)) {//包含文本ID
            this.languageKey = text;
            CCLabel_set_string_Old.call(this, I18n.t2(text));
        }
        else {
            this.languageKey = null;
            CCLabel_set_string_Old.call(this, text);
        }
    }
}
Object.defineProperty(cc.Label.prototype, "string", stringProperty);



let CCLabel_updateFormatString_Old = cc.Label.prototype.updateFormatString;
cc.Label.prototype.updateFormatString = function () {
    this.languageKey = null;
    if (this._formatValus) {
        CCLabel_set_string_Old.call(this, gameGlobal.i18n.t3(this._stringFormat, this._formatValus));

    }
    else {
        CCLabel_set_string_Old.call(this, gameGlobal.i18n.t2(this._stringFormat));
    }
}

cc.Label.prototype.updateLanguageString = function () {
    if (this._stringFormat) {
        this.updateFormatString();
    }
    else {
        if (this[LabelLanguageKey]) {//存在多语言Key
            CCLabel_set_string_Old.call(this, I18n.t2(this[LabelLanguageKey]));
        }
    }
}
let CCLabel_onEnable_Old = cc.Label.prototype.onEnable;
cc.Label.prototype.onEnable = function () {
    let newString = convertTextContentToIndex(this._string);
    if (_textIndexReg.test(newString)) {
        this.languageKey = newString;
        this._string = I18n.t2(newString);
        this._stringFormat = null;
        this._formatValus = null;
    }
    else if (this.languageKey) {
        this._string = I18n.t2(this._string);
    }
    else if (this._stringFormat) {
        this._string = I18n.t3(this._stringFormat, this._formatValus);
    }
    CCLabel_onEnable_Old.call(this);
}


export default class I18N {

    protected _curLang: string;

    protected _localLanguageList: string[];
    constructor() {
        this._localLanguageList = [];
    }

    get curLang() {
        return this._curLang;
    }
    setCurrLang(value: string, isShowLoading: boolean = true) {
        if (this.curLang != value) {
            // window["i18n"].curLang = value;
            //加载语言包
            if (this._localLanguageList.indexOf(value) >= 0) {
                this._curLang = value;
                this.updateLanguge(value);
                return;
            }
            if (isShowLoading)
                msg.Tips("正在加载...", 10, null, "LanguageLoader");
            let self = this;
            cc.loader.load(AppDefines.LanguageResPath[value], function (err: any, obj: any) {
                if (isShowLoading)
                    gameGlobal.removePanelWithTag("LanguageLoader");
                if (err || !obj) {
                    if (isShowLoading)
                        msg.Tips("加载语言包失败，请稍后再试...");
                    return;
                }
                for (let i = 0, len = obj.length; i < len; i++) {
                    AppDefines.LanguageMap[i][value] = obj[i];
                }

                self._curLang = value;
                self.updateLanguge(value);

            });
        }
    }

    protected updateLanguge(targetLanguage: string) {

        if (!cc.director.getScene()) {
            return;
        }

        //写入本地缓存，当前的语言
        store.setStorageItem(UserLanguageKey, targetLanguage);

        //获取所有的cc.Label
        let rootNodes = cc.director.getScene().children;
        // walk all nodes with localize label and update
        let allLocalizedLabels: cc.Label[] = [];
        for (let i = 0; i < rootNodes.length; ++i) {
            let labels = rootNodes[i].getComponentsInChildren<cc.Label>(cc.Label);
            Array.prototype.push.apply(allLocalizedLabels, labels);
        }

        // let totalLabel = [];
        // findChildComponents( rootNodes[0].children,cc.Label,totalLabel );

        for (let i = 0; i < allLocalizedLabels.length; ++i) {
            let label = allLocalizedLabels[i];
            // if(!label.node.active)continue;
            label.updateLanguageString();
        }

        let allLocalizedSprites = [];
        for (let i = 0; i < rootNodes.length; ++i) {
            let sprites = rootNodes[i].getComponentsInChildren('LocalizedSprite');
            Array.prototype.push.apply(allLocalizedSprites, sprites);
        }
        for (let i = 0; i < allLocalizedSprites.length; ++i) {
            let sprite = allLocalizedSprites[i];
            if (!sprite.node.active) continue;
            sprite.updateSprite(this._curLang);
        }

        //获取所有的LanguageSprite

    }
    protected replaceText(text: string) {
        if (text) {
            let result = text.match(_textIndexReg);
            if (result && result.length > 0) {

                let newText = text;
                for (let i = 0, len = result.length; i < len; i++) {
                    let subText = result[i];
                    let index = subText.substring(4, subText.length - 4);
                    let newSubText = AppDefines.LanguageMap[index][this._curLang];
                    if (!newSubText) {
                        newSubText = AppDefines.LanguageMap[index][AppDefines.DEFAULT_LANGUAGE];
                    }
                    newText = newText.replace(new RegExp(escapeRegExp(subText), "g"), newSubText)
                }
                return newText;
            }
            return text;
        }
        return "";
    }
    public t2(textOrForamt: string, ...formatValues) {
        return this.t3(textOrForamt, formatValues);
    }

    public t3(textOrForamt: string, formatValues: any[]) {
        let newFormat = this.replaceText(textOrForamt);
        if (formatValues && formatValues.length > 0) {
            for (var i = 0; i < formatValues.length; ++i) {
                newFormat = newFormat.replace(new RegExp("\\{" + i + "\\}", "g"), this.replaceText(formatValues[i].toString()));
            }
        }
        return newFormat;
    }

    //从中文字符获取多语言文本
    public tWithZhText(textOrForamt: string, formatValues: any[]) {
        if (this._curLang == AppDefines.DEFAULT_LANGUAGE) {
            return this.t3(textOrForamt, formatValues);
        }
        let index = -1;
        for (let i = 0, len = AppDefines.LanguageMap.length; i < len; i++) {
            if (AppDefines.LanguageMap[i]["zh"] == textOrForamt) {
                index = i;
                break;
            }
        }
        if (index != -1) {
            let newTextFormat = AppDefines.LanguageMap[index][this._curLang];
            if (!newTextFormat)
                newTextFormat = textOrForamt
            return this.t3(newTextFormat, formatValues);
        }
        return StringUtils.Format2(textOrForamt, formatValues);
    }

    //从__T[ 和 ]T__中提取文本
    public getTextWithIndexReg(text: string) {
        let newString = convertTextContentToIndex(text);
        if (_textIndexReg.test(newString)) {
            newString = I18n.t2(newString);
        } else {
            newString = text;
        }
        return newString;
    }

    getTextIndex(text: string) {
        let index = -1;
        for (let i = 0, len = AppDefines.LanguageMap.length; i < len; i++) {
            if (AppDefines.LanguageMap[i][AppDefines.DEFAULT_LANGUAGE] == text) {
                index = i;
                break;
            }
        }
        return index;
    }

    public t(key: string, formatParams?: { [key: string]: string }): string {
        return key;
    }

    public getLanguageNum(): number {
        return Object.keys(AppDefines.LanguageResPath).length;
    }
    /**
     * 
     * @param deviceLanguage 设备语言
     */
    public init(): void {
        let usrLanguage = store.getStorageItem(UserLanguageKey, AppDefines.DEFAULT_LANGUAGE);
        this._curLang = AppDefines.DEFAULT_LANGUAGE;
        this._localLanguageList.push(AppDefines.DEFAULT_LANGUAGE);
        if (AppDefines.LanguageResPath[usrLanguage])
            this.setCurrLang(usrLanguage, false);
    }
}