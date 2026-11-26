---
title: Naval Character Assessment
summary: Record each rating's character and efficiency grades for a period, read the report and manage the periods.
order: 70
module: assessment
---

Naval Character Assessment records an appraisal of each rating for an appraisal period. Each appraisal has a **Character Grade** and an **Efficiency Grade**, from **A · Outstanding** to **E · Poor**. A rating has one appraisal in each period.

## Recommendation and Grading {#assessment-grading screen=appraisal.grading}

This page lists the appraisals. Each row shows the rating, the period and the two grades.

![The appraisals](shot:assessment-grading-list)

### Find an appraisal {#assessment-find needs="appraisal.grading view"}

1. Open [Recommendation and Grading](#assessment/grading).
2. Find a rating in **Rating**, or choose a **Period**, **Ship**, **Rate** or **Grade**. A grade filter matches either grade.
3. Press a row to read the appraisal: the appraisal number, the grades, the CO's name, the director's name and date, and the remark.

### Initiate an appraisal {#assessment-initiate needs="appraisal.grading add"}

1. Open [Recommendation and Grading](#assessment/grading).
2. Press **Initiate Appraisal**.
3. Find the **Rating**. Any current rating can be appraised.
4. Choose the **Period**. Only open periods are listed.
5. Choose the **Character Grade** and the **Efficiency Grade**. The grades come from [Appraisal Ratings](#tables/appraisal-ratings) in Static Tables.
6. Type a **Remark** if you need one.
7. Type the **CO's Name**.
8. Type the **Director's Name** and **Director's Date**. Give both or neither.
9. Press **Record Appraisal**.

If the page says the rating already has an appraisal in that period, it names the first one. Open that appraisal instead.

![The Initiate Appraisal dialog](shot:assessment-initiate-dialog)

### Edit an appraisal {#assessment-edit needs="appraisal.grading edit"}

1. Press the appraisal.
2. Press **Edit**.
3. Change a field and press **Save Changes**.

If the page says **Nothing was changed**, you saved without a change. Edit a field first. The Audit Trail keeps the before and after.

> **Important:** An appraisal can be changed only while its period is open. A closed period is read-only.

### Cancel an appraisal {#assessment-cancel needs="appraisal.grading delete"}

1. Press the appraisal.
2. Press **Cancel Appraisal**.
3. Type the **Reason**. It is required.
4. Press **Cancel Appraisal** again. Press **Keep Appraisal** to stop.

The appraisal leaves the lists and the rating may be appraised again for that period.

## Report on Appraisal {#assessment-report screen=appraisal.report}

The report shows the appraisals of a period with three figures and the **Grade Counts** for both grades.

![The Report on Appraisal](shot:assessment-report-page)

### Read and print the report {#assessment-read-report needs="appraisal.report view"}

1. Open [Report on Appraisal](#assessment/report).
2. Choose a **Period**, **Ship**, **Rate**, **Branch** or **Grade**.
3. Read **Appraisals**, **Character A or B** and **Efficiency A or B**.
4. Read **Grade Counts**. Each grade has its score range.
5. Press **Print PDF** or **Export Excel**. Both use the filters you set.

## Appraisal Periods {#assessment-periods screen=appraisal.periods}

A period is a stretch of dates in which appraisals are recorded, for example **2026 Second Half**.

![The appraisal periods](shot:assessment-periods-list)

### Add a period {#assessment-add-period needs="appraisal.periods add"}

1. Open [Appraisal Periods](#assessment/periods).
2. Press **Add Period**.
3. Type a **Name**. Each name is used once.
4. Choose the **Start Date** and the **End Date**. The end must be after the start. Periods never overlap.
5. Press **Add Period**.

A new period is open at once.

### Edit or close a period {#assessment-close-period needs="appraisal.periods edit"}

1. Press the period.
2. Press **Edit** to change its name or dates, then press **Save Period**.
3. Press **Close Period** to end it. The dialog warns how many current ratings have no appraisal.
4. Press **Close Period** again to confirm.

> **Important:** Closing a period is final. A closed period is read-only everywhere.

```shot assessment-grading-list
open: #assessment/grading
as: admin
crop: #app-main
height: 520
marks:
  1: button "Initiate Appraisal" | Record an appraisal
```

```shot assessment-initiate-dialog
open: #assessment/grading
as: admin
do:
  - click: button "Initiate Appraisal"
  - wait: button "Record Appraisal"
crop: modal
marks:
  1: button "Record Appraisal" | Save the appraisal
```

```shot assessment-report-page
open: #assessment/report
as: admin
crop: #app-main
height: 490
marks:
  1: button "Print PDF" | Print the report
  2: button "Export Excel" | Save as a workbook
```

```shot assessment-periods-list
open: #assessment/periods
as: admin
crop: #app-main
height: 440
marks:
  1: button "Add Period" | Add a period
```
