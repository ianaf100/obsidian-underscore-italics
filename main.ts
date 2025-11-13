import { Editor, MarkdownView, Plugin  } from 'obsidian';
import { EditorView } from "@codemirror/view";
import { ChangeSpec, EditorSelection, EditorState, SelectionRange } from "@codemirror/state";
import { checkSelectionForItalics, expandCursorSelection, nextChar, prevChar, selectionText, updateRange } from "src/utils/selection-utils"
import { matchInnerItalics } from 'src/utils/regex';
import { UnderscoreItalicsSettingTab, UnderscoreItalicsSettings, DEFAULT_SETTINGS }  from 'src/UnderscoreItalicsSettings';

type DelimiterCharacter = '_' | '*';

export default class UnderscoreItalics extends Plugin {
	settings: UnderscoreItalicsSettings;
	delim: DelimiterCharacter;

	async onload() {
		await this.loadSettings();
		console.log('loading underscore-italics plugin');
		this.addCommand({
			id: 'toggle-italic',
			name: 'Toggle italic',	
			icon: 'lucide-italic',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				// @ts-expect-error, not typed
				const editorView = view.editor.cm as EditorView;
				this.toggleItalics(editor, editorView);
			}
		});
		this.addSettingTab(new UnderscoreItalicsSettingTab(this.app, this));
	}

	onunload() { }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.delim = (this.settings.defaultItalic === 'asterisk') ? '*' : '_';
	}

	async saveSettings() {
		this.delim = (this.settings.defaultItalic === 'asterisk') ? '*' : '_';
		await this.saveData(this.settings);
	}

	toggleItalics(editor: Editor, view: EditorView) {
		const { state } = view;
		const editorSelection = state.selection;

		const selectionRanges: SelectionRange[] = [];
		const changeList: ChangeSpec[] = [];

		// 1. Single cursor/selection
		if (editorSelection.ranges.length == 1) {
			const range = editorSelection.main;
			const transaction = this.buildTransaction(view, range);
			changeList.push(...transaction.changes);
			selectionRanges.push(transaction.selectionRange);

		// 2. If there's multiple cursors/selections
		} else {
			const selections = editorSelection.ranges;
			let offset = 0;
			selections.forEach((selection) => {
				// const which: boolean = this.checkWordForItalic(state, selection);  // ?
				const partialTransaction = this.buildTransaction(view, selection, offset);
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
	buildTransaction(view: EditorView, range: SelectionRange, offset = 0) {
		let cursorPos;
		if (range.empty) {
			// let ab = view.state.sliceDoc(Math.max(0, range.anchor-1), Math.min(view.state.doc.length, range.anchor+1));
			// console.log(`${ab}`)
			// if (prevChar(range.anchor, view.state) === ' ') {  // all whitespace?
			// 	if (nextChar(range.anchor, view.state) !== ' ') {
			// 	}
			// } else if (nextChar(range.anchor, view.state) === ' ') {
			// }
			cursorPos = range.anchor;
			let updatedRange = expandCursorSelection(range, view.state);
			range = updatedRange;
		}

		if (checkSelectionForItalics(range, view.state) == false) {
			return this.italicizeTransaction(view.state, range, ++offset, cursorPos);

		} else {
			const updatedRange = updateRange(view.state, range);
			return this.unitalicizeTransaction(updatedRange, --offset, cursorPos);
		}
	}
	
	unitalicizeTransaction(range: SelectionRange, accumOffset: number, cursorPos?: number) {
		let changes = [
			{ from: range.to,     to: range.to+1, insert: '' },
			{ from: range.from-1, to: range.from, insert: '' }
		];
		return {
			toItalics: false,
			changes: changes,
			selectionRange: this.updateCursorTransaction({ 
				anchor: range.anchor, 
				head: range.head, 
				cursor: cursorPos, 
				accumOffset: accumOffset 
			}),
		};
	}

	italicizeTransaction(state: EditorState, range: SelectionRange, accumOffset: number, cursorPos?: number) {
		let fullSelection = selectionText(state, range).trimStart();
		let fromOffset = (range.to - range.from) - fullSelection.length;
		fullSelection = fullSelection.trimEnd();
		let toOffset = (range.to - range.from) - fullSelection.length - fromOffset;
		let changes = []
		let z = 0;  // ?????
		// FIRST check for internal italic sections and undo them
		for (const match of matchInnerItalics(fullSelection)) {
			let anchor = range.from + match.index! + 1 + fromOffset;
			let head = anchor + match[0].length - 2;
			changes.push({ insert: '', from: head,     to: head+1 });
			changes.push({ insert: '', from: anchor-1, to: anchor });
			z += 2;
		}
		
		// Push final italicize operation
		changes.push({ from: range.from + fromOffset, insert: `${this.delim}` });
		changes.push({ from: range.to - toOffset,   insert: `${this.delim}` });

		return {
			toItalics: true,
			changes: changes,
			selectionRange: this.updateCursorTransaction({ 
				anchor: range.anchor, 
				head: range.head, 
				cursor: cursorPos, 
				accumOffset: accumOffset,
				fromOffset: fromOffset,
				toOffset: toOffset + z
			})
		}
	}

	updateCursorTransaction({ anchor, head, cursor, fromOffset = 0, toOffset = 0, accumOffset = 0 }
		: { anchor: number;     	// anchor position of italic selection
			head: number; 	    	// head position of italic selection
			cursor?: number;    	// optional cursor pos (overrides anchor/head as final pos)
			fromOffset?: number; 	// offset value for selection.from position (if any) 
			toOffset?: number;      // offset value for selection.to position (if any) 
			accumOffset?: number; 	// accumulated total offset for the entire selection
		}): SelectionRange { 

		// Final cursor is just a cursor position
		if (cursor) {
			let finalCursor = cursor + accumOffset;
			return EditorSelection.cursor(Math.max(0, finalCursor)); 
			
		// Cursor is a selection range
		} else {
			let leftToRight = anchor < head;
			let from = leftToRight ? anchor : head;
			let to   = leftToRight ? head : anchor;
			from = Math.max(0, from + fromOffset + accumOffset);
			to   = to - toOffset + accumOffset;
			anchor = leftToRight ? from : to;
			head   = leftToRight ? to : from;
			return EditorSelection.range(anchor, head);
		} 
	}
}

// debug
function printSelection(view: EditorView, range?: SelectionRange) {
	if (!range) {
		range = view.state.selection.main;
	}
	console.log(view.state.sliceDoc(range.from, range.to));
}