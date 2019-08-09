export default class Dictionary {
    private _entries: {};
    private _size: number;

    constructor(elements?: [number | string, string][]) {
        this._entries = {};
        this._size = 0;
        if (Array.isArray(elements)) {
            for (var i = 0; i < elements.length; i++) {
                this.set(elements[i][0], elements[i][1]);
            }
        }
    }

    /**
     * 
     * @param key 
     * @param value 
     */
    public set(key: string | number, value: any) {
        if (!this.has(key)) {
            this._entries[key] = value;
            this._size++;
        }
        else {
            this._entries[key] = value;
        }
        return this;
    }

    /**
     * 
     * @param key 
     */
    public get(key: string | number): any {
        if (this.has(key)) {
            return this._entries[key];
        }
        return null;
    }

    /**
     * 
     */
    get size() {
        return this._size;
    }

    /**
     * 
     */
    public getArray(): any[] {
        var output = [];
        var entries = this._entries;
        for (var key in entries) {
            output.push(entries[key]);
        }
        return output;
    }

    /**
     * 
     * @param key 
     */
    public has(key: string | number): boolean {
        return (this._entries.hasOwnProperty(key.toString()));
    }

    /**
     * 
     * @param key 
     */
    public delete(key: string | number) {
        if (this.has(key)) {
            delete this._entries[key];
            this._size--;
        }
        return this;
    }

    /**
     * 
     */
    public clear() {
        Object.keys(this._entries).forEach(function (prop) {
            delete this._entries[prop];

        }, this);

        this._size = 0;

        return this;
    }

    /**
     * 
     */
    get keys(): string[] {
        return Object.keys(this._entries);
    }

    /**
     * 
     */
    get values() {
        var output = [];
        var entries = this._entries;

        for (var key in entries) {
            output.push(entries[key]);
        }

        return output;
    }

    /**
     * 
     */
    public dump() {
        var entries = this._entries;

        for (var key in entries) {
            console.log(key, entries[key]);
        }

        console.groupEnd();
    }

    /**
     * 
     * @param callback 
     */
    public each(callback: (key: string, value: any) => boolean) {
        var entries = this._entries;

        for (var key in entries) {
            if (callback(key, entries[key]) === false) {
                break;
            }
        }
        return this;
    }

    /**
     * 
     * @param value 
     */
    public contains(value: any): boolean {
        var entries = this._entries;

        for (var key in entries) {
            if (entries[key] === value) {
                return true;
            }
        }

        return false;
    }

    /**
     * 
     * @param dict 
     * @param override 
     */
    public merge(dict: Dictionary, override: boolean = false) {
        if (override === undefined) { override = false; }

        var local = this._entries;
        var source = dict._entries;

        for (var key in source) {
            if (local.hasOwnProperty(key) && override) {
                local[key] = source[key];
            }
            else {
                this.set(key, source[key]);
            }
        }

        return this;
    }
}