### Bugs:

## Todo:
- [ ] Preserve correct anchor and head
- [ ] Expand built-in word selection to include additional characters
- [ ] Improve on redundancy/efficiency
- [ ] Dynamically update offset based on where the cursor is (before/inside/after the italics)
    - _(or I can skip this probably)_
- [ ] Handle `***`?
- [x] Cursor updates for multiple cursors need to be additive
- [x] Basic out of bounds checks
- [x] Larger selection with smaller italic selection inside doesn't do what I want
    - That's a bigger project
- [x] **Trim/fix spacing automatically**
- [x] Actually handling the change between asterisk/underscore
    - I guess we'll just look for _both_ in detection (being careful to be consistent), then use the preferred delimiter when we insert/replace
- [x] **Nesting/recursion**: An italic operation *within* a larger italic section. Detecting that? (Might require utilizing more sophisticated *syntax tree* scanning)
    - [x] Cursor
    - [ ] Selection? Default behavior?

## Other
- [ ] Packaging/installing steps
- [ ] Publishing steps?
