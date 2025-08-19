
Simple AI Tasks
===============


A simple task management tool with command-line interface, and AI features.  


How It Works
------------

The application bacically read the folders in current directory, listing all tasks.  
Each task is a folder with a `task.txt` file inside it.  
The folder name is the task ID, which is a timestamp in seconds.  
After start it with `stask`, it will list all tasks in current folder, and user can move between tasks.  


Features
--------

Task Preview  
Use `space` to preview task details.  

Highlighting  
Current task is highlighted with a different color.

Status bar  
Shows the task counter, task folder path, and default text editor.  

* AI Features

To be implemented in the future.  
1. Help summarize tasks and create a title.  
2. Help create subtasks based on the task details.  


Dependencies
------------

Node.js


Installation
------------

Install:  
`npm install`  

Install globally:  
`npm install -g .`

Uninstall:  
`npm uninstall -g simple-ai-tasks`


Setup
-----

.env  
`EDITOR=nvim`  
Tested available editors: `vim`, `nvim`, `subl`(Sublime Text), `notepad`  


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
Origin: Wife
Created at: 20250814_2100
Last edit at: 20250814_2100
Details:
Buy apple from the store.
```


Task List
---------

Example:  
```
      id         edit_at        created_at     task
[x]  1755176512  20250814_2100  20250814_2100  Buy apple.   
[ ]  1755176512  20250814_2100  20250814_2100  Buy orange.  
```

Task status:
empty for todo.  
x for done.  
p for pending.  

Task order:  
TODO tasks first, then done tasks, then pending tasks.


Shortcuts
---------

l  
List tasks, or refresh task list.  

a  
Add a task, it will create a folder inside current directory,  
and open the default text editor (like Vim) to edit the `task.txt` file.  

e  
Edit a task with the default text editor.  

↑ or ↓ (arrow keys)  
j and k
Move from tasks.  

h and l  
→ or ← (arrow keys)
Move from main task and subtasks.  

x  
Mark a task as done.  

Space  
Show task details.  

Enter  
Open a task folder to view details and attachments.  

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