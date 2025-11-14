
# Obsidian Plugin: Underscore Italics

Do you prefer using \__underscores_\_ for italics and **\*\*asterisks\*\*** for bold? Don't like how Obsidian's native commands force asterisk-based notation for both, with no option to change this? This plugin is for you.

**Underscore Italics** gives you the option to choose which italics delimiter you prefer: asterisk or underscore. It provides a setting to choose which one is used by default, andgives you a new `toggle italic` command that always uses the character chosen.

While this plugin doesn't _override_ Obsidian's default "toggle italic" command, it can easily replace it by re-mapping the `Ctrl -> I` shortcut (or whichever you prefer). While this is a different command, I built this to faithfully recreate Obsidian's standard behavior, so this should mimic the standard functionality you're used to, including **multi-cursor support** and **smart selection**. It supports word selection so you don't need to first highlight a word you want to toggle. It smartly detects existing italic syntax, and can quickly undo an italic portion from anywhere inside of one. It detects italic formatting using _both_ asterisks or underscores, regardless of the preferred delimiter you choose.

**{ Gifs/screenshots of functionality here }**

### Supports/features:

- Core italic toggling functionality
- Word expansion
- Smart syntax-aware expansion
- Uses clean CodeMirror transactions that don't pollute undo history.
- Behaves reliably, as other existing syntax-aware commands do. For instance:
	- When toggling a large italic section, automatically finds and replaces any existing smaller italic portions that are inside the outer selection.
	- Can detect if any position is italicized already and then locate the formatting boundaries.

### Why?

 Markdown has always supported [two syntaxes](https://daringfireball.net/projects/markdown/syntax#em) for bold and italic formatting: underscore and asterisk. For most cases they can be used interchangeably, however some (like me) prefer to differentiate the two. Using a consistent convention (specifically underscores as italics, in my opinion) makes the Markdown formatting much _clearer_ and easier to parse when looking at the raw formatting in source mode. 
 
Certain organizations and style guides ([Google developer docs](https://developers.google.com/style/text-formatting)) actually specify preference of underscores for _italics_ and double-asterisk for **bold**. Additionally, certain nested formattings of bold and italic are not even possible without differentiating the two (which is even mentioned in [Obsidian's documentation](https://help.obsidian.md/syntax#Bold%2C+italics%2C+highlights)). Regardless of your preference, I believe you should be able to choose. 

Other plugins have attempted to correct this but didn't fully implement all the default features and behavior that Obsidian's built-in italic operation does. That's what I wanted, and is why I chose to make this as my first plugin. 


### Feature List (forget what this is called)

- [ ] Expand built-in word selection to include apostrophes and other additional characters
- [ ] Specific handling of `***` and `___`
- [x] Detect and trim addtional spacing automatically
- [x] Syntax expansion: an italic operation done *within* an existing italic section
- [x] Preserve correct anchor and head
- [x] Cursor offsets for multiple cursors need to be additive
- [x] Dynamically calculate offsets based on where the cursor is (before/inside/after the italics)



<!--

This is a sample plugin for Obsidian (https://obsidian.md).

  

This project uses TypeScript to provide type checking and documentation.

The repo depends on the latest plugin API (obsidian.d.ts) in TypeScript Definition format, which contains TSDoc comments describing what it does.

  

This sample plugin demonstrates some of the basic functionality the plugin API can do.

- Adds a ribbon icon, which shows a Notice when clicked.

- Adds a command "Open Sample Modal" which opens a Modal.

- Adds a plugin setting tab to the settings page.

- Registers a global click event and output 'click' to the console.

- Registers a global interval which logs 'setInterval' to the console.

  

## First time developing plugins?

  

Quick starting guide for new plugin devs:

  

- Check if [someone already developed a plugin for what you want](https://obsidian.md/plugins)! There might be an existing plugin similar enough that you can partner up with.

- Make a copy of this repo as a template with the "Use this template" button (login to GitHub if you don't see it).

- Clone your repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/your-plugin-name` folder.

- Install NodeJS, then run `npm i` in the command line under your repo folder.

- Run `npm run dev` to compile your plugin from `main.ts` to `main.js`.

- Make changes to `main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.

- Reload Obsidian to load the new version of your plugin.

- Enable plugin in settings window.

- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

  

## Releasing new releases

  

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.

- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.

- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases

- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.

- Publish the release.

  

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.

> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

  

## Adding your plugin to the community plugin list

  

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).

- Publish an initial version.

- Make sure you have a `README.md` file in the root of your repo.

- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

  

## How to use

  

- Clone this repo.

- Make sure your NodeJS is at least v16 (`node --version`).

- `npm i` or `yarn` to install dependencies.

- `npm run dev` to start compilation in watch mode.

  

## Manually installing the plugin

  

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

  

## Improve code quality with eslint (optional)

- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code.

- To use eslint with this project, make sure to install eslint from terminal:

  - `npm install -g eslint`

- To use eslint to analyze this project use this command:

  - `eslint main.ts`

  - eslint will then create a report with suggestions for code improvement by file and line number.

- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder:

  - `eslint ./src/`

  

## Funding URL

  

You can include funding URLs where people who use your plugin can financially support it.

  

The simple way is to set the `fundingUrl` field to your link in your `manifest.json` file:

  

```json

{

    "fundingUrl": "https://buymeacoffee.com"

}

```

  

If you have multiple URLs, you can also do:

  

```json

{

    "fundingUrl": {

        "Buy Me a Coffee": "https://buymeacoffee.com",

        "GitHub Sponsor": "https://github.com/sponsors",

        "Patreon": "https://www.patreon.com/"

    }

}

```

  

## API Documentation

  

See https://github.com/obsidianmd/obsidian-api

-->