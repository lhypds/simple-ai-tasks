#!/usr/bin/env node
const blessed = require('blessed');

const { isCJKChar } = require('./utils/cjkUtils');
const {
  createTask,
  markTask,
  deleteTask,
  openTask,
  readTasks
} = require('./utils/taskUtils');
const { clearScreen } = require('./utils/screenUtils');
const { getEditor } = require('./utils/editorUtils');

// load .env
const path = require('path');
const fs = require('fs');
(function loadDotenv() {
  try {
    // require dotenv only if available so this script still works without the package
    let dotenv = null;
    try { dotenv = require('dotenv'); } catch (e) { /* dotenv not installed */ }
    if (!dotenv) return;

    // try common locations in order: cwd (where user runs the CLI), script dir (project root), then parent
    const candidates = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(__dirname, '.env'),
      path.resolve(__dirname, '..', '.env')
    ];

    for (const dotenvPath of candidates) {
      if (fs.existsSync(dotenvPath)) {
        dotenv.config({ path: dotenvPath });
        break;
      }
    }
  } catch (e) { /* dotenv optional or not installed; ignore */ }
})();

function formatOriginForDisplay(s, width) {
  s = (s || '').toString().trim();
  let out = '';
  let cur = 0;
  for (const ch of s) {
    const w = isCJKChar(ch) ? 2 : 1;
    if (cur + w > width) break; // don't exceed target width
    out += ch;
    cur += w;
  }
  if (cur < width) out += ' '.repeat(width - cur);
  return out;
}

function renderList(screen, list, tasks, selected) {
  const lines = tasks.map((t, i) => {
    // show [x] for done, [p] for pending, [ ] for todo/others
    const check = (t.Status === 'done') ? '[x]' : (t.Status === 'pending' ? '[p]' : '[ ]');
    const labels = t.Labels || '';
    const rawTitle = (t.Title || '').trim();
    const detailsRaw = t.Details || '';
    let title;
    if (rawTitle) {
      title = rawTitle;
    } else {
      // find the first non-empty row in Details and use that as the title
      const detailLines = detailsRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (detailLines.length > 0) {
        const firstLine = detailLines[0];
        const words = firstLine.split(/\s+/).filter(Boolean);
        if (words.length > 3) {
          title = words.slice(0, 3).join(' ');
        } else {
          title = firstLine;
        }
      } else {
        title = '(empty)';
      }
    }

    // format origin to exact display width 5, counting CJK chars as width 2
    const origin = formatOriginForDisplay(t['Origin'] || t.Origin || '', 8);

    const last = t['Last edit at'] || t.Edit_at || '';
    const created = t['Created at'] || t.Created_at || '';
    return `${check}  ${t.id}  ${origin}  ${last}  ${created}  ${title}`;
  });
  list.setItems(lines);
  list.select(selected);
  screen.render();
}

function main() {
  const cwd = process.cwd();
  const screen = blessed.screen({ smartCSR: true, title: 'stask', fullUnicode: true, mouse: true });

  // header row (always visible)
  const header = blessed.box({
    parent: screen,
    top: 0, left: 0, height: 1, width: '100%',
    content: '     id          origin    edit_at        created_at     task'
  });

  const selectedStyle = (process.platform === 'win32')
    ? { bg: 'blue', fg: 'white', bold: true }
    : { bg: 'blue', fg: 'white', bold: true };

  const list = blessed.list({
    parent: screen,
    top: 1, left: 0, width: '100%', height: '100%-1',
    keys: true, vi: true, mouse: true,
    style: { selected: selectedStyle }
  });

  const statusBarStyle = (process.platform === 'win32')
    ? { bg: 'green', fg: 'white' }
    : { bg: 'gray', fg: 'black' };

  // status bar shown at the bottom of the screen
  const statusBar = blessed.box({
    parent: screen,
    bottom: 0, left: 0, height: 1, width: '100%',
    content: '',
    style: statusBarStyle
  });

  function updateStatusBar(tasks) {
    const ts = tasks || list.tasksData || [];
    const total = ts.length;

    // Show: <counters> `path-to-task-folder` <editor>
    const editor = getEditor();

    // counters for statuses: todo (including empty), done, pending
    let todoCount = 0, doneCount = 0, pendingCount = 0;
    for (const item of ts) {
      const st = (item.Status || '').toLowerCase();
      if (st === 'done') doneCount++;
      else if (st === 'pending') pendingCount++;
      else todoCount++;
    }

    const counterString = `todo:${todoCount} done:${doneCount} pending:${pendingCount}`;
    const pathString = ' ' + '`' + cwd + '`';
    const editorString = ' ' + editor;
    statusBar.setContent(counterString + pathString + editorString);
    try { screen.render(); } catch (e) { }
  }

  // persistent no-tasks box (hidden by default)
  const noTasksBox = blessed.box({
    parent: screen,
    top: 'center', left: 'center', width: 'shrink', height: 'shrink',
    content: 'No tasks found. Press `a` to add a task, or `q` to quit.',
    border: { type: 'line' },
    style: { border: { fg: 'gray' } },
    hidden: true
  });

  function refresh(selectedIndex = 0) {
    const tasks = readTasks(cwd);

    if (tasks.length === 0) {
      list.clearItems();

      // hide header and list, show the no-tasks box
      try { header.hide(); } catch (e) { }
      try { list.hide(); } catch (e) { }
      try { noTasksBox.show(); } catch (e) { }
      screen.render();

      // update status bar to show no tasks
      updateStatusBar([]);
      return;
    }

    // tasks exist: ensure header and list visible and no-tasks box hidden
    try { noTasksBox.hide(); } catch (e) { }
    try { header.show(); } catch (e) { }
    try { list.show(); } catch (e) { }

    // reorder tasks: todo (top), done (middle), pending (bottom)
    const statusOrder = (s) => {
      const st = (s || '').toLowerCase();
      if (st === 'todo' || st === '') return 0;
      if (st === 'done') return 1;
      if (st === 'pending') return 2;
      return 0;
    };

    tasks.sort((a, b) => {
      const sa = statusOrder(a.Status);
      const sb = statusOrder(b.Status);
      if (sa !== sb) return sa - sb;
      // within same status, sort by id descending (bigger id first)
      const ai = parseInt(a.id, 10) || 0;
      const bi = parseInt(b.id, 10) || 0;
      return bi - ai;
    });

    renderList(screen, list, tasks, selectedIndex);
    list.tasksData = tasks; // attach

    // Update the status bar
    updateStatusBar(tasks);
  }
  refresh(0);

  // Shortcuts
  // 1. Exit the application
  screen.key(['q', 'C-c'], () => {
    try { screen.destroy(); } catch (e) { }
    clearScreen();
    process.exit(0);
  });

  // 2. Refresh the task list
  screen.key('l', () => { refresh(list.selected); });

  // 3. Refresh the task list
  screen.key('r', () => {
    const sel = (typeof list.selected === 'number') ? list.selected : 0;
    // Re-render the blessed UI and refresh the list — do NOT clear the raw terminal buffer
    try { refresh(sel); } catch (e) { try { screen.render(); } catch (err) { /* ignore */ } }
  });

  // 4. Add a new task
  screen.key('a', () => {
    const taskPath = createTask(cwd);
    const editor = getEditor();
    const { spawnSync } = require('child_process');
    // temporarily leave blessed fullscreen so editor can use the terminal
    try { screen.leave(); } catch (e) { }
    spawnSync(editor, [taskPath], { stdio: 'inherit' });
    // restore screen and refresh tasks after editor exits
    try { screen.render(); } catch (e) { }
    refresh();
  });

  // 5. Edit a task
  screen.key('e', () => {
    const tasks = list.tasksData || readTasks(cwd);
    const t = tasks[list.selected];
    if (t) {
      const editor = getEditor();
      const { spawnSync } = require('child_process');
      try { screen.leave(); } catch (e) { }
      spawnSync(editor, [t.path], { stdio: 'inherit' });
      try { screen.render(); } catch (e) { }
      refresh(list.selected);
    }
  });

  // 6. Preview task content on space (previously toggled done)
  let previewBox = null;

  screen.key('space', () => {
    // If a preview is open, close it (toggle behavior)
    if (previewBox) {
      try { previewBox.hide(); } catch (e) { }
      try { previewBox.destroy(); } catch (e) { }
      previewBox = null;
      try { list.focus(); } catch (e) { }
      try { screen.render(); } catch (e) { }
      return;
    }

    const tasks = list.tasksData || readTasks(cwd);
    const t = tasks[list.selected];
    if (!t) return;

    // Show only the Details field in the preview (do not show full file)
    const detailsRaw = (t.Details || '').toString();
    const previewContent = detailsRaw.trim() ? detailsRaw : '';

    previewBox = blessed.box({
      parent: screen,
      top: 'center', left: 'center', width: '80%', height: '70%',
      content: previewContent,
      border: { type: 'line' },
      scrollable: true,
      keys: true,
      vi: true,
      mouse: true,
      alwaysScroll: true,
      scrollbar: { ch: ' ', track: { bg: 'gray' }, style: { bg: 'white' } },
      style: { fg: 'white', bg: 'black', border: { fg: 'blue' } }
    });

    // Close preview with common keys and restore focus
    previewBox.key(['q', 'escape', 'enter', 'space'], () => {
      try { previewBox.hide(); } catch (e) { }
      try { previewBox.destroy(); } catch (e) { }
      previewBox = null;
      try { list.focus(); } catch (e) { }
      try { screen.render(); } catch (e) { }
    });

    // Ensure list doesn't capture keys while preview is open
    try { list.blur(); } catch (e) { }
    try { previewBox.focus(); } catch (e) { }
    try { screen.render(); } catch (e) { }
  });

  // 6.5. Toggle pending status with 'p' — mark pending/todo and refresh ordering
  screen.key('p', () => {
    const tasks = list.tasksData || readTasks(cwd);
    const cur = (typeof list.selected === 'number') ? list.selected : 0;
    const t = tasks[cur];
    if (!t) return;
    const id = t.id;

    if ((t.Status || '').toLowerCase() !== 'pending') {
      markTask(t, 'pending');
    } else {
      markTask(t, 'todo');
    }

    // refresh list and re-select the same task by id in new ordering
    refresh();
    const newTasks = list.tasksData || readTasks(cwd);
    const idx = newTasks.findIndex(x => x.id === id);
    const sel = idx >= 0 ? idx : Math.min(cur, newTasks.length - 1);
    try { list.select(sel); } catch (e) { }
    try { screen.render(); } catch (e) { }
  });

  // 7. Open current task folder
  screen.key('enter', () => {
    const tasks = list.tasksData || readTasks(cwd);
    const t = tasks[list.selected];
    if (t) { openTask(t); }
  });

  // 8. Delete a task
  screen.key('d', () => {
    const tasks = list.tasksData || readTasks(cwd);
    const t = tasks[list.selected];
    if (t) {
      deleteTask(cwd, t);
      refresh(Math.max(0, list.selected - 1));
    }
  });

  // Gestures
  // Support mouse wheel to move between tasks
  function moveSelection(delta) {
    const tasks = list.tasksData || readTasks(cwd);
    if (!tasks || tasks.length === 0) return;
    const max = tasks.length - 1;
    const cur = (typeof list.selected === 'number') ? list.selected : 0;
    const next = Math.max(0, Math.min(max, cur + delta));
    if (next !== cur) {
      list.select(next);
      screen.render();
    }
  }

  // Handle mouse wheel events on both screen and list (covers more terminals, incl. some Windows hosts)
  function onMouseWheel(data) {
    if (!data) return;
    const action = data.action || data.type || '';
    const button = data.button || '';
    // common names: 'wheelup' / 'wheeldown', also some terminals use button values
    if (action === 'wheelup' || button === 'wheelup') {
      moveSelection(-1);
    } else if (action === 'wheeldown' || button === 'wheeldown') {
      moveSelection(1);
    }
  }

  screen.on('mouse', onMouseWheel);
  list.on('mouse', onMouseWheel);

  list.focus();
  screen.render();
}

main();
