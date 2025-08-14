#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const blessed = require('blessed');

// load .env
try { require('dotenv').config(); } catch (e) { /* dotenv optional */ }

const TASK_FILE = 'task.txt';

function readTasks(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const tasks = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      const id = e.name;
      const taskPath = path.join(dir, id, TASK_FILE);
      if (fs.existsSync(taskPath)) {
        const content = fs.readFileSync(taskPath, 'utf8');
        const parsed = parseTask(content);
        parsed.id = id;
        parsed.path = taskPath;
        tasks.push(parsed);
      }
    }
  }

  // sort by id descending (newest first)
  tasks.sort((a, b) => b.id.localeCompare(a.id));
  return tasks;
}

function parseTask(text) {
  const lines = text.split(/\r?\n/);
  const out = { Title: '', Status: '', Labels: '', Created_at: '', Edit_at: '', Details: '\n' };
  let detailsMode = false;
  const details = [];
  for (const l of lines) {
    if (detailsMode) { details.push(l); continue; }
    if (/^Details:\s*$/.test(l)) { detailsMode = true; continue; }
    const m = l.match(/^([^:]+):\s*(.*)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim();
      out[key] = val;
    }
  }
  out.Details = details.join('\n');
  return out;
}

function createTask(dir) {
  const id = Math.floor(Date.now() / 1000).toString();
  const taskDir = path.join(dir, id);
  fs.mkdirSync(taskDir);
  const taskPath = path.join(taskDir, TASK_FILE);
  const now = formatDate(new Date());
  const template = `Title: \nStatus: todo\nLabels: \nCreated at: ${now}\nLast edit at: ${now}\nDetails:\n\n`;
  fs.writeFileSync(taskPath, template, 'utf8');

  // return path to let caller open editor while screen is suspended
  return taskPath;
}

function formatDate(d) {
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}${m}${day}_${hh}${mm}`;
}

// clear terminal (works in zsh/bash)
function clearScreen() {
  try { process.stdout.write('\x1b[2J\x1b[H'); } catch (e) { try { console.clear(); } catch (e) { } }
}

function saveTask(task) {
  const parts = [];
  parts.push(`Title: ${task.Title}`);
  parts.push(`Status: ${task.Status}`);
  parts.push(`Labels: ${task.Labels}`);
  parts.push(`Created at: ${task['Created at'] || task.Created_at}`);
  parts.push(`Last edit at: ${task['Last edit at'] || task.Edit_at}`);
  parts.push('Details:');
  parts.push(task.Details || '');
  fs.writeFileSync(task.path, parts.join('\n'), 'utf8');
}

function toggleDone(task) {
  if (!task) return;
  task.Status = (task.Status === 'done') ? 'todo' : 'done';
  task['Last edit at'] = formatDate(new Date());
  saveTask(task);
}

function deleteTask(dir, task) {
  const taskDir = path.join(dir, task.id);
  fs.rmSync(taskDir, { recursive: true, force: true });
}

function openTaskInFs(task) {
  const { spawnSync } = require('child_process');
  const dir = path.dirname(task.path);
  if (process.platform === 'win32') {
    // Use explorer.exe which is an actual executable. "start" is a cmd.exe builtin
    // and won't work when called directly via spawnSync without a shell.
    const winPath = dir.replace(/\//g, '\\');
    spawnSync('explorer', [winPath], { stdio: 'ignore' });
  } else {
    const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawnSync(opener, [dir], { stdio: 'ignore' });
  }
}

function showNoTasks(screen) {
  const box = blessed.box({
    parent: screen,
    top: 'center', left: 'center', width: 'shrink', height: 'shrink',
    content: 'No tasks found. Press a to add a task, or q to quit.',
    border: { type: 'line' },
    style: { border: { fg: 'gray' } }
  });
  screen.render();
}

function renderList(screen, list, tasks, selected) {
  const lines = tasks.map((t, i) => {
    const check = t.Status === 'done' ? '[x]' : '[ ]';
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
    const last = t['Last edit at'] || t.Edit_at || '';
    const created = t['Created at'] || t.Created_at || '';
    return `${check}  ${t.id}  ${last}  ${created}  ${title}`;
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
    content: '     id          edit_at        created_at     task'
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

  // persistent no-tasks box (hidden by default)
  const noTasksBox = blessed.box({
    parent: screen,
    top: 'center', left: 'center', width: 'shrink', height: 'shrink',
    content: 'No tasks found. Press a to add a task, or q to quit.',
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
      return;
    }
    // tasks exist: ensure header and list visible and no-tasks box hidden
    try { noTasksBox.hide(); } catch (e) { }
    try { header.show(); } catch (e) { }
    try { list.show(); } catch (e) { }
    renderList(screen, list, tasks, selectedIndex);
    list.tasksData = tasks; // attach
  }

  refresh(0);

  screen.key(['q', 'C-c'], () => {
    try { screen.destroy(); } catch (e) { }
    clearScreen();
    process.exit(0);
  });

  screen.key('l', () => { refresh(list.selected); });

  // clear terminal and re-render list
  screen.key('r', () => {
    const sel = (typeof list.selected === 'number') ? list.selected : 0;
    // Re-render the blessed UI and refresh the list — do NOT clear the raw terminal buffer
    try { refresh(sel); } catch (e) { try { screen.render(); } catch (err) { /* ignore */ } }
  });

  screen.key('a', () => {
    const taskPath = createTask(cwd);
    const editor = process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'vim');
    const { spawnSync } = require('child_process');
    // temporarily leave blessed fullscreen so editor can use the terminal
    try { screen.leave(); } catch (e) { }
    spawnSync(editor, [taskPath], { stdio: 'inherit' });
    // restore screen and refresh tasks after editor exits
    try { screen.render(); } catch (e) { }
    refresh();
  });

  screen.key('e', () => {
    const tasks = list.tasksData || readTasks(cwd);
    const t = tasks[list.selected];
    if (t) {
      const editor = process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'vim');
      const { spawnSync } = require('child_process');
      try { screen.leave(); } catch (e) { }
      spawnSync(editor, [t.path], { stdio: 'inherit' });
      try { screen.render(); } catch (e) { }
      refresh(list.selected);
    }
  });

  screen.key('space', () => {
    const tasks = list.tasksData || readTasks(cwd);
    const t = tasks[list.selected];
    if (t) { toggleDone(t); refresh(list.selected); }
  });

  screen.key('enter', () => {
    const tasks = list.tasksData || readTasks(cwd);
    const t = tasks[list.selected];
    if (t) { openTaskInFs(t); }
  });

  screen.key('d', () => {
    const tasks = list.tasksData || readTasks(cwd);
    const t = tasks[list.selected];
    if (t) {
      deleteTask(cwd, t);
      refresh(Math.max(0, list.selected - 1));
    }
  });

  screen.key('s', () => {
    // placeholder: create subtasks with AI — not implemented
    const msg = blessed.message({ parent: screen, top: 'center', left: 'center', width: 40, height: 5, border: { type: 'line' } });
    msg.display('AI subtasks not implemented in this version.', 3, () => { });
  });

  // support mouse wheel to move between tasks
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

  // handle mouse wheel events on both screen and list (covers more terminals, incl. some Windows hosts)
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

  // Attach mouse handlers only on non-Windows platforms. Some Windows terminals
  // generate noisy or incompatible mouse events; disable to avoid erratic behavior.
  if (process.platform !== 'win32') {
    screen.on('mouse', onMouseWheel);
    list.on('mouse', onMouseWheel);
  }
  list.focus();
  screen.render();
}

main();
