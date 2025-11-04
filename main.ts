// import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { App, Editor, EditorRange, EditorSelection as EditorSelectionOb, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { EditorView } from "@codemirror/view";
import { ChangeSpec, EditorSelection as EditorSelectionCM, EditorState, SelectionRange } from "@codemirror/state";

// Remember to rename these classes and interfaces!

type DelimiterCharacter = '_' | '*';
// type ItalicCharChoice = 'underscore' | 'asterisk';

interface UnderscoreItalicsSettings {
	defaultItalic: 'underscore' | 'asterisk';
    autoConvert: boolean;
}

const DEFAULT_SETTINGS: Partial<UnderscoreItalicsSettings> = {
	defaultItalic: 'underscore',
}

const IS_ITALICIZED = /(?<!\\|_)_(?!_).*?(?<!\\)_|(?<!\\|\*)\*(?!\*).*?(?<![\*\\])\*/;

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
		let { state } = view;
		let editorSelected = state.selection;
		
		let selectionRanges: SelectionRange[] = [];
		let changeList: ChangeSpec[] = [];

		// 1. Single cursor/selection
		if (editorSelected.ranges.length == 1) {
			let range = editorSelected.main;
			const transaction = this.generateTransaction(state, range);
			changeList.push(...transaction.changes);
			selectionRanges.push(transaction.selectionRange);

		// 2. If there's multiple cursors/selections
		} else {
			let selections = editorSelected.ranges;
			let removeItalics = false;  // ? 
			let offset = 0;
			selections.forEach((selection) => {
				// let which: boolean = this.checkWordForItalic(state, selection);  // ?
				const partialTransaction = this.generateTransaction(state, selection, offset);
				changeList.push(...partialTransaction.changes);
				selectionRanges.push(partialTransaction.selectionRange);
				offset += (partialTransaction.toItalics) ? 2 : -2;
				console.log(offset);
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

	
	generateTransaction(state: EditorState, range: SelectionRange, cursorOffset: number = 0) {
		let cursorPos = undefined;
		
		// Cursor only, no selection
		if (range.empty) {
			// Attempt to expand the selection to the surrounding word at the cursor point 
			cursorPos = range.anchor;
			let selectedWord = state.wordAt(range.anchor);
			range = EditorSelectionCM.range(selectedWord?.from ?? cursorPos, selectedWord?.to ?? cursorPos);
		}

		let cursorUpdate: SelectionRange;
		let changes = [];
		let toItalics: boolean;

		// Unitalicize (the immediate selection is italicized already) 
		if (this.checkWordForItalic(state, range)) {
			toItalics = false;
			let updatedRange = this.updateRange(state, range);
			changes = [
				{ from: updatedRange.to, to: updatedRange.to+1, insert: '' },
				{ from: updatedRange.from-1, to: updatedRange.from, insert: '' }
			];
			cursorUpdate = this.genercursorPos(cursorPos ?? updatedRange, cursorOffset - 1);
			console.log(cursorUpdate);
		
		// Italicize: the selection isn't already italicized
		} else {
			toItalics = true;
			changes = [
				{ from: range.from, insert: `${this.delim}` },
				{ from: range.to,   insert: `${this.delim}` }
			];
			cursorUpdate = this.genercursorPos(cursorPos ?? range, cursorOffset + 1);
		}
		return {
			changes: changes,
			selectionRange: cursorUpdate,
			toItalics: toItalics
		};
	}

	unitalicizeTransaction(state: EditorState, range: SelectionRange) {
		let updatedRange = this.updateRange(state, range);
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

	genercursorPos(range: SelectionRange | number, cursorOffset: number): SelectionRange {
		if (range instanceof SelectionRange) {
			// Cursor is a selection range
			return EditorSelectionCM.range(Math.max(0, range.anchor + cursorOffset), range.head + cursorOffset);
		} else {
			// Cursor is just a cursor position
			return EditorSelectionCM.cursor(Math.max(0, range + cursorOffset)); 
		} 
	}

	// Lazy check to see if current word has underscores around it
	checkWordForItalic(state: EditorState, range: SelectionRange, radius: number = 3) {
		radius = Math.min(radius, range.from);
		const token = state.sliceDoc(range.from - radius, range.to + radius);
		return token.match(IS_ITALICIZED) != null;
	}

	// Return a new selection that's expanded to include nearby enclosing italics
	updateRange(state: EditorState, range: SelectionRange, radius: number = 3) {
		radius = Math.min(radius, range.from);
		const token = state.sliceDoc(range.from - radius, range.to + radius);
		const match = token.match(IS_ITALICIZED);
		if (match?.index != undefined) {
			let fromOffset = match.index - radius + 1; 
			let toOffset = match[0].length - ((range.to - range.from) - fromOffset) - 2;
			// Creates a new selection with `from` and `to` located just inside the underscores
			return EditorSelectionCM.range(range.from + fromOffset, range.to + toOffset);
		}
		return range;
	}


	// helper to turn Obsidian line/char range into a from/to range for CodeMirror
	private getFromTo(selection: EditorSelectionOb): EditorRange {
		let anchorpos = selection.anchor.line + selection.anchor.ch;
		let headpos = selection.head.line + selection.head.ch;
		let from = anchorpos < headpos ? selection.anchor : selection.head;
		let to = anchorpos < headpos ? selection.head : selection.anchor;
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
					let choice: 'underscore' | 'asterisk' = (value as 'underscore' | 'asterisk') ?? 'underscore';
					this.plugin.settings.defaultItalic = choice; 
					await this.plugin.saveSettings();
				})
			);
	}
}
