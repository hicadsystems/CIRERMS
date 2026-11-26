---
title: Ratings Management
summary: Find a rating, read and update its record, add ratings one by one or in a batch, keep its documents, and read your own details.
order: 20
module: ratings
---

Ratings Management holds the service record of every rating. This chapter covers the Current and Former lists, adding a rating, the record and its tabs, Batch Upload, Documents and My Details.

You see only the pages and buttons your role may use. A Records Clerk, for example, can look up and update records but cannot add new ratings.

## Current Ratings {#ratings-current screen=ratings.list}

**Current** lists the ratings who serve now. It is the first page of **Ratings Management**. On a desktop it is a table. On a phone each rating is a card.

![The Current Ratings list](shot:ratings-current-list)

### Find a rating {#ratings-find needs="ratings.list view"}

1. Open [Current Ratings](#ratings/current).
2. Type an Official Number or part of a name in **Search**. The list narrows as you type.
3. Choose a **Rate** to see one rate only.
4. Choose a **Ship** to see one ship or unit only.
5. Press the page buttons under the list to move through the pages. Each page has 25 ratings.

The number under the search box says how many ratings match, for example **119 found**.

> **Tip:** Clear the search box and the filters to see everyone again.

### Open a rating {#ratings-open-rating needs="ratings.list view"}

1. Press a row in the list.
2. On a wide screen the rating opens beside the list, and the first rating is already open when the page loads. On a phone, or a narrow screen, it opens in a dialog or a sheet from the bottom.
3. Read the quick facts: Official Number, name, rate, ship and branch.
4. Press **Open Record** to see the whole record.
5. {needs="ratings.edit view"} Press **Print Report** to print the rating's report.
6. Press **Documents** to open the rating's documents.

### Export the list {#ratings-export needs="ratings.list view"}

1. Open [Current Ratings](#ratings/current) and set the search and filters you need.
2. Press **Export** at the top right.
3. Choose **Copy Rows**, **Excel**, **PDF** or **CSV**.
4. The file holds the rows that match your filters, not only the page you are on.

## Former Ratings {#ratings-former screen=ratings.list}

**Former** lists ratings who have left the service by retirement, discharge or death. It works like Current. Search, filters, a row that opens the rating, and **Export** all behave the same way.

### Read a former rating {#ratings-read-former needs="ratings.list view"}

1. Open [Former Ratings](#ratings/former).
2. Search by Official Number or name.
3. Press a row, then press **Open Record**.
4. Read the record. **Status** shows **Former**, and **Exit Type**, **Exit Date** and **Exit Reason** say how the rating left.

> **Important:** A former rating cannot be drafted, advanced, appraised or charged. Disciplinary Action refuses a former rating with a message.

## Adding a Rating {#ratings-new-rating screen=ratings.new}

A rating is added in a dialog with four steps: **Basic Details**, **Contact**, **Health** and **Official**. On a phone the dialog is a sheet from the bottom.

![The New Rating dialog](shot:ratings-new-rating-dialog)

### Add a rating {#ratings-add-rating needs="ratings.new add"}

1. Open [Current Ratings](#ratings/current).
2. Press **New Rating** at the top right. On a phone press the green plus button at the bottom right. The dialog opens at **Basic Details**.
3. Type the **Official Number**, **Surname** and **First Name**. These three are required.
4. Fill in the other fields you know, such as **Date of Birth**, **Gender** and **Rate**.
5. Press **Choose Photo** to add a passport photograph. It can be a JPG, PNG or WebP file up to 5 MB.
6. Press **Next** to go to **Contact**, then **Health**, then **Official**. What you typed is kept when you move between steps.
7. At **Official**, choose the branch, command, specialisation, entry mode, ship and the dates.
8. Press **Save**.
9. The record opens.

Everything except the Official Number, Surname and First Name can be added later from the record.

| Field | What to enter | Needed |
|---|---|---|
| **Official Number** | The rating's number, for example `B0539`. It is also the rating's user name | Yes |
| **Surname** | Family name. The system writes it in capitals | Yes |
| **First Name** | Given name | Yes |
| **Date of Birth** | dd/mm/yyyy | No |
| **Rate** | From the list | No |

If the page says the **Official Number already exists in CIRERMS**, a rating with that number is on file. Check the number. Search for the rating in [Current Ratings](#ratings/current) and open it instead.

## The Rating's Record {#ratings-record screen=ratings.edit}

The record shows everything held about one rating. At the top are the photograph, the name, the labels and a **Record** completeness bar. The bar is red below 50%, amber to 79% and green from 80%.

Below the bar are ten tabs.

| Tab | What it holds |
|---|---|
| **Details** | Basic Details, Contact, Health and Official, as four cards |
| **Next of Kin** | The people to call, with a photograph |
| **Spouse** | The rating's spouse |
| **Children** | The rating's children |
| **Advancement** | Every rate the rating has held, with dates, decoration and authority |
| **Drafting** | The postings, as a timeline with the current one at the top |
| **Training** | Courses attended |
| **Education** | Schools and qualifications |
| **Language** | Languages spoken |
| **Documents** | Scanned papers by category |

![A rating's record](shot:ratings-record)

### Read a record {#ratings-read-record needs="ratings.edit view"}

1. Open a rating from [Current Ratings](#ratings/current) with **Open Record**.
2. Read the top of the page: rate, ship, branch and command.
3. Press a tab to read that part of the record. A small number on a tab is how many entries it holds.
4. Press **Print Dossier** at the top to print the whole record as a PDF. It opens in a preview with **Download** and **Print**.

> **Tip:** A **Discipline** tab shows pending and concluded cases. It is for reading only, and only if your role may see Concluded Cases.

### Change a rating's details {#ratings-edit-details needs="ratings.edit edit"}

1. Open the record and stay on **Details**.
2. Press **Edit** on the card you want to change, for example **Basic Details**.
3. Change the fields.
4. Press **Save**.

> **Important:** When you change the **Official Number**, the rating's user name changes with it.

### Add an entry to a tab {#ratings-add-entry needs="ratings.edit add"}

1. Open the record and press a tab, for example **Next of Kin**.
2. Press the add button at the bottom of the tab, for example **Add Next of Kin**.
3. Fill in the dialog. Fields with a star are required.
4. Press **Save**.

![Adding a next of kin](shot:ratings-add-next-of-kin)

To change an entry, press its edit icon.

{needs="ratings.edit delete"} To remove an entry, press its delete icon and confirm.

### Delete a rating {#ratings-delete-rating needs="ratings.edit delete"}

1. Open the record.
2. Press **Delete** at the top.
3. Read the question. It says the record, its ten tabs and its documents are removed.
4. Press **Delete Rating** to confirm, or **Cancel** to stop.

> **Important:** Deleting cannot be undone. The Audit Trail keeps a note of who deleted it. A rating who has left the service should stay on file as a former rating, not be deleted.

## Batch Upload {#ratings-batch-upload screen=ratings.upload}

Batch Upload adds many ratings from one Excel workbook. It has three steps: **Download Template**, **Upload Workbook** and **Review and Commit**.

![The Batch Upload page](shot:ratings-batch-upload)

### Add ratings from a workbook {#ratings-upload-workbook needs="ratings.upload add"}

1. Open [Batch Upload](#ratings/upload).
2. Press **Download Template**. A workbook opens with every column and its allowed values.
3. Fill in one row for each rating. Keep the first row as it is.
4. Press **Choose an .xlsx workbook** and pick your file.
5. Press **Check and Commit**.
6. Read the three counts: **Added**, **Skipped** and **Errors**.
7. Read **Rows Not Added**. Each row says why it was left out.
8. Press an Official Number under **Ratings Added** to open that record.

Official Numbers already on file are skipped. Rows with a mistake are left out and named. All the other rows are added together.

If the page says **Choose an .xlsx workbook.**, the file is not an Excel file. Save it as `.xlsx` and try again.

> **Tip:** Fix the rows under **Rows Not Added** in the same workbook, remove the rows already added, and upload it again.

## Documents {#ratings-documents screen=ratings.documents}

Documents holds the scanned papers of each rating, sorted by category: Drafting, Certificate, Request Forms, Emolument / Re-engage Forms, General Forms and Other.

![The Documents page](shot:ratings-documents-page)

### Find a rating's documents {#ratings-find-documents needs="ratings.documents view"}

1. Open [Documents](#ratings/documents).
2. Press **Choose a Rating** and type at least two characters of the Official Number or name.
3. Press the rating in the list.
4. Press a category chip, for example **Certificate**, to show that category.
5. Press a file to open it. A PDF opens in the preview.
6. Press **Download** to save the file.

### Upload a document {#ratings-upload-document needs="ratings.documents add"}

1. Find the rating as in [Find a rating's documents](#ratings-find-documents).
2. Press **Upload Document**.
3. Choose the **Category**.
4. Choose the **File**. It can be a PDF, an image or a Word document.
5. Press **Upload**.

If the page says **Choose a category.** or **Choose a file.**, fill in the field it names.

### Delete a document {#ratings-delete-document needs="ratings.documents delete"}

1. Open the document.
2. Press **Delete**.
3. Press **Delete Document** to confirm.

## My Details {#ratings-my-details screen=ratings.my-details}

My Details is your own record, for reading. Every person with an account has one. You cannot change it here. Ask the Records office to correct a mistake.

![My Details](shot:ratings-my-details-page)

### Read your own record {#ratings-read-my-details needs="ratings.my-details view"}

1. Open [My Details](#ratings/my-details). On a phone press **My Details** in the bottom bar.
2. Read the cards under **Details**.
3. Press a tab to read the rest of your record.
4. Press **Print Dossier** to print it.

```shot ratings-current-list
open: #ratings/current
as: admin
crop: #app-main
height: 640
marks:
  1: searchbox | Type an Official Number or a name
  2: button "Export" | Save the list
```

```shot ratings-new-rating-dialog
open: #ratings/new
as: admin
do:
  - wait: label "Surname *"
crop: modal
marks:
  1: button "Next" | Go to the next step
```

```shot ratings-record
open: #ratings/edit/B0539
as: admin
crop: #app-main
height: 560
marks:
  1: button "Edit Details" | Change the details
  2: button "Print Dossier" | Print the record
  3: tab "Next of Kin 2" | A tab of the record
```

```shot ratings-add-next-of-kin
open: #ratings/edit/B0539
as: admin
do:
  - click: tab "Next of Kin 2"
  - click: button "Add Next of Kin"
  - wait: label "First Name *"
crop: modal
marks:
  1: label "First Name *" | Required
  2: button "Save" | Save the entry
```

```shot ratings-batch-upload
open: #ratings/upload
as: admin
crop: #app-main
marks:
  1: button "Download Template" | Step 1
  2: button "Choose an .xlsx workbook" | Step 2
```

```shot ratings-documents-page
open: #ratings/documents
as: admin
crop: #app-main
height: 360
marks:
  1: heading "Documents" | Pick a rating first
```

```shot ratings-my-details-page
open: #ratings/my-details
as: admin
crop: #app-main
height: 600
marks:
  1: button "Print Dossier" | Print your record
  2: tab "Advancement" | Press a tab to read more
```
