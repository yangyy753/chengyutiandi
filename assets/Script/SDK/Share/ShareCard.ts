import { GraphicsContainer } from "../../Extra/Canvas2D";
import { timer } from "../../Common/Time/TimerManager";
import { functionWrapper } from "../../Struct/FunctionWrapper";

export default class ShareCard extends GraphicsContainer {
    protected _currDrawTimerID: number;
    constructor() {
        super(null, { width: 640, height: 512 });
        this._currDrawTimerID = -1;
    }

    get isFillBgValid() {
        return this._fillBgSprite && this._fillBgSprite.getParent() && this._fillBgSprite.isValid;
    }

    setDirty() {
        super.setDirty();
        if (this._currDrawTimerID == -1) {
            this._currDrawTimerID = timer.addFrameListener(1, 0, functionWrapper(this.onEnterFrame, this), null);
        }
    }
    destory() {
        super.destory();

        if (this._currDrawTimerID >= 0) {
            timer.removeListener(this._currDrawTimerID);
            this._currDrawTimerID = -1;
        }
    }
    draw(graphics?: any, isForce: boolean = false) {
        if (this.isValid || isForce) {
            let result = super.draw(graphics, isForce);
            return result;
        }
        return false;
    }


    protected onEnterFrame() {
        if (this.draw()) {
            if (this._currDrawTimerID >= 0) {
                timer.removeListener(this._currDrawTimerID);
                this._currDrawTimerID = -1;
            }
        }
    }
    async checkDraw(timeoutTime: number = 5) {
        let self = this;
        return new Promise((resolve, reject) => {
            let beginTime = new Date().getTime();
            let func = functionWrapper(function (targetCard: ShareCard, beginTime: number, timeLimit: number) {
                if (targetCard.draw()) {

                    resolve(true);

                }
                else {
                    let currTime = new Date().getTime();
                    if ((currTime - beginTime) >= timeLimit) {
                        targetCard.draw(null, true);
                        resolve(false);
                        return;
                    }
                    timer.addNextFrameListener(func);
                }


            }, null, self, beginTime, timeoutTime * 1000);
            timer.addNextFrameListener(func);
        });
    }

}