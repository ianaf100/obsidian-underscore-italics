const EMPTY = /(?<!_)__(?!_)/;
const UNDERSCORE = /(?<!\\|_)_(?!_).*(?<!\\)_/;
const ASTERISK = /(?<!\\|\*)\*(?!\*).*(?<!\\|\*)\*(?!\*)/;
const UNDERSCORE_GREEDY = /(?<!\\|_)_(?!_).*?(?<!\\)_/;
const ASTERISK_GREEDY = /(?<!\\|\*)\*(?!\*).*?(?<!\\|\*)\*(?!\*)/;
const INNER_ITALICS = new RegExp([UNDERSCORE_GREEDY, ASTERISK_GREEDY].join('|'), 'g');
const TASKLIST_PREFIX = /(?<=\n)[ \t]*[-*+] \[.\]\s+/;
const BLOCKQUOTE_MARKERS = /(?<=\n)\s{0,3}(?:>\s+)+/;
const LIST_MARKERS = /(?<=\n)\s*[+\-*]\s+|\s*\d+\.\s+/;
//TODO: update to detect *** bold/italic
// (?<=(?<![\*_])[\*_])\*{2}.*\*{2}(?=[\*_](?![_\*]))

export function matchItalics(selection: string): RegExpMatchArray | null {
    return selection.match(ASTERISK) ??
           selection.match(UNDERSCORE) ??
           selection.match(EMPTY);
}

export function matchPrefixes(selection: string): RegExpMatchArray | null {
    return selection.match(BLOCKQUOTE_MARKERS) ??
           selection.match(TASKLIST_PREFIX) ??
           selection.match(LIST_MARKERS);
}

export function isItalicized(selection: string): boolean {
    return matchItalics(selection) != null;
}

export function matchInnerItalics(selection: string) {
    return selection.matchAll(INNER_ITALICS);
}
