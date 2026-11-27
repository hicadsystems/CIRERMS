---
title: Static Tables
summary: Keep the lists that other screens pick from, such as ships, branches, offences and courses.
order: 100
module: tables
---

Static Tables are the lists the other screens choose from: the ships, the branches, the offences, and so on. A table has its own tab under **Static Tables**. Every tab works the same way. You may open only the tabs your role allows, and use only the buttons it allows.

The sixteen tabs are: **Appraisal Ratings**, **Branch**, **Exit Type**, **Entry Mode**, **Offences**, **Sanctions**, **Institution**, **Local Government**, **Languages**, **Relationship**, **Staff Branch**, **Specialisation Area**, **Ships**, **States**, **Title** and **Training**.

## How Every Table Works {#tables-engine needs="tables.ships view"}

Each tab is a searchable list, 25 rows to a page. Press **Edit** at the end of a row, or the add button at the top, to change it. Every change is kept in the Audit Trail.

![A static table](shot:tables-ships-list)

### Find a value {#tables-find-value needs="tables.ships view"}

1. Open **Static Tables** in the sidebar and press the tab you need.
2. Type words in **Search**. The list narrows as you type.
3. Press **Print List** to print the whole list as a PDF.

### Add a value {#tables-add-value needs="tables.ships add"}

1. Open the tab.
2. Press the add button at the top right. It is named for the table, for example **Add Ship**.
3. Fill in the fields. A star marks a required one.
4. Choose the **Status**: **Active** or **Inactive**.
5. Press **Save**.

A new value goes to the end of its dropdown lists. Every name is unique. A name that already exists is refused.

![The Add Ship dialog](shot:tables-add-ship)

### Edit a value {#tables-edit-value needs="tables.ships edit"}

1. Press **Edit** at the end of the row.
2. Change the fields.
3. Press **Save**.

### Delete a value {#tables-delete-value needs="tables.ships delete"}

1. Press **Edit** at the end of the row.
2. Press **Delete**.
3. Confirm.

If the page says **This ... is in use** and names where, for example **(5 ratings)**, the value cannot be deleted because records hold it. Make it **Inactive** instead. An inactive value leaves the dropdown lists, and the records that hold it still show it.

> **Important:** Never delete a value to hide it. Make it **Inactive**. Deleting is for a value added by mistake that nothing uses.

## What Is Special in Each Table {#tables-special needs="tables.ships view"}

| Tab | What is special |
|---|---|
| **Appraisal Ratings** | Each grade has a **Code**, a name, a **Lowest Score** and a **Highest Score** from 0 to 100. The score ranges must not overlap. The grades feed [Recommendation and Grading](#assessment/grading) |
| **Branch** | A two letter **Code**, such as `SM`. It appears in the drafting and advancement batch numbers |
| **Exit Type** | A two letter **Code**. **Rating Stays Current** says whether the rating stays on the Current list. **Death** marks the exit type that asks for the death documents in [Process Discharge](#discharge/process) |
| **Entry Mode** | A **Code** of up to five letters |
| **Offences** | A **Code** and a **Category**: **Conduct**, **Discipline**, **Duty** or **Property**. A case in [Disciplinary Action](#disciplinary/initiate) picks one |
| **Sanctions** | A **Severity**: **Minor** or **Major**. A concluded case picks one |
| **Institution** | A **Code**, **Location** and **Type**, such as University or Training Base. A course picks one |
| **Local Government** | Belongs to a **State**. A name is unique within its state |
| **Languages** | A name only |
| **Relationship** | A name only. Next of kin entries pick one as their **Relationship** |
| **Staff Branch** | May belong to a **Command**. The rating form's Staff Branch list follows the chosen command |
| **Specialisation Area** | A **Code** of up to 15 characters. It appears in the batch numbers |
| **Ships** | A **Type**: **Sea**, **Land** or **Training**, and an optional **Command**. The list shows the name, type, command and status. The description is in the dialog. Drafting uses the active ships, and a posting takes its command from its ship |
| **States** | A **Code** and a **Geo-Political Zone**. The rating form fills the zone from the state |
| **Title** | A name and a description |
| **Training** | A course. It needs an **Institution** and the **Weeks**, 1 to 104. **Branch** and **Specialisation** empty mean any. **Rates** are picked from a list that adds a chip. None picked means every rate. [Training Drafting](#training/process) offers these courses |

> **Tip:** The optional codes (Institution, Local Government, Relationship, Staff Branch and Training) may be left empty, but two rows never share a code.

```shot tables-ships-list
open: #tables/ships
as: admin
crop: #app-main
height: 520
marks:
  1: searchbox | Find a value
  2: button "Add Ship" | Add a value
```

```shot tables-add-ship
open: #tables/ships
as: admin
do:
  - click: button "Add Ship"
  - wait: button "Save"
crop: modal
marks:
  1: button "Save" | Save the value
```
