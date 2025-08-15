// Utility to select the user's preferred editor.
// Extracted from cli.js so other modules can reuse it.
function getEditor() {
  return process.env.EDITOR || process.env.VISUAL || (process.platform === 'win32' ? 'notepad' : 'vim');
}

module.exports = { getEditor };
