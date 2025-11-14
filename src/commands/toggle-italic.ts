import { EditorView } from "@codemirror/view";
import { ChangeSpec, EditorSelection, EditorState, SelectionRange } from "@codemirror/state";

import { matchInnerItalics } from 'src/utils/regex';
import { checkSelectionForItalics, expandCursorSelection, selectionText, updateRange } from "src/utils/selection-utils"
import { DelimiterCharacter } from "src/types";
import UnderscoreItalicsPlugin from 'src/main';


export const toggleItalicsCommand = (plugin: UnderscoreItalicsPlugin, view: EditorView): void => {
    const { state } = view;
    const editorSelection = state.selection;
    const activeDelimiter = plugin.delim;

    const selectionRanges: SelectionRange[] = [];
    const changeList: ChangeSpec[] = [];

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
function buildTransaction(view: EditorView, range: SelectionRange, delim: DelimiterCharacter, offset = 0) {
    let cursorPos;
    if (range.empty) {
        cursorPos = range.anchor;
        // If the cursor is right after or before an italic delimiter, move it inside
        const adjacentChars = selectionText(view.state, {from: cursorPos-1, to: cursorPos+1});
        if (adjacentChars.match(/\s_/))
            cursorPos += 1;
        if (adjacentChars.match(/_\s/))
            cursorPos -= 1;
        range = expandCursorSelection(EditorSelection.cursor(cursorPos), view.state);
    }

    if (checkSelectionForItalics(range, view.state) == false) {
        return italicizeTransaction(view.state, range, ++offset, delim, cursorPos);

    } else {
        const updatedRange = updateRange(view.state, range);
        return unitalicizeTransaction(updatedRange, --offset, cursorPos);
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
    let leftPadding = (range.to - range.from) - fullSelection.length;
    fullSelection = fullSelection.trimEnd();
    let rightPadding = (range.to - range.from) - fullSelection.length - leftPadding;
    let toOffset = 0; 
    let changes = [];

    // FIRST check for internal italic sections and undo them
    for (const match of matchInnerItalics(fullSelection)) {
        let anchor = range.from + match.index! + 1 + leftPadding;
        let head = anchor + match[0].length - 2;
        changes.push({ insert: '', from: head,     to: head+1 });
        changes.push({ insert: '', from: anchor-1, to: anchor });
        toOffset += 2;
    }
    
    // Push final italicize operation
    changes.push({ from: range.from + leftPadding, insert: `${delim}` });
    changes.push({ from: range.to - rightPadding,   insert: `${delim}` });
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

function unitalicizeTransaction(range: SelectionRange, accumOffset: number, cursorPos?: number) {
    let changes = [
        { from: range.to,     to: range.to+1, insert: '' },
        { from: range.from-1, to: range.from, insert: '' }
    ];
    return {
        toItalics: false,
        changes: changes,
        selectionRange: updateCursorTransaction({ 
            anchor: range.anchor, 
            head: range.head, 
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
        let finalCursor = cursor + accumOffset;
        return EditorSelection.cursor(Math.max(0, finalCursor)); 
        
    // Cursor is a selection range
    } else {
        const leftToRight = anchor < head;
        const [fromBase, toBase] = leftToRight ? [anchor, head] : [head, anchor];
        const from = Math.max(0, fromBase + fromOffset + accumOffset);
        const to = toBase - toOffset + accumOffset;
        return EditorSelection.range(leftToRight ? from : to, leftToRight ? to : from);
    } 
}


// debug
function printSelection(view: EditorView, range?: SelectionRange) {
	if (!range) {
		range = view.state.selection.main;
	}
	console.log(view.state.sliceDoc(range.from, range.to));
}