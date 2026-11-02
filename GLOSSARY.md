# justable

A React package that owns a data table's mechanics and nothing about its data or its state.

## Language

### Keyboard

**Keyboard row**:
The one row the keyboard acts on, which the consumer holds and feeds back to the grid as its focus.
_Avoid_: cursor, active row, current row

**Movement**:
A named step of the keyboard row: up, down, first, last, page up or page down.
_Avoid_: key, direction, navigation

**Key binding**:
The consumer's choice of which key, with which modifiers, asks for which movement. The engine holds none.
_Avoid_: shortcut, keymap, default keys

**Type-ahead**:
Moving the keyboard row to a row whose name starts with the characters just typed.
_Avoid_: typeahead search, quick find, incremental search
