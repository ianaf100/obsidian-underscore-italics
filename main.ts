// import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { App, Editor, EditorRange, EditorSelection as EditorSelectionOb, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { EditorView } from "@codemirror/view";
import { ChangeSpec, EditorSelection as EditorSelectionCM, EditorState, SelectionRange } from "@codemirror/state";
import { checkSelectionForItalics, findItalicSyntaxParent, getSelectionText, updateRange } from "src/utils"
import { matchInnerItalics } from 'src/regex';


type DelimiterCharacter = '_' | '*';

interface UnderscoreItalicsSettings {
	defaultItalic: 'underscore' | 'asterisk';
    autoConvert: boolean;
}

const DEFAULT_SETTINGS: Partial<UnderscoreItalicsSettings> = {
	defaultItalic: 'underscore',
}

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
		this.addSettingTab(new MySettingTab(this.app, this));
	}

	onunload() {
	}

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
			selection: EditorSelectionCM.create(selectionRanges)
		});
	}

	// Returns the components of a single italicize/unitalicize transaction  
	//  on ONE cursor/selection. Can be combined with other partial transactions.   
	buildTransaction(view: EditorView, range: SelectionRange, offset = 0) {
		let cursorPos = null;
		if (range.empty) {
			cursorPos = range.anchor;
			let updatedRange = this.expandCursorSelection(range, view.state);
			range = updatedRange;
		}

		if (checkSelectionForItalics(range, view.state) == false) {
			return this.italicizeTransaction(view.state, range, ++offset, cursorPos);

		} else {
			const updatedRange = updateRange(view.state, range);
			return this.unitalicizeTransaction(updatedRange, --offset, cursorPos);
		}
	}
	
	// Given a cursor position, returns an expanded smart selection around it (if one is found)
	expandCursorSelection(range: SelectionRange, state: EditorState) {
		// Look for existing italics syntax
		let newRange = findItalicSyntaxParent(range, state);
		if (!newRange.eq(range)) 
			// Return a new selection around the entire italics section
			return newRange;

		// Check if the cursor is in the middle of a word 
		const selectedWord = state.wordAt(range.anchor);
		if (selectedWord) 
			// Return a selection around the nearby word 
			return EditorSelectionCM.range(selectedWord.from, selectedWord.to);
		
		// No smart selection found - return original cursor
		return range;
	}

	unitalicizeTransaction(range: SelectionRange, accumOffset: number, cursorPos: number | null) {
		let changes = [
			{ from: range.to,     to: range.to+1, insert: '' },
			{ from: range.from-1, to: range.from, insert: '' }
		];
		return {
			changes: changes,
			selectionRange: this.updateCursorTransaction(cursorPos ?? range, accumOffset),
			toItalics: false
		};
	}

	italicizeTransaction(state: EditorState, range: SelectionRange, accumOffset: number, cursorPos: number | null) {
		let fullSelection = getSelectionText(state, range).trimStart();
		let anchorOffset = (range.to - range.from) - fullSelection.length;
		fullSelection = fullSelection.trimEnd();
		let headOffset = (range.to - range.from) - fullSelection.length - anchorOffset;
		let changes = []
		
		// FIRST check for internal italic sections and undo them
		for (const match of matchInnerItalics(fullSelection)) {
			let anchor = range.from + match.index + 1;
			let head = anchor + match[0].length - 2;
			changes.push({ insert: '', from: head,     to: head+1 });
			changes.push({ insert: '', from: anchor-1, to: anchor });
			headOffset += 2;
		}
		// Push final italicize operation
		changes.push({ from: range.from + anchorOffset, insert: `${this.delim}` });
		changes.push({ from: range.to - headOffset,   insert: `${this.delim}` });
		return {
			changes: changes,
			toItalics: true,
			selectionRange: (cursorPos) 
				? this.updateCursorTransaction(cursorPos, accumOffset) 
				: EditorSelectionCM.range(
					Math.max(0, (range.from + anchorOffset + accumOffset)), 
					Math.min(state.doc.length, (range.to - headOffset + accumOffset))
			)
		}
	}

	updateCursorTransaction(range: SelectionRange | number, accumOffset: number): SelectionRange {
		// FIXME: cursor translation needs to be calculated, dependent on the update + context
		//        (or I can skip this probably)
		if (range instanceof SelectionRange) {
			// Cursor is a selection range
			return EditorSelectionCM.range(Math.max(0, range.anchor + accumOffset), range.head + accumOffset);
		} else {
			// Cursor is just a cursor position
			return EditorSelectionCM.cursor(Math.max(0, range + accumOffset)); 
		} 
	}
}

class MySettingTab extends PluginSettingTab {
	plugin: UnderscoreItalics;

	constructor(app: App, plugin: UnderscoreItalics) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Dropdown Test #1')
			.setDesc('Default character to use for new italics')
			.addDropdown((dropdown) => dropdown
				.addOption('underscore', 'Underscore')
				.addOption('asterisk', 'Asterisk')
				.setValue(this.plugin.settings.defaultItalic)
				.onChange(async (value) => {
					const choice: 'underscore' | 'asterisk' = (value as 'underscore' | 'asterisk') ?? 'underscore';
					this.plugin.settings.defaultItalic = choice; 
					await this.plugin.saveSettings();
				})
			);
	}
}

// debug
function printSelection(view: EditorView, range?: SelectionRange) {
	if (!range) {
		range = view.state.selection.main;
	}
	console.log(view.state.sliceDoc(range.from, range.to));
}

// helper to turn Obsidian line/char range into a from/to range for CodeMirror
function getFromTo(selection: EditorSelectionOb): EditorRange {
	const anchorpos = selection.anchor.line + selection.anchor.ch;
	const headpos = selection.head.line + selection.head.ch;
	const from = anchorpos < headpos ? selection.anchor : selection.head;
	const to = anchorpos < headpos ? selection.head : selection.anchor;
	return { from: from, to: to };
}