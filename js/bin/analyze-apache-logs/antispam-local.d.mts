import { OptionValues } from "commander";
import ApacheData from "./apache-data.mjs";
declare function spamDetection(apacheData: ApacheData, options: OptionValues): Promise<void>;
declare const _default: {
    spamDetection: typeof spamDetection;
};
export default _default;
