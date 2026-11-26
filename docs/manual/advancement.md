---
title: Advancement Processing
summary: Find who is due for the next rate, review and approve the batch, close it and enter the board date.
order: 60
module: advancement
---

Advancement Processing promotes ratings to the next rate. It works like the draft cycle: a batch is made, reviewed, approved by each department and closed, and then the board's date makes the new rate take effect.

> **Important:** If your account is tied to a department, you see only that department's ratings, batches and approvals.

## The Advancement Cycle {#advancement-cycle needs="advancement.due view"}

### Run an advancement batch from start to end {#advancement-whole-cycle needs="advancement.due view"}

1. {needs="advancement.due add"} Open [Rates due for Advancement](#advancement/due) and make a batch. See [Make an advancement batch](#advancement-make-batch).
2. {needs="advancement.review edit"} Open [Advancement Review](#advancement/review) and set each rating's new rate. See [Review a batch](#advancement-review-batch).
3. {needs="advancement.approval approve"} Open [Approval](#advancement/approval) and approve each department. See [Approve a department](#advancement-approve-department).
4. {needs="advancement.close edit"} Open [Close](#advancement/close) and close the batch with its authority. See [Close a batch](#advancement-close-batch).
5. {needs="advancement.board edit"} Open [Board Returns Update](#advancement/board) and enter the board's date. See [Enter the board date](#advancement-set-date).
6. Open [Report on Promoted Rates](#advancement/promoted) to read the result.

## Rates due for Advancement {#advancement-due screen=advancement.due}

The page lists ratings who are due for the next rate. **Months in Rate** is the time at the current rate. The page only reads. The number of months is kept in [Settings](#admin/settings).

![Ratings due for advancement](shot:advancement-due-list)

### Make an advancement batch {#advancement-make-batch needs="advancement.due add"}

1. Open [Rates due for Advancement](#advancement/due).
2. Choose a **Branch**, **Specialisation** and **Current Rate** to narrow the list. Each has **All**.
3. Read the line above the list, for example **51 ratings are due, 8 already in an open batch**.
4. Press **Create Advancement Batch**.
5. Read the dialog: the batch number, the filters and **Ratings to Add**.
6. Press **Create Batch**.

A batch number looks like `DOA-ME-ALL-ALL-000001`. A rating already in a batch is left out.

![Create Advancement Batch](shot:advancement-create-batch)

## Advancement Review {#advancement-review screen=advancement.review}

Pick a batch to see its ratings with the months in rate and the new rate.

![Reviewing a batch](shot:advancement-review-page)

### Review a batch {#advancement-review-batch needs="advancement.review view"}

1. Open [Advancement Review](#advancement/review).
2. Choose the batch in **Batch Number**.
3. Press a rating.
4. {needs="advancement.review edit"} Press **Set New Rate**. Choose the **New Rate**. A rating advances one rate at a time. Type **Remarks** if you need to. Press **Set New Rate**.
5. {needs="advancement.review edit"} Press **Not Recommended** to hold a rating back. Type the **Reason**, then press **Not Recommended** again. The row is struck out and the Advancement Form shows it. The rating is on the due list again next time.
6. {needs="advancement.review delete"} Press **Remove** to take the rating out of the batch.
7. {needs="advancement.review add"} Press **Add Personnel** to add a rating. Find it in **Rating** and press **Add to Batch**.
8. Press **Print Form** to open the Advancement Form, or **Export Excel**.
9. {needs="advancement.review delete"} Press **Clear Batch** and confirm to remove every rating from the open batch.

If the page says a rating **is in the top rate and cannot be advanced**, there is no higher rate to give. Remove the row.

If the page says a rating **is now** at another rate, **no longer** the one it was, the rating changed rate after it was added. Remove the row and add the rating again.

## Approval {#advancement-approval screen=advancement.approval}

Each department approves its own ratings. The page shows one row for each department with its total and its status.

### Approve a department {#advancement-approve-department needs="advancement.approval approve"}

1. Open [Approval](#advancement/approval).
2. Press the department.
3. Press **Approve Department**.
4. Type the **Approving Rank**, **Name** and **Appointment**.
5. Press **Approve**.

If the page says **This department has no ratings in an open advancement batch to approve**, nothing is waiting for that department.

## Close {#advancement-close screen=advancement.close}

The page shows each batch and whether it is **Ready**: every rating has a new rate and every department has approved.

![Batches ready to close](shot:advancement-close-list)

### Close a batch {#advancement-close-batch needs="advancement.close edit"}

1. Open [Close](#advancement/close).
2. Press a batch that says **Ready**.
3. Press **Close Batch**.
4. Type the **Authority**, the signal that authorises it. Each authority is used once.
5. Type the **Close Date**. It cannot be in the future or before the batch began.
6. Press **Close Batch** again.

If the page says **This batch cannot be closed yet**, the dialog lists what is missing.

> **Important:** A closed batch is final and is never reopened. A correction is made on the rating's record.

## Board Returns Update {#advancement-board screen=advancement.board}

The board's approval date makes the new rate take effect. The rating's rate and its Advancement tab change on that date. A date today or earlier applies now. A later date is scheduled, and the system applies it on that day.

![Entering board dates](shot:advancement-board-list)

### Enter the board date {#advancement-set-date needs="advancement.board edit"}

1. Open [Board Returns Update](#advancement/board).
2. Choose a closed batch in **Batch Number**.
3. Press a rating, then press **Set Date**. Choose the **Board Approval Date** and save.
4. To date the whole batch, press **Set Date for Batch**, choose the **Board Approval Date** and press **Save Date**. Dates already entered stay as they are.

If the page says **Only a closed batch with its authority gets board dates**, close the batch first.

## Report on Promoted Rates {#advancement-promoted screen=advancement.promoted}

This page lists every advancement batch, its authority and how many ratings were promoted. A date not yet reached reads **Pending**.

### Read the promoted rates {#advancement-read-promoted needs="advancement.promoted view"}

1. Open [Report on Promoted Rates](#advancement/promoted).
2. Narrow the list with **Branch**, **Rate**, **Signal Code** and **Batch No**.
3. Press a batch to see its ratings.
4. Press **Print Advancement Report** for that batch, or **Print Batch Summary** and **Export Excel** on the list.

## Upload Advanced Rates {#advancement-upload screen=advancement.upload}

This page loads past advancements for many ratings from one workbook.

### Upload advanced rates {#advancement-upload-rates needs="advancement.upload add"}

1. Open [Upload Advanced Rates](#advancement/upload).
2. Press **Download Template**. The columns are Official No, Old Rate, New Rate, Effective Date, Authority, Decoration and Remark.
3. Fill in one row for each advancement.
4. Press **Choose an .xlsx workbook** and pick the file.
5. Read the review. Every row is checked and each problem is named.
6. Press **Import**.

If the page says **Column ... was not found in row 1**, download the template again and copy your rows into it.

```shot advancement-due-list
open: #advancement/due
as: admin
crop: #app-main
height: 520
marks:
  1: button "Create Advancement Batch" | Make a batch
```

```shot advancement-create-batch
open: #advancement/due
as: admin
do:
  - click: button "Create Advancement Batch"
  - wait: button "Create Batch"
crop: modal
marks:
  1: button "Create Batch" | Make the batch
```

```shot advancement-review-page
open: #advancement/review
as: admin
crop: #app-main
height: 560
marks:
  1: role combobox "Batch Number" | Choose the batch
  2: button "Print Form" | Open the Advancement Form
```

```shot advancement-close-list
open: #advancement/close
as: admin
crop: #app-main
height: 400
```

```shot advancement-board-list
open: #advancement/board
as: admin
crop: #app-main
height: 520
marks:
  1: button "Set Date for Batch" | Date the whole batch
```
