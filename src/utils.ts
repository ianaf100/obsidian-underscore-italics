import { EditorSelection, EditorState, SelectionRange } from "@codemirror/state";
import { syntaxTree } from '@codemirror/language';
import { NodeIterator } from '@lezer/common';
import { isItalicized, matchInnerItalics, matchItalics } from "./regex";


// Returns actual text string of a selection range's content in the editor. 
//  Optional radius to grow each side of the selection.  
function getSelectionText(state: EditorState, range: SelectionRange, radius = 0) {
    const from = Math.max(0, range.from - radius);
    const to = Math.min(state.doc.length /*- 1*/, range.to + radius);  // TODO: test
    return state.sliceDoc(from, to);
}

// Lazy check to see if current (entire) selection is italic
function checkSelectionForItalics(range: SelectionRange, state: EditorState) {
    const selectionLength = getSelectionText(state, range).trim().length;
    const token = getSelectionText(state, range, 3);  
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
function updateRange(state: EditorState, range: SelectionRange, radius = 3) {
    const token = getSelectionText(state, range, 3);
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

export { findItalicSyntaxParent, getSelectionText, checkSelectionForItalics, updateRange }
