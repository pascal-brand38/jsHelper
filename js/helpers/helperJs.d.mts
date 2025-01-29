declare function warning(s: string): void;
declare function error(s: string): void;
declare function walkDir(rootDir: any, options: any): any[];
declare const _default: {
    question: {
        question: (text: string) => Promise<string>;
    };
    thunderbird: {
        compose: (email: string, subject: string, body: string, attachment?: string | null, exe?: string, forbiddenWords?: string[]) => Promise<void>;
    };
    utils: {
        getImmediateSubdirs: (dir: string) => string[];
        error: typeof error;
        warning: typeof warning;
        sleep: (s: number) => Promise<unknown>;
        walkDir: typeof walkDir;
        beautifulSize(s: number): string;
    };
    sha1: {
        getSha1: (filename: string) => string;
        initSha1List: () => {};
        updateSha1List: (sha1List: import("./helperJs/sha1.mjs").sha1ListType, sha1sum: string, filename: string, checkCollision?: boolean) => import("./helperJs/sha1.mjs").sha1ListType;
        isInSha1List: (sha1List: import("./helperJs/sha1.mjs").sha1ListType, filename: string) => string | undefined;
    };
    info: (text: string) => void;
    logError: (text: string) => void;
    warning: typeof warning;
    error: typeof error;
};
export default _default;
