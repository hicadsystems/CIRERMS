---
title: Discharge Administration
summary: Make a discharge proposal, process, close or re-engage each rating, print the forms, read the report and upload discharges.
order: 90
module: discharge
---

Discharge Administration takes ratings out of the service, or keeps them in it for longer. A proposal is a list of ratings who are due. Each rating in it is processed with an exit type and an exit date.

## The Discharge Cycle {#discharge-cycle}

### Discharge a rating from start to end {#discharge-whole-cycle needs="discharge.process view"}

1. {needs="discharge.process add"} Open [Process Discharge](#discharge/process) and make a proposal of the ratings due. See [Make a proposal](#discharge-make-proposal).
2. {needs="discharge.process edit"} Process each rating. See [Process a rating](#discharge-process-rating).
3. Print the rating's forms. See [Print service details](#discharge-print-service) and [Print a verification form](#discharge-print-form).
4. Read the [Discharge Report](#discharge/report).

## Process Discharge {#discharge-process screen=discharge.process}

The page has two tabs: **Due for Discharge** and **Proposals**.

**Due for Discharge** lists the ratings who are due, with the age and the years of service as coloured pills. A **Pending case** pill marks a rating with a pending disciplinary case. The page only reads. The age and the years are kept in [Settings](#admin/settings).

![Ratings due for discharge](shot:discharge-due-list)

### Make a proposal {#discharge-make-proposal needs="discharge.process add"}

1. Open [Process Discharge](#discharge/process).
2. Narrow the list with **Official No or Name**, **Branch**, **Rate** and **Entry Mode**.
3. Press **Create Proposal**.
4. Read the dialog: the proposal number, the filters, **Ratings to Add** and **Proposed By**.
5. Press **Create Proposal**.

A proposal number looks like `DIS-2026-0003`. Ratings already in a proposal are left out. Creating a proposal changes nobody's record.

If the page says **There are no ratings matching these filters**, change the filters.

### Add a rating to a proposal {#discharge-add-rating needs="discharge.process add"}

1. Press the **Proposals** tab, then **Add Rating** at the top.
2. Find the **Rating**.
3. Choose the **Proposal**.
4. Press **Add Rating**.

If the page says **This rating is already in a proposal or has been discharged**, the rating cannot be added again.

### Process a rating {#discharge-process-rating needs="discharge.process edit"}

1. Press the **Proposals** tab.
2. Choose the **Proposal**.
3. Press a rating. Its dialog opens.
4. Press **Process**.
5. Choose the **Exit Type**.
6. Choose the **Exit Date**. A date after today is scheduled. The rating stays current until then.
7. Type the **Exit Reason**, up to 100 characters.
8. Type **Approved By** if it applies.
9. Add a **Comment** if you need one.
10. Choose the **Status**: **Pending** keeps it open, **Closed** is final.
11. Press **Save**.

![Processing a rating](shot:discharge-process-dialog)

When you close with an exit date of today or earlier, the rating becomes a former rating at once, its posting ends on the exit date, and its user account is turned off and signed out. A later exit date shows as **Scheduled**, and the system makes the change on that day. Closing also cancels any posting or advancement of the rating that is dated on or after the exit date.

> **Important:** A closed discharge is final. A scheduled or closed discharge cannot be changed or removed.

### Re-engage a rating {#discharge-re-engage needs="discharge.process edit"}

1. Press the rating in the **Proposals** tab.
2. Press **Re-engage**.
3. Choose the **Period (Months)**.
4. Press **Save**.

The rating stays current, and leaves the due list while the period runs. Its record shows **Re-engaged to dd/mm/yyyy**.

### Remove a rating from a proposal {#discharge-remove-rating needs="discharge.process delete"}

1. Press the rating.
2. Press **Remove**.
3. Press **Remove Rating** to confirm.

The rating stays current and can be proposed again later.

## Print Service Details {#discharge-service screen=discharge.service}

This page prints the personnel details sheet of one rating, current or former.

### Print service details {#discharge-print-service needs="discharge.service view"}

1. Open [Print Service Details](#discharge/service).
2. Type two characters of the Official Number or name in **Official No or Name**.
3. Press the rating.
4. Press the print button. The Personnel Details sheet opens in the preview.
5. Press **Download PDF** or **Print**.

## Verification Forms {#discharge-forms screen=discharge.forms}

This page opens the Re-engagement Verification, the Retirement Routine and the Engagement Form for a rating.

### Print a verification form {#discharge-print-form needs="discharge.forms view"}

1. Open [Verification Forms](#discharge/forms).
2. Find the rating.
3. Press the form you need.
4. Read it in the preview. Press **Download PDF** or **Print**.

A form that has no source for this rating is turned off, and the page says why.

## Discharge Report {#discharge-report screen=discharge.report}

The report lists closed discharges and re-engagements.

![The Discharge Report](shot:discharge-report-page)

### Read and print the report {#discharge-read-report needs="discharge.report view"}

1. Open [Discharge Report](#discharge/report).
2. Choose **Exit From**, **Exit To**, **Exit Type**, **Rate** and **Branch**.
3. Read the three figures: **Discharges**, **Scheduled** and **Re-engagements**.
4. Press **Print PDF** or **Export Excel**.

## Upload Discharge {#discharge-upload screen=discharge.upload}

Upload Discharge closes many discharges from one workbook.

### Upload discharges {#discharge-upload-rows needs="discharge.upload add"}

1. Open [Upload Discharge](#discharge/upload).
2. Press **Download Template**. The columns are Official No, Exit Type, Exit Date, Authority, Approved By and Comment.
3. Fill in one row for each rating.
4. Press **Choose an .xlsx workbook** and pick the file.
5. Read the review. Every row is read first and each problem row is listed.
6. Press **Import**.

Ratings already in a proposal, already discharged, or repeated in the file are skipped. The rest are closed, or scheduled by their exit date, together.

```shot discharge-due-list
open: #discharge/process
as: admin
crop: #app-main
height: 640
marks:
  1: button "Create Proposal" | Make a proposal
```

```shot discharge-process-dialog
open: #discharge/process
as: admin
do:
  - click: tab "Proposals 5"
  - click: css #app-main tbody tr, #app-main div.space-y-2 > button
  - click: button "Process"
  - wait: button "Save"
crop: modal
marks:
  1: text "Exit Type" | The way the rating leaves
```

```shot discharge-report-page
open: #discharge/report
as: admin
crop: #app-main
height: 700
marks:
  1: button "Print PDF" | Print the report
```
