import { OptionValues } from 'commander';
export type ApacheLineIndexTypes = 'originalLine' | 'remoteHost' | 'logname' | 'remoteUser' | 'time' | 'request' | 'status' | 'sizeCLF' | 'RequestHeader Referer' | 'RequestHeader User-Agent';
export interface ApacheLineTypes {
    originalLine: string;
    remoteHost: string;
    logname: string;
    remoteUser: string;
    time: string;
    request: string;
    status: string;
    sizeCLF: string;
    'RequestHeader Referer': string;
    'RequestHeader User-Agent': string;
}
declare class ApacheData {
    logs: ApacheLineTypes[];
    ips: {
        [key: string]: string[];
    };
    constructor();
    /**
     * Read all log files, and populates this.logs
     * @param {Array.<string>} logFilenames
     */
    readLogs(logFilenames: string[]): void;
    /** return all logs related to an IP, excluding some of them that are in the JSON configuration */
    getLogsforIp(ip: string, config: any): ApacheLineTypes[];
    categoriesIp(ip: string, logs: ApacheLineTypes[], config: any): number;
    /**
     * Populate ips, that is ips['all'], ips['user'], ips['bot'], and ips['spam']
     */
    populateIps(options: OptionValues): void;
}
export default ApacheData;
