// import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { App, Editor, EditorRange, EditorSelection as EditorSelectionOb, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { EditorView } from "@codemirror/view";
import { ChangeSpec, EditorSelection as EditorSelectionCM, EditorState, SelectionRange } from "@codemirror/state";
import { checkSelectionForItalics, expandToParentSyntax, updateRange } from "src/utils"


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

	// Returns the components of a partial transaction for an italicize/unitalicize operation
	// on ONE selection.  
	buildTransaction(view: EditorView, range: SelectionRange, cursorOffset = 0) {
		let cursorPos = undefined;
		let cursorUpdate: SelectionRange;
		let changes = [];

		// Cursor only, no selection
		if (range.empty) {
			cursorPos = range.anchor;
			let updatedRange = this.expandCursorSelection(range, view.state);
			range = updatedRange;				
		}
		const toItalics = !checkSelectionForItalics(range, view.state);

		// Italicize:
		if (toItalics) {
			changes = [
				{ from: range.from, insert: `${this.delim}` },
				{ from: range.to,   insert: `${this.delim}` }
			];
			cursorUpdate = this.updateCursorTransaction(cursorPos ?? range, cursorOffset + 1);
		
		// Unitalicize (the immediate selection is italicized already):
		} else {
			const updatedRange = updateRange(view.state, range);
			changes = [
				{ from: updatedRange.to, to: updatedRange.to+1, insert: '' },
				{ from: updatedRange.from-1, to: updatedRange.from, insert: '' }
			];
			cursorUpdate = this.updateCursorTransaction(cursorPos ?? updatedRange, cursorOffset - 1); 
		}
		return {
			changes: changes,
			selectionRange: cursorUpdate,
			toItalics: toItalics
		};
	}
	
	// Given a cursor selection, returns the appropriate smart selection surrounding the cursor. 
	// Either a selection expanded to the surrounding italics block (if one exists),
	// or to the surrounding word (if one exists), otherwise returns the original cursor
	expandCursorSelection(range: SelectionRange, state: EditorState) {
		let newRange = expandToParentSyntax(range, state);
		
		// Has parent formatting: check if italic and not anything else
		if (!newRange.eq(range)) {
			if (checkSelectionForItalics(newRange, state)) 
				return newRange;  
			// TODO: expand parent for nested formatting? is it worth it?
		}

		// No existing italics: 
		// Attempt to expand the selection to the surrounding word at the cursor point 
		const selectedWord = state.wordAt(range.anchor);
		if (selectedWord) 
			return EditorSelectionCM.range(selectedWord.from, selectedWord.to);
		return range;
	}

	unitalicizeTransaction(state: EditorState, range: SelectionRange) {
		const updatedRange = updateRange(state, range);
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
		// FIXME: cursor translation needs to be calculated, dependent on the update + context
		if (range instanceof SelectionRange) {
			// Cursor is a selection range
			return EditorSelectionCM.range(Math.max(0, range.anchor + cursorOffset), range.head + cursorOffset);
		} else {
			// Cursor is just a cursor position
			return EditorSelectionCM.cursor(Math.max(0, range + cursorOffset)); 
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