### Bugs:

- [x] Cursor updates for multiple cursors need to be additive
- [ ] Out of bounds checks


## Todo:
- [ ] Handle `***`
- [ ] Trim/fix spacing automatically
- [ ] Packaging/installing steps
- [ ] Publishing steps?
- [x] Actually handling the change between asterisk/underscore 
    - I guess we'll just look for _both_ in detection (being careful to be consistent), then use the preferred delimiter when we insert/replace
- [ ] Expand built-in word selection to include additional characters
- [ ] **Nesting/recursion**
    - An italic operation *within* a larger italic section. Detecting that?
    - Both for cursor (should always unitalicize), and for a selection (which would be a mistake, so unitalicize also or do nothing?)
    - Might require utilizing more sophisticated **syntax tree** scanning
