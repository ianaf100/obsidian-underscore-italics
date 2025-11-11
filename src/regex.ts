export const EMPTY = /(?<!_)__(?!_)/;
export const UNDERSCORE = /(?<!\\|_)_(?!_).*?(?<!\\)_/;
export const ASTERISK = /(?<!\\|\*)\*(?!\*).*?(?<!\\|\*)\*(?!\*)/;


export function matchItalics(selection: string): RegExpMatchArray | null {
    return selection.match(ASTERISK) ??
           selection.match(UNDERSCORE) ??
           selection.match(EMPTY);
}

export function isItalicized(selection: string): boolean {
    return matchItalics(selection) != null;
}
