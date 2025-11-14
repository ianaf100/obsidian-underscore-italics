### Bugs:
- [x] Fix the _cursor just after/before italic delimiter_ bug.

## Todo:
- [ ] Expand built-in word selection to handle apostrophes and other additional characters
- [ ] Specific handling of `***` and `___`
- [ ] More thorough out-of-bounds checks
- [ ] Improve on redundancy/efficiency: `updateRange()` and `expandCursorSelection()`
- [x] Detect and trim addtional spacing automatically
- [x] Preserve correct anchor and head
- [x] Cursor offsets for multiple cursors need to be additive
- [x] Syntax expansion: an italic operation *within* an existing italic section. Detecting that?
- [x] Dynamically calculate offsets based on where the cursor is (before/inside/after the italics)
- [x] Larger selection with smaller italic selections inside doesn't do what I want
- [x] Actually handling the change between asterisk/underscore
    - I guess we'll just look for _both_ in detection (being careful to be consistent), then use the preferred delimiter when we insert/replace

## Other
- [ ] Packaging/installing steps
- [ ] Publishing steps?
