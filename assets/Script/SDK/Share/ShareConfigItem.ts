import Dictionary from "../../Struct/Dictionary";
import { PublishPlatform } from "../PlatformSDK";

export default class ShareConfigItem {
    shareType: string;
    imageURL: string;
    title: string;
    platformOps: Dictionary;
    reportType: number;
    tag: number;
    dependImages: string[];
    constructor() {
        this.platformOps = new Dictionary();
    }
    /**
     * 获取平台选项
     * @param {PublishPlatform} plat
     * @return {any}
     */
    public getPlatOps(plat: PublishPlatform) {
        let key: string;
        switch (plat) {
            case PublishPlatform.WX_GAME:
                {
                    key = "wx";
                    break;
                }
            case PublishPlatform.FB_GAME:
                {
                    key = "fb";
                    break;
                }
        }
        if (key) {
            return this.platformOps.get(key);
        }
        return null;
    }
}