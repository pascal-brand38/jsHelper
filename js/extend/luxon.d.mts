import { StringUnitLength, InfoUnitOptions } from 'luxon';
declare module 'luxon' {
    namespace DateTime {
        function fromNowStartOfDay(): DateTime;
        function fromEpochStartOfDay(epoch: number): DateTime;
        function fromFormatStartOfDay(str: string, format?: string): DateTime;
        function fromExcelSerialStartOfDay(serial: number): DateTime;
        function epochNDays(nDays: number): number;
    }
    interface DateTime<IsValid extends boolean = boolean> {
        toEpoch: () => number;
        toExcelSerial: () => number;
        weekdayStr: (length?: StringUnitLength, opts?: InfoUnitOptions) => string;
    }
}
