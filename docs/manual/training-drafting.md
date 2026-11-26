---
title: Training Drafting
summary: Open a training batch for a course, choose who attends, record attendance and put the course on each record.
order: 50
module: training-drafting
---

Training Drafting sends ratings on a course. A batch is for one course in one month, for example `DOT-2026-12-06`. The work runs through five pages: **Process Training Draft**, **Training Review**, **Update Training History**, **Reports** and **Excel Upload**.

## The Training Cycle {#training-cycle needs="training.process view"}

### Run a training batch from start to end {#training-whole-cycle needs="training.process view"}

1. {needs="training.process add"} Open [Process Training Draft](#training/process) and make a batch. See [Open a training batch](#training-new-batch).
2. {needs="training.review edit"} Open [Training Review](#training/review) and add or remove ratings. See [Choose who attends](#training-choose-ratings).
3. {needs="training.history edit"} Open [Update Training History](#training/history) and mark who attended. See [Record attendance](#training-record-attendance).
4. {needs="training.history edit"} Press **Confirm Training History**. Each attending rating gets a Training entry on its record, and the batch closes.
5. Open [Reports](#training/reports) to read the batches.

## Process Training Draft {#training-process screen=training.process}

The page lists the open training batches, with the number of ratings in each.

![The open training batches](shot:training-process-list)

### Open a training batch {#training-new-batch needs="training.process add"}

1. Open [Process Training Draft](#training/process).
2. Press **New Training Batch**.
3. In **Course and Period**, choose the **Course**, the **Month** and the **Year**.
4. Press **Next**.
5. In **Select Ratings**, choose the **Branch**, **Specialisation** and **Rate**. The count of eligible ratings updates as you choose.
6. Press **Create Batch**.

Only one batch is made for a course in a month. If one is open already, add ratings to it from [Training Review](#training/review).

![Choosing the course and the month](shot:training-new-batch-dialog)

## Training Review {#training-review screen=training.review}

The page shows the ratings of one open batch, with the rating's length of service and the last course it did.

![Reviewing a training batch](shot:training-review-page)

### Choose who attends {#training-choose-ratings needs="training.review view"}

1. Open [Training Review](#training/review).
2. Choose the batch in **Batch Number**.
3. {needs="training.review edit"} Press **Add Rating**, find the rating and press **Add Rating** in the dialog. Only a current rating the course is open to can be added, and not one already in an open batch for it.
4. {needs="training.review edit"} Press **Add by Branch** to add many. Choose the **Branch**, **Specialisation** and **Rate**, read the count, and press **Add Ratings**. A rating already in an open batch for the course is left out.
5. {needs="training.review edit"} Press a row, then press **Remove**, to take a rating out.

## Update Training History {#training-history screen=training.history}

Here you say who attended and on which dates. Then you confirm, and the course goes onto each rating's Training tab.

![Recording attendance](shot:training-history-page)

### Record attendance {#training-record-attendance needs="training.history edit"}

1. Open [Update Training History](#training/history).
2. Choose the batch.
3. Read **Attending**, for example **4 of 4**.
4. Tick the box in the **Attended** column for each rating who attended. Leave it clear for a rating who did not. **This Course** shows **Batch dates**, or **Not attending**.
5. Press a rating who attended, then press **Change Dates**. Type a **Start Date** and **End Date** and press **Save Dates**. Clear both to go back to the batch's dates.
6. Press **Confirm Training History**.
7. Read the question and confirm.

> **Important:** Confirming is final. It adds a Training entry with its result to the record of each rating who attended, and it closes the batch.

## Reports {#training-reports screen=training.reports}

The Reports page lists batches by training, month, year and number.

### Read the training reports {#training-read-reports needs="training.reports view"}

1. Open [Reports](#training/reports).
2. Choose a **Training**, **Month** or **Year**, or type a **Batch No**.
3. Read **Status**: **Open** or **Closed**.
4. Press a batch to read it with its ratings, then press **Print PDF** to open the Training Draft Report in the preview.

## Excel Upload {#training-upload screen=training.upload}

Excel Upload adds Training entries to many records from one workbook, for courses done in the past.

### Upload training entries {#training-upload-entries needs="training.upload add"}

1. Open [Excel Upload](#training/upload).
2. Press **Download Template**. Its columns are Official No, Course, Institution, Qualification, Start Date, End Date and Authority.
3. Fill in one row for each entry.
4. Press **Choose an .xlsx workbook** and pick the file.
5. Press **Review**. Every row is checked and each problem is named.
6. Press **Import**.

```shot training-process-list
open: #training/process
as: admin
crop: #app-main
height: 380
marks:
  1: button "New Training Batch" | Open a batch
```

```shot training-new-batch-dialog
open: #training/process
as: admin
do:
  - click: button "New Training Batch"
  - wait: button "Next"
crop: modal
marks:
  1: button "Next" | Go to the ratings
```

```shot training-review-page
open: #training/review
as: admin
crop: #app-main
height: 560
marks:
  1: button "Add Rating" | Add one rating
  2: button "Add by Branch" | Add many
```

```shot training-history-page
open: #training/history
as: admin
crop: #app-main
height: 560
marks:
  1: button "Confirm Training History" | Confirm and close the batch
```
