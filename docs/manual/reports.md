---
title: Reports
summary: Read the six reports on ships, personnel, disposition, nominal roll, manning and retirements, and print or export each one.
order: 110
module: reports
---

Reports are read-only pages. They change no record. Each one has filters on the screen, a **Print PDF** button for a printed report and an **Export Excel** button for a workbook. The PDF and the workbook use the same filters as the screen.

## Printing and Exporting {#reports-printing needs="reports.ship-history view"}

### Print or export any report {#reports-print-export needs="reports.all-personnel view"}

1. Open the report.
2. Set the filters.
3. Press **Print PDF**. The report opens in the preview. Press **Download PDF** or **Print**.
4. Or press **Export Excel** to save a workbook.

## Ship History Report {#reports-ship-history screen=reports.ship-history}

The report shows the ratings posted to one ship or unit over a period, with the dates, and **Aboard** for those still there. It also shows the number of postings, how many are aboard now and the average tour.

![The Ship History Report](shot:reports-ship-history-page)

### Read a ship's history {#reports-read-ship-history needs="reports.ship-history view"}

1. Open [Ship History](#reports/ship-history).
2. Choose the **Ship or Unit**. The page asks you to pick one first.
3. Choose **From** and **To** if you want a period.
4. Read the list: official number, name, rate, from, to.

## All Personnel {#reports-all-personnel screen=reports.all-personnel}

The Ratings Report lists ratings with the filters you choose. It shows the official number, the name, the ship or unit and the status.

![The All Personnel report](shot:reports-all-personnel-page)

### Read the Ratings Report {#reports-read-all-personnel needs="reports.all-personnel view"}

1. Open [All Personnel](#reports/all-personnel).
2. Choose any of **Status**, **Rate**, **Branch**, **Command**, **Ship or Unit**, **Specialisation**, **Staff Branch**, **AK (Entry Mode)**, **State**, **Geo-Political Zone** and **Sort By**.
3. Read the figures: **Personnel**, **Current** and **Former**.
4. Press a row to see every detail in a dialog.

## Disposition Report {#reports-disposition screen=reports.disposition}

The report shows where the current ratings serve: each ship or unit with its count and its share, and the count of each rate.

### Read the disposition {#reports-read-disposition needs="reports.disposition view"}

1. Open [Disposition](#reports/disposition).
2. Choose a **Command**, **Area Office** or **Trade** to narrow it.
3. Read **Ships and Units**, **Current Ratings** and **Largest**.
4. Press a row to see the count of every rate on that ship or unit.

## Nominal Roll {#reports-nominal-roll screen=reports.nominal-roll}

The Nominal Roll lists the ratings serving on one ship or unit, or on every ship of a command. The highest rate comes first, then the seniority date. It shows when each rating joined the ship and the months there.

![The Nominal Roll](shot:reports-nominal-roll-page)

### Read a nominal roll {#reports-read-nominal-roll needs="reports.nominal-roll view"}

1. Open [Nominal Roll](#reports/nominal-roll).
2. Choose a **Ship or Unit**, or a **Command**. The page asks for one of them first.
3. Narrow it with **Branch** and **Rate** if you want.
4. Read the total and the count of each rate.

For a command, the printed roll is grouped by ship.

## Manning State {#reports-manning-state screen=reports.manning-state}

Manning State sets each ship's manning requirement against the ratings borne. The difference is a pill: short is red, over is amber and exact is green.

![The Manning State report](shot:reports-manning-state-page)

### Read the manning state {#reports-read-manning-state needs="reports.manning-state view"}

1. Open [Manning State](#reports/manning-state).
2. Choose a **Command**, **Ship or Unit**, **Rate** or **Specialisation**. Choose **Show** to see only the ships that are short.
3. Read **Required**, **Borne** and **Difference**.
4. Press a row to see the ship's lines by rate and specialisation.

## Retirement Forecast {#reports-retirement-forecast screen=reports.retirement-forecast}

The forecast lists the current ratings who become due for discharge in the next 6, 12 or 24 months, soonest first. It says why: age, or years of service.

![The Retirement Forecast](shot:reports-retirement-forecast-page)

### Read the forecast {#reports-read-forecast needs="reports.retirement-forecast view"}

1. Open [Retirement Forecast](#reports/retirement-forecast).
2. Choose the **Period**: 6, 12 (the default) or 24 months.
3. Narrow it with **Branch**, **Rate** or **Ship or Unit**.
4. Read the count of each quarter.
5. Read **Already Due Today**. Press **Open Process Discharge** to deal with those ratings.

```shot reports-ship-history-page
open: #reports/ship-history
as: admin
crop: #app-main
height: 380
```

```shot reports-all-personnel-page
open: #reports/all-personnel
as: admin
crop: #app-main
height: 560
marks:
  1: button "Print PDF" | Print the report
```

```shot reports-nominal-roll-page
open: #reports/nominal-roll
as: admin
crop: #app-main
height: 380
```

```shot reports-manning-state-page
open: #reports/manning-state
as: admin
crop: #app-main
height: 560
```

```shot reports-retirement-forecast-page
open: #reports/retirement-forecast
as: admin
crop: #app-main
height: 560
marks:
  1: button "Print PDF" | Print the report
```
