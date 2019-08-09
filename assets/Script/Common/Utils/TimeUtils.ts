class TimeUtils {
    /**
     * 
     * @param time 
     */
    static getCurrentTime(time?: number) {
        var now = time ? new Date(time) : new Date();

        var year = now.getFullYear();
        var month = now.getMonth() + 1;
        var day = now.getDate();

        var hh = now.getHours();
        var mm = now.getMinutes();

        var clock = year + "-";

        if (month < 10) {
            clock += "0";
        }
        clock += month + "-";

        if (day < 10) {
            clock += "0";
        }
        clock += day + " ";

        if (hh < 10) {
            clock += "0";
        }
        clock += hh + ":";

        if (mm < 10) {
            clock += "0";
        }
        clock += mm + ":";

        return clock;
    }

    /**
     * 
     * @param time 
     */
    static getFormatDate(time: number) {
        return TimeUtils.getCurrentTime(time)
    }

    /**
       * XX:XX
       * @param time 单位毫秒
       */
    static getHourMinutes(time) {
        var date = new Date(time);
        return TimeUtils.toTwoLenStr(date.getHours()) + ':' + TimeUtils.toTwoLenStr(date.getMinutes());
    }
    /**
     * XXXXXXXX
     * @param time 单位毫秒
     */
    static GetCurrTimeStr(time) {
        var date = new Date(time);
        return date.getFullYear() + TimeUtils.toTwoLenStr(date.getMonth() + 1) + TimeUtils.toTwoLenStr(date.getUTCDate())
    }

    /**
     * 
     */
    static toTwoLenStr = function (value) {
        if (value < 10) {
            return '0' + value;
        }
        else {
            return value.toString();
        }
    }
};

export = TimeUtils;