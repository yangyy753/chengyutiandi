import BaseComponent from "./BaseComponent";
import { IPoolItem } from "../Common/Pool/IPoolItem";

const { ccclass, property } = cc._decorator;
@ccclass
export default class PoolItemComponent extends BaseComponent implements IPoolItem {
    public reuse(): void {
    }

    public unuse(): void {
        if (this.node) {
            this.node.removeFromParent(false);
        }
    }
    
    public destory(): void {
        if (this.node) {
            this.node.destroy();
        }
    }

}