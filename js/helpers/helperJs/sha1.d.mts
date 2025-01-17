export interface sha1ListType {
    [sha1: string]: string[];
}
declare function getSha1(filename: string): string;
declare function initSha1List(): {};
declare function updateSha1List(sha1List: sha1ListType, sha1sum: string, filename: string, checkCollision?: boolean): sha1ListType;
declare function isInSha1List(sha1List: sha1ListType, filename: string): string | undefined;
declare const _default: {
    getSha1: typeof getSha1;
    initSha1List: typeof initSha1List;
    updateSha1List: typeof updateSha1List;
    isInSha1List: typeof isInSha1List;
};
export default _default;
