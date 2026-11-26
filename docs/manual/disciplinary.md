---
title: Disciplinary Action
summary: Open a case, conclude it, cancel it, correct it and print the lists and the report.
order: 80
module: disciplinary
---

Disciplinary Action keeps each case from the incident to the decision. A case is numbered `DC-YYYY-NNNN`. It keeps the rate and the ship the rating had at the time of the incident.

A case moves through three states: **Pending** (waiting for a decision), **Concluded** (decided) or cancelled (opened by mistake, and removed from the lists).

## The Life of a Case {#disciplinary-cycle needs="disciplinary.pending view"}

### Take a case from start to end {#disciplinary-whole-case needs="disciplinary.initiate add"}

1. Open [Initiate Incident](#disciplinary/initiate) and open the case. See [Open a case](#disciplinary-open-case).
2. {needs="disciplinary.pending approve"} Open [Pending Cases](#disciplinary/pending) and conclude it with the decision. See [Conclude a case](#disciplinary-conclude).
3. {needs="disciplinary.pending delete"} If the case was opened by mistake, cancel it instead. See [Cancel a case](#disciplinary-cancel).
4. {needs="disciplinary.concluded edit"} If a decided case has a mistake, correct it on [Concluded Cases](#disciplinary/concluded). See [Correct a case](#disciplinary-correct).
5. {needs="disciplinary.report view"} Read the totals on the [Disciplinary Report](#disciplinary/report).

## Initiate Incident {#disciplinary-initiate screen=disciplinary.initiate}

A case can be opened only for a current rating. A former rating is refused with a message.

![The Initiate Incident page](shot:disciplinary-initiate-page)

### Open a case {#disciplinary-open-case needs="disciplinary.initiate add"}

1. Open [Initiate Incident](#disciplinary/initiate).
2. Type two characters of the Official Number or name in **Official No or Name**.
3. Press the rating in the list. A dialog shows the rating's rate, branch, ship and **Cases on File**. If the rating has a pending case, the dialog says so. A new incident then opens a separate case.
4. Press **Open Case**. The form opens.
5. Choose the **Incident Date**. It cannot be in the future or before the rating joined.
6. Choose the **Offence** from the list.
7. Type **What Happened**.
8. Type **Reported By**.
9. Press **Open Case** again.
10. A message gives the case number.

If the page says **Only a current rating can have a case opened. This rating has left the service.**, choose another rating.

The same rating, offence and incident date cannot be opened twice. The page refuses the second one.

![Opening a case](shot:disciplinary-open-case-dialog)

## Pending Cases {#disciplinary-pending screen=disciplinary.pending}

The page lists the cases that wait for a decision. Press **Print List** for them as a PDF.

![The pending cases](shot:disciplinary-pending-list)

### Find a pending case {#disciplinary-find-pending needs="disciplinary.pending view"}

1. Open [Pending Cases](#disciplinary/pending).
2. Type an Official Number or name in **Official No or Name**, or choose an **Offence**.
3. Press a case to read it.
4. Press **Print Case** to print the Case Sheet.
5. {needs="ratings.edit view"} Press **Open Record** to see the rating's record.

### Conclude a case {#disciplinary-conclude needs="disciplinary.pending approve"}

1. Open [Pending Cases](#disciplinary/pending).
2. Press the case.
3. Press **Conclude**.
4. Choose the **Decision Date**. It cannot be before the incident or in the future.
5. Choose the **Sanction**.
6. Type the **Decision**, up to 250 characters.
7. Type the **Authority** that decided.
8. Press **Conclude Case**.

> **Important:** Concluding is final. A later change is made with **Correct**, which needs a reason.

![Concluding a case](shot:disciplinary-conclude-dialog)

### Cancel a case {#disciplinary-cancel needs="disciplinary.pending delete"}

1. Press the case in [Pending Cases](#disciplinary/pending).
2. Press **Cancel Case**.
3. Type the **Reason**. It is required.
4. Press **Cancel Case** again. Press **Keep Case** to stop.

Use this for a case opened by mistake. The case leaves the lists. Nothing is deleted, and the Audit Trail keeps it with the reason.

If the page says **Only a pending case can be cancelled. A concluded case is changed with Correct.**, use [Correct a case](#disciplinary-correct).

## Concluded Cases {#disciplinary-concluded screen=disciplinary.concluded}

The page lists decided cases. You can narrow it by name, offence, sanction and the dates it was decided.

![The concluded cases](shot:disciplinary-concluded-list)

### Correct a case {#disciplinary-correct needs="disciplinary.concluded edit"}

1. Open [Concluded Cases](#disciplinary/concluded).
2. Press the case. Read **Corrections**, if any, at the bottom.
3. Press **Correct**.
4. Change the fields that are wrong. Every field but the rating can change.
5. Type the **Reason for the Correction**. It is required.
6. Press **Save Correction**.

The case keeps the before and after of each change. If the page says **Nothing was changed. Edit a field first, then give the reason.**, change a field before you save.

## Disciplinary Report {#disciplinary-report screen=disciplinary.report}

The report counts concluded cases for a period.

### Read and print the report {#disciplinary-read-report needs="disciplinary.report view"}

1. Open [Disciplinary Report](#disciplinary/report).
2. Choose **Decided From** and **Decided To**, and filter by **Offence**, **Sanction**, **Ship** or **Rate**.
3. Read **Cases**, **Most Common Offence** and **Most Common Sanction**.
4. Press **Print PDF** or **Export Excel**.

> **Tip:** A rating's record has a **Discipline** tab that shows its cases for reading.

```shot disciplinary-initiate-page
open: #disciplinary/initiate
as: admin
crop: #app-main
height: 340
marks:
  1: role combobox "Official No or Name" | Find a current rating
```

```shot disciplinary-open-case-dialog
open: #disciplinary/initiate
as: admin
do:
  - fill: role combobox "Official No or Name" = B0539
  - click: css [role=option]
  - click: button "Open Case"
  - wait: label "What Happened"
crop: modal
marks:
  1: label "What Happened" | Say what happened
```

```shot disciplinary-pending-list
open: #disciplinary/pending
as: admin
crop: #app-main
height: 600
marks:
  1: button "Print List" | Print the list
```

```shot disciplinary-conclude-dialog
open: #disciplinary/pending
as: admin
do:
  - click: css #app-main tbody tr, #app-main div.space-y-2 > button
  - click: button "Conclude"
  - wait: button "Conclude Case"
crop: modal
marks:
  1: button "Conclude Case" | Save the decision
```

```shot disciplinary-concluded-list
open: #disciplinary/concluded
as: admin
crop: #app-main
height: 560
```
