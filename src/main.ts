import { Editor, MarkdownView, Plugin  } from 'obsidian';
import { EditorView } from "@codemirror/view";
import { UnderscoreItalicsSettingTab, UnderscoreItalicsSettings, DEFAULT_SETTINGS }  from './settings';
import { toggleItalicsCommand } from './commands/toggle-italic';
import { DelimiterCharacter } from './types';

export default class UnderscoreItalicsPlugin extends Plugin {
	settings: UnderscoreItalicsSettings;
	delim: DelimiterCharacter;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new UnderscoreItalicsSettingTab(this.app, this));
		this.addCommand({
			id: 'toggle-italic',
			name: 'Toggle italic',	
			icon: 'lucide-italic',
			editorCallback: (_editor: Editor, view: MarkdownView) => {
				// @ts-expect-error, not typed
				const editorView = view.editor.cm as EditorView;
				toggleItalicsCommand(this, editorView);
			}
		});
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
}
