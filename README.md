# SavedatCost — Finance Workbench

SavedatCost is a local-first personal finance workbench for tracking everyday spending, budgets, savings, bank accounts, e-wallets, and long-term investments in Philippine pesos.

The interface is designed as a calm, modern desktop workspace: quick actions stay close at hand, detailed calculations remain inspectable, and the app continues to work without an internet connection.

## Project description

SavedatCost helps you answer three practical questions every day:

1. Where did my money go?
2. What can I safely spend this month?
3. Am I making progress toward my savings and investment goals?

It uses a local SQLite database for the desktop app and creates timestamped JSON backups whenever you save. The calculation and data layers are kept separate from the visual interface so the tracker can grow into an optional encrypted-sync application later.

## Features

- Current balance overview with income, spending, budget, savings, and investment totals
- Fast expense, income, and transfer entry
- Bank account, e-wallet, cash, and investment accounts
- Philippine bank and e-wallet provider icons
- Monthly category budgets with spent, remaining, and over-budget states
- Savings goals and progress tracking
- Manual investment holdings, cost basis, current valuation, and gain/loss
- Built-in calculator with common arithmetic and memory functions
- Beginner mode and detailed review mode
- Reports, settings, light/dark themes, and local reset controls
- Local SQLite storage and timestamped JSON backups
- “Save” action in the top bar for an explicit save-and-backup workflow
- “Made by Rodelio G. Cua” watermark in the app interface

## Run the editable local version

Requirements:

- Windows, macOS, or Linux
- Node.js 18 or newer

Start the local server with either:

```text
start-local.bat
```

or:

```text
node server.js
```

Then open [http://localhost:5173](http://localhost:5173) in a browser. The local server has no external npm dependencies. It serves the app, supports automatic refresh when source files change, stores the local database, and creates backups when the app saves.

## Build the Windows desktop app

The native desktop wrapper is in `desktop/` and uses Rust, Tao, and WRY. The current working Windows build is kept locally under `release/SavedatCost/` and is intentionally excluded from version control because it contains generated runtime files.

To create a new desktop build, install Rust and the Windows WebView2 runtime, then build the wrapper from the `desktop/` directory. The app expects the packaged web files, `server.js`, and a local Node runtime beside the executable.

## Local data and privacy

Your financial records are local by design. The repository intentionally excludes:

- SQLite database files
- JSON backup files
- Generated desktop builds and bundled runtimes
- Environment files and logs

This keeps personal balances and transactions out of GitHub. Always keep your local `data/` and `backups/` folders backed up separately.

## Repository layout

```text
index.html              App structure
styles.css              Visual design and responsive layout
app.js                  Finance state, calculations, and interactions
server.js               Local HTTP server and SQLite persistence
save-flow.js            Save and backup workflow
account-providers.js    Bank and e-wallet provider catalog
desktop/                Native Windows desktop wrapper source
assets/bank-logos/      Provider logo assets
tools/                  Icon/build helper scripts
```

## Status

SavedatCost is a personal local-first project. Optional online synchronization is not enabled in this repository, so the app does not send financial records to a cloud service.
