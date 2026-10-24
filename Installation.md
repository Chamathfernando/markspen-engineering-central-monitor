# Markspen Engineering Central Monitor — Installation & Setup Guide for Windows PC

This guide provides instructions to install, configure, and run the **Markspen Engineering Central Monitor** on a Windows computer (Windows 10, Windows 11, or Windows Server).

---

## 1. Prerequisites

Before installing, ensure your Windows PC has:

1. **Node.js (LTS version 20.x or 22.x recommended)**
   - Download from [https://nodejs.org/](https://nodejs.org/)
   - Choose the "LTS" (Long Term Support) installer for Windows (`.msi`).
   - Run the installer and check the box to automatically install required tools.
   - Verify installation in Command Prompt (CMD) or Windows PowerShell:
     ```cmd
     node -v
     npm -v
     ```

2. **Git (Optional, for cloning repository)**
   - Download from [https://git-scm.com/download/win](https://git-scm.com/download/win)

---

## 2. Project Directory Setup & Excel Workbook

1. Place the project folder on your drive (for example: `C:\Markspen\markspen-engineering-monitor`).
2. Verify that the primary workbook `Markspen_Engineering_Central_Monitor.xlsx` is located in the **root directory** of the project:
   ```text
   C:\Markspen\markspen-engineering-monitor\
   ├── Markspen_Engineering_Central_Monitor.xlsx
   ├── package.json
   ├── server.ts
   ├── vite.config.ts
   ├── index.html
   └── ...
   ```
   > **Note:** If the workbook is not present on initial launch, the application will automatically initialize a compliant workbook with all 14 worksheets, headers, formula links, and reference datasets.

### 2.1 Configured Operational Reference Data
- **Branches (8):** Ampara, Anuradhapura, Kurunegala, Embilipitiya, Polonnaruwa, Maharagama, Kilinochchi, Head Office.
- **Job Types (8):** Breakdown, Service, Installation, Inspection, Modification, Commissioning, Warranty, Other.
- **Priority Levels (4):** Low, Medium, High, Critical.
- **Status Lifecycle:** Open, Assigned, In Progress, Pending Parts, Pending Customer, On Hold, Completed, Closed, Cancelled, Invalid.

---

## 3. Installation Steps on Windows

Open **Windows Terminal**, **PowerShell**, or **Command Prompt (CMD)** as Administrator or your standard user, and navigate to the project directory:

```cmd
cd "C:\Markspen\markspen-engineering-monitor"
```

### Step 3.1: Install Dependencies
Run the following command to download and install all required Node.js packages:

```cmd
npm install
```

### Step 3.2: Run Automated Logic Tests (Optional Verification)
To verify that all business calculations, date difference rules, visit hour calculations, and financial discount/VAT algorithms pass:

```cmd
npm test
```

---

## 4. Starting the Application

To start the unified server (Express backend + React frontend) on port 3000:

```cmd
npm run dev
```

You will see output similar to:
```text
[Markspen Monitor] Server running at http://localhost:3000
[Server] Authoritative Excel workbook verified and ready.
```

Open your web browser (Google Chrome, Microsoft Edge, Firefox, or Brave) and navigate to:
```text
http://localhost:3000
```

---

## 5. Production Build & Deployment on Windows

If you want to run the optimized production build:

```cmd
npm run build
npm start
```

---

## 6. Important Notes for Windows Users

### 6.1 Excel File Locking Behavior
- When you open an `.xlsx` file in Microsoft Excel on Windows, Excel may place an exclusive file lock on it.
- While the application has built-in retry mechanisms and temporary file write protection, **it is strongly recommended to close the file in Microsoft Excel before performing write operations in the web application** to avoid file access permission errors (`EBUSY` / `EPERM`).

### 6.2 Automatic Backups & Recovery
- The server automatically creates a backup named `Markspen_Engineering_Central_Monitor.backup.xlsx` in the root folder before committing writes during a session.
- If you ever need to restore from backup:
  1. Stop the application server (`Ctrl + C` in your command window).
  2. Copy `Markspen_Engineering_Central_Monitor.backup.xlsx` over `Markspen_Engineering_Central_Monitor.xlsx`.
  3. Restart the server: `npm run dev`.

---

## 7. Windows Command Summary Cheat Sheet

| Action | Command |
| :--- | :--- |
| Navigate to directory | `cd "C:\Path\To\Project"` |
| Install packages | `npm install` |
| Run test suite | `npm test` |
| Start Development Server | `npm run dev` |
| Build for Production | `npm run build` |
| Start Production Server | `npm start` |
| Stop Server | Press `Ctrl + C` |
