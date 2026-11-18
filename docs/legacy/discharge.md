# Legacy map: Discharge Administration (5 live pages)

Source tree: `/home/user/cirems/hpproject` (paths below are relative to it unless prefixed `HRProjectDAL/`). Procedure and view bodies are NOT available anywhere, so everything about them is inferred from the C# that calls them and marked UNCONFIRMED.

## 0. Overview

Menu block `Views/Shared/_menu.cshtml`: `@if (User.IsInRole("Discharge"))`, group "Discharge Administration". Live items (the "Discharge Proposal" and "Discharge Registration" items are inside `@* *@`, so OFF, but the proposal page is still reachable from a button on Process Discharge, see 1.3).

| Menu label | URL | Role | MVC action (`Controllers/DischargeController.cs`) | View |
|---|---|---|---|---|
| Process Discharge | `/Discharge/dischargereview` | `Discharge` | `dischargereview` | `Views/Discharge/dischargereview.cshtml` (title "Discharge Review") |
| Print Service Details | `/Discharge/ServiceDetails` | `Discharge` | `ServiceDetails(SearchCriteria, svcno)` | `ServiceDetails.cshtml` |
| Verification Forms | `/Discharge/Reports` | `Discharge` | `Reports(SearchCriteria, svcno)` | `Reports.cshtml` |
| Discharge Report | `/Discharge/dischargereport` | `Discharge` | `dischargereport` | `dischargereport.cshtml` |
| Upload Discharge | `/Discharge/ExcelUpload` | `Discharge` | `ExcelUpload` (GET), `UploadExcel` (POST), `Download` | `ExcelUpload.cshtml` |

Role enforcement: only the menu is hidden by role. MVC has a global `AuthorizeAttribute` (`Global.asax.cs`, login required) but no `[Authorize(Roles=...)]` on `DischargeController`, and every `DischargeAPIController` action is `[AllowAnonymous]` (so callable without login). Do not copy.

### 0.1 The discharge lifecycle in one table

| Step | Where | What is written |
|---|---|---|
| 1. Propose | `dischargeproposal` page (button "Process Discharge"), or Batch dropdown on Process Discharge | New `discharge` rows, `status`=0 (Pending), `postedby`=logged-in AspNet user id. Done inside procs `migratefromDischarge` / `migratefrompersontodischargeproposal` (bodies unknown, UNCONFIRMED) |
| 2. Process (review) | Process Discharge, row button "Process" then "Save" | `discharge` row updated; if `status`=1 (Closed) the rating is changed (section 0.2) |
| 2b. Remove | row button "Remove" | `discharge` row hard-deleted |
| 3. Report | Discharge Report page | reads view `dischargereport` (rows with `status`=1) |

Status values: `HRProjectDAL/APIModel/Helper.cs: enum DischargeStatus { Pending = 0, Closed = 1 }`; shown by `ISelectServiceImplementation.GetDischargeStatus` -> `api/DropDownAPI/dischargestatus`.

### 0.2 What discharging does to the rating (exact)

Code: `APIServices/IServiceImplementation/IDischargePrepServiceImplementation.cs: updatedischargerecord`, then `HRProjectDAL/APIImplementationRepository/IPersonReportImplementation.cs: updateExit / updateReengagement`, and `IDischargeRepoImplementation.cs: updateSIngleDischarge / updateSIngleDischargeRE`.

There is no separate "former" table. The rating stays in table `Person` (new schema: `ratings`); "former" is a state of `Person.ExitTypeid` (see 0.3). Two branches, chosen ONLY by whether the form field `ReEngagementDateDischarge` is non-empty (not by exit type):

**Branch A: normal exit (re-engagement date empty).**

| Target | Column | Value | Condition | Source |
|---|---|---|---|---|
| `discharge` | `comment` | form Comment | always | `updateSIngleDischarge` |
| `discharge` | `status` | form Status (0/1) | always | same |
| `discharge` | `dischargereason` | form Exit Reason (free text, max 100) | always | same |
| `discharge` | `deathcert`, `condolenceletter`, `evidence`, `swornafidavit` | the 4 document checkboxes | always (see fault F2) | same |
| `discharge` | `dischargedate` | `DateTime.Now` (processing time, NOT the exit date) | always | same |
| `discharge` | `updatedby` | AspNet user id (`ViewBag.UserUpdating` = `AccountController.getLoggedinInfo().AspNetuserID`) | always | same |
| `discharge` | `lengthserviceyr`, `personelage` | client-posted LOS and Age (read-only text boxes) | always | same |
| `discharge` | `dischargetype` | `Int32.Parse(exittypeid)` = `Exittype.id` | always | same |
| `Person` | `dateleft` | `Convert.ToDateTime(ExitDateDischarge)` (page format dd-mm-yyyy) | only if `dischargestatusid == Closed(1)` | `updateExit` |
| `Person` | `ExitTypeid` | `Convert.ToInt32(exittypeid)` | only if Closed | `updateExit` |
| `Person` | `LiveStatus` | `true` | only if Closed | `updateExit` |

**Branch B: re-engagement (re-engagement date non-empty).**

| Target | Column | Value | Condition | Source |
|---|---|---|---|---|
| `discharge` | `comment`, `status`, `dischargereason`, `dischargedate`(=Now), `updatedby`, `lengthserviceyr`, `personelage`, `dischargetype` | as branch A | always | `updateSIngleDischargeRE` |
| `discharge` | `deathcert`, `condolenceletter`, `evidence`, `swornafidavit` | forced `false` | always | same |
| `discharge` | `reengaementdate` (sic) | form ReEngagement Date | always | same |
| `discharge` | `reengagementperiod` | form Period (months) | always | same |
| `discharge` | `approvedby` | form Approved By | always | same |
| `discharge` | `reengagement` | `true` | always | same |
| `Person` | `ExitTypeid` | `exittypeid` | ALWAYS, even when Pending (fault F6) | `updateReengagement` |
| `Person` | `reengagementdate` | ReEngagement Date + `reengagmentperiodvalue` months | only if status Closed | `updateReengagement` |

**Not touched by discharge** (so the new build must decide): `Person.IsActive` (stays as is), `Person.ExitReason` (reason only lives in `discharge.dischargereason`), `Person.LeavingDate`, `Person.Rateid/TitleTypeId`, open drafting row, the user login (`AspNetUsers`), `discharge.dateleft` (column exists, never written by C#; maybe by a trigger or the proc, UNCONFIRMED), `discharge.pid` / `enterymodeid` / `personelserviceyears` (set by the propose proc, UNCONFIRMED). Discharge Pending does nothing to `Person` in branch A.

### 0.3 What "current" and "former" mean (so "moves to Former" can be reproduced)

- `Exittype` table: `id`, `Name` (nvarchar(2) code), `Description` (nvarchar(30)). Seed rows are not in the repo. Codes seen in C#: `A, M, C` = current, anything else = former (`Controllers/EmployeePersonalInfoController.cs` lines 594 and 630: current list `Exittype.Name == "A" || "M" || "C"`, former list the negation; `Controllers/DeciplineController.cs` line 52 uses the same current predicate). `Name == "A"` is the "Still In Service" type: `Controllers/EmployeeController.cs` ~1771 sets `IsActive=true` and keeps `dateleft/ExitReason` only for "A", and sets `IsActive=false`, `dateleft=null`, `ExitReason=""` for every other code. Descriptions seen in page JS: "Re-Engagement", "Death", "Retired", "Still In Service". Codes used by Print Service Details: `X, T, R, M, D, A, S` (descriptions not in repo). The `DischargeType` enum (`HRProjectDAL/APIModel/Helper.cs`: VOLUNTARY=1, COMPULSORY=2, MENTALLY=3, PHYSICALLY=4, MISCONDUCT=5, TRANSFER=6, SNLR=7) is NOT used by the discharge pages; the only discharge type is `Exittype.id`.
- Views `getCurrentPersonel` (PersonID, SVC_NO, names, ExitTypeid) and `getFormerPersonel` (PersonID, SVC_NO, names, ExitTypeName, ExitReason, ExitDate) feed the Current/Former ratings lists (`IPersonReportImplementation.returnListofCurrentPersonsLimited / ...F`); their bodies are unknown, UNCONFIRMED but evidently derived from `Person.ExitTypeid` and `Person.dateleft`.
- Therefore "moves to Former" in the old system = `Person.ExitTypeid` changed to a non-A/M/C exit type + `Person.dateleft` = exit date + `Person.LiveStatus` = 1. Death, Retired etc. all use this path. A Re-Engagement (exit type "Re-Engagement") keeps the person in the table with new `reengagementdate`; whether the person still counts as current depends on the code of that exit type (not in repo, UNCONFIRMED).

Mapping to the new schema (`/home/user/cirerms/src/db/migrations/20261116_090200_create_ratings.sql`): `ratings.status` ENUM('current','former'), `exit_type_id` -> `ref_exit_type`, `exit_date`, `exit_reason` already exist. No `discharge` table or re-engagement columns exist yet (a new table is needed for pending proposals, documents flags, approver, period). `ratings.status` replaces the A/M/C code test; `LiveStatus` has no equivalent and its meaning is UNCONFIRMED (profile saves in `EmployeeController.cs` set it `false`; discharge sets it `true`).

## 1. Process Discharge  (`/Discharge/dischargereview`)

### 1.1 Page layout and fields (`Views/Discharge/dischargereview.cshtml`)

| Label | Control / id | Required | Options / source | Notes |
|---|---|---|---|---|
| Official No (search) | text `#officialno` | no | free text | Button "Search" `#processBTN` has NO handler on this page: dead control (fault F11) |
| Batch | select `SEntrymodeId` in GET form to `Discharge/dischargelistfilte` | `required` | `ISelectService.GetEntryModeS` = table `entrymode` rows as `"{id}_{entryname}"`, preceded by "--Select Batch" (id 0) and "All" (id 0) | submit button "Search" (also id `processBTN`) |
| Add Personel to Discharge | link `#newdischargebtn` | | to `Discharge/dischargeproposal` | opens the proposal page (menu item is OFF) |
| Table `#table6`: SN, Official No, Full Name, LOS, Age, Discharge Type, Reason, Comment, Posted By, Action | DataTable server-side | | AJAX 1.2 | LOS and Age shown as coloured labels (rules 1.5) |
| Row buttons | "Process" -> `loadeditDischarge(dischargeid)`; "Remove" -> `loaddeleteDischarge(dischargeid)` | | | |
| Edit panel (shown by Process): Official No `#svcnoidValue`, Full Name `#nameidValue`, Rate `#rateidValue`, Length of Service `#losidValue`, Age `#ageidValue` | readonly text | | filled from the row | hidden `#dischargeidIDD` |
| Exit Type | select `#exittypeid` | `required` attr only | AJAX `GET api/DropDownAPI/exittype` = `Exittype` rows (Text=`Description`, Value=`id`); blanks and "0" filtered in JS | |
| Status | select `#dischargestatusid` | `required` attr only | AJAX `GET api/DropDownAPI/dischargestatus` = Pending(0) / Closed(1) | JS drops an item named "Still In Service" (never present) |
| Exit Date | text `#ExitDateDischarge`, datepicker `dd-mm-yyyy`, placeholder "Exit Date (dd/mm/yyy)" | not validated | | shown when exit type text = "Death" or "Retired", or when Status = Closed and exit type is not "Re-Engagement" |
| ReEngagement Date | text `#ReEngagementDateDischarge`, datepicker `dd-mm-yyyy` | not validated | | shown only when exit type text = "Re-Engagement" (or Status not Closed, see F8) |
| Period | text `#reengagementperiodvalue` | not validated | months | same panel |
| Approved By | text `#approvebyvalue` | no | free text | always visible |
| Comment | textarea `#commentidValue` | no | | |
| Exit Reason | textarea `#exitreasonidValue` | no | | column max 100 chars, no client limit |
| Documents Available (4 checkboxes): Death Certificate `#dealthcertidValue`, Condolence Letter `#condolenceletteridValue`, Evidence of Payment Of Dependent Fund `#evidenceofdependentidValue`, Sworn Affidavit as Next Of Kin in case of Dead `#swornaffidavitidValue` | checkbox | no | | block shown only when exit type text = "Death" |
| Save | `#SaveIDDischarge` | | AJAX 1.2 `updateDischargeRecord` | |

State machine: row exists Pending (status 0) -> Process -> Save with Status=Closed -> `discharge.status`=1 and rating changed (0.2); Save with Status=Pending only edits the `discharge` row. Closed rows vanish from this page (list is `status==0` only) and appear on Discharge Report.

### 1.2 AJAX and form calls (all JSON, `Content/` scripts jQuery + DataTables 1.10 `sAjaxSource`)

| # | Trigger | Verb URL | Payload | Fills / effect |
|---|---|---|---|---|
| 1 | page load (`loadReviewTable`) | GET `api/DischargeAPI/reviewListofDischargePagedSearch?personage=0&rateid=0&svcno=0&los=0&dischargeid=0` (+ DataTables `sEcho, iDisplayStart, iDisplayLength`) | none | table `#table6`; JSON `GenericList<dischargeReview>`: `sEcho,iTotalRecords,iTotalDisplayRecords,aaData,status,errormessage` |
| 2 | click Process | GET same URL with `dischargeid=N`, `iDisplayStart=0&iDisplayLength=10` | | fills edit panel from `aaData[0]`: `svcno, FirstName/MiddleName/LastName, rate, personelserviceyears, personelage, exittypeid, deathcert, condolenceletter, evidence, swornafidavit, status, dateleft, comment, dischargereason, dischargeid` |
| 3 | click Save | POST `api/DischargeAPI/updateDischargeRecord` (form-encoded) | `swornaffidavitidValue, evidenceofdependentidValue, condolenceletteridValue, dealthcertidValue, exitreasonidValue, commentidValue, ExitDateDischarge, dischargestatusid, exittypeid, dischargeidIDD, reengagementdatevalue, reengagmentperiodvalue, approvebyvalue, ReEngagementDateDischarge, los, age, updatedby(=user id), svcno` | model `dischargeUpdateModel`; response `RResponse{status,errormessage,errorcode}`; `errorcode "200"` -> alert "Updated Successfully" + reload |
| 4 | click Remove (after JS `confirm`) | POST `api/DischargeAPI/deleteDischarge` | `dischargeidIDD, svcno` | writes audit then deletes `discharge` row |
| 5 | page load | GET `api/DropDownAPI/exittype`, GET `api/DropDownAPI/dischargestatus` | | selects |
| 6 | Batch form submit | GET `Discharge/dischargelistfilte?SEntrymodeId=<id_name>` | | see 1.4 |

Server side of #3: `DischargeAPIController.updateDischargeRecord` -> `IDischargePrepServiceImplementation.updatedischargerecord` (rules in 0.2) -> audit row `Tbl_AuditTrail` `Action=AuditAction.UpdateNewDischarge`, `UserId=User.Identity.Name`, `UserIdAffected=svcno`, `Data`=serialised model. Of #4: audit `AuditAction.RemoveDischarge` written BEFORE the delete; `IDischargeRepoImplementation.deleteSIngleDischarge` = `dischargeRepository.Delete` (hard delete, no status check).

### 1.3 The proposal page (`/Discharge/dischargeproposal`, not in menu, reached via "Add Personel to Discharge")

| Item | Detail |
|---|---|
| Controller | `DischargeController.dischargeproposal` sets `ViewBag.getUserLoggedin` = AspNet user id (try/catch swallows failure) |
| Search | Official No `#officialno`; button "Search" -> reloads grid with `svcno=<value>` (exact match) |
| Grid | AJAX `GET api/DischargeAPI/getListofDischargePagedSearch?personage=0&los=0&svcno=0` -> `IDischargeRepoImplementation.getListdueforDischarge` over view `dischargeproposal` (columns PersonID, SVC_NO, personelage, personelserviceyears, BirthDate, commissiondate, reengagementdate, FirstName, MiddleName, LastName, dateleft). Filter: `(svcno=="0" or SVC_NO==svcno) and (personage==0 or personelage==personage) and (los==0 or personelserviceyears==los)`, ordered by PersonID, paged. Who is "due" is decided inside the view (body unknown, UNCONFIRMED); UI colour bands suggest age >= 50 and service >= 20 years |
| Columns | checkbox, Official No, Surname (actually FirstName), Middle Name, Last Name, Age, Length of Service |
| Button "Process Discharge" `#processDischarge` | POST `api/DischargeAPI/submitSelectedDischarge` form fields `svcno`=logged-in user id (misnamed), `valueu`=JSON array of selected `SVC_NO` strings. `performsubmitfordischarge` joins them with commas and calls `context.migratefromDischarge(servicenolist, bypersonid)`; then writes audit `AuditAction.SaveNewDischarge` (its `UserIdAffected` looks up the USER ID as a service number, so it is null: fault F10). On `errorcode "200"` redirects to `dischargereview` |
| Hidden "Add" `#processAddBTN` | commented out in markup; JS exists |

Procedure `migratefromDischarge(servicenolist varchar, bypersonid varchar)`: UNCONFIRMED. Implied: split the comma list, insert one `discharge` row per rating (svcno, pid, postedby=bypersonid, status 0, created/modified now, lengthserviceyr/personelage/personelserviceyears/rate/enterymodeid copied from `Person`).

### 1.4 Batch dropdown ("Search")

`DischargeController.dischargelistfilte(SEntrymodeId, page)`: parses the id before `_`, builds `dischargesearch{entrymode=id, svcno="0"}`, calls `IDischargePrepService.returnListofProposedDischargeLimited` which FIRST runs proc `migratefrompersontodischargeproposal(entrymodeID int, bypersonid varchar)` (UNCONFIRMED: inserts into `discharge` every rating of that entry mode/batch who is due, as Pending, posted by the user) and then reads view `dischargeReview` (`getListdueforDischarges`), result is discarded and the action ALWAYS returns `RedirectToAction("dischargereview")`. So the Batch search is really a "propose the whole batch for discharge" bulk action with a side effect on a GET, then shows the Pending list. The unused view `Views/Discharge/dischargelistfilte.cshtml` (674 lines) is a never-rendered earlier version that calls `api/DischargeAPI/getListofDischargePagedSearchLTD?entrymodeid=` (`returnListofProposedDischargeLimitedPP`, same proc, then view `PropsalForDischargeRate`).

### 1.5 Rules and colour bands

| Rule | Value | Source |
|---|---|---|
| Pending list | view `dischargeReview` rows where `status == 0`, ordered by `dischargeid`; filters `svcno, rateid, personelage, dischargeid, personelserviceyears` each "0 = ignore" | `IDischargeRepoImplementation.getdischargeListforReview` / `...Count` |
| View `dischargeReview` columns read | dischargeid, svcno, dischargetype, postedby, postedbyname, dischargereason, status, dischargedate, comment, personelage, personelserviceyears, FirstName, MiddleName, LastName, rate (nvarchar(5)), deathcert, evidence, condolenceletter, swornafidavit, exittype_discharge (exit type description), exittypeid, dateleft, reengagementdate, rateid, rengagementdateP, dateemployed, lenghtofservicebylastR | edmx entity `dischargeReview` |
| LOS label colour | 20-29 green (`label-success`); 31-34 yellow (`label-warning`); >35 red (`label-danger`); all other non-null values (incl. exactly 30 and 35) blue (`label-primary`) | JS in `dischargereview.cshtml` and `dischargeproposal.cshtml` (boundary bug F12) |
| Age label colour | 50-54 green; 55-59 yellow; >59 red; below 50 no label (blank cell) | same |
| Exit type text drives the form | "Re-Engagement" -> shows re-engagement date/period; "Death" -> shows documents + exit date; "Retired" -> exit date | `$('#exittypeid').change` (compares the visible text) |
| Mandatory documents for death | none enforced; 4 flags only stored | `updateSIngleDischarge` |

### 1.6 Procedures and tables for this page

| Name | Kind | Params as called | Result read | Implied behaviour |
|---|---|---|---|---|
| `migratefromDischarge` | proc (function import, no result) | `servicenolist string, bypersonid string` | none | insert Pending `discharge` rows. UNCONFIRMED |
| `migratefrompersontodischargeproposal` | proc | `entrymodeID int?, bypersonid string` | none | batch proposal into `discharge`. UNCONFIRMED |
| `dischargeproposal` | view | | listed in 1.3 | due list. UNCONFIRMED body |
| `dischargeReview` | view | | 1.5 | pending list with person/exit type joined |
| `PropsalForDischargeRate` | view | | as `dischargeReview` plus `entrymode_discharge` | only used by dead view |
| `discharge` | table | | | columns: dischargeid bigint identity, svcno nvarchar(10), lengthserviceyr, personelage, created, modified (both NOT NULL), postedby nvarchar(128), dischargetype int, rate int, dischargereason nvarchar(100), status int NOT NULL, updatedby nvarchar(128), dischargedate, comment text, deathcert, condolenceletter, evidence, swornafidavit (bits), reengagement bit, reengaementdate, reengagementperiod int, approvedby nvarchar(150), pid int FK `Person.PersonID` (`FK_discharge_Person`), enterymodeid, personelserviceyears, dateleft |
| `Person` | table | read + write | | columns written: `ExitTypeid, dateleft, LiveStatus, reengagementdate` (0.2) |
| `Tbl_AuditTrail` | table | insert | | `LogAudit` |

## 2. Print Service Details  (`/Discharge/ServiceDetails`)

| Item | Detail |
|---|---|
| Controller | `DischargeController.ServiceDetails(SearchCriteria, svcno)`. Only when `svcno` is non-empty it loads `Person` rows with `Exittype.Name in {X,T,R,M,D,A,S}` and (`SVC_NO == svcno` or `LastName == svcno`); otherwise empty list |
| Field | "Search Using Service Number": text `svcno`, GET form, button "Search". Accepts service number OR exact surname |
| Table | headers Official No, FileName (really first name), MiddleName, LastName, Action; rows `SVC_NO, FirstName, MiddleName, LastName`; button "Print Service Details" (POST form with hidden `pid`=`PersonID`) |
| Print | POST `Employee/EmployeeMaster` (action in `Controllers/EmployeeController.cs`, line ~5462, NOT in Discharge) -> loads `~/Report/EmployeeMaster.rpt` (note folder `Report`, not `RDLCReport`) -> PDF "Personel Details.pdf". Data: table `Person` with SVC_NO, LastName, FirstName, MiddleName, BirthDate, GSMNumber; table `AdvanceMent` with fromdate, rate (Rate.rate1), todate (open row uses now) from `promotionshist` for the person. Nothing about ships, discharge, education |
| Procedures | none |
| Commented out in view | three more buttons (Re-engagement form, Retirement Routine, Engagement Form) moved to Verification Forms |

## 3. Verification Forms  (`/Discharge/Reports`)

Page heading: "Print Re - engagement Verification/Retirement Routine/ Engagement Forms".

| Item | Detail |
|---|---|
| Controller | `DischargeController.Reports(SearchCriteria, svcno)`: if `svcno` non-empty, `discharge` rows where `svcno == svcno` (exact, ANY status) via `GenericRepository<discharge>` |
| Field | "Search Using Service Number" text `svcno`, GET form, "Search" |
| Table | header Official No / FileName / MiddleName / LastName / Action (labels wrong, body has svcno + 3 buttons per discharge row) |
| Buttons (POST forms, hidden `svcno`) | "Re-engagement Verifiation Form" -> `dischargeexecuteR`; "Print Retirement Routine" -> `dischargeexecuteRT`; "Print Engagement Form" -> `dischargeexecuteEn` |

| Action | rpt loaded (`ReportDocument.Load`) | PDF name | Data |
|---|---|---|---|
| `dischargeexecuteR` | `~//RDLCReport//CrystalReportForReengagementF.rpt` | "Re-engagement Form.pdf" | `DischargeReportView` list: only FirstName, svcno, rate filled |
| `dischargeexecuteRT` | `~//RDLCReport//CrystalReportForReleaseRoutine.rpt` | "Release Routine.pdf" | same three fields |
| `dischargeexecuteEn` | `~//RDLCReport//CrystalReportForServiceDetails.rpt` (so the rpt named "ServiceDetails" is really the Engagement Form) | "Engagement Form.pdf" | same three fields |
| `dischargeexecute` (no UI: only in a commented-out block of `dischargereview.cshtml`) | `CrystalReportForReengagementF.rpt` | "draft Report.pdf" | dead |

Data query for all three: `idischargeService.getdischargeListforReviewCR(apiSearch, svcno)` -> `IDischargeRepoImplementation.getdischargeListforReviewCR`: view `dischargeReview` where `status == 0` (Pending ONLY) and `svcno == dds.svcno` (the method's `svcno` parameter is ignored; the model binder fills `apiSearch.svcno` from the same posted field). Dataset schema for these rpts (`RDLCReport/DataSetForEngagementForm.xsd`, table `DataTableForEngagement`; `DischargeDataSet.xsd` table `DischargeDate`): svcno, FirstName, rate, lengthserviceyr, rengagementdateP, lenghtofservicebylastR, dateemployed. The `.rpt` files are compressed binaries; layout, labels and parameters are not readable (UNCONFIRMED which of these fields each form prints). Only the first three are populated, so dates and service lengths cannot appear.

## 4. Discharge Report  (`/Discharge/dischargereport`)

| Item | Detail |
|---|---|
| Controller | `DischargeController.dischargereport()` returns the view only |
| Grid | `GET api/DischargeAPI/reportListofDischargePagedSearch?personage=0&svcno=0&los=0&dischargeid=0&renengagemnet=0&rateid=0&dischargetype=0` -> `idischargeService.getdischargeListforReport` -> `IDischargeRepoImplementation.getdischargeListforReport`: view `dischargereport` where `status == 1` (Closed) and `(svcno=="0" or svcno==)` and `(rate==0 or rateid==)` and `(dischargetype==0 or dischargetype==)` and `(rengagement==2 or reengagement==rengagementVal)` and age/LOS/dischargeid "0 = ignore"; ordered by `dischargeid`, paged. Service maps `rengagement` 0 -> `rengagementVal=false`, 1 -> `true`, 2 -> no filter |
| Columns | SN (`#`), Official No, Full Name, LOS (`personelserviceyears`), Age, Discharge Type (`exittype_discharge`), Rate, Reason, Comment, Posted By (`postedbyname`) |
| View `dischargereport` columns | those of `dischargeReview` plus `postedby, lengthserviceyr, page, updatedby, reengagement bit, reengagementdate, dateemployed, lenghtofservicebylastR, rengagementdateP` |
| Official No box + "Process" | text `officialnoid`; JS `search()` is copy-pasted from the drafting report: reads `#signalcodeid, #batchnoid, #departmentid, #newdepartmentid, #personelnameid` which do not exist (JS error) and would call `api/DraftingAPI/getDraftingReportbyBatch` (fault F7). No working filter on this page |
| "Print Report" | POST (empty form) `Discharge/dischargerateexecute` -> `getdischargeListforReportCR` (all Closed, same filters, defaults) -> loads `~//Report//CrystalReportForDischargeRats.rpt` (folder `Report`, a copy also in `ReportOLD`) -> PDF "Discharge Report.pdf". Fields passed (`DischargeReportView`): FirstName (first name only), svcno, rate, lengthserviceyr (`Convert.ToInt32`), dateemployed (string). Not printed: exit type, reason, date, comment |
| Hidden form | a form to `dischargeexecuteR` with hidden `svcno` exists but nothing submits it |

## 5. Upload Discharge  (`/Discharge/ExcelUpload`)

| Item | Detail |
|---|---|
| View | `ExcelUpload.cshtml`: notes "Duplicate record will not be Uploaded" and "All dates must be in a correct date format"; file input `FileUpload`, button "Upload File" (JS blocks empty file); shows `ViewBag.Message` and `ViewBag.trainl` ("N Rows was added") |
| Template | `Download()` serves `App_Data/UploadFormat/Discharge.xlsx`, but that file does NOT exist in the repo and the view has no link to Download. None of the 10 templates in `App_Data/UploadFormat` is the discharge one: `CndFormat*.xlsx`, `bands 29ak.xlsx` (new ratings), `NNDoc.xlsx`, `adva.xlsx` (advancement), `traininexcel.xlsx` (training), `BATCH 27 NOMINAL ROLL.xlsx`, `Draft6.xlsx` (drafting; closest sibling: SER, Name, Rate, Sex, Svc_No, Present_Ship, DOJ, Authority, Draft_To, WEF, REMARKS). Discharge layout is therefore derived from the entity `tbl_uploadexceltodischarge` that LinqToExcel maps by column name |
| Expected header (sheet name must be `Sheet1`) | `name, title, sex, svcno, presentship, DOJ, authority, exittype, comment, entrymode, WEF, approvedby` (also mappable: `dischargeid`, `User`; `dischargeid` is read only to label error lines) |
| Staging table `tbl_uploadexceltodischarge` | dischargeid bigint identity, name nvarchar(150), title nvarchar(50), sex nvarchar(5), svcno nvarchar(50), presentship nvarchar(50), DOJ datetime, authority nvarchar(50), exittype nvarchar(50), comment nvarchar(50), entrymode nvarchar(50), WEF datetime, approvedby nvarchar(140), User nvarchar(140) |

Import steps, `DischargeController.UploadExcel` (POST):

| # | Step | Detail |
|---|---|---|
| 1 | File checks | not null; `ContentType` is `application/vnd.ms-excel` or the OOXML type; name ends `.xlsx`; else messages "Please choose Excel file" / "Only Excel file format is allowed" / "This file is not valid format" |
| 2 | Save | `SaveAs(App_Data/UploadFormat/ + original file name)` (overwrites any file of that name, including the templates; fault F14) |
| 3 | Pass 1 (validate every row with non-null `svcno`) | `Person.SVC_NO` exists; `Departments.Description == presentship` exists (ships are in table Department); `Exittypes.Description == exittype`; `TitleTypes.Name == title` (the "rate" is a TitleType); `entrymodes.entryname == entrymode`. First failure aborts with e.g. "Line {dischargeid}{svcno} ) Official Number is not Valid", "... Present Ship does not Exist", "... Exit Type Name does not Exist", "... Rate does not Exist", "... Enetery Mode Name does not Exist". The line label uses the sheet's `dischargeid` cell, not the row number |
| 4 | Pass 2 (write, one call per row, no transaction) | `Convert.ToDateTime(WEF)` and `Convert.ToDateTime(DOJ)` (throw on blank); `db.UploadExcelTodischarge(name, title, sex, svcno, presentship, DOJ, authority, exittype, comment, entrymode, exitdate=WEF, rengagementdate=DateTime.Now, approvedby, user=User.Identity.Name)`; return int <= 0 -> message "Hello User, Found some duplicate Official Number" and the row is skipped; > 0 -> `ViewBag.trainl` = count of ALL rows in `tbl_uploadexceltodischarge` + " Rows was added" and message "Successful upload records" (last row wins) |
| 5 | Null `svcno` row | in pass 2 the `else` branch returns "<svcno>Some fields are null, Please check your excel sheet" and stops, after earlier rows were already written (blank trailing rows trigger this) |

Procedure `UploadExcelTodischarge` (14 params above, returns int): body UNCONFIRMED. By its name and the entity it at least inserts the row (with `User`) into `tbl_uploadexceltodischarge`; whether it also creates a Closed `discharge` row and updates `Person` (`ExitTypeid` from `exittype`, `dateleft` = exitdate, `reengagementdate`) is NOT visible. The new build must define this itself: recommended behaviour = for each valid row, perform the same Closed-discharge update as 0.2 branch A (or B when a re-engagement date is given), inside one transaction, with per-row error report.

## 6. Printouts summary (this module)

| Page / button | Action | rpt (folder) | Loaded by |
|---|---|---|---|
| Print Service Details | `Employee/EmployeeMaster` | `EmployeeMaster.rpt` (`Report/`) | `EmployeeController.EmployeeMaster` |
| Verification Forms: Re-engagement | `dischargeexecuteR` | `CrystalReportForReengagementF.rpt` (`RDLCReport/`) | `DischargeController.dischargeexecuteR` |
| Verification Forms: Retirement Routine | `dischargeexecuteRT` | `CrystalReportForReleaseRoutine.rpt` | `DischargeController.dischargeexecuteRT` |
| Verification Forms: Engagement Form | `dischargeexecuteEn` | `CrystalReportForServiceDetails.rpt` | `DischargeController.dischargeexecuteEn` |
| Discharge Report: Print Report | `dischargerateexecute` | `CrystalReportForDischargeRats.rpt` (`Report/`) | `DischargeController.dischargerateexecute` |
| (dead) | `dischargeexecute` | `CrystalReportForReengagementF.rpt` | no UI |

Other outputs: DataTables "copy/excel/pdf/csv" buttons are configured (`buttons:`) but the `dom` string puts them in `bottom` and no export plugin scripts are verified, UNCONFIRMED. Full rpt inventory is in `reports.md`.

## 7. Faults of the old pages that must NOT be copied

| ID | Where | Fault |
|---|---|---|
| F1 | `DischargeController.dischargelistfilte` | A GET with a database side effect (bulk-proposes a batch), result discarded; "All" and "--Select Batch" both have id 0 so choosing either runs the proc with 0 |
| F2 | `dischargereview.cshtml` Save | `$('#dealthcertidValue').val()` etc. on a checkbox always posts the string "on" (never `true/false`), so the four document flags are not reliably stored; use `.prop('checked')` |
| F3 | `DischargeController.dischargeexecute*`, `dischargerateexecute` | `if (apiSearch == null) { apiSearch.svcno = ... }` is a guaranteed NullReferenceException branch; `getdischargeListforReviewCR` ignores its `svcno` argument |
| F4 | Verification Forms | Lists discharge rows of any status but the forms read only Pending ones, so a Closed discharge prints an empty PDF; only first name, service no and rate are sent to the rpt |
| F5 | Print Service Details / Verification Forms | Column headers say FileName/MiddleName/LastName for first name; heading text typos ("Verifiation"); "Print Service Details" prints the Employee master sheet, while the rpt called ServiceDetails is the Engagement Form |
| F6 | `IPersonReportImplementation.updateReengagement` | Sets `Person.ExitTypeid` even when the discharge is still Pending |
| F7 | `dischargereport.cshtml` | Process button runs drafting-report JS on missing elements; page filters never work; page hard-codes `renengagemnet=0`, so re-engaged discharges (`reengagement` true) can never be listed and rows with NULL `reengagement` are excluded by the SQL equality (UNCONFIRMED) |
| F8 | `dischargereview.cshtml` status change handler | Choosing any status other than Closed shows the re-engagement panel; a user who fills the re-engagement date with exit type Death is silently routed to branch B because the branch is chosen by the date field, not by exit type |
| F9 | `IPersonReportImplementation.updateExit` | `Convert.ToDateTime(ExitDateDischarge)` throws on empty or non-matching culture (the page sends `dd-mm-yyyy`); no server validation that exit date is present, not in the future, after DOJ; `Person.IsActive` and `Person.ExitReason` are not updated |
| F10 | `DischargeAPIController.submitSelected` | Payload field `svcno` carries the USER id; audit `UserIdAffected` is looked up with it and ends up null; the page alerts "Adding Record Failed" if the audit step throws although rows were already inserted |
| F11 | `dischargereview.cshtml` | "Search" by Official No has no handler; the grid is never filterable by service number |
| F12 | LOS colour JS | Boundaries `>30`, `>35` skip exactly 30 and 35 (render blue); proposal grid and review grid duplicate the logic |
| F13 | `DischargeAPIController` | All actions `[AllowAnonymous]`; no role check; `deleteDischarge` deletes any id (also Closed rows, whose effect on `Person` is not reverted); client-supplied `los` and `age` and `updatedby` are trusted; audit written before delete and before the proc can fail |
| F14 | `DischargeController.UploadExcel` | Saves under the client file name into `App_Data/UploadFormat` (overwrite of templates, path risk); no transaction; partial writes on failure; error line number is the sheet's own `dischargeid`; `Convert.ToDateTime` crashes on blank dates; "rows added" counts the whole staging table; message variable overwritten per row; template download file missing and not linked; staging table never cleaned |
| F15 | `DischargeController.ServiceDetails`/`Reports` | Exact-match search only; `x.LastName == svcno` branch of the filter is unreachable for empty input; `GetByQuery(...).ToList()` loads with lazy joins per row; Exittype code list `X,T,R,M,D,A,S` hard-coded |
| F16 | audit | Re-processing a Closed discharge is not blocked at API level (the UI hides it) |

## 8. Hand-off notes for design/build

1. Read first: sections 0.2 and 0.3 (rating change) and section 1.3/1.4 (proposal), then decide the new table for pending proposals; the new `ratings` table already has `status`, `exit_type_id`, `exit_date`, `exit_reason`.
2. Decisions the build must take, because the old code is ambiguous: (a) what makes a rating "due" (age/LOS thresholds are only colour hints; the real rule lives in unreachable view `dischargeproposal`); (b) the meaning of `LiveStatus`; (c) which exit types keep a rating current (A/M/C test) versus former; (d) whether re-engagement keeps status current; (e) what the discharge upload writes (procedure body unknown); (f) a real template file (`Discharge.xlsx` header in section 5).
3. Suggested clean flow: Propose (select due ratings, pending) -> Process (exit type, exit date, reason, documents, approver; Closed sets `ratings.status='former'`, `exit_type_id`, `exit_date`, `exit_reason`, in one transaction, audit with the real service number) -> Reports.
4. Risks: Crystal rpt layouts are unreadable (compressed), so the printouts must be redesigned from the field lists in sections 3 and 4 and the sample PDFs, if any exist; verify with the users what each form must show (re-engagement verification, retirement/release routine, engagement form).
5. Procedures to re-specify from scratch: `migratefromDischarge`, `migratefrompersontodischargeproposal`, `UploadExcelTodischarge`; views `dischargeproposal`, `dischargeReview`, `dischargereport`, `PropsalForDischargeRate`.
