export const EMPTY = /(?<!_)__(?!_)/;
export const UNDERSCORE = /(?<!\\|_)_(?!_).*(?<!\\)_/;
export const ASTERISK = /(?<!\\|\*)\*(?!\*).*(?<!\\|\*)\*(?!\*)/;
const UNDERSCORE_GREEDY = /(?<!\\|_)_(?!_).*?(?<!\\)_/;
const ASTERISK_GREEDY = /(?<!\\|\*)\*(?!\*).*?(?<!\\|\*)\*(?!\*)/;

//TODO: update to detect *** bold/italic

export function matchItalics(selection: string): RegExpMatchArray | null {
    return selection.match(ASTERISK) ??
           selection.match(UNDERSCORE) ??
           selection.match(EMPTY);
}

export function isItalicized(selection: string): boolean {
    return matchItalics(selection) != null;
}

const innerItalics = new RegExp(UNDERSCORE_GREEDY.source + "|" + ASTERISK_GREEDY.source, 'g');

export function matchInnerItalics(selection: string) {
    return selection.matchAll(innerItalics);
}
