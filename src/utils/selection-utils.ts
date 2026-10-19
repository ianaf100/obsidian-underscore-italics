import { EditorSelection, EditorState, SelectionRange } from "@codemirror/state";
import { syntaxTree } from '@codemirror/language';
import { NodeIterator, SyntaxNode } from '@lezer/common';
import { matchPrefixes } from "./regex";


// Returns actual text string of a selection range's content in the editor. 
//  Optional radius to grow each side of the selection.  
export function selectionText(
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

// Get whole line (based on '@codemirror/commands:selectLine')
function getLine(state: EditorState, range: SelectionRange) {
    let startLine = state.doc.lineAt(range.from), endLine = state.doc.lineAt(range.to);
    if (!range.empty && range.to == endLine.from)
        endLine = state.doc.lineAt(range.to - 1);
    return { from: startLine.from, to: endLine.to, ranges: [range] };
}

// Given a cursor position, returns an expanded smart selection to enclosing italics (if found)
export const expandSelectionToItalics = (cursor: SelectionRange, state: EditorState) => {
    const italicRange = findItalicSyntaxParent(EditorSelection.cursor(cursor.anchor), state);
    return italicRange ? italicRange : cursor;
}

// Finds the surrounding word of a cursor position and return the selection 
export const expandSelectionToWord = (cursor: SelectionRange, state: EditorState) => {
    const selectedWord = state.wordAt(cursor.anchor);
    if (selectedWord) {
        return EditorSelection.range(selectedWord.from, selectedWord.to);
    }
    // No word found
    return cursor;
}

export const trimLinePrefixes = (range: SelectionRange, state: EditorState) => {
    const match = 
        matchPrefixes(selectionText(state, {from: range.from-1, to: range.to} ));
    if (match && match.index != undefined) {
        const fromOffset = match.index + match[0].length - 1;
        const anchor = (range.anchor < range.head) ? range.from + fromOffset : range.to; 
        const head   = (range.anchor > range.head) ? range.from + fromOffset : range.to; 
        return EditorSelection.range(anchor, head);
    }
    return range;
}

// Adjusts final cursor location if at the end/start of a word
export const updateFinalCursorPos = (cursorPos: number|undefined, range: SelectionRange) => {
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
export const findItalicSyntaxParent = (selectionRange: SelectionRange, state: EditorState) => {
    const tree = syntaxTree(state);
    let stack = tree.resolveStack(selectionRange.from, 1);
    if (selectionRange.empty) {
        const stackBefore = tree.resolveStack(selectionRange.from, -1);
        if (stackBefore.node.from >= stack.node.from && stackBefore.node.to <= stack.node.to)
            stack = stackBefore;
    }
    const from = Math.min(selectionRange.from+1, selectionRange.to);
    const to = Math.max(selectionRange.to-1, from);
    for (let cur: NodeIterator | null = stack; cur != null; cur = cur.next) {
        const { node } = cur;
        // expand to parent formatting
        if (((node.from <= from && node.to >= to) ||
             (node.to >= to && node.from <= from)) &&
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
    return undefined;
};
