// import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { App, Editor, EditorRange, EditorSelection as EditorSelectionOb, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { EditorView } from "@codemirror/view";
import { ChangeSpec, EditorSelection as EditorSelectionCM, EditorState, SelectionRange } from "@codemirror/state";
import { expandToParentSyntax } from "src/utils"

// Remember to rename these classes and interfaces!

type DelimiterCharacter = '_' | '*';

interface UnderscoreItalicsSettings {
	defaultItalic: 'underscore' | 'asterisk';
    autoConvert: boolean;
}

const DEFAULT_SETTINGS: Partial<UnderscoreItalicsSettings> = {
	defaultItalic: 'underscore',
}

const IS_ITALICIZED = /(?<!\\|_)_(?!_).*?(?<!\\)_|(?<!\\|\*)\*(?!\*).*?(?<!\\|\*)\*(?!\*)/;

export default class UnderscoreItalics extends Plugin {
	settings: UnderscoreItalicsSettings;
	delim: DelimiterCharacter;

	async onload() {
		await this.loadSettings();
		console.log('loading underscore-italics plugin');

		// This adds an editor command that can perform some operation on the current editor instance
		/* this.addCommand({
			id: 'ian-editor-command',
			name: 'Ian\'s editor command',
			editorCallback: (editor: Editor) => {
				console.log('Selection: ' + editor.getSelection());
			}
		}); */

		// This adds an editor command that first checks whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'toggle-italic',
			name: 'Toggle italic',	
			editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// @ts-expect-error, not typed
					const editorView = view.editor.cm as EditorView;

					if (!checking) {
						// If checking is false, we actually perform the operation:
						this.toggleItalics(editor, editorView);
					}
					// If checking is true, we're only checking if the command 'can' be run.
					// This command will only show up in Command Palette when this check function returns true.
					// Here we're just checking that MarkdownView is active.
					return true;
				}
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
			const transaction = this.generateTransaction(view, range);
			changeList.push(...transaction.changes);
			selectionRanges.push(transaction.selectionRange);

		// 2. If there's multiple cursors/selections
		} else {
			const selections = editorSelection.ranges;
			let offset = 0;
			selections.forEach((selection) => {
				// const which: boolean = this.checkWordForItalic(state, selection);  // ?
				const partialTransaction = this.generateTransaction(view, selection, offset);
				changeList.push(...partialTransaction.changes);
				selectionRanges.push(partialTransaction.selectionRange);
				offset += (partialTransaction.toItalics) ? 2 : -2;
			});

		}
		// Execute the given list of update transactions in the editor view
		view.dispatch({
			changes: changeList,
			selection: EditorSelectionCM.create(selectionRanges)
		});
		//// Note: Obsidian default behavior seems to be if there are multiple selections, then it becomes a 
		////   UNIVERAL operation to either italicize OR unitalicize for EVERY candidate. However I can't
		////   figure out how it determines *which* it decides to pick if there's a mixture.
	}
	
	generateTransaction(view: EditorView, range: SelectionRange, cursorOffset = 0) {
		let cursorPos = undefined;
		
		// Cursor only, no selection
		if (range.empty) {
			cursorPos = range.anchor;
			let updatedRange = this.expandCursorSelection(range, view.state);
			range = updatedRange;				
		}

		let toItalics: boolean;
		let cursorUpdate: SelectionRange;
		let changes = [];

		// Unitalicize (the immediate selection is italicized already) 
		if (this.checkSelectionForItalics(range, view.state)) {
			toItalics = false;
			const updatedRange = this.updateRange(view.state, range);
			changes = [
				{ from: updatedRange.to, to: updatedRange.to+1, insert: '' },
				{ from: updatedRange.from-1, to: updatedRange.from, insert: '' }
			];
			cursorUpdate = this.updateCursorTransaction(cursorPos ?? updatedRange, cursorOffset - 1);
		
		// Italicize: the selection isn't already italicized
		} else {
			toItalics = true;
			changes = [
				{ from: range.from, insert: `${this.delim}` },
				{ from: range.to,   insert: `${this.delim}` }
			];
			cursorUpdate = this.updateCursorTransaction(cursorPos ?? range, cursorOffset + 1);
		}
		return {
			changes: changes,
			selectionRange: cursorUpdate,
			toItalics: toItalics
		};
	}

	unitalicizeTransaction(state: EditorState, range: SelectionRange) {
		const updatedRange = this.updateRange(state, range);
		return [
			{ from: updatedRange.to, to: (updatedRange.to + 1), insert: '' },
			{ from: updatedRange.from, to: (updatedRange.from + 1), insert: '' }
		];
	}

	italicizeTransaction(range: SelectionRange) {
		return [
			{ from: range.from, insert: `${this.delim}` },
			{ from: range.to,   insert: `${this.delim}` }
		];
	}

	updateCursorTransaction(range: SelectionRange | number, cursorOffset: number): SelectionRange {
		if (range instanceof SelectionRange) {
			// Cursor is a selection range
			return EditorSelectionCM.range(Math.max(0, range.anchor + cursorOffset), range.head + cursorOffset);
		} else {
			// Cursor is just a cursor position
			return EditorSelectionCM.cursor(Math.max(0, range + cursorOffset)); 
		} 
	}
	
	// Given a cursor selection, returns the appropriate smart selection surrounding the cursor. 
	// Either a selection expanded to the surrounding italics block (if one exists),
	// or to the surrounding word (if one exists), otherwise returns the original selection
	expandCursorSelection(range: SelectionRange, state: EditorState) {
		// First: check if cursor is inside any formatting syntax
		let newRange = expandToParentSyntax(range, state);
		
		// No surrounding formatting
		if (newRange.eq(range)) {
			// Attempt to expand the selection to the surrounding word at the cursor point 
			const selectedWord = state.wordAt(range.anchor);
			if (!selectedWord) 
				return range;
			return EditorSelectionCM.range(selectedWord.from, selectedWord.to);
		}

		// Check if parent formatting is italics and not anything else
		if (this.checkSelectionForItalics(newRange, state)) {
			return newRange;
		} else {
			// TODO: expand parent for nested formatting? is it worth it?
			return range;
		}
	}

	/* return selectParentSyntax({
		state: state, 
		dispatch: (x) => {}  // override dispatch() so the selection isn't actually changed
	}); */

	// Lazy check to see if current selection has underscores around it
	checkSelectionForItalics(range: SelectionRange, state: EditorState, radius = 3) {
		//TODO: update to detect *** bold/italic
		radius = Math.min(radius, range.from);
		const token = state.sliceDoc(range.from - radius, range.to + radius);
		return token.match(IS_ITALICIZED) != null;
	}

	// Return a new selection that's expanded to include nearby enclosing italics
	updateRange(state: EditorState, range: SelectionRange, radius = 3) {
		radius = Math.min(radius, range.from);
		const token = state.sliceDoc(range.from - radius, range.to + radius);
		const match = token.match(IS_ITALICIZED);
		if (match?.index != undefined) {
			const fromOffset = match.index - radius + 1; 
			const toOffset = match[0].length - ((range.to - range.from) - fromOffset) - 2;
			// Creates a new selection with `from` and `to` located just inside the underscores
			return EditorSelectionCM.range(range.from + fromOffset, range.to + toOffset);
		}
		return range;
	}

	private printSelection(view: EditorView, range?: SelectionRange) {
		if (!range) {
			range = view.state.selection.main;
		}
		console.log(view.state.sliceDoc(range.from, range.to));
	}

	// helper to turn Obsidian line/char range into a from/to range for CodeMirror
	private getFromTo(selection: EditorSelectionOb): EditorRange {
		const anchorpos = selection.anchor.line + selection.anchor.ch;
		const headpos = selection.head.line + selection.head.ch;
		const from = anchorpos < headpos ? selection.anchor : selection.head;
		const to = anchorpos < headpos ? selection.head : selection.anchor;
		return { from: from, to: to };
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
