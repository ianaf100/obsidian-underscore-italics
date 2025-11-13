import { EditorSelection, EditorState, SelectionRange } from "@codemirror/state";
import { syntaxTree } from '@codemirror/language';
import { NodeIterator } from '@lezer/common';
import { matchItalics } from "./regex";


// Returns actual text string of a selection range's content in the editor. 
//  Optional radius to grow each side of the selection.  
const selectionText = (state: EditorState, range: SelectionRange, radius = 0) => {
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

// TODO: change this radius shit to expandToParentSyntax?

// Return a new selection that's properly expanded to nearby enclosing italics
const updateRange = (state: EditorState, range: SelectionRange, radius = 3) => {
    const token = selectionText(state, range, 3);
    const match = matchItalics(token);
    if (match?.index != undefined) {
        const fromOffset = match.index - radius + 1; 
        const toOffset = match[0].length - ((range.to - range.from) - fromOffset) - 2;
        let anchor = (range.anchor < range.head) ? range.from + fromOffset : range.to + toOffset; 
        let head   = (range.anchor > range.head) ? range.from + fromOffset : range.to + toOffset; 
        // Creates a new selection with the edges located just inside italic tags
        return EditorSelection.range(anchor, head);
    }
    return range;
}

// Given a cursor position, returns an expanded smart selection around it (if one is found)
const expandCursorSelection = (cursor: SelectionRange, state: EditorState) => {
    // FIXME: This breaks when the cursor is on the outside edge of the delimiter
    let anchor = cursor.anchor;
    const charBefore = prevChar(anchor, state);
    const charAfter  = nextChar(anchor, state);
    console.log(charBefore)
    console.log(charAfter)
    // If the cursor is right after or before an italic delimiter, expand to include it
    if (charBefore === ' ' && charAfter === '_') {
        anchor = Math.min(state.doc.length, anchor + 1);
    } else if (charAfter === ' ' && charBefore === '_') {
        anchor = Math.max(0, anchor - 1);
    }
    
    // Look for existing italics syntax
    let newRange = findItalicSyntaxParent(EditorSelection.cursor(anchor), state);
    if (!newRange.eq(cursor)) 
        // Return a new selection around the entire italics section
        return newRange;

    // Check if the cursor is in the middle of a word 
    const selectedWord = state.wordAt(anchor);
    if (selectedWord) 
        // Return a selection around the nearby word 
        return EditorSelection.cursor(selectedWord.from, selectedWord.to);
    
    // No smart selection found
    return cursor;
}

// For a selection, expand the bounds to contain the entire italic section (if one is detected)
const findItalicSyntaxParent = (selectionRange: SelectionRange, state: EditorState) => {
    let tree = syntaxTree(state);
    let stack = tree.resolveStack(selectionRange.from, 1);
    if (selectionRange.empty) {
        let stackBefore = tree.resolveStack(selectionRange.from, -1);
        if (stackBefore.node.from >= stack.node.from && stackBefore.node.to <= stack.node.to)
            stack = stackBefore;
    }
    for (let cur: NodeIterator | null = stack; cur != null; cur = cur.next) {
        let { node } = cur;
        // expand to parent formatting
        if (((node.from <= selectionRange.from && node.to >= selectionRange.to) ||
             (node.to >= selectionRange.to && node.from <= selectionRange.from)) &&
              cur.next) {
            // italic ancestor detected: scan for the beginning and end
            if (node.type.name.contains('em')) {
                let next = node.nextSibling;
                while (next && !next?.type.name.contains('formatting-em')) next = next.nextSibling;
                
                let prev = node.prevSibling;
                while (prev && !prev?.type.name.contains('formatting-em')) prev = prev.prevSibling;
                if (next && prev) {
                    return EditorSelection.range(prev.to, next.from);
                }
            }
        }
    }
    return selectionRange;
};

export { selectionText, nextChar, prevChar, findItalicSyntaxParent, checkSelectionForItalics, updateRange, expandCursorSelection }
