# Beta testing

Test disposable notes before enabling Revision Marks in a working vault. Disable any other automatic writer of the same timestamp/revision properties first. Android support is declared, but live Android validation is still pending; synthetic tests do not establish real lifecycle behavior.

1. Edit a note, then leave it: expect one timestamp update and one increment in Counter mode. Save unchanged content or completely undo an edit: expect no metadata write.
2. Use Save current file / Ctrl+S: expect one completion. Continue typing, save again: expect another. Repeated unchanged saves do nothing.
3. Edit and immediately quit normally. Check the saved note's body and properties, then restart twice: expect no content loss and no duplicate increment. On Android, repeat by backgrounding and returning to the activity.
4. Change a property through Properties or Bases. Inactive notes may complete immediately; active notes wait for a boundary. A Base file itself is not tracked.
5. Try Off mode: timestamps still work; an existing revision field remains untouched and an absent field is not added.
6. Try rename, custom property names and two views of the same note. Unsaved/divergent views should defer metadata writes rather than overwrite their content.

Report the plugin/Obsidian versions, operating system, reproduction steps and any visible error in [GitHub issues](https://github.com/committed-sins/obsidian-plugin-revision-marks/issues). Use a synthetic example rather than personal note contents.
