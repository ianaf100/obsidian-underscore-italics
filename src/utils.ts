import { EditorSelection, EditorState, SelectionRange } from "@codemirror/state";
import { syntaxTree } from '@codemirror/language';
import { NodeIterator } from '@lezer/common';


const expandToParentSyntax = (selectionRange: SelectionRange, state: EditorState) => {
    let tree = syntaxTree(state);
    let stack = tree.resolveStack(selectionRange.from, 1);
    if (selectionRange.empty) {
        let stackBefore = tree.resolveStack(selectionRange.from, -1);
        if (stackBefore.node.from >= stack.node.from && stackBefore.node.to <= stack.node.to)
            stack = stackBefore;
    }
    for (let cur: NodeIterator | null = stack; cur != null; cur = cur.next) {
        let { node } = cur;
        if (((node.from < selectionRange.from && node.to >= selectionRange.to) ||
            (node.to > selectionRange.to && node.from <= selectionRange.from)) &&
            cur.next)
            return EditorSelection.range(node.to, node.from);
    }
    return selectionRange;
};


export { expandToParentSyntax }
