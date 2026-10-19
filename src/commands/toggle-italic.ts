import { EditorView } from "@codemirror/view";
import { ChangeSpec, EditorSelection, EditorState, SelectionRange } from "@codemirror/state";

import UnderscoreItalicsPlugin from '../main';
import { matchInnerItalics } from '../utils/regex';
import { DelimiterCharacter } from "../types";
import { 
    expandSelectionToItalics,
    expandSelectionToWord,
    findItalicSyntaxParent,
    selectionText,
    trimLinePrefixes,
    updateFinalCursorPos 
} from "../utils/selection-utils"


export const toggleItalicsCommand = (plugin: UnderscoreItalicsPlugin, view: EditorView): void => {
    const { state } = view;
    const editorSelection = state.selection;
    const activeDelimiter = plugin.delim;

    const selectionRanges: SelectionRange[] = [];
    const changeList: ChangeSpec[] = [];

    // TODO: handle multi-line selections
    // if (text.contains('\n')) 
    // lines = getSelectedLines(state, rangex)

    // 1. Single cursor/selection
    if (editorSelection.ranges.length == 1) {
        const range = editorSelection.main;
        const transaction = buildTransaction(view, range, activeDelimiter);
        changeList.push(...transaction.changes);
        selectionRanges.push(transaction.selectionRange);

    // 2. If there's multiple cursors/selections
    } else {
        const selections = editorSelection.ranges;
        let offset = 0;
        selections.forEach((selection) => {
            // const which: boolean = checkWordForItalic(state, selection);  // ?
            const partialTransaction = buildTransaction(view, selection, activeDelimiter, offset);
            changeList.push(...partialTransaction.changes);
            selectionRanges.push(partialTransaction.selectionRange);
            offset += (partialTransaction.toItalics) ? 2 : -2;
        });
    }
    // Push the given list of update transactions to the editor view
    view.dispatch({
        changes: changeList,
        selection: EditorSelection.create(selectionRanges)
    });
}

// Returns the components of a single italicize/unitalicize transaction  
//  on ONE cursor/selection. Can be combined with other partial transactions.   
function buildTransaction(view: EditorView, currentRange: SelectionRange, delim: DelimiterCharacter, offset = 0) {
    let cursorPos;
    if (currentRange.empty) {
        cursorPos = currentRange.anchor;

        // If the cursor is right after or before an italic delimiter, move it inside
        const adjacentChars = view.state.sliceDoc(cursorPos-1, cursorPos+1);
        if (adjacentChars.match(/\s_/)) cursorPos += 1;
        if (adjacentChars.match(/_\s/)) cursorPos -= 1;

        // Attempt to expand the selection
        currentRange = expandSelectionToItalics(EditorSelection.cursor(cursorPos), view.state);
        if (currentRange.empty) 
            currentRange = expandSelectionToWord(EditorSelection.cursor(cursorPos), view.state);
    }
    const italicRange = findItalicSyntaxParent(currentRange, view.state);
    const currentlyItalicized = italicRange !== undefined;
    
    // Trim list prefixes, blockquotes, etc from italic portion
    currentRange = trimLinePrefixes(currentRange, view.state);
    
    if (currentlyItalicized == false) {
        cursorPos = updateFinalCursorPos(cursorPos, currentRange);
        return italicizeTransaction(view.state, currentRange, ++offset, delim, cursorPos);
    } else {
        return unitalicizeTransaction(
            currentRange, 
            italicRange,
            --offset, 
            cursorPos
        );
    }
}

function italicizeTransaction(
    state: EditorState, 
    range: SelectionRange, 
    accumOffset: number,           // accumulated offset from previous changes in this transaction
    delim: DelimiterCharacter,     // '_' or '*'
    cursorPos?: number
) {
    let fullSelection = selectionText(state, range).trimStart();
    const leftPadding = (range.to - range.from) - fullSelection.length;
    fullSelection = fullSelection.trimEnd();
    const rightPadding = (range.to - range.from) - fullSelection.length - leftPadding;
    let toOffset = 0; 
    const changes = [];

    // FIRST check for internal italic sections and undo them
    for (const match of matchInnerItalics(fullSelection)) {
        if (match.index) {
            const anchor = range.from + match.index + 1 + leftPadding;
            const head = anchor + match[0].length - 2;
            changes.push({ insert: '', from: head,     to: head+1 });
            changes.push({ insert: '', from: anchor-1, to: anchor });
            toOffset += 2;
        }
    }
    // Push final italicize operation
    changes.push({ from: range.from + leftPadding, insert: `${delim}` });
    changes.push({ from: range.to - rightPadding, insert: `${delim}` });
    return {
        toItalics: true,
        changes: changes,
        selectionRange: updateCursorTransaction({ 
            anchor: range.anchor, 
            head: range.head, 
            cursor: cursorPos, 
            accumOffset: accumOffset,
            fromOffset: leftPadding,
            toOffset: rightPadding + toOffset
        })
    }
}

function unitalicizeTransaction(currentRange: SelectionRange, italicRange: SelectionRange, accumOffset: number, cursorPos?: number) {
    const changes = [
        { from: italicRange.to,     to: italicRange.to+1, insert: '' },
        { from: italicRange.from-1, to: italicRange.from, insert: '' }
    ];
    return {
        toItalics: false,
        changes: changes,
        selectionRange: updateCursorTransaction({ 
            anchor: currentRange.anchor, 
            head: currentRange.head, 
            cursor: cursorPos, 
            accumOffset: accumOffset 
        }),
    };
}

function updateCursorTransaction({ anchor, head, cursor, fromOffset = 0, toOffset = 0, accumOffset = 0 }
    : { anchor: number;     	// anchor position of italic selection
        head: number; 	    	// head position of italic selection
        cursor?: number;    	// optional cursor pos (overrides anchor/head as final pos)
        fromOffset?: number; 	// offset value for selection.from position (if any) 
        toOffset?: number;      // offset value for selection.to position (if any) 
        accumOffset?: number; 	// accumulated total offset for the entire selection
    }): SelectionRange { 

    // Final cursor is a cursor only
    if (cursor) {
        const finalCursor = cursor + accumOffset;
        return EditorSelection.cursor(Math.max(0, finalCursor)); 
        
    // Cursor is a selection
    } else {
        const leftToRight = anchor < head;
        const [fromBase, toBase] = leftToRight ? [anchor, head] : [head, anchor];
        const from = Math.max(0, fromBase + fromOffset + accumOffset);
        const to = toBase - toOffset + accumOffset;
        return EditorSelection.range(leftToRight ? from : to, leftToRight ? to : from);
    } 
}
