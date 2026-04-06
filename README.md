# **ALED**
### ⚠️ AI NOTICE ⚠️
This project is completly vibe coded and idk anything about JS
<br><br><hr>
## How to install
I have not released the build yet, for now you may clone the repo by 
``` 
$ git clone https://github.com/Silent-Ghost-Git/ALED.git
``` 
Install dependencies and start the desktop app (Electron):

```
python3 -m start.py
```

Your data stays in this folder: `aled_data.json` and the `data/` directory (same layout as before).

### Windows MSI installer

Put your app icon in the project root as **`ALED.jpg`**. Before each build, `predist` turns it into **`build/icon.ico`** (multi-size, for the `.exe` / shortcuts) and **`build/icon.png`**. Then:

```
npm install
npm run dist
```

Output: **`dist/ALED 1.0.0.msi`** (version follows `package.json`). The MSI is an **assisted** installer: you can change the install folder; the default is under your user profile (typically `%LocalAppData%\Programs\ALED`). **`ALED.exe`**, **`aled_data.json`**, and **`data/`** all live in that same install folder. A **Start Menu** shortcut is created by default.

<br> <br> <hr>
## What is about
<b>ALED</b> (Ankur's local examination dashboard (terrible name ik) ) is an examination dashboard for students to use
for their exams preperations. This dashboard allows students organize their worksheets, make plans and make tasks
accordingly to maximize their workflow. They have also access to resources like a timer for setting goals and in
app preview. It is modular and allows great flexibilty for all kinds of exam patterns and portions.
