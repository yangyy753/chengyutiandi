export default class FunctionWrapper<T extends Function>
{
    protected _func: T;
    protected _thisObj: any;
    protected _attachParams: any[];

    constructor(func: T, thisObj: any, ...attachParams: any[]) {
        this._func = func;
        this._thisObj = thisObj;
        this._attachParams = attachParams;
    }

    /**
     * 
     * @param params 
     */
    public setAttachParams(...params: any[]) {
        this._attachParams = params.concat();
    }

    /**
     * 
     * @param params 
     */
    public execute(...params: any[]): any {
        let currParams = params;
        if (this._attachParams && this._attachParams.length > 0) {
            if (!currParams)
                currParams = this._attachParams.concat();
            else {
                currParams = currParams.concat(this._attachParams);
            }
        }

        if (this._thisObj) {
            return this._func.apply(this._thisObj, currParams);
        }
        else {
            return this._func.apply(null, currParams);
        }
    }

    /**
     * 
     * @param func 
     * @param thisObj 
     */
    public equal(func: T, thisObj: any): boolean {
        return this._func == func && this._thisObj == thisObj;
    }

    /**
     * 
     */
    get thisObj() {
        return this._thisObj;
    }
}

export function functionWrapper<T extends Function>(func: T, thisObj: any, ...attachParams: any[]): FunctionWrapper<T> {
    let result = new FunctionWrapper(func, thisObj);
    if (attachParams && attachParams.length > 0)
        result.setAttachParams.apply(result, attachParams);
    return result;
}
