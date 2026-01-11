import '../../extend/luxon.mjs';
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
    userIps: string[];
    spamIps: string[];
    dbip: any;
    todayStr: string;
    constructor();
    /**
     * Read all log files, and populates this.logs
     * @param {Array.<string>} logFilenames
     */
    readLogs(logFilenames: string[]): void;
    /**
     * Populate this.userIps and this.spamIps using this.logs and this.dbip
     */
    populateIps(): void;
    _addToDb(ip: string, isSpam: boolean, antispam: string, reason: string | undefined): void;
    _spamInformation(ip: string, isSpam: boolean, antispam: string, reason: string | undefined): {
        ip: string;
        isSpam: boolean;
        antispam: string;
        reason: string | undefined;
        date: string;
    };
    spamCheckToday(ip: string, antispam: string): boolean;
    spamDetected(ip: string, reason: string, antispam: string): {
        ip: string;
        isSpam: boolean;
        antispam: string;
        reason: string | undefined;
        date: string;
    };
    noSpam(ip: string, antispam: string): {
        ip: string;
        isSpam: boolean;
        antispam: string;
        reason: string | undefined;
        date: string;
    };
    _printSingle(users: number, spams: number, title: string, usersText: string, spamsText: string, from?: boolean, print?: (size: number) => string): void;
    /**
     * Print statistics on logs
     */
    print(options: OptionValues): void;
    /**
     * Knowing new ips are spam, remove them from the list this.userIps,
     * and add them to the list this.spamIps
     * @param {Array.<string>} newSpamIps List of new ips detected as spam ip
     */
    addSpamIps(newSpamIps: string[]): void;
    saveLogsUser(filename: string): void;
}
export default ApacheData;
