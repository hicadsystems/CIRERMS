# Legacy map: Disciplinary Action (4 menu items, 3 distinct pages)

Source root: `/home/user/cirems/hpproject` (EF model `HRProjectDAL/Core/HicadHRProjectModel.edmx`). Paths are relative to `hpproject` unless they start with `HRProjectDAL`.
"UNCONFIRMED" = inferred (procedure bodies are not available).

## 0. Overview

Menu group "Disciplinary Action" in `Views/Shared/_menu.cshtml` (block at lines ~160-170), guarded by `User.IsInRole("DisciplinaryActions")`. Item links are at lines 165-168.

| Menu label | Route | Controller action | View |
|---|---|---|---|
| Initiate Incidence | `/Decipline/index` | `DeciplineController.Index(SearchCriteria, svcno)` | `Views/Decipline/Index.cshtml` + partial `_LayoutDesciplineForP` |
| Pending Cases | `/Decipline/List` | `List(int? id)` | `List.cshtml` + partial `_LayoutDesciplineComment` |
| Concluded Cases | `/Decipline/DesciplineHistoryList` | `DesciplineHistoryList(int? id)` | `DesciplineHistoryList.cshtml` + partial `_LayoutAllDescipline` |
| Disciplinary Report | `/Decipline/DesciplineHistoryList` (identical link) | same | same |

- Concluded Cases and Disciplinary Report are THE SAME PAGE (same URL, same action, same view, same filter). The page header says "Concluded Cases". The "report" is only the Export button on that page (PDF). See section 4.
- No `[Authorize]`/role attribute on `DeciplineController` (grep); role is enforced only by the menu. Sitewide auth (forms) is UNCONFIRMED.
- Spelling in route and code is `Decipline`/`Descipline`, fields `Decission`, `WhatHappen`. Do not copy.
- Pages reached by links only (not menu): `CreateNewIncident` (GET/POST), `incidents` (confirmation), `Edit` (GET/POST; sanction and decision), `Delete` (GET/POST; no link to it anywhere).
- Lookups (separate static pages, role `StaticTables`, lines ~205-217): "Disciplinary Offence Setup" = `Office/Index` (table `offences`: id, Name nvarchar(50)); "Disciplinary Sanction Setup" = `Sanction/Index` (table `sanctions`: id, Name nvarchar(50)). Each is a plain create/edit/delete list (`Controllers/OfficeController.cs`, `SanctionController.cs`; EF entities `offence`, `sanction`). They are used only to fill drop-downs here.

### Data model

Table `Discipline` (edmx line ~522; EF class `HRProjectDAL/Core/Discipline.cs`):

| Column | Type | Null | Notes |
|---|---|---|---|
| id | int identity | no | PK |
| PersonID | int | no | FK `FK_Discipline_DisciplinePerson` to `Person` |
| IncidentDate | date | no | |
| WhatHappen | nvarchar(250) | no | description of incident |
| ReportedBy | nvarchar(150) | no | free text |
| Decission | nvarchar(250) | no | `""` = case is PENDING; any other text = CONCLUDED |
| DecissionDate | date | no | on create it is the default `0001-01-01` (field is not on the create form) |
| Authority | nvarchar(150) | no | `""` on create |
| sanctionid | int | yes | FK to `sanctions` |
| offenceid | int | yes | FK to `offences` |
| modifiedby | nvarchar(150) | yes | set by proc `updateDisci` (UNCONFIRMED) |
| modifieddate | datetime | yes | same |
| dactive | bit | yes | soft-delete/active flag; both lists filter `dactive == true` |

Procs: `updateDisci(id int, user nvarchar)` called after a successful Edit save (UNCONFIRMED: stamps modifiedby/modifieddate and probably dactive); `deleteDisci(nokid int)` (parameter name is copy-pasted from next-of-kin; UNCONFIRMED: probably sets `dactive = 0`).

Case state is derived from `Decission`, not stored as a status:

| State | Rule | Where |
|---|---|---|
| Pending | `Decission == "" && dactive == true` | `DeciplineController.List` |
| Concluded | `Decission != "" && dactive == true` | `DesciplineHistoryList` |
| Deleted | `dactive` not true (UNCONFIRMED how it is set) | `Delete POST` |

Audit rows (`Tbl_AuditTrail`) are written by hand in Create, Edit and Delete via `AuditServiceImpl.LogAudit` using `AuditAction.CreateDiscipline`, `EditDiscipline`, `DeleteDiscipline` (`Helper/AuditAction.cs`).

Workflow: Initiate (search a rating, create incident, `Decission=""`) -> Pending Cases list -> "Saction And Comment" (Edit: add DecissionDate, Sanction, Decission, Authority) -> case moves to Concluded. Review from Concluded re-opens the same Edit form.

---

## 1. Initiate Incidence

| Item | Value |
|---|---|
| Menu / URL | Disciplinary Action > Initiate Incidence; `GET /Decipline/Index?svcno=` |
| Role | `DisciplinaryActions` |
| Create form | `GET /Decipline/CreateNewIncident/{id}` (id = PersonID), `POST /Decipline/CreateNewIncident` |
| Ajax | none (plain GET and POST forms) |

### Search (Index)

| Label | Name | Type | Required | Rule |
|---|---|---|---|---|
| (heading "Search For Offenders Using Service Number or LastName") | svcno | text | no (but empty returns no rows) | `Person` where `Exittype.Name` in ("A","M","C") AND (`SVC_NO == svcno` OR `LastName == svcno`). EXACT match, not "contains". Same A/M/C filter as the "current officers" search in `EmployeePersonalInfoController` line ~594: only serving ratings can be reported. Meaning of the codes is UNCONFIRMED (exit-type table data). |
| Search | submit | button | | `Index` returns a list only when `svcno` is non-empty. |

Result grid (`_LayoutDesciplineForP`): Official No (SVC_NO), FileName [sic] (FirstName), MiddleName, LastName, Action = link "Create Incident" to `CreateNewIncident/{PersonID}`. No paging.

### Create incident form (`Views/Decipline/CreateNewIncident.cshtml`)

| Label | Property | Input | Required | Options / validation |
|---|---|---|---|---|
| Incident Date | IncidentDate | text, datepicker, shown `dd-MMM-yy`, maxlength 10 | yes (implicit: non-nullable `DateTime`) | none else; future dates not blocked |
| Offence | offenceid | select "Select Offence" | NOT enforced (nullable int; blank allowed) | table `offences` (`GetData()` -> id, Name) |
| What Happen | WhatHappen | textarea | DB says NOT NULL; no `[Required]`, so blank posts as null and the save fails (UNCONFIRMED error path) | max 250 in DB |
| Reported By | ReportedBy | text | same as above | max 150 in DB; free text, not a lookup |
| (hidden) | id, PersonID | | | PersonID comes from the URL |
| Save | submit | button | | |

Commented out (not live): Decission, Decission Date fields.
View model: `Models/DeciplineViewModel.cs`. It contains a `Validate` method (`DecissionDate < IncidentDate` -> "DecissionDate must be greater than IncidentDate"), but the class does not implement `IValidatableObject`, so that rule NEVER runs.

### POST behaviour (`CreateNewIncident`)

1. If `ModelState.IsValid`: build `Discipline` { PersonID, WhatHappen, IncidentDate, ReportedBy, Decission = "", DecissionDate = model default (0001-01-01), Authority = "", offenceid }. `sanctionid` and `dactive` are NOT set (null).
2. `DesciplineService.Insert` (generic repository).
3. Writes an audit row: Action `CreateDiscipline`, UserId = login name, UserIdAffected = the rating's service number (`ipersonService.getEmployeeFullInfo(PersonID).svcno`), IP, browser, URL, Data = serialized model.
4. Redirects to `incidents` (route values taken from the view model, so `id` = 0), which shows "Are you sure you want to Discipline" with Yes (to Pending Cases) and Cancel (link to `CreateNewIncident` with no id: throws, see faults). The incident is already saved before the "Are you sure" page appears.
- Invalid model: redisplays the form (but `GetData()` is not re-run, so the drop-down is empty: fault).

---

## 2. Pending Cases

| Item | Value |
|---|---|
| Menu / URL | Disciplinary Action > Pending Cases; `GET /Decipline/List` |
| Role | `DisciplinaryActions` |
| View | `List.cshtml`, partial `_LayoutDesciplineComment` (title "List of Pending Cases") |
| Query | `db.Disciplines.Where(Decission == "" && dactive == true)`; no paging, no search, no sort |
| Ajax | none |

Grid: Official No (`Person.SVC_NO`), Incident Date, Offence (`offence.Name`), What Happened, Action = link "Saction And Comment" [sic] to `Edit/{id}`. Below the grid: "Export" button -> `GET /Decipline/ExportPenddingDiscipline` (PDF, section 4).

### Edit (sanction and decision) - `GET/POST /Decipline/Edit/{id}` (`Views/Decipline/Edit.cshtml`)

| Label | Property | Input | Editable | Required | Options |
|---|---|---|---|---|---|
| Incident Date | IncidentDate | text | read-only attr | | |
| Offence | offenceid | select | `readonly` attribute on a select does NOT stop changes (can be edited) | | table `offences` |
| What Happen | WhatHappen | textarea | `readonly` | | |
| Reported By | ReportedBy | text | `readonly` | | |
| Decission Date | DecissionDate | text, datepicker `mm/dd/yyyy`, shown `dd-MMM-yy` | yes | yes (non-nullable date) | none; no `>= IncidentDate` check (the `Validate` rule is dead) |
| Sanction | sanctionid | select "Select Sanction" | yes | NOT enforced (nullable) | table `sanctions` where `Name != null` |
| Decission | Decission | textarea | yes | DB NOT NULL, empty posts as null -> save fails | max 250 |
| Authority | Authority | text | yes | same | max 150 |
| Update | submit | button | | | |

POST (`[ValidateAntiForgeryToken]`, `Bind(Include="id,PersonID,DecissionDate,Decission,IncidentDate,WhatHappen,ReportedBy,Authority,sanctionid,offenceid")`):
1. If valid: `db.Entry(diciplin).State = Modified` then `SaveChanges()` (all columns are written, including `dactive`, `modifiedby`, `modifieddate`, which are NOT in the bind list so they are set to null), then `db.updateDisci(id, User.Identity.Name)`, then redirect to `DesciplineHistoryList`.
2. `dactive` is not bound, so the save sets it to null. Both lists need `dactive == true`, so a case would vanish from both lists unless `updateDisci` sets it back (UNCONFIRMED; same question for create, which also leaves it null). Resolve with the domain owner/DB owner before designing the lists.
3. The audit row (`EditDiscipline`) is written ONLY on the invalid-model path (after the `return RedirectToAction` on success), so successful edits are not audited.
- A case becomes "concluded" simply by saving a non-empty Decission. A blank Decission cannot be saved at all (NOT NULL), so there is no "save draft".

---

## 3. Concluded Cases and 4. Disciplinary Report (same page)

| Item | Value |
|---|---|
| Menu | "Concluded Cases" and "Disciplinary Report" both link to `GET /Decipline/DesciplineHistoryList` |
| Role | `DisciplinaryActions` |
| View | `DesciplineHistoryList.cshtml`, partial `_LayoutAllDescipline`; heading "Concluded Cases", breadcrumb "Concluded Cases" |
| Query | `db.Disciplines.Where(Decission != "" && dactive == true)`; no paging/search/filter by date, rating or offence |
| Ajax | none |

Do they differ? NO. There is no second action, view, parameter or filter behind "Disciplinary Report". The menu simply has two labels for one page. The new system should either merge them or build a true report (filters by date range, offence, sanction, rating, with a printout).

Grid columns: Official No (`Person.SVC_NO`), Incident Date, Offence (`offence.Name`), What Happened, Reported By, Decission Date, Sanction (`sanction.Name`), Decission, Authority, Action = "Review" button to `Edit/{id}` (the same edit form as section 2; re-saving changes a concluded case). Date cells print raw `DateTime` text (no format).

### Printouts

| Page | Button | Action | Report file | Loaded how | Data source | Fields |
|---|---|---|---|---|---|---|
| Pending Cases | Export | `ExportPenddingDiscipline` | `Report/CrystalReportForPenddingDiscipline.rpt` | `rd.Load(Server.MapPath("~/Report/CrystalReportForPenddingDiscipline.rpt"))` (folder `Report`, NOT `RDLCReport`) | anonymous projection of ALL `Disciplines` where `Decission == ""` (does NOT apply `dactive`) | id, PersonID, WhatHappen, IncidentDate, ReportedBy, Decission, Official_NO (= `Person.SVC_NO`) |
| Concluded / Report | Export | `ExportDiscipline(int? PersonID)` | `Report/CrystalReportForDiscipline.rpt` | `rd.Load(Server.MapPath("~/Report/CrystalReportForDiscipline.rpt"))` | anonymous projection of ALL `Disciplines` where `Decission != ""` (no `dactive`; the `PersonID` parameter is ignored) | id, PersonID, Official_NO, WhatHappen, IncidentDate, ReportedBy, DecissionDate, Decission, Authority |

- Both export a PDF stream named "Disciplines.pdf" (`CrystalDecisions.Shared.ExportFormatType.PortableDocFormat`). Dataset schema: `Report/DataSetForDiscipline.xsd` (columns id, PersonID, IncidentDate, WhatHappen, ReportedBy, DecissionDate, Decission, Authority, Official_NO). Layout inside the .rpt (headings, grouping) is UNCONFIRMED (binary). Copies of both .rpt exist in `ReportOLD/` (not loaded).
- Offence, Sanction, rating name, rate and ship do NOT appear on either printout (only service number).
- Neither printout is filtered or scoped by the on-screen list.

### Delete (reachable only by typing the URL)

`GET/POST /Decipline/Delete/{id}` (`Delete.cshtml`: "Are you sure you want to Delete ?"). POST calls `db.deleteDisci(id)`, sets `TempData`, redirects to `DesciplineHistoryList`. The audit code after it is unreachable on success. No page links to it.

---

## 5. Faults of the old module that must NOT be copied

| # | Fault | Where |
|---|---|---|
| 1 | No server-side authorization; only the menu hides the pages. | `DeciplineController` |
| 2 | Two menu labels, one page ("Concluded Cases" = "Disciplinary Report"). | `_menu.cshtml` lines ~167-168 |
| 3 | Case state encoded as `Decission == ""` rather than a status column; blank decision is impossible to save. | `List`, `DesciplineHistoryList`, `Edit` |
| 4 | `dactive` is never set on create and is overwritten with null on edit (not in `Bind`), while lists require `dactive == true`. Likely invisible cases unless a proc or trigger repairs it (UNCONFIRMED). | `CreateNewIncident`, `Edit` |
| 5 | `DecissionDate` stored as `0001-01-01` for pending cases. Use null in the new schema. | `CreateNewIncident` |
| 6 | Date rule (decision not before incident) is in a `Validate` method on a class that does not implement `IValidatableObject`. | `Models/DeciplineViewModel.cs` |
| 7 | Null reference errors: `f.offence.Name` and `f.sanction.Name` when offence/sanction is null (both nullable, "Select ..." option allowed). A concluded case without a sanction crashes the whole Concluded list. | `_LayoutDesciplineComment`, `_LayoutAllDescipline` |
| 8 | `CreateNewIncident` invalid POST redisplays without re-running `GetData()` (empty drop-down); the Cancel link on the confirmation page calls `CreateNewIncident` without an id (`id.Value` throws). The "Are you sure" page appears AFTER the record is already inserted. | `CreateNewIncident`, `incidents.cshtml` |
| 9 | `readonly` on a `<select>` (Offence) does not lock it; the edit POST binds `offenceid`, `PersonID`, `IncidentDate`, `WhatHappen`, `ReportedBy` from the client, so the original incident facts can be tampered with. | `Edit.cshtml`, `Edit POST` |
| 10 | Audit gaps: Edit audits only when invalid; Delete's audit is unreachable; `UserIdAffected` lookup can throw before saving. | `Edit`, `Delete` |
| 11 | Exports ignore `dactive` (deleted cases print) and ignore the `PersonID` parameter; "Export" on both pages cannot be filtered. | `ExportDiscipline`, `ExportPenddingDiscipline` |
| 12 | Search is exact match on service number or surname (no partial, no case rules specified) and returns nothing on an empty box. | `Index` |
| 13 | Reported By is free text; Authority is free text. Offences and sanctions are unversioned lookups: editing a name rewrites history. | views, `offences`, `sanctions` |
| 14 | Dead/odd code: `Create(FormCollection)`, `Insert(de, model)`, `GetPerson()`, `incidents POST` do nothing useful; typos in labels (Saction, FileName for first name, "Decission"). | `DeciplineController`, partials |
| 15 | Large pasted template header (fake user/mail menus) in `Edit.cshtml` and `CreateNewIncident.cshtml`. Do not copy. | views |

---

## Hand-off notes for design/build

- Read first: the data model and state table in section 0, then the printout table in section 3/4. The whole module is one table (`Discipline`) plus two lookups; the new schema has none of them yet (`src/db/migrations` has no discipline, offence or sanction tables).
- Suggested new design: `discipline_cases` (service_number FK to `ratings`, incident_date, offence_id, description, reported_by, status enum `pending/concluded/cancelled`, decision_date NULL, sanction_id NULL, decision, authority, created_by, concluded_by, soft-delete) with `ref_offence`, `ref_sanction`. Keep the audit trail on create, edit, conclude and delete.
- Decisions to confirm with the domain owner: who may conclude a case (separate from who initiates); whether a concluded case may be edited (old "Review" allows it); the meaning of exit-type codes A/M/C for "eligible to be reported"; whether the "Disciplinary Report" should become a real report; what `updateDisci` and `deleteDisci` do.
- The rating profile or the discharge module may need to show or check open cases; no link from discipline to discharge, drafting or advancement was seen in `DeciplineController` (other controllers not searched: UNCONFIRMED).
- Risk: the PDF layouts are binary (.rpt) and unread; rebuild from the field lists above.
