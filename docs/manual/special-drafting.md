---
title: Special Drafting
summary: Move one rating outside the batch cycle, print the waiting drafts on one form, and upload many special drafts.
order: 40
module: special-drafting
---

Special Drafting moves a single rating to a new ship on a signal's authority, without a batch. Each draft has a **Posting Type**: **Complement**, **Vice**, **TY** or **DW**. A draft waits until its form is printed. Printing moves the ratings.

## Special Draft Proposal {#special-drafting-proposal screen=special-drafting.proposal}

This page lists the special drafts that are waiting to be printed. Each row shows the rating, where it goes, the posting type and the WEF.

![Special drafts waiting to be printed](shot:special-drafting-proposal-list)

### Draft a rating {#special-drafting-draft-rating needs="special-drafting.proposal add"}

1. Open [Special Draft Proposal](#special-drafting/proposal).
2. Press **Draft a Rating**.
3. Find the **Rating**. Type two characters of the Official Number or name and press the rating. Any current rating can be drafted, in a batch or not.
4. Choose the **Posting Type**.
5. Choose **Drafted To**, the new ship. It must be an active ship and not the one the rating is on.
6. Type the **Authority**.
7. Choose the **WEF**, the day the rating moves. It must be after the day the rating joined its ship, and not more than a year ahead.
8. Type the **Deployment/Vice** if the posting type is **Vice**. It is required for Vice.
9. Add a **Remark** if you need one.
10. Press **Draft Rating**.

![The Draft a Rating dialog](shot:special-drafting-draft-dialog)

A WEF after today reads **Scheduled when printed**. The system moves the rating on that day.

### Read or remove a draft {#special-drafting-read-draft needs="special-drafting.proposal view"}

1. Press a row. The draft opens with the rating's current posting and the draft's details.
2. Press **Draft Letter** to open the letter in the preview.
3. {needs="special-drafting.proposal delete"} Press **Remove** and confirm to cancel the draft.

> **Tip:** Use the **Search** box and **Posting Type** filter to narrow a long list.

## Special Draft Report {#special-drafting-report screen=special-drafting.report}

The report prints the waiting drafts of one posting type on one form, and keeps the forms already printed.

![The Special Draft Report](shot:special-drafting-report-page)

### Print a form {#special-drafting-print-form needs="special-drafting.report view"}

1. Open [Special Draft Report](#special-drafting/report).
2. Choose a **Posting Type**.
3. Read the line under it, for example **2 ratings on this form: 1 moves when it is printed, 1 is scheduled for a later WEF.**
4. Press **Preview Draft Form** to read the form first.
5. {needs="special-drafting.report edit"} Press **Print and Mark Printed**.
6. Confirm. The form gets a number such as `SDF-2026-0002`.

> **Important:** Printing is all or nothing. Each rating with a WEF today or earlier moves now. If one draft cannot move, the print stops and the message names it. Fix that draft and print again.

### Reprint a form {#special-drafting-reprint-form needs="special-drafting.report view"}

1. Scroll to **Printed Forms**.
2. Press the form.
3. Press **Reprint Form**.

## Upload Draft {#special-drafting-upload screen=special-drafting.upload}

Upload Draft adds many special drafts from one Excel workbook.

### Upload special drafts {#special-drafting-upload-drafts needs="special-drafting.upload add"}

1. Open [Upload Draft](#special-drafting/upload).
2. Press **Download Template**. The columns are Official No, Drafted To, Authority, WEF, Posting Type, Deployment/Vice and Remark.
3. Fill in one row for each draft.
4. Press **Choose an .xlsx workbook** and pick the file.
5. Read the review. It checks every row first and names each problem.
6. Press **Import**. The ready rows are added together as drafts not yet printed.

If the page says **The file could not be read as an Excel workbook**, save the file as `.xlsx` and choose it again.

```shot special-drafting-proposal-list
open: #special-drafting/proposal
as: admin
crop: #app-main
height: 620
marks:
  1: button "Draft a Rating" | Draft a rating
```

```shot special-drafting-draft-dialog
open: #special-drafting/proposal
as: admin
do:
  - click: button "Draft a Rating"
  - wait: button "Draft Rating"
crop: modal
marks:
  1: button "Draft Rating" | Save the draft
```

```shot special-drafting-report-page
open: #special-drafting/report
as: admin
crop: #app-main
height: 720
marks:
  1: button "Preview Draft Form" | Read the form first
  2: button "Print and Mark Printed" | Print and move the ratings
```
