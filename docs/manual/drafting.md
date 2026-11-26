---
title: Drafting
summary: Move ratings between ships. Make a draft batch, review it, approve it, close it and date each posting.
order: 30
module: drafting
---

Drafting moves ratings from one ship or unit to another. The work goes through a cycle, one page for each stage:

1. **Print Draft Proposal** shows who is due and makes a batch.
2. **Review/Print Draft** is where you choose each rating's new ship.
3. **Draft Approval** is where each department approves its part.
4. **Close Draft** closes the batch with its authority.
5. **Update WEF** gives each posting its date, and the rating moves on that date.

**Update Manning Requirement**, **Batch/Signal Content**, **Rate DOD History** and **Draft Report** help you plan and read the results.

> **Important:** If your account is tied to a department, you see only that department's ratings, batches and approvals.

## The Draft Cycle {#drafting-cycle}

The stages in order, from the first list to the last date.

### Run a draft from start to end {#drafting-whole-cycle needs="drafting.proposal view"}

1. Open [Print Draft Proposal](#drafting/proposal). {needs="drafting.proposal add"} Press **Create Draft Batch** and confirm. See [Make a draft batch](#drafting-make-batch).
2. Open [Review/Print Draft](#drafting/review). {needs="drafting.review edit"} Choose the proposed ship of each rating. See [Review a batch](#drafting-review-batch).
3. {needs="drafting.approval approve"} Open [Draft Approval](#drafting/approval) and approve each department. See [Approve a department](#drafting-approve-department).
4. {needs="drafting.close edit"} Open [Close Draft](#drafting/close) and close the batch with its authority. See [Close a batch](#drafting-close-batch).
5. {needs="drafting.wef edit"} Open [Update WEF](#drafting/wef) and date each posting. See [Set the WEF](#drafting-set-wef).
6. Open [Batch/Signal Content](#drafting/batches) to see how many ratings have reported.

## Update Manning Requirement {#drafting-manning screen=drafting.manning}

The manning requirement says how many ratings of each rate and specialisation a ship or unit needs. The page shows **Required**, **Aboard** (the ratings posted there now) and the **Difference**. It only advises. It never stops a draft.

![The manning requirement](shot:drafting-manning-list)

### Add a requirement {#drafting-add-requirement needs="drafting.manning add"}

1. Open [Update Manning Requirement](#drafting/manning).
2. Press **Add Requirement**.
3. Choose the **Ship or Unit**, the **Rate** and the **Specialisation**.
4. Type the **Quantity**, from 1 to 99.
5. Press **Add Requirement** in the dialog.

If the page says the requirement already exists, the ship has a line for that rate and specialisation. Edit that line instead.

### Change or remove a requirement {#drafting-edit-requirement needs="drafting.manning edit"}

1. Press the line in the list.
2. Press **Edit**, change the **Quantity** and save.
3. {needs="drafting.manning delete"} Press **Delete** and confirm to remove the line.

### Print the requirement {#drafting-print-requirement needs="drafting.manning view"}

1. Press **Print** at the top.
2. Choose one ship or all ships.
3. The Manning Requirement Report opens in the preview. Press **Download** or **Print**.

## Print Draft Proposal {#drafting-proposal screen=drafting.proposal}

This page lists the ratings who are due for a draft. A rating is due after a set number of months on a ship. The number is kept in [Settings](#admin/settings). The **On Ship** column shows the months, as a coloured pill: green is newly due, amber has waited longer and red is long overdue. The colours only guide your order of work.

![Ratings due for a draft](shot:drafting-proposal-list)

### Make a draft batch {#drafting-make-batch needs="drafting.proposal add"}

1. Open [Print Draft Proposal](#drafting/proposal).
2. Choose a **Branch**, **Specialisation** and **Rate** to narrow the list. Each has **All**. The list only reads.
3. Read the line above the list, for example **63 ratings are due, 12 already in a batch**.
4. Press **Create Draft Batch**.
5. Read the dialog: the batch number, your filters and **Ratings to Add**.
6. Press **Create Batch**.

A batch number looks like `DOD-LG-ALL-ALL-000001`. If an open batch with the same filters exists, the ratings are added to it. A rating already in a batch is left out, and the dialog says how many.

If the page says **Nobody on this list can be added**, everyone due is already in a batch, or nobody is due. Review that batch, or change the filters.

![The Create Draft Batch dialog](shot:drafting-create-batch)

## Review/Print Draft {#drafting-review screen=drafting.review}

Here you choose where each rating goes. Pick a batch at the top. The page shows the batch, its progress and its ratings.

![Reviewing a batch](shot:drafting-review-page)

### Review a batch {#drafting-review-batch needs="drafting.review view"}

1. Open [Review/Print Draft](#drafting/review).
2. Choose the batch in **Batch Number**.
3. Read **Progress**. It says how many ratings have a proposed ship.
4. Press a rating. Its dialog opens.
5. {needs="drafting.review edit"} Press **Edit Posting**. Choose the proposed ship, the vice or deployment if it applies, and a remark. Press **Save**.
6. Read **Manning at the Proposed Ship** in the dialog. It says, for example, **Needs 1, will have 1**. Beside the ship in the list, a pill says **Over by 1** or **Under by 1**. This advises only.
7. {needs="drafting.review edit"} Press **Not Recommended** to hold a rating back. Type the **Reason**, then press **Not Recommended** again. The row is struck out and the Draft Form shows it struck out.
8. {needs="drafting.review delete"} Press **Remove** to take the rating out of the batch.

If the page says **This rating is not recommended. Remove the row, or add the rating again.**, a rating you held back cannot be given a ship. Remove it, or add it again.

![A rating in the batch](shot:drafting-review-row)

### Add a rating to a batch {#drafting-add-personnel needs="drafting.review add"}

1. Press **Add Personnel**.
2. Find the rating in **Rating**. Type two characters of the Official Number or name, then press the rating.
3. Type a **Request** if there is one.
4. Press **Add to Batch**.

A rating already in a batch cannot be added.

### Print or export the draft {#drafting-print-draft needs="drafting.review view"}

1. Press **Print Draft** to open the Draft Form in the preview.
2. Press **Export Excel** to save the batch as a workbook.

### Clear a batch {#drafting-clear-batch needs="drafting.review delete"}

1. Press **Clear Draft**.
2. Read the question and confirm.

> **Important:** Clear Draft removes every rating from the open batch. Use it only when the whole batch was made by mistake.

## Draft Approval {#drafting-approval screen=drafting.approval}

Each department approves its own ratings. The page shows one row for each department with its total and its status, **Waiting** or **Approved**.

![Approval by department](shot:drafting-approval-list)

### Approve a department {#drafting-approve-department needs="drafting.approval approve"}

1. Open [Draft Approval](#drafting/approval).
2. Press the department. Its dialog shows the totals by rate and each rating with the ship.
3. Press **Approve Department**.
4. Type the **Approving Rank**, **Name** and **Appointment** of the officer who approves.
5. Press **Approve**.

If the page says **This department has no ratings in an open batch to approve**, there is nothing waiting for that department.

### Export the approval lists {#drafting-export-approval needs="drafting.approval view"}

1. Press **Export Excel All Departments** at the top, or **Export Excel** in a department's dialog.

## Close Draft {#drafting-close screen=drafting.close}

Closing ends the review. The page shows each batch and whether it is **Ready**. A batch is ready when every rating has a proposed ship and every department has approved.

![Batches ready to close](shot:drafting-close-list)

### Close a batch {#drafting-close-batch needs="drafting.close edit"}

1. Open [Close Draft](#drafting/close).
2. Press a batch that says **Ready**. Its dialog shows the readiness checks.
3. Press **Close Draft**.
4. Type the **Authority**, the signal that authorises the draft. Each authority is used once.
5. Type the **Close Date**. It cannot be in the future or before the batch began.
6. Press **Close Draft** again.

If the page says **This batch cannot be closed yet**, the dialog lists what is missing: a ship, or a department's approval. Finish that and try again.

> **Important:** A closed batch is final and is never reopened. A correction is made on the rating's record, and the Audit Trail keeps it.

![The close dialog](shot:drafting-close-dialog)

## Update WEF {#drafting-wef screen=drafting.wef}

WEF is the date a posting takes effect. A rating moves to the new ship on that date. A date today or earlier moves the rating at once. A later date is scheduled, and the system moves the rating on that day.

![Dating a batch's postings](shot:drafting-wef-list)

### Set the WEF {#drafting-set-wef needs="drafting.wef edit"}

1. Open [Update WEF](#drafting/wef).
2. Choose a closed batch in **Batch Number**.
3. Press a rating.
4. Press **Set WEF**, choose the date and save.

To date a whole department: press **Set WEF for Department**, choose the **Department**, choose the **WEF Date** and press **Save WEF**. The date cannot be before the authority's date. Ratings with no proposed ship are left out.

If the page says **This rating's WEF is already set**, it was dated before and is final.

## Batch/Signal Content {#drafting-batches screen=drafting.batches}

This page lists every draft batch with its signal code, its status and how many ratings have reported to the new ship.

![The batches](shot:drafting-batches-list)

### Read a batch {#drafting-read-batch needs="drafting.batches view"}

1. Open [Batch/Signal Content](#drafting/batches).
2. Narrow the list with **Branch**, **Rate**, **Signal Code** and **Batch No**.
3. Press a batch to see its ratings with the old ship, the new ship and the date reported.
4. Press **Print Draft Report** or **Export Excel** on that page.
5. Press **Print Summary** or **Export Excel** on the list to take every batch you see.

## Rate DOD History {#drafting-history screen=drafting.history}

This page shows every draft of every rating, newest first, with the old and new ship, the date reported and the batch number.

### Read a rating's drafts {#drafting-read-history needs="drafting.history view"}

1. Open [Rate DOD History](#drafting/history).
2. Type two characters of an Official Number or name in **Rating** and press the rating. The list shows only that rating.
3. Clear the box to see everyone again.
4. Press **Print PDF** or **Export Excel**.

A date in the future reads **Scheduled**. A posting with no date yet reads **Pending**. If more than 2,000 drafts match, a message asks you to use the search first.

## Draft Report {#drafting-report screen=drafting.report}

The Draft Report lists every posting that has reported, by WEF.

### Print the Draft Report {#drafting-print-report needs="drafting.report view"}

1. Open [Draft Report](#drafting/report).
2. Choose a **Specialisation**, an **Authority**, and dates in **From** and **To**.
3. Press **Print Report** for a PDF or **Export Excel** for a workbook.

```shot drafting-manning-list
open: #drafting/manning
as: admin
crop: #app-main
height: 620
marks:
  1: button "Print" | Print the requirement
  2: button "Add Requirement" | Add a line
```

```shot drafting-proposal-list
open: #drafting/proposal
as: admin
crop: #app-main
height: 620
marks:
  1: button "Create Draft Batch" | Make a batch of the ratings due
```

```shot drafting-create-batch
open: #drafting/proposal
as: admin
do:
  - click: button "Create Draft Batch"
  - wait: button "Create Batch"
crop: modal
marks:
  1: button "Create Batch" | Make the batch
```

```shot drafting-review-page
open: #drafting/review
as: admin
crop: #app-main
height: 700
marks:
  1: role combobox "Batch Number" | Choose the batch
  2: button "Print Draft" | Open the Draft Form
```

```shot drafting-review-row
open: #drafting/review
as: admin
do:
  - click: css #app-main tbody tr, #app-main div.space-y-2 > button
  - wait: button "Edit Posting"
crop: modal
marks:
  1: button "Edit Posting" | Choose the proposed ship
  2: button "Not Recommended" | Hold the rating back
```

```shot drafting-approval-list
open: #drafting/approval
as: admin
crop: #app-main
height: 560
```

```shot drafting-close-list
open: #drafting/close
as: admin
crop: #app-main
height: 420
```

```shot drafting-close-dialog
open: #drafting/close
as: admin
do:
  - click: text "DOD-ME-ALL-ALL-000001"
  - click: button "Close Draft"
  - wait: label "Authority"
crop: modal
marks:
  1: label "Authority" | The signal that authorises the draft
  2: label "Close Date" | Today or earlier
```

```shot drafting-wef-list
open: #drafting/wef
as: admin
crop: #app-main
height: 640
marks:
  1: button "Set WEF for Department" | Date a whole department
```

```shot drafting-batches-list
open: #drafting/batches
as: admin
crop: #app-main
height: 560
marks:
  1: button "Print Summary" | Print every batch listed
```
