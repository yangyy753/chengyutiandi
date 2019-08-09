class StringUtils {
    static String2ArrayBuffer(str: string) {
        var buf = new ArrayBuffer(str.length);
        var bufView = new Uint8Array(buf);
        for (var i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i) & 255;
        }
        return buf;
    }

    static ArrayBuffer2String(ab: ArrayBuffer) {
        let data = new Uint8Array(ab);
        var dataString = "";
        for (var i = 0; i < data.length; i++) {
            dataString += String.fromCharCode(data[i]);
        }
        return dataString;
    }

    static Format(formatText: string, ...params) {
        return this.Format2(formatText, params);
    }

    static Format2(formatText, formatValues: any[]) {
        if (formatValues && formatValues.length) {
            for (var i = 0; i < formatValues.length; ++i) {
                formatText = formatText.replace(new RegExp("\\{" + i + "\\}", "g"), formatValues[i]);
            }
        }
        return formatText;
    }

    static substitute() {
        var str = Array.prototype.shift.apply(arguments);
        if (str == null) return '';

        // Replace all of the parameters in the msg string.
        var len = arguments.length;
        var args;
        if (len == 1 && Array.isArray(arguments[0])) {
            args = arguments[0];
            len = args.length;
        }
        else {
            args = arguments;
        }

        for (var i = 0; i < len; i++) {
            str = str.replace(new RegExp("\\{" + i + "\\}", "g"), args[i]);
        }

        return str;
    }

    static Trim(str) {
        var result = "";
        for (var i = 0; i < str.length; ++i) {
            if (str.charCodeAt(i) != 0) {
                result += str.charAt(i);
            }
        }

        return result;
    }

    static showCharCodes(str) {
        var result = "";
        for (var i = 0; i < str.length; ++i) {
            result += str.charCodeAt(i);
            if (i != str.length - 1) {
                result += "|";
            }
        }
        return result;
    }
};

export = StringUtils;