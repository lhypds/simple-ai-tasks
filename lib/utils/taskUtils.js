const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { formatDate } = require('./dateUtils');

const TASK_FILE = 'task.txt';

function parseTask(text) {
  const lines = text.split(/\r?\n/);
  const out = { Title: '', Status: '', Labels: '', Origin: '', Created_at: '', Edit_at: '', Details: '\n' };
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

function createTask(dir) {
  const id = Math.floor(Date.now() / 1000).toString();
  const taskDir = path.join(dir, id);
  fs.mkdirSync(taskDir);
  const taskPath = path.join(taskDir, TASK_FILE);
  const now = formatDate(new Date());
  const template = `Title: \nStatus: todo\nLabels: \nOrigin: \nCreated at: ${now}\nLast edit at: ${now}\nDetails:\n\n`;
  fs.writeFileSync(taskPath, template, 'utf8');

  // return path to let caller open editor while screen is suspended
  return taskPath;
}

function saveTask(task) {
  const parts = [];
  parts.push(`Title: ${task.Title}`);
  parts.push(`Status: ${task.Status}`);
  parts.push(`Labels: ${task.Labels}`);
  parts.push(`Origin: ${task['Origin'] || task.Origin || ''}`);
  parts.push(`Created at: ${task['Created at'] || task.Created_at}`);
  parts.push(`Last edit at: ${task['Last edit at'] || task.Edit_at}`);
  parts.push('Details:');
  parts.push(task.Details || '');
  fs.writeFileSync(task.path, parts.join('\n'), 'utf8');
}

function toggleTaskDone(task) {
  if (!task) return;
  task.Status = (task.Status === 'done') ? 'todo' : 'done';
  task['Last edit at'] = formatDate(new Date());
  saveTask(task);
}

function deleteTask(dir, task) {
  const taskDir = path.join(dir, task.id);
  fs.rmSync(taskDir, { recursive: true, force: true });
}

function openTask(task) {
  if (!task) return;
  const dir = path.dirname(task.path);
  if (process.platform === 'win32') {
    const winPath = dir.replace(/\//g, '\\');
    spawnSync('explorer', [winPath], { stdio: 'ignore' });
  } else {
    const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawnSync(opener, [dir], { stdio: 'ignore' });
  }
}

module.exports = {
  createTask,
  saveTask,
  toggleTaskDone,
  deleteTask,
  openTask,
  parseTask,
  readTasks
};
