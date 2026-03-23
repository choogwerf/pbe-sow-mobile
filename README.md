# PBE SOW Mobile

A mobile-friendly Scope of Works app for PBE technician SOW spreadsheets.

This project is set up for the lowest-friction path:
- keep the workbook as the data source
- import the workbook in the browser
- work from a proper mobile UI instead of editing Excel on your phone
- deploy as a static app on Vercel from GitHub

## What it does

- Loads the bundled `PBE SOW CSS092 filled.xlsx` workbook on first launch
- Imports other SOW workbooks in the same layout
- Shows:
  - dashboard KPIs
  - task register
  - daily log
  - project details / notes
- Lets you update:
  - status
  - assignee
  - planned dates
  - progress
  - completion evidence
  - daily log entries
- Saves app state in local browser storage
- Exports updated data as JSON or task CSV

## What it does not pretend to do

It does **not** do safe live write-back into the original styled Excel workbook. That is the part that becomes brittle fast in a browser-only app.

If you want real shared live editing later, the sensible next step is one of these:
1. Power Apps + SharePoint / Excel Online
2. React app + backend + proper database / API

## Local run

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## Production build

```bash
npm install
npm run build
npm run preview
```

## GitHub + Vercel deploy

1. Create a new GitHub repo.
2. Upload this whole project folder.
3. In Vercel, click **Add New Project**.
4. Import the GitHub repo.
5. Vercel should detect **Vite** automatically.
6. Click **Deploy**.

That is it. No backend required for this version.

## Included sample file

The sample workbook is stored at:

`public/sample/PBE SOW CSS092 filled.xlsx`

That means the deployed app will open with real data on first load.

## Suggested next upgrade

If you want this to become a true shared field tool, build the next version against SharePoint lists instead of raw Excel. Excel is excellent until it decides to become a small administrative hostage situation.
