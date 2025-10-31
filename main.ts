// import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

type ItalicCharChoice = 'underscore' | 'asterisk';

interface UnderscoreItalicsSettings {
	defaultItalic: ItalicCharChoice;
    autoConvert: boolean;
}

const DEFAULT_SETTINGS: Partial<UnderscoreItalicsSettings> = {
	defaultItalic: 'underscore',
}

export default class UnderscoreItalics extends Plugin {
	settings: UnderscoreItalicsSettings;

	async onload() {
		await this.loadSettings();
		console.log('loading obsidian-underscore-italics plugin');

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
			editorCheckCallback: (checking: boolean, editor: Editor) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						// If checking is false, we actually perform the operation:

						if (!editor.somethingSelected()) {
							let wordSelection = editor.wordAt(editor.getCursor());
							if (wordSelection == null) {
								// Empty selection (simple case)
								console.log("Empty selection");
								editor.replaceSelection('_');
								let pos = editor.getCursor();
								editor.replaceSelection('_');
								editor.setCursor(pos);
							} else {
								// At the cursor, italicize the surrounding word
								let word = editor.getRange(wordSelection.from, wordSelection.to);
								let italicized = '_' + word + '_'
								let pos = editor.getCursor();
								editor.replaceRange(italicized, wordSelection.from, wordSelection.to);
								pos.ch = pos.ch + 1;
								editor.setCursor(pos);
							}
						} else {
							if (editor.listSelections().length == 1) {
								let selected = editor.getSelection();
								console.log('Selection(1): ' + selected); // refactor into function
								let italicized = '_' + selected + '_';
								editor.replaceSelection(italicized);
							} else {
								let selections = editor.listSelections();
								selections.forEach((elem, i) => {
									let anchorpos = elem.anchor.line + elem.anchor.ch;
									let headpos = elem.head.line + elem.head.ch;
									let from = anchorpos < headpos ? elem.anchor : elem.head;
									let to = anchorpos < headpos ? elem.head : elem.anchor;
									let selected = editor.getRange(from, to);  // refactor into function
									// TODO: trim/update selection
									console.log(`Selection(${i+1}): ${selected}`);
									let italicized = '_' + selected + '_';
									editor.replaceRange(italicized, from, to);
								});
							}
						}

					}
					// If checking is true, we're only checking if the command 'can' be run.
					// This command will only show up in Command Palette when the check function returns true.
					// Here we're just checking that MarkdownView is active.
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MySettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });
		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
			.setDesc('Default character for italics')
			.addDropdown((dropdown) => dropdown
				.addOption('underscore', 'Underscore')
				.addOption('asterisk', 'Asterisk')
				.setValue(this.plugin.settings.defaultItalic)
				.onChange(async (value) => {
					let choice: ItalicCharChoice = value as ItalicCharChoice ?? 'underscore'; // idk???????
					this.plugin.settings.defaultItalic = choice; 
					console.log(choice);
					await this.plugin.saveSettings();
				})
			);
	}
}
