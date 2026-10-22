import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { PluginValue, DecorationSet, EditorView, ViewUpdate, Decoration, ViewPlugin } from "@codemirror/view";
import { SyntaxNode } from "@lezer/common";
import { Range } from '@codemirror/state';


class UnderscoreViewPlugin implements PluginValue {
	decorations: DecorationSet;

	constructor(view: EditorView) {
        this.buildDecorations = buildDecorations;
		this.decorations = this.buildDecorations(view);
	}

	update(update: ViewUpdate) {
		if (
			update.docChanged ||
			update.viewportChanged ||
			update.selectionSet ||
			update.focusChanged
		) {
			this.decorations = buildDecorations(update.view);
		}
	}

    buildDecorations(view: EditorView): DecorationSet {
        return buildDecorations(view);
    }

	destroy() { }
}


export const underscoreViewPlugin = ViewPlugin.fromClass(
    UnderscoreViewPlugin,
	{ decorations: (v) => v.decorations }  // Bind the decorations array directly to the EditorView's decoration facet
);


const buildDecorations = (view: EditorView): DecorationSet => {
    const live = !!view.dom.closest('.is-live-preview');
    const selection = view.hasFocus ? view.state.selection.ranges : [];
    // const builder = new RangeSetBuilder<Decoration>();
    const out: Range<Decoration>[] = [];

    for (let { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from,
            to,
            enter(node) {
                // If an opening color highlight tag: '==🟠'
                if (node.name.contains('formatting-highlight_highlight_highlight-')) {
                    const firstNode = node.node.nextSibling;
                    if (!firstNode) return false;
                    const italicRange = findItalicsInHighlight(firstNode, view.state);
                    if (!italicRange) return false;

                    const open = italicRange.from, close = italicRange.to;
                    const selected = selection.some(
                        (r) => r.from <= close && r.to >= open
                    );
                    if (live && !selected) {
                        out.push(Decoration.replace({}).range(open, open + 1));
                        out.push(Decoration.replace({}).range(close - 1, close));
                    } else {
                        out.push(Decoration.mark({ class: 'cm-em-formatting cm-em' }).range(open, open + 1));
                        out.push(Decoration.mark({ class: 'cm-em-formatting cm-em' }).range(close - 1, close));
                    }
                    out.push(Decoration.mark({ class: 'cm-em' }).range(open + 1, close - 1));
                    return false;
                }
                return true;
            }
        });
    }
    // return builder.finish();  // not using builder
    return Decoration.set(out, true);
}


function findItalicsInHighlight(firstNode: SyntaxNode, state: EditorState) {
    let open: number|undefined, close: number|undefined; 
    let text = getHighlightedText(firstNode, state);

    if (text.startsWith('_')) 
        open = firstNode.from;
    if (text.endsWith('_')) 
        close = firstNode.from + text.length;

    // We only care about when EITHER italic is just inside a highlight tag (that's the bug)
    let eitherFound = open !== undefined || close !== undefined;
    if (!eitherFound) return null;

    let current: SyntaxNode|null = firstNode;
    if (open === undefined) {
        while (current && !current.name.contains('formatting-highlight')) {
            let match = state.doc.sliceString(current.from, current.to).match(/ _|^_/m);
            if (match?.index) {
                close = current.from + match.index + 1;
            }
            current = current.nextSibling;
        }
    }
    if (close === undefined) {
        while (current && !current.name.contains('formatting-highlight-end')) {
            let match = state.doc.sliceString(current.from, current.to).match(/_ |_$/m);
            if (match?.index) {
                close = current.from + match.index + 1;
            }
            current = current.nextSibling;
        }
    }
    if (open && close) return {from: open, to: close};
    return null;
}


function getHighlightedText(initial: SyntaxNode, state: EditorState) {
    let current: SyntaxNode|null = initial, prev: SyntaxNode|null = initial;
    while (current && !current.name.contains('formatting-highlight-end')) {
        prev = current;
        current = current.nextSibling;
    }
    return current ? state.doc.sliceString(initial.from, prev.to) : "";
}
