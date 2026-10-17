import { EditorSelection, EditorState, SelectionRange } from "@codemirror/state";
import { syntaxTree } from '@codemirror/language';
import { NodeIterator, SyntaxNode } from '@lezer/common';
import { matchItalics, matchPrefixes } from "./regex";


// Returns actual text string of a selection range's content in the editor. 
//  Optional radius to grow each side of the selection.  
function selectionText(
    state: EditorState, 
    range: SelectionRange | {from: number, to: number},
    radius = 0
) {
    const from = Math.max(0, range.from - radius);
    const to = Math.min(state.doc.length, range.to + radius);
    return state.sliceDoc(from, to);
}

const nextChar = (anchor: number, state: EditorState) => {
    const to = Math.min(state.doc.length, anchor + 1); 
    return state.sliceDoc(anchor, to);
}

const prevChar = (anchor: number, state: EditorState) => {
    const from = Math.max(0, anchor - 1); 
    return state.sliceDoc(from, anchor);
}

// Lazy check to see if current (entire) selection is italic
const checkSelectionForItalics = (range: SelectionRange, state: EditorState) => {
    const selectionLength = selectionText(state, range).trim().length;
    const token = selectionText(state, range, 3);  
    const match = matchItalics(token);
    // Ensure the italic portion has similar length to the entire selection
    if (match) {
        const diff = selectionLength - (match[0].length - 2); 
        return Math.abs(diff) <= 1;  // tolerance of 1(?)
    } 
    return false;
}


    // let fromOffset = 0;
    // const token = selectionText(state, range, radius);
    // const match = matchPrefixes(token);
    // fromOffset += (match?.index ?? 0)
    //             + (match?.[0]?.length ?? 0)
    //          // - radius;
    // token = token.slice(match?.index);


// Return a new selection that's properly expanded to nearby enclosing italics
const updateRange = (state: EditorState, range: SelectionRange, radius = 3) => {
    const token = selectionText(state, range, radius);
    const match = matchItalics(token);
    if (match?.index != undefined) {
        const fromOffset = match.index - radius + 1; 
        const toOffset = match[0].length - ((range.to - range.from) - fromOffset) - 2;
        const anchor = (range.anchor < range.head) ? range.from + fromOffset : range.to + toOffset; 
        const head   = (range.anchor > range.head) ? range.from + fromOffset : range.to + toOffset; 
        // Creates a new selection with the edges located just inside italic tags
        return EditorSelection.range(anchor, head);
    }
    return range;
}
// TODO: Instead of a guessing radius, I should expand to the full line

// Attempt 1
const trimLinePrefixes = (state: EditorState, range: SelectionRange, radius = 1) => {
    const token = selectionText(state, range, radius);
    // if (!token.contains('\n')) {  // unnecessary
    //     return range;
    // }
    const match = matchPrefixes(token);
    if (match?.index != undefined) {
        const fromOffset = match[0].length + match.index - radius;;  
        const anchor = (range.anchor < range.head) ? range.from + fromOffset : range.to; 
        const head   = (range.anchor > range.head) ? range.from + fromOffset : range.to; 
        return EditorSelection.range(anchor, head);
    }
    return range;
}

 

// Given a cursor position, returns an expanded smart selection to enclosing italics (if found)
const expandSelectionToItalics = (cursor: SelectionRange, state: EditorState) => {
    // Look for existing italics syntax
    const newRange = findItalicSyntaxParent(EditorSelection.cursor(cursor.anchor), state);
    if (!newRange.eq(cursor)) 
        // Return a new selection around the entire italics section
        return newRange;

    // No smart selection found
    return cursor;
}

// Finds the surrounding word of a cursor position and return the selection 
const expandSelectionToWord = (cursor: SelectionRange, state: EditorState) => {
    const selectedWord = state.wordAt(cursor.anchor);
    if (selectedWord) {
        return EditorSelection.range(selectedWord.from, selectedWord.to);
    }
    // No word found
    return cursor;
}

// Adjusts final cursor location if at the end/start of a word
const updateFinalCursorPos = (cursorPos: number|undefined, range: SelectionRange) => {
    if (cursorPos === undefined || range.empty)
        return cursorPos;
    // Cursor is at end of word
    if (cursorPos == range.to)
        cursorPos += 1;    // unitalicize needs no adjustment in current version
    // Cursor is at start of word
    else if (cursorPos == range.from)
        cursorPos += -1;
    return cursorPos;
}

// For a selection, expand the bounds to contain the entire italic section (if one is detected)
const findItalicSyntaxParent = (selectionRange: SelectionRange, state: EditorState) => {
    const tree = syntaxTree(state);
    let stack = tree.resolveStack(selectionRange.from, 1);
    if (selectionRange.empty) {
        const stackBefore = tree.resolveStack(selectionRange.from, -1);
        if (stackBefore.node.from >= stack.node.from && stackBefore.node.to <= stack.node.to)
            stack = stackBefore;
    }
    for (let cur: NodeIterator | null = stack; cur != null; cur = cur.next) {
        const { node } = cur;
        // expand to parent formatting
        if (((node.from <= selectionRange.from && node.to >= selectionRange.to) ||
             (node.to >= selectionRange.to && node.from <= selectionRange.from)) &&
              cur.next) {
            // italic ancestor detected: scan for the beginning and end
            if (node.type.name.contains('em')) {
                let next: SyntaxNode | null = node;
                while (next && !next.type.name.contains('formatting-em')) {
                    next = next.nextSibling;
                }
                let prev = node.prevSibling;
                while (prev && !prev.type.name.contains('formatting-em')) {
                    prev = prev.prevSibling;
                }
                if (next && prev) {
                    return EditorSelection.range(prev.to, next.from);
                }
            }
        }
    }
    return selectionRange;
};

export { selectionText, nextChar, prevChar, findItalicSyntaxParent, checkSelectionForItalics, updateRange, expandSelectionToItalics, expandSelectionToWord, updateFinalCursorPos, trimLinePrefixes }
