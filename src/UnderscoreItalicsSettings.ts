import {App, PluginSettingTab, Setting } from 'obsidian';
import UnderscoreItalics from 'main';


export interface UnderscoreItalicsSettings {
	defaultItalic: 'underscore' | 'asterisk';
	autoConvert: boolean;
}

export const DEFAULT_SETTINGS: Partial<UnderscoreItalicsSettings> = {
	defaultItalic: 'underscore',
}

export class UnderscoreItalicsSettingTab extends PluginSettingTab {
	plugin: UnderscoreItalics;

	constructor(app: App, plugin: UnderscoreItalics) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Default italics style')
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
