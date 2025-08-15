
Simple AI Tasks
===============


A simple task management tool with command-line interface, and AI features.  


How it works
------------

The application bacically read the folders in current directory, listing all tasks.  
Each task is a folder with a `task.txt` file inside it.  
The folder name is the task ID, which is a timestamp in seconds.  
After start it with `stask`, it will list all tasks in current folder, and user can move between tasks.  
Current task will be highlighted with a different color.  


Dependencies
------------

Node.js


Installation
------------

`npm install`  

Install globally with:
`npm install -g .`

Uninstallation
`npm uninstall -g simple-ai-tasks`


Setup
-----

.env  
`EDITOR=nvim`  
Tested available editors: vim, nvim, subl, notepad  


Command
-------

`stask`
After start it will list all tasks in current folder.  
If there is no task, it will show a message: "No tasks found."


Task files
----------

`task.txt`
Plain text file, with task details.

File example:
```
Title: Buy apple.
Status: done
Labels: shopping, groceries
Created at: 20250814_2100
Last edit at: 20250814_2100
Details:
Buy apple from the store.
```


Shortcuts
---------

l
List all tasks, or refresh tasks.  

Output example:  
```
      id          task         edit_at   created_at  
[x]  1755176512  Buy apple.   20250814_2100  20250814_2100  
[ ]  1755176512  Buy orange.  20250814_2100  20250814_2100  
```

a  
Add a task, it will create a folder inside current directory,  
and open the default text editor (like Vim) to edit the `task.txt` file.  

e  
Edit a task with the default text editor.  

↑ or ↓ (arrow keys)  
jk
Move from tasks.  

hl  
→ or ← (arrow keys)
Move from main task and subtasks.  

x 
Mark a task as done.  

Space  
Show task details.  

Enter  
Open a task to view details.  
If it is a folder, it will open the folder with the file manager and the task file.  

d  
Delete a task.  

s  
Create subtasks with AI.  

r  
Refresh the task list.  

p
Pending a task.  

q  
Quit the application.  


Gestures
--------

Mouse scroll up/down  
Scroll through the task list.  