
export default class TMap<K, V>
{
    protected _keys: K[];
    protected _values: V[];
    protected _size: number;

    constructor(elements?: [K, V][]) {
        this._keys = [];
        this._values = [];
        this._size = 0;
        if (Array.isArray(elements)) {
            for (var i = 0; i < elements.length; i++) {
                let item = elements[i];
                this.set(item[0], item[1]);
            }
        }
    }

    public set(key: K, value: V) {
        let keyIndex = this._keys.indexOf(key);
        if (keyIndex >= 0) {
            this._values[keyIndex] = value;
        }
        else {
            this._keys.push(key);
            this._values.push(value);
            this._size++;
        }
    }
    public swap(key1: K, key2: K) {
        let value1 = this.get(key1);
        let value2 = this.get(key2);
        this.set(key1, value2);
        this.set(key2, value1);
    }

    public get(key: K): any {
        let keyIndex = this._keys.indexOf(key);
        if (keyIndex >= 0) {
            return this._values[keyIndex];
        }
        return null;
    }

    public findKey(value: V): K {
        let index = this._values.indexOf(value);
        if (index >= 0) {
            return this._keys[index];
        }
        return null;
    }

    get size() {
        return this._size;
    }

    public has(key: K): boolean {
        return this._keys.indexOf(key) >= 0;
    }

    public remove(key: K) {
        let keyIndex = this._keys.indexOf(key);
        if (keyIndex >= 0) {
            this._keys.splice(keyIndex, 1);
            this._values.splice(keyIndex, 1);
            this._size--;
        }
        return this;
    }

    public clear(): TMap<K, V> {
        this._keys.length = 0;
        this._values.length = 0;
        this._size = 0;
        return this;
    }

    get keys(): K[] {
        return this._keys.concat();
    }

    get values() {
        return this._values.concat();
    }

    public dump(): void {
        console.group('TMap');
        for (let i = 0; i < this._size; i++) {
            console.log(this._keys[i], this._values[i]);
        }
        console.groupEnd();
    }

    public each(callback: (key: K, value: V) => boolean) {
        for (let i = 0; i < this._size; i++) {
            if (callback(this._keys[i], this._values[i])) {
                break;
            }
        }
        return this;
    }

    public eachRemove(callback: (key: K, value: V) => boolean) {
        for (let i = this._size - 1; i >= 0; i--) {
            if (callback(this._keys[i], this._values[i])) {
                this.remove(this._keys[i]);
            }
        }
        return this;
    }

    public contains(value: V): boolean {
        return this._values.indexOf(value) >= 0;
    }

    public merge(map: TMap<K, V>, override: boolean = false) {
        if (override === undefined) { override = false; }
        for (var i = 0; i < map._size; i++) {
            let currKey = map._size[i];
            if (!this.has(currKey) || override) {
                this.set(currKey, map.get(currKey));
            }
        }
        return this;
    }
}