# Legacy map: Drafting (10 live pages of the menu "Drafting")

Old code root: `hpproject/` (web), `HRProjectDAL/` (data). Paths below are relative to those. "UNCONFIRMED" = inferred, because procedure/view bodies are not available anywhere (see section 0.3).
Out of scope: Special Draft (`SpecialDraft`, `specialdraftinglist`), Training Drafting, Advancement. But see 0.4: the page "Upload Draft" writes to the Special Draft table.

## 0. Read this first

### 0.1 Pages, menu and privilege (`Views/Shared/_menu.cshtml`)

| # | Menu label | URL (controller/action) | `IsInRole` | Section |
|---|---|---|---|---|
| 1 | Update Manning Requirement | `ShipRequirement/viewrequirement` | `SystemAdministration` | 1 |
| 2 | Print Draft Proposal | `draftings/draftlistfilters` | `Drafting` | 2 |
| 3 | Review/Print Draft | `draftings/draftreview` | `Drafting` | 3 |
| 4 | Draft Approval | `draftings/draftapproval` (+ detail `draftings/draftingreportByDept?specid=`) | `SystemAdministration` | 4 |
| 5 | Close Draft | `draftings/closedraftreview` | `SystemAdministration` | 5 |
| 6 | Upload Draft | `draftings/ExcelUpload` | `SystemAdministration` | 6 |
| 7 | Update WEF | `draftings/draftenddate` | `SystemAdministration` | 7 |
| 8 | Batch/Signal Content | `draftings/summaryreport` (+ detail `draftings/draftingreport?batchno=`) | `SystemAdministration` | 8 |
| 9 | Rate DOD History | `draftings/draftingreportindividual` | `SystemAdministration` | 9 |
| 10 | Draft Report | `draftings/draftingreportList` | `SystemAdministration` | 10 |

Faults common to all 10 (do not copy): neither `draftingsController` nor `ShipRequirementController` has `[Authorize]` or any `IsInRole` check, and `Web.config` has no `<authorization>`; the role only hides the menu item. Every Web API action used (`DraftingAPIController`, `PersonelController`, `DropDownAPIController`) is `[AllowAnonymous]`. So any caller can read the drafting data and call `updateNewShip`, `updateDraftApprove`, `updateDraftDate`, `deleteShipR`.

### 0.2 Live vs dead code

| File | Status | Evidence |
|---|---|---|
| `Controllers/draftingsController.cs` | LIVE | in `HPProject.csproj` (line 348) |
| `Controllers/draftingsControllerXX.cs` | DEAD (older copy, same class name `draftingsController`, so it cannot compile with the live one) | not in `HPProject.csproj`. Only trace: the live view `summaryreport.cshtml` posts to action `summaryreportexecute`, which exists only in the XX file, so "Generate PDF" on page 8 is a 404 |
| `Controllers/ShipRequirementController.cs` | LIVE | |
| `APIController/DraftingAPIController.cs` | LIVE (many actions inside are dead stubs, see 11) | csproj line 297 |
| `APIServices/IServiceImplementation/IDraftingPrepServiceImplementation.cs` | LIVE, thin pass-through to the repository; swallows every exception into `SystemException(AppSettings["erroraccessingpersonelreport"])` | |
| `APIServices/IServices/IDraftingPrepServiceXX.cs`, `HRProjectDAL/APIImplementationRepository/IDraftingRepoImplementationXXX.cs`, `APIIRepository/IDraftingRepoXX.cs` | DEAD | not in the csproj files |
| `HRProjectDAL/APIImplementationRepository/IDraftingRepoImplementation.cs` | LIVE (note: it also holds Training and Special Draft methods) | |
| `Controllers/draftingsController.cs: draftlistexecuteALL, draftlistexecuteR, draftlistexecuteP, savenewshipdraft, addnewSpecialDraft..` | `draftlistexecuteALL` loads `~/Report/CrystalReportLocalGovt.rpt`, a file that does not exist; `draftlistexecuteR/P` and `savenewshipdraft` are not called by any view | grep of `Views/` |

### 0.3 The big gap: the rules are in the database
No C# code (and no `Web.config` key) contains the "who is due" rule, the months threshold, sea/shore rules, or the manning-requirement check. They sit in SQL views/procedures whose bodies are not available:
- Views read by C# (EF entity = view, definition not known): `retrievefordrafting` (people due), `retrieveDraftingNotUpTo` (see 2.5), `retrieveDraftToAddUpPerson`, `retieveDraftProposalDRAFTTB` (a draft's rows joined with names), `draftingReport` (drafting rows + names, for reports), `batchSummaryView`, `shiprequirementreport`, `getEmploymenthist`.
- Procedures: see 12.
What the C# does tell us about "due" (all UNCONFIRMED as a rule): see 2.4.

### 0.4 How the pages chain (the real workflow)

```
(1) Manning requirement (shiprequirement)  -- standalone list; no C# reads it for the draft (see 1.5)
(2) Proposal search  --> creates BatchRecord (status 0) + drafting rows (proc)        [Drafting officer]
(3) Review           --> per row: Proposed Ship, Vice/Deployment, Remark; add/remove people; Clear Draft
(4) Approval (per Department = specid, NOT per batch): approver rank, name, appointment [SystemAdministration]
(5) Close (one Authority/signal no. + close date) --> BatchRecord status 1, signalCode  [SystemAdministration]
(7) Update WEF  (only batches status=1 with signalCode) --> drafting.reportdate ("reported") per row or whole Department
(8)(9)(10) reports: batch/signal content, history per official number, draft list + PDF/Excel
(6) Upload Draft: NOT part of the chain; writes SpecialDraft (out of scope table)
```
Status of a batch: `BatchRecord.status` 0 = OPEN, 1 = CLOSED (`Views/draftings/summaryreport.cshtml` render: 1 = CLOSED, 0 = OPEN). A draft row is "pending" while `drafting.reportdate IS NULL AND drafting.signalCode IS NULL` (`IDraftingRepoImplementation.cs: fetchsummaryByDept`); it is "reported" once the WEF is saved (`fetchOtherRecordforSummary*` returns totalposted = "Reported Personel", totalnotposted = "Not Reported Personel", see column headers in `summaryreport.cshtml`).

### 0.5 Vocabulary traps (the UI labels do not match the tables)

| UI word | Really is | Table / source |
|---|---|---|
| Branch | trade branch (`busdesc`, code `busline`) | `branch` (`ISelectService.GetBranchS`, value = `id_busline`) |
| Department (page 2, 7, 4, 5, 10 headers) | the person's specialisation area | `Specializationarea` (`id`, `sp_code`, `sp_desc`); `drafting.specid`, `AspNetUsers.specid`, `BatchRecord.specid` all point here |
| Department / Ship / "Old Ship" / "Proposed Ship" (page 3, 7, ship requirement) | a ship or shore unit | `Department` (`Id`, `Name`, `Description`, `LandSea` in {Land, Sea, Training}, `commandid`) |
| Rate (page 2) | a rating category | `Rate` (`id`, `rate`, `Description`; EF property `rate1`); `GetRatingS` value = `id_rate` |
| Rate (upload, history) | a rank name | `TitleType` (`TitleTypeId`, `Name`, `Description`) |
| WEF / "reported" | `drafting.reportdate` | |
| Authority / Signal | `BatchRecord.signalCode` (set at Close); `drafting.signalCode`; `drafting.fSignalCode` = authority of the person's previous (first) draft shown in "Authority" column of pages 2/3 | |

### 0.6 Mapping to the new schema (`src/db/migrations`)
New: `ref_ship` (old `Department`), `ref_rate` (old `Rate`; `ratings.rate_id`), `ref_title` (old `TitleType`; `ratings.title_id`), `ref_branch`, `ref_specialisation`, `ref_mother_base`, `ratings` (`branch_id`, `specialisation_id`, `seniority_date`, `date_employed`), `rating_drafting` (`service_number`, `ship_id`, `rate_id`, `start_date`, `end_date`, `remarks`). The new schema states "current ship is NOT stored on `ratings`: it is the open `rating_drafting` row". Old equivalents: `Person.Departmentid` (current ship) and `employmenthist` (history). Missing in new schema and to be created for Drafting: manning requirement, draft batch, draft row (proposal), approval, signal/authority, special-draft table (for upload, see 6).

---
## 1. Update Manning Requirement

### 1.1 Entry points
Menu "Update Manning Requirement", `ShipRequirement/viewrequirement`, role `SystemAdministration`. Page title shown: "Ship Requirement Report" (label mismatch with menu).

| Verb / route | Code | Purpose |
|---|---|---|
| GET `ShipRequirement/viewrequirement` | `ShipRequirementController.viewrequirement` | list page; `ViewData["spec"]` = `GetDepartment` (ships; Text=Value=`Department.Name`) |
| GET `ShipRequirement/openrequirement`, POST (anti-forgery) | `openrequirement` | Add New |
| GET `ShipRequirement/updaterequirement/{id}`, POST | `updaterequirement` | Edit |
| GET `ShipRequirement/deleterequirement/{id}` | `deleterequirement` | NOT used by UI (UI uses the API below) |
| POST `ShipRequirement/ShipRequirementlistexecute` | `ShipRequirementlistexecute` | "Print Ship" PDF |
| POST `ShipRequirement/ShipRequirementlistexecutebydept` | `ShipRequirementlistexecutebydept` | "Print Report" in modal PDF |
| GET `api/Personel/getListofShip?officialno=` (DataTables server-side) | `APIController/PersonelController.cs: returnListofCurrentPersonsLimitedShip` | fills the list (param is named `officialno` but carries the ship text) |
| POST `api/Personel/deleteShipR` body `sn`, `createdby` | `PersonelController.deleteShipR` | Delete |
| GET `api/DropDownAPI/ratines` | `DropDownAPIController.ratines` | fills Rate in Add form (`GetRating(0)` = `Rate` table, drops id 0) |
Unused: `getspec`, `shiprequirementbydept` view, `api/DraftingAPI/getShipReqReportList`.

### 1.2 Fields
List filter: "Ship" text (`shipname`, contains-match on `shiprequirementreport.shipname`; "0" = all); buttons Add New, Search, Print By Department (modal with Department select = ships, Value = `Department.Name`), Print Ship. List columns: SN (always shows "#"), Ship, Rate, Specialization, Quantity, Action (Edit, Delete with `confirm`).
Add/Edit form (`Views/ShipRequirement/openrequirement.cshtml`, `updaterequirement.cshtml`; model `Models/shiprequirementViewModel.cs`):

| Label | Input | Required | Options from | Validation |
|---|---|---|---|---|
| Ship/Department | select `shipcode` | HTML `required` on Add; not on Edit | `Department` (Value = `Id`) via `GetDepartment` | none server side (`shipcode` int, defaults 0) |
| Rate | select `rank` (filled by AJAX, Add) | required | `Rate` table (Value = `Rate.id`, Text = `rate`) | `[Required]` "Rank is required" |
| Specialization | select `specialization` | required | `Specializationarea` (Value = `id`) via `UtilityClass.GetSpecializationArea` | `[Required]` "Specialization Area is required" |
| Quantity | text `quantity` | required | free | `[Required]` int; no min/max check |

### 1.3 Table `shiprequirement` (`sn` bigint PK; `shipcode` nvarchar(5); `rank` nvarchar(50); `specialization` nvarchar(50); `quantity` int; `quantitysupplied` int; `quantityremain` int; `postingstatus` int; `createdby` nvarchar(50); `datecreated`; `period` nvarchar(15))
Ids are stored as strings. Insert (`openrequirement` POST): maps view model, sets `createdby = ""`, `datecreated = now`; `quantitysupplied`, `quantityremain`, `postingstatus`, `period` stay 0/null. Update (`updaterequirement` POST) changes only `quantity`, `shipcode`, `rank`, `specialization`. Delete = physical delete of the row.
View `shiprequirementreport` columns: `sn, shipcode, rank, specialization, quantity, shipname (Department.Name), shipdesc (Department.Description), ratename (Rate), speccode, specdesc` (body UNCONFIRMED; joins implied by column names).

### 1.4 Rules and uniqueness
No duplicate check (the check `sn/rank/specialization/postingstatus == 0` is commented out in `openrequirement`). One row = (ship, rate, specialisation) -> quantity (the complement). `quantitysupplied`, `quantityremain`, `postingstatus` are never read or written by any C# (only referenced in a commented line), so "supplied/remaining" is not computed here.

### 1.5 Does the requirement drive "who is due"?
Not in C#: no draft query reads `shiprequirement`. It may be read inside `migratefromEmplHistToDraft` (UNCONFIRMED). The only other trace of "complement" is a constant text `"COMPLEMENT"` written into the Excel export (`draftingsController.cs: DownloadExcel`, column J). Treat the manning requirement as a stand-alone register until the owner says otherwise (open question Q1).

### 1.6 Printouts
`RDLCReport/CrystalReportShipRequirement.rpt` loaded by both print actions (`Server.MapPath("~//RDLCReport//CrystalReportShipRequirement.rpt")`); dataset `DataSetForShipRequriement.xsd` fields: `shipname, ratename, quantity, specialization`. Output PDF "ShipRequirement Report.pdf".
- "Print Ship": `returnListofCurrentPersonsLimitedShipCR`: `shipname == typed text` (exact), or all if "0".
- "Print By Department": `...CR2`: `shiprequirementreport.shipdesc == spec`, where `spec` = the ship NAME.

### 1.7 Faults not to copy
- Print By Department compares `shipdesc` (Description) with `Department.Name` (`ShipRequirementController.viewrequirement` option values vs `IPersonReportImplementation.cs: returnListofCurrentPersonsLimitedShipCR2`): returns nothing or wrong rows.
- Search is "contains" but Print Ship is "exact": a partial name prints an empty report. `ShipRequirementlistexecute` dereferences `apiSearch` when null (`apiSearch == null` then `apiSearch.shipname`).
- `deleteShipR` audits using `ipersonService.getEmployeeFullInfo(ship.sn).svcno` (treats the requirement id as a PersonID) and takes the user name from the client (`createdby` posted by the page) (`PersonelController.deleteShipR`); the service swallows all exceptions (`IPersonServiceImplementation.deleteShipR`), so failed deletes still say success. After delete the page calls undefined `reloadNextofKinTab()`.
- Delete link is a plain GET anchor with `onclick` AJAX; `createdby` always empty on insert; no audit on add/edit; no duplicate rule; no positive-quantity check; the list's count API (`returnCuurentPRecordCount`) counts persons, not requirement rows (DataTables paging wrong).
- Labels: menu "Update Manning Requirement" vs page "Ship Requirement Report"; "Rate" select is named `rank`; "SN" column prints "#".

---
## 2. Print Draft Proposal (who is due)

### 2.1 Entry points
Menu "Print Draft Proposal" -> GET `draftings/draftlistfilters` (`SBranchId`, `SSpecilization`, `SRankDropDown`, `page`). Role `Drafting`. Page title: "Draft Proposal". Audit action `DraftProposal` is written on every request.
There is NO print button on this page and no rpt. The only effect of "Print" in the name is the batch it creates (a draft officer then prints from page 3). Its DataTables script is dead (button id `processBTN` but script binds `#procewssBTN`; points to `api/DraftingAPI/getListofDraftPagedSearch`, not used).

### 2.2 Fields

| Label | Input | Required | Options | Notes |
|---|---|---|---|---|
| Branch | select `SBranchId` | yes | `GetBranchS`: "--Select Branch", "All" (id 0), then each `branch`; value `id_busline` | `0_...` = all |
| Department | select `SSpecilization` | yes | `GetSpecializationAreaS(user.specid)`; value `id_sp_code` | user's `AspNetUsers.RolenameID == 7` -> specid forced to 7 and the list is ALL departments; any other user: ONLY the user's own `Specializationarea` row plus "--Select Department" and "All" (id 0, value `0_`) |
| Rate | select `SRankDropDown` | yes | `GetRatingS`: "--Select Rate", "All", then each `Rate`; value `id_rate` | |
| (button) Search | GET submit | | | all three must be non-empty or nothing is searched |
Result columns (all from `retieveDraftProposalDRAFTTB`): Name (`LastName` only), Rate (`rate`), Official No (`svcno`), Sex (`sexname`), Last Ship 1 (`formerdepartname`), Last Ship 11 (`lastdepartname`), Current Ship (`departmentname`), DOJ Ship (`fromdate`), Authority (`fSignalCode`), Duration on Current Ship (`noofmonths`, colour badge).

### 2.3 What a search does (it is a write)
`draftingsController.draftlistfilters` -> `IDraftingPrepServiceImplementation.returnListofProposedDraftLimitedD`:
1. `period = "DOD" + month + year` (no zero pad, e.g. `DOD112026`).
2. `batchcode = String.Format(AppSettings["DraftindBatchPrefix"] = "DOD-{0}{1}{2}-", branch busline, dept sp_code, rate code)`, e.g. `DOD-<busline><sp_code><rate>-`.
3. `verifyOpenBatch(batchcode)`: `BatchRecord` with `batchcode == code AND status == 0`, newest first (`IBatchCreationImplementation.cs`). If found, REUSE it (whoever created it) and return its rows (`returnListofProposedDraftD`, filtered by batch, plus `specialization == spec` when `spec > 0`).
4. If none: take the latest CLOSED batch of that `batchcode` (`status == 1`, highest `id`); sequence = number after the prefix + 1, left-padded to 6 digits; first ever = `000001`. Batch number = `batchcode + sequence`, e.g. `DOD-XXYYZZ-000001`. Sequence is per (branch, department, rate), not global.
5. Only if `retrievefordrafting` (filtered by rate/branch/specialization, `0` = all) returns MORE THAN 1 person (`Count > 1`): `CreateBatchRec(batchnumber, "DOD Draft for Department and Rate", initiatedby = logged-in AspNetUserID, batchcode, dept_rank = "branch_spec_rank", specid, draftofficer = user name, draftperiod)` then `migratefromEmplHistToDraft(batchnumber, branch, spec, rate, user, period)`; then read back the batch's rows. With 0 or 1 person due, no batch and an empty list.

### 2.4 Who is due: what is known
- Population = rows of view `retrievefordrafting` (columns: `PersonID, serviceno, personfname/mname/lname, branchid, rateid, specialization, departmentid/departmentname (current ship), fromdate (date joined current ship), noofmonthsspent, statename, exittypename, appntmentname, dateemployed, ratename, sexname, rate`), filtered ONLY by rate, branch, specialization (`IDraftingRepoImplementation.returnListofProposedDraft`). The due test (threshold in months, sea/shore, state/exit exclusion) is inside the view body: UNCONFIRMED, not recoverable from the code.
- Hints, none authoritative: the display band (2.6); `Department.LandSea` in {Land, Sea, Training} (`Views/Ships/CreateDepartment.cshtml`), a likely input for sea/shore durations (UNCONFIRMED); `noofmonths` copied into `drafting.noofmonths` at batch creation; the dead script uses 18..20 as the first band.
- Ask the owner (Q2): the months at sea, months ashore, per rate group, exclusions (state, exit), and whether manning requirement/complement is checked.

### 2.5 The other two "due" views (used only to ADD a person on page 3)
`retrieveDraftingNotUpTo` (same columns as `retrievefordrafting` plus `specid`; name suggests "people not yet due") is searched first; if no hit `retrieveDraftToAddUpPerson` (people with no usable history? UNCONFIRMED) is used. So an officer can add a person who is not yet due, manually, from page 3.

### 2.6 Duration colour band (`Views/draftings/draftlistfilters.cshtml`, `draftreview.cshtml` same code)
| `noofmonths` | Badge |
|---|---|
| < 10 or null | nothing shown |
| 10 to 20 | green (label-success) |
| 21 to 24 | amber (label-warning) |
| > 24 | red (label-danger) |
(The dead JS in the same pages uses 18-20 / 21-24 / >24.) Months are whole numbers computed by the DB.

### 2.7 Faults not to copy
- A GET search creates records (batch + rows) and is re-run by paging/refresh; wrong role or a mistaken filter leaves an open batch.
- `Count > 1` (should be at least one person); 1 person due => nothing shown.
- A "Department" restricted user can pick "All" (spec 0) and generate a batch for everyone; `Sbranch/SSpec/Srank` taken from the posted text and used to build the batch code unvalidated; "All" gives a code like `DOD-` + empty parts, UNCONFIRMED effect.
- `userspec` null -> exception; `f.fromdate.Value` null -> exception; Name column shows surname only; "Last Ship 11" label.
- `IndexViewModel`/ViewBag errors swallowed: failures set `status="0"` and show an empty page (no message).
- Sequence number read by `Substring` of the previous batch number; two simultaneous searches can create the same batch number.

---
## 3. Review/Print Draft

### 3.1 Entry points
Menu `draftings/draftreview` (role `Drafting`). Audit `DraftReview` per view.

| Verb / route | Code | Purpose |
|---|---|---|
| GET `draftings/draftreview?batchNumber=<batch>:<dept_rank>` | `draftingsController.draftreview` | show batch rows |
| POST `draftings/addnewDraft` | `addnewDraft` | add a person (audit `AddNewDraft`) |
| POST `draftings/removefromdraft` | `removefromdraft` | remove one row (audit `RemoveDraft`) |
| POST `draftings/DraftReviewexecute` | `DraftReviewexecute` | "Clear Draft" |
| POST `api/DraftingAPI/updateNewShip` (form: `svcno`="V1", `valueu`=JSON array) | `DraftingAPIController.Update` | save Proposed Ship/Vice/Remark (audit `UpdateShip`) |
| GET `api/DraftingAPI/getListofToAdd?personelname=&deptrank=` | `getListInfoToAdd` | name search (the input is commented out of the UI: dead) |
| GET `api/DraftingAPI/getListofServiceNoToAdd?personelserviceno=&deptrank=` | `getListofServiceNoToAdd` | official-number search for Add Personnel |
| POST `draftings/DownloadExcel1` (`specid`) | `DownloadExcel1` | "Export To Excel" |
Dead: `savenewship` (form action does not exist; the button is intercepted by JS), `savenewshipdraft` (calls `updatenextship`), the "Next/Future ship" lists (`DepartmentDropDownNd/Fd`, not rendered), `Bindbatch` (`dratftings` typo).

### 3.2 Fields

| Label | Input | Required | Options / rule |
|---|---|---|---|
| Batch Number | select `batchNumber` (GET) | yes | `GetDODBatch(null, user)` = `BatchRecord` where `batchcode` starts "DOD", `status == 0`; if `AspNetUsers.specid != 0` only batches whose `draftofficer == user name`, else all open DOD batches (`getAllOpenBatchDOD`). Text = batch number, value = `batch:dept_rank` |
| Review >> | submit | | |
| Clear Draft | POST `batchnoid`, `queryStringpath2` | | no confirm dialog |
| Export To Excel | POST `specid` (hidden, = batch specid) | | |
| Official Number (Add Personnel) | text + Search | | `suggestPersonelDraftingBySvcNo` (see 3.5) |
| Official No / Department / From Date / Duration at Current Dept | read-only, filled by the search | | |
| Request | select `requesttype` | | static: Medical, Special Requests, Others |
| AddRecord | submit | | |
| Row: Proposed Ship | select (id = svcno) | yes | `GetDepartment` (all ships by `Description`), preset to `newdeptid` |
| Row: Vice/Deployment | text (id `c<svcno>`) | no | free |
| Row: Remark | text (id `d<svcno>`) | no | free |
| Row: Save New Ship | button, enabled after any edit | | sends ALL edited rows so far |
| Row: Remove Rate | submit with confirm | | |
Columns: Name, Rate, Official No, Sex, Last Ship 1, Last Ship 11, Current Ship, DOJ Ship, Authority, Duration (band 2.6), Proposed Ship, Vice/Deployment, Remark, Action.

### 3.3 What each button writes
| Action | Effect (table.column) |
|---|---|
| Review | read: `BatchRecord` (by number) + `retieveDraftProposalDRAFTTB` rows for the batch (no `spec` filter: `rank=0, branch=0, spec=0`). Sets `ViewBag.closedraft` (unused) |
| Save New Ship (`updateNewShip`) | for each `{svcno, value, value2, value3, btchno}`: row `drafting` where `batchnumber == btchno AND svcno`: `newdeptid = Int32.Parse(value)`; `deploymentvice = value2` if not null; `remark = value3` (`IDraftingRepoImplementation.cs: updateNewShipHistory`) |
| AddRecord (`addnewDraft`) | proc `migrateSinglefromEmplHistToDraft(batchnumber, personelsvcno, departmentID = person's current ship id, rankid = null (never set), user, period = DOD+month+year)` (Dapper, timeout 2000 s). Also builds `request`, `noofmonths`, `fromdate`, `postedby` into a `drafting` object, but only the 6 proc parameters are sent: the Request choice and the months are NOT saved by C# (UNCONFIRMED whether the proc takes them from the history) |
| Remove Rate | physical delete of `drafting` row `draftingid` |
| Clear Draft | proc `deletedraft(batchno)`: deletes the batch's rows and probably the open batch (UNCONFIRMED; the same proc is called by Advancement) |
| Export To Excel | see 3.4 |
Nothing on this page writes `Person.Departmentid` or `employmenthist`.

### 3.4 Printouts
No rpt on this page (the "Verification Form" button calling `draftlistexecuteR` -> `CrystalReportForDraftForm.rpt` is commented out). `DownloadExcel1(specid)`: all `draftingReport` rows with that `specid` (every batch of the department, not only this batch), ordered `specid, rateid`. Headers (row 4): Name, Rate, Service No, Sex, Mother base, Last Ship II, Last Ship I, Current Ship, DOJ, Authority, WEF Date, Propose Ship, Vice/Deployment, Remark; A3 "Date" with timestamp. Faults: header `content-disposition: attachment: filename=` (colon, filename ignored); date format string `{0:dd mm yyyy} at {0:H: mm tt}` uses `mm` (minutes) for month; `specid` is a non-nullable int so exporting before a batch is chosen fails; export includes other batches.

### 3.5 Add Personnel search rules
`getListofServiceNoToAdd` -> `suggestPersonelDraftingBySvcNo`: proc `getDraftNotUpto(@personsvcno)` (result mapped to `retrieveDraftingNotUpTo`); if none, `retrieveDraftToAddUpPerson` by `serviceno`. The `deptrank` (branch/rate of the batch) is NOT used, so a person of any branch/rate/department can be added to any batch. No check that the person is already in another open batch (UNCONFIRMED inside proc).

### 3.6 Faults not to copy
- `getListofToAdd` name search parses `dept_rank` ("branch_spec_rank") as "branch_rank": `rank = after first "_"` = "spec_rank" -> `Int32.Parse` throws (`IDraftingPrepServiceImplementation.suggestPersonelDraftingByName`), and returns only when `Count > 1`.
- `addnewDraft`: swallows every exception, shows "Record Added Successfully"/"Record Exist" wrongly (`Record Exist` only when svcno is null), never sets `rateid`, `DateTime fromdate` non-nullable (post fails if empty); the Request value is lost (3.3); no duplicate check in C#.
- Per-row inline `<script>` reads `batchNumber` from the URL and breaks when the page is reached any other way (e.g. after redirect with `%3A` decoded); duplicate element ids (`queryStringpath2ID`, `printReport`); `Int32.Parse(value)` fails for a blank Proposed Ship and aborts the whole save halfway (rows before it are already saved).
- `updateNewShip` has no check that the ship differs from the current ship, no check that the batch is still open (a closed batch can be edited by posting), no audit of old values.
- `removefromdraft`/`DraftReviewexecute` are GET-able destructive operations without a closed-batch check; `Clear Draft` has no confirmation.

---
## 4. Draft Approval

### 4.1 Entry points
Menu `draftings/draftapproval` (role `SystemAdministration`). `draftapproval()` just returns the view (page header: "Draft Report By Department"; breadcrumb "Draft Summary Report").
| Verb / route | Code |
|---|---|
| GET `api/DraftingAPI/getSummaryReportByDept` (DataTables; params `deptid,rateid,signalcode,batchno` all sent as the string "0") | `DraftingAPIController.SummaryReportByDept` -> `IDraftingRepoImplementation.fetchsummaryByDept` |
| link per row -> GET `draftings/draftingreportByDept?specid=<id>` | `draftingsController.draftingreportByDept` (+ `DepartmentDropDown`) |
| GET `api/DraftingAPI/getDraftingReportbyDept?specid=` | `summaryReportBatchandDept` -> `fetchBatchRecordForReportFullByDept` |
| POST `api/DraftingAPI/updateDraftApprove` JSON `{specid, approverank, approverby, draftofficer}` | `DraftingAPIController.UpdateApprove` -> `updateDraftByApproval` -> proc `ApproveDraft` |
| POST `draftings/DownloadExcel1` (`specid`), `DownloadExcel2` | exports |

### 4.2 List (page 4) and what each column is
One row per Department (`specid`) that still has PENDING draft rows (`drafting.reportdate IS NULL AND signalCode IS NULL`); a user with `AspNetUsers.specid > 0` sees only his own department, else all (grouped by `specid`; `fetchsummaryByDept`). Columns: Department (link), Total Deepartment (`totalforbatch`), Total OS/SM/AB/LS/PO/WO/MWO/NWO (counts by rate group from proc `fetchOtherRecordforSummaryBydept(specid)`, result columns `totalforbatch,totalnotposted,totalposted,totalos,totalsm,totalab,totalls,totalpo,totalwo,totalmwo,totalnwo`; expansion of the abbreviations is not in the code: UNCONFIRMED), Approve By (`approveby`), Rank (`approverank`), Office (`approvalappointment`), Approve Date (`approvedate`) all taken from the FIRST pending `drafting` row of that department.

### 4.3 Detail page (approve dialog)
`draftingreportByDept.cshtml`: read-only table (Name, Rate, Service No/Official No., Sex, Last Ship II, Last Ship I, Current Ship, Date of Joining, Authority, WEF Date, New Ship / Propose Ship, Vice/deployment, Remark) = all `draftingReport` rows of the department (ALL batches, newest rate first: `OrderByDescending(rateid).ThenByDescending(senioritydate)`, `Skip/Take` paging). Buttons: Export To Excel (department), Export To Excel All Dept (current period only, `DownloadExcel2`: `draftperiod == "DOD"+month+year`), Approve.
Approve dialog fields:
| Label | Input | Options | Posted as |
|---|---|---|---|
| (no label) Rank | select | S/LT, LT, LTCDR, CDR, CAPT, CDRE, R/ADM, ADM | `approverank` |
| Name | text | free | `approverby` |
| Appointment | text | free | `draftofficer` (!) |
| (hidden) department | `@ViewBag.specid` | | `specid` |

### 4.4 What Approve writes
`ApproveDraft(rank, name, departid = specid, draftingOfficer = appointment text, period = "DOD"+month+year computed NOW)`. Body UNCONFIRMED; the columns it must fill (read back by `fetchsummaryByDept`) are `drafting.approveby`, `approverank`, `approvedate`, `approvalAppointment` for the department's rows of `period`; `BatchRecord` has the same four columns plus `draftofficer`. Approval is per Department, not per batch, and there is no "approved" status flag: approved = those columns filled.

### 4.5 Faults not to copy
- The Appointment is sent in the `draftofficer` field, overwriting the meaning of "draft officer" (which is the user who built the batch, `BatchRecord.draftofficer`).
- Period is recomputed at click time, so approving in a later month than the batch matches no rows (UNCONFIRMED).
- Success handler is broken: `alert("CustomerId: " + r.CustomerId.toString())` (copy-paste, `r.CustomerId` undefined) and redirects to a `~/` URL; the user gets a JS error although the save succeeded. `queryString222` is read before it exists.
- Approver rank list has no Navy ratings beyond Admiral ranks, no validation of empty Name/Appointment; can approve an empty department, can re-approve and overwrite silently; no audit of approvals (API controller `UpdateApprove` has none).
- Page labels: heading says "Report By Department", columns "Total Deepartment", "Office" for appointment; the unused search (`#processBTN`, `#branchid`) references elements that do not exist.
- `fetchsummaryByDept` throws if the logged-in user row is missing; `rankRepo.GetByQuery(x.id == 0)` always empty (dead code).

---
## 5. Close Draft

### 5.1 Entry points
Menu `draftings/closedraftreview` (role `SystemAdministration`); GET `closedraftreview()` returns the view; POST `closedraftreview(CloseDraft)` (audit `CloseDraft`). The page shows the same per-department summary table as page 4 (`getSummaryReportByDept`) and "Export To Excel All Dept" (`DownloadExcel2`).

### 5.2 Fields

| Label | Input | Required | Notes |
|---|---|---|---|
| Authority | text `signalno` | yes | the signal/authority reference of the draft |
| Close Date | text `closedate`, datepicker `dd/mm/yyyy` | yes | |
| (hidden) `batchno` | `@ViewBag.batchNumberSS` | | NEVER set by `closedraftreview` GET: posted EMPTY |
| Close Draft | submit; `onclick confirm(...)` | | |

### 5.3 What it writes
`closedraftreview POST`: `closeby = AccountController().getLoggedinInfo().AspNetuserID`; `closeDraft(username = closeby, batchno, signalcode, dateclosed = Utils.returnDateTime(closedate))` -> proc `closeDraft` returns string: `"1"` = closed, anything else = "Signal Number Added" refused with message "Signal Number Used Before, Please Use a unique Signal Number". Exception -> "Draft Closed Failed; Please contact the Administrator". Redirect back (`TempData["feedback"]` is not displayed by the view).
Known columns that Close fills (UNCONFIRMED procedure body): `BatchRecord.status = 1`, `signalCode`, `batchcloseby`, `batchclosedate`; `drafting.signalCode`, `closeby`, `closedate` (they appear in `draftingReport`; pending test in `fetchsummaryByDept` uses `signalCode IS NULL`). Evidence that batchno empty means "all pending, all departments": the page lists all departments, there is no batch picker, and the hidden field is empty (UNCONFIRMED: ask Q3). The authority must be unique across batches (the proc's check).
After Close: batch status 1, rows have the signal, `reportdate` still null -> appear on Update WEF (7) via `GetDODBatchOpenBatchWithSignal` (`status == 1 AND signalCode != null`).

### 5.4 Faults not to copy
- `Utils.returnDateTime` parses `"MM/dd/yyyy HH:mm"` while the datepicker produces `dd/mm/yyyy`: any day > 12 throws ("Draft Closed Failed"), days <= 12 silently swap day and month (`Infra/Utilities/Utils.cs`).
- The confirm text contains `<br/>` literal; no check that every department is approved before closing; no preview of what will close; the empty `batchno` (above); feedback message is never rendered (`TempData["feedback"]`); the close is irreversible (`reopencount` exists on `BatchRecord` but no reopen page).

---
## 6. Upload Draft

### 6.1 Entry points
Menu `draftings/ExcelUpload` (role `SystemAdministration`). GET view; POST `draftings/UploadExcel` (file input `FileUpload`); GET `draftings/Download` (sample file link, twice).

### 6.2 Template: which file belongs to which page
| File (`App_Data/UploadFormat`) | Header row (sheet) | Belongs to |
|---|---|---|
| `Draft6.xlsx` | Sheet1: SER, Name, Rate, Sex, Svc_No, Present_Ship, DOJ, Authority, Draft_To, WEF, REMARKS (+2 empty columns); Sheet2, Sheet3 empty | THIS page (the only sample returned by `Download`) |
| `NNDoc.xlsx` | ServiceNuber, Surname, Firstname, Middlename, Rank, PhoneNumber, Email | personnel/security bulk upload (`Views/Employee/ExcelUpload.cshtml`, `Views/Security/Upload.cshtml`); linked a second time on this page by copy-paste; `Download` ignores `filename` and returns `Draft6.xlsx` anyway |
| `BATCH 27 NOMINAL ROLL.xlsx` | sheets "BTS NUMBER", "TRN WITH NCE", "TRN AS DEPT" (title rows only; a trainee roll) | not drafting (new-entry training batch list; for the WP of personnel/training) |
| `bands 29ak.xlsx`, `CndFormat.xlsx`, `CndFormat (1..3).xlsx` | personID, SVC_NO, FirstName, MiddleName, LastName, BirthDate, Sex, rate, GSMNumber, homeaddress, Email, senioritydate, dateemployed, Specialisation | bulk personnel conversion/new-entry data (procs `CND_*`), not drafting |
The upload model `Core/tbl_DraftUpload.cs` also has `deployment_vice`, `sur_name`, `middle_name`, `branch`, `lastdraft_date`, but the sample has no Deployment/Vice header, so it is always null.

### 6.3 What the import does (`draftingsController.UploadExcel`)
1. File checks: `ContentType` = `application/vnd.ms-excel` or `...spreadsheetml.sheet`; name ends `.xlsx`; saved as `App_Data/UploadFormat/<client file name>` (overwrites a template of the same name); read with LinqToExcel, worksheet named exactly "Sheet1".
2. Pass 1, row by row (skipped when `Svc_No` is empty): `Person` exists with `SVC_NO`; `Department.Description == Present_Ship`; `Department.Description == Draft_To`; `TitleType.Name == Rate`. First failure stops everything with `"Line <SER> ... is not valid / does not Exist"`.
3. Pass 2: `WEF` and `DOJ` via `Convert.ToDateTime`; proc `UploadExcelToSpecialDraft(name, title=Rate, sex, svcno, presentship, DOJ, authority, draftedto, deployment_vice, WEF, Remarks, User)`; return `<= 0` = duplicate official number: message "Hello User, Found some duplicate Official Number" and continue; else "Successful upload records" and `trainl` = count of ALL rows in `tbl_DraftUpload` + " Rows was added".
4. A row with empty `Svc_No` in pass 2 aborts: "Some fields are null...".
Target table: `SpecialDraft` (`svc_no, sur_name, middle_name, last_name, doj, title, sex, branch, present_ship, lastdraft_date, draft_to, deployment_vice, authority, wef, remark, created_by, date_created, posted_by, date_posted, recordno, ref`), shown by Special Draft pages where `date_posted IS NULL`. Body of the proc UNCONFIRMED (probably also fills `tbl_DraftUpload`). The upload does NOT touch `drafting`, `BatchRecord`, `Person` or `employmenthist`.

### 6.4 Faults not to copy
- The page named "Upload Draft" feeds Special Drafting (a different process), and the batch cycle has no import. Decide with the owner (Q4) whether this page moves to the Special Drafting package.
- Path traversal / overwrite through `FileUpload.FileName`; no size limit; needs the Access OLEDB engine; sheet name fixed; whole file validated by repeated DB lookups per row; ship matched on `Description` while every dropdown uses `Name`; messages concatenate `SER` and `Svc_No` without a space; duplicate rule only inside the proc; partial import (rows already inserted stay when a later row fails); success message counts the whole table.
- `Download` ignores the requested file; `File(dir + filename)` concatenates without a path separator (broken path); a second "Download Sample File" for the wrong template.
- On-page text "All dates must be in a correct date format" but conversion is culture dependent; null WEF becomes 0001-01-01.

---
## 7. Update WEF

### 7.1 Entry points
Menu `draftings/draftenddate` (role `SystemAdministration`; audit `DraftWEFDate`). Page title "Update With Effect From".
| Verb / route | Code |
|---|---|
| GET `draftings/draftenddate?batchNumber=<batch>:<dept_rank>&spcid=<specid>` | `draftenddate`: rows of that batch (`returnListofProposedDraftCloseD`: `specialization == spcid AND batchnumber`; with `spcid = 0` ("All") only the batch filter) |
| POST `api/DraftingAPI/updateDraftDate` (form `svcno`="V1", `valueu`=JSON `[{svcno, value = date text, btchno, value3}]`) | `DraftingAPIController.updateDraftDate` -> proc `performreportDateOperation(Convert.ToDateTime(value), btchno, value3, svcno)`; audit `UpdateDraftDateShip` |
| POST `draftings/updateDateAllDepartment` (`spec`, `fromdate`) | proc `performreportDateOperationAllDept(fromdate, spec)` then redirect to referrer |

### 7.2 Fields
| Label | Input | Required | Options |
|---|---|---|---|
| Batch Number | select `batchNumber` | yes | `GetDODBatchOpenBatchWithSignal`: `BatchRecord` code starting "DOD", `status == 1 AND signalCode != null`, newest first (name says Open, they are CLOSED batches); value `batch:dept_rank` |
| Department | select `spcid` | yes | `GetSpecializationArea` ("--Select Branch", "All" (0), each `sp_desc`), value `id` |
| Process >> | GET submit | | |
| Update All Department | modal: Date text `fromdate` (`dd-MM-yyyy`), Save | | applies to the whole department `spec` (hidden `ViewBag.specid`) |
Columns: Name, Rate, Official No, Sex, Last Ship 1, Last Ship 11, Current Ship, DOJ Ship, Authority, Proposed Ship (disabled select), Vice/Deployment, WEF (datepicker `dd/mm/yyyy`, only for rows with a `newdeptid`; preset to `reportdate`), Remark, Action "Save Date" (enabled after a date change).

### 7.3 What it writes (UNCONFIRMED bodies)
Visible in C#: only the procedures are called. `reportdate` is what the reports call WEF and what makes a row "Reported" (`totalposted`). The proc must be what moves the rating (otherwise nothing ever changes current ship): expected to set `drafting.reportdate`, and to update `Person.Departmentid` (current ship) and write `employmenthist` (new row `Departmentid = newdeptid`, `fromdate = WEF`, `signal`, close `todate` on the previous one; `employmenthist` also has `nextship`, `fultureship`). No C# in the draft pages writes `Person.Departmentid` or `employmenthist` (the other writers of `Departmentid` are the profile edit pages). Ask Q5. Suggested new behaviour (design, not legacy): on WEF save, end the open `rating_drafting` row and open a new one at the proposed ship from the WEF date.

### 7.4 Faults not to copy
- `Convert.ToDateTime(value)` on `dd/mm/yyyy` text is server-culture dependent (day/month swap or exception); `fromdate` of the dialog is bound as `dd-MM-yyyy` by MVC default culture.
- `value3` (authority) comes from a text box that is commented out, so it is always undefined/empty; the procedure parameter `signalno` is therefore unused.
- Department "All" + the "Update All Department" dialog use `spec` only: no batch filter, so it dates the department's rows in every batch/period (`performreportDateOperationAllDept(date, spec)`); no confirmation; no check `WEF >= close date`; rows without a proposed ship are skipped silently in the list but included in "all".
- `(int)spcid` NRE when the parameter is missing; the "Open" batch wording; a single "Save Date" posts every pending edit; `queryString222` from the URL; wrong label "Branch" on the department list.

---
## 8. Batch/Signal Content

### 8.1 Entry points
Menu `draftings/summaryreport` (role `SystemAdministration`); view header "Draft Summary Report". `summaryreport()` loads `BranchDropDown` (`GetBranch`: value `branch.id`), `RankDropDown` (`GetRating`: `Rate.id`), `SpecializationDropDown` (unused).
| Verb / route | Code |
|---|---|
| GET `api/DraftingAPI/getSummaryReport?deptid&rateid&signalcode&batchno` (DataTables) | `summaryReportBatchandSignal` -> `fetchBatchRecordForReport` (+ `fetchBatchRecordForReportCount`) |
| link on Signal Code -> GET `draftings/draftingreport?batchno=<batch>` (detail) | `draftingreport` |
| GET `api/DraftingAPI/getDraftingReportbyBatch?signalcode&batchno&name&oldship&newship&officialno&firsttime` | `summaryReportBatchandSignalFull` -> `fetchBatchRecordForReportFull` |
| POST `draftings/draftlistexecute` (Generate PDF on detail) | PDF, see 8.3 |
| POST `draftings/DownloadExcel` (`batchno`) | Excel, see 8.3 |
| POST `draftings/summaryreportexecute` (Generate PDF on list) | DOES NOT EXIST in live code (404) |

### 8.2 List page
Filters: Branch (`branch` select), Rate (`rate` select), Signal Code (text), Batch No (text), Process (AJAX search), Generate PDF (broken). Columns: Signal Code (link), Branch (`deptname`), Rank (`rankname`), Batch Number, Status (1 CLOSED green, 0 OPEN amber), Total No of Personel (`totalforbatch`), Reported Personel (`totalposted`), Not Reported Personel (`totalnotposted`) (proc `fetchOtherRecordforSummary(batchno)`), Initiated By (`initiatedby`), Date Initiated, Closed By (`batchcloseby`), Date Closed.
Source: view `batchSummaryView` columns `id, batchnumber, status, batchcode, batchrequestname, batchinitiateddate, batchclosedate, signalCode, dept_rank, specid, approveby, approverank, approvedate, draftofficer, initiatedby/batchcloseby (user names)`. Filter in `fetchBatchRecordForReport`: `batchnumber StartsWith "DOD-"`; `signalcode` equals or "0"; `batchnumber` equals or "0"; `branch == "0" OR dept_rank StartsWith(branch)`; `rank == "0" OR dept_rank EndsWith(branch)`. Only `skip/take` paging; `deptname` = `branch.busdesc` for the id before the first "_" of `dept_rank`; `rankname` is always empty (rank id fixed at 0).
Detail page filters: Official No, Personel Name (hidden Batch No / Signal), Process; details block (Signal Code, Batch Number, Branch, Rank, Initiated By, Date Initiated, Status, Total Personel Posted, Closed By, Date Closed) is empty in the live script (fill code commented). Columns of the grid: Official No, Full Name, Old Ship (`departmentname`), New Ship (`newdepartmentName`), Date Reported (`reportdate`), Batch Number (script lines 70-90 of `draftingreport.cshtml`; list = `draftingReport` rows of the first matching batch, `(officialNo, name contains, curdeptid, newdeptid)` filters).

### 8.3 Printouts
- `draftlistexecute` -> `fetchBatchRecordForReportFullCR` (first batch matching the filters; with batch "0" it takes the first batch of the list, UNCONFIRMED intent) -> `RDLCReport/CrystalReportForDraft.rpt` via `ReportDocument.Load(Server.MapPath("~//RDLCReport//CrystalReportForDraft.rpt"))` -> PDF "draft Report.pdf". Dataset `DataForDraft.xsd`: `batchnumber, svcno, FirstName (= LastName only), ratename, SexName, DOJ, departmentname, newdepartmentName, reportdate, Authority (= signalCode), request, recordno`. Also used by `draftlistexecuteALL2` (page 10), `draftlistexecuteP`, `draftlistexecuteRSP`.
- `CrystalReportForDraftForm.rpt` (dataset `DataSetForDraftingForm.xsd`: `batchnumber, svcno, FirstName, ratename, SexName, departmentname, newdepartmentName, noofmonths, reportdate`) is loaded only by `draftlistexecuteR` (dead) and the Special Draft actions.
- Excel `DownloadExcel(batchno)`: `draftingReport` rows of the batch; headers Name, Rate, Sex, Officail Number, Present Ship, DOJ, Authority, Drafted To, WEF, Deployment/Vice, remark.
- `CrystalReportForDraftReview.rpt`, `SummaryForDraftReport.rpt`: not loaded by any live Drafting page.

### 8.4 Faults not to copy
- "Generate PDF" on the list (`summaryreportexecute`) is a 404; `rank` filter uses the branch value; `StartsWith(branch)` also matches "12_.." for "1"; Rank column empty; list count (`fetchBatchRecordForReportCount`) counts batches unfiltered by search-paging; the grid's total counts use `x.newdeptid == ddsearch.oldship` (typo) so totals wrong when New Ship is filtered (`fetchBatchRecordForReportFull`).
- Excel: header "Officail Number"; column I (WEF) is overwritten by `request`; column J is the constant text "COMPLEMENT" instead of vice/deployment; `content-disposition: attachment:` (colon); date formatting `mm`.
- Name in PDF = surname only; the detail's header panel is never filled; heading "Report for Branch/Rank" is empty.

---
## 9. Rate DOD History

### 9.1 Entry points
Menu `draftings/draftingreportindividual` (role `SystemAdministration`); heading "Draft Individual Report". GET `api/DraftingAPI/getDraftingReportList?officialno=` (DataTables, `"0"` if blank) -> `reportFull` -> `IDraftingRepoImplementation.fetchBatchRecordForReportL`.
Fields: Official No (text), Process, Generate PDF (POST `draftlistexecute` with `officialno` and an empty `batchnumber`). Columns: Official No (`svcno`), Full Name (Last First Middle), Old Ship (`departmentname`), New Ship (`newdepartmentName`), Date Reported (`reportdate`), Batch Number.
Data: `draftingReport` where `svcno == officialno` ordered by `draftingid` (one row per draft the rating has been through, all batches). With blank Official No ("0") it returns EVERY row of the table, paged.
PDF: `fetchBatchRecordForReportFullCR(...)` with batch "0" -> picks the FIRST DOD batch of the whole system (`fetchBatchRecordForReportCR` ordered by `id`), then filters it by Official No: so the PDF is empty for any rating not in that batch. `CrystalReportForDraft.rpt` (see 8.3).

### 9.2 Faults not to copy
- Blank search lists everything; PDF is not the individual's history (see above); no validation that the official number exists; includes drafts that were never closed/reported (pending and cleared rows) without a status column; only the person's drafting rows, not `employmenthist` (the profile's Drafting tab uses `getEmploymenthist` instead); name is rendered client side from `LastName/FirstName/MiddleName`.

---
## 10. Draft Report

### 10.1 Entry points
Menu `draftings/draftingreportList` (role `SystemAdministration`); `draftingsController.draftingreportList(option, startdate, enddate, sortOrder, CurrentSort, page)`.
| Verb / route | Code |
|---|---|
| GET `draftings/draftingreportList?...` | if BOTH `startdate` and `enddate` are given: proc `migrateTorct_Draft(startdate, enddate)` (rebuilds the report table `rt_drafting`; body UNCONFIRMED); then shows ALL rows of `rt_drafting` ordered by `Newship`, 25 per page |
| POST `draftings/draftlistexecuteALL2` ("Print Report") | `fetchBatchRecordForReportFullCRAL` = all `rt_drafting` rows -> `CrystalReportForDraft.rpt` -> "draft Report.pdf" |
`rt_drafting` columns: `draftingid, batchnumber, svcno, FirstName, MiddleName, LastName, Currentship, Newship, formership, lastship, futureship, nextship, fromdate, noofmonths, dateposted, request, closeby, closedate, rateid (text), DOJ, sex, signalCode, createddate, reportedby, reportdate, reportindicator, reportreason`.
Fields on the form: "Department" select (`SSpecilization`), an unlabeled text `authority` (id `enddate`), an unlabeled text `startdate`, Search; a dead "Approval" modal (same fields, "Modal title", Save does nothing). Grid columns: BatchNumber, Name (surname), Rate (`rateid`), Sex, Svc No, Present Ship, DOJ, Authority (`signalCode`), Proposed Ship, Deployment/Vice (= `request`), WEF (`reportdate`).

### 10.2 Faults not to copy
- The Department select is bound to `ViewData["SPecilizationDropDown"]`, which this action never sets (UNCONFIRMED whether the page throws or shows empty) and the select is not used by the action.
- The end-date box is named `authority`, not `enddate`, so the action never receives `enddate` and never calls `migrateTorct_Draft`: the page shows whatever stale rows `rt_drafting` holds (a leftover report table shared by all users; concurrent users overwrite each other).
- The Print button prints the whole stale table; "Deployment/Vice" column shows `request`; unlabeled date boxes with no date picker; format not stated; `Model.PageCount` used when `Model` could be null.
- Dead modal and dead `option`, `sortOrder`, `CurrentSort`; `db.deletert_drafting()` commented out (table never cleared).

---
## 11. API summary used by these pages (`APIController/DraftingAPIController.cs`)
Live: `getListofDraftPagedSearch` (dead UI script), `getListofToAdd` (dead input), `getListofServiceNoToAdd`, `updateNewShip` (POST), `updateDraftApprove` (POST), `updateDraftDate` (POST), `getSummaryReport`, `getSummaryReportByDept`, `getDraftingReportbyBatch`, `getDraftingReportbyDept`, `getDraftingReportList`. Not used by the 10 pages: `submitSelectedTraining` (empty stub), `getListofServiceNoToAdd2` (profile pages, null-ref `draftlistnupto.busdesc` in its else branch), `getSummaryReportDOT`, `getDraftingReportbyBatchDOT`, `getDraftingReportbyBatchALL`, `getShipReqReportList`.
Faults common: `[AllowAnonymous]` everywhere; response shape `{aaData, iTotalRecords, status "1"|"0", errormessage}` (status "2" = go to login); errors turned into empty tables; audit rows record `IpAddress = "127.0.0.1"` and empty browser from API actions.

## 12. Tables, views, procedures

### 12.1 Tables written
| Table | Writer |
|---|---|
| `shiprequirement` | page 1 |
| `BatchRecord` (`id, batchnumber, batchcode, batchrequestname, status, initiatedby, batchinitiateddate, batchcloseby, batchclosedate, signalCode, reopencount, dept_rank, specid, approveby/approverank/approvedate/approvalappointment, draftofficer, draftperiod, created, modified`) | procs `CreateBatchRec`, `closeDraft`, probably `ApproveDraft`, `deletedraft` |
| `drafting` (`draftingid, batchnumber, svcno, curdeptid, newdeptid, formerdeptid, lastdeptid, prevdeptid, Lastdept, newcommandid, nextship, futureship, postedby, dateposted, fromdate, noofmonths, request, closeby, closedate, reportindicator, reportreason, reportedby, reportdate, rateid, DOJ, sexid, signalCode, fSignalCode, datecreate, createddate, deploymentvice, remark, specid, approveby/approverank/approvedate/approvalAppointment, draftofficer, draftperiod, titleid, senioritydate, motherbase`) | procs `migratefromEmplHistToDraft`, `migrateSinglefromEmplHistToDraft`, `ApproveDraft`, `closeDraft`, `performreportDateOperation*`, `deletedraft`; C# updates `newdeptid, deploymentvice, remark`; C# deletes rows |
| `rt_drafting` | proc `migrateTorct_Draft` |
| `SpecialDraft`, `tbl_DraftUpload` | page 6 (proc `UploadExcelToSpecialDraft`) |
| `Person.Departmentid`, `employmenthist` | expected from `performreportDateOperation*` (UNCONFIRMED) |
| `Tbl_AuditTrail` | audit rows, actions: `DraftProposal`, `DraftReview`, `AddNewDraft`, `RemoveDraft`, `UpdateShip`, `UpdateDraftDateShip`, `DraftWEFDate`, `CloseDraft`, `DeleteShipRequirement` |

### 12.2 Tables/views read
`Person`, `AspNetUsers` (`UserName, RolenameID, specid`), `branch`, `Rate`, `TitleType`, `Specializationarea`, `Department`, views `retrievefordrafting`, `retrieveDraftingNotUpTo`, `retrieveDraftToAddUpPerson`, `retieveDraftProposalDRAFTTB`, `draftingReport`, `batchSummaryView`, `shiprequirementreport`.

### 12.3 Procedures (bodies unavailable; "as called" from C#)
| Proc | Parameters as called | Result read | Implied behaviour (UNCONFIRMED) |
|---|---|---|---|
| `CreateBatchRec` | batchnumber, batchrequestname, initiatedby, batchcode, deptrank, specid, draftofficer, draftperiod | int | inserts `BatchRecord`, status 0 |
| `migratefromEmplHistToDraft` | batchnumber, branchID, departmentID (= specialisation), rankid, user, period | none | copies every person due (view `retrievefordrafting`) for the filters into `drafting` for the batch with `curdeptid, fromdate, noofmonths, postedby, dateposted, draftperiod, specid ...` |
| `migrateSinglefromEmplHistToDraft` | batchnumber, personelsvcno, departmentID (current ship), rankid (null), user, period | none | same for one person |
| `deletedraft` | batchno | none | deletes batch rows |
| `ApproveDraft` | rank, name, departid (specid), draftingOfficer (= appointment), period | none | fills approval columns |
| `closeDraft` | username, btchno, signalcode, dateclosed | first string: `"1"` ok | closes batch(es), stores authority; refuses a reused authority |
| `performreportDateOperation` | startdate, batchno, signalno, svcno | none | sets WEF/reported for one row (and probably the ship move) |
| `performreportDateOperationAllDept` | startdate, spec | none | same for a department |
| `getDraftNotUpto` | personsvcno | `retrieveDraftingNotUpTo` rows | one person's data to add |
| `fetchOtherRecordforSummary` | batchno | `totalforbatch, totalnotposted, totalposted` | counts |
| `fetchOtherRecordforSummaryBydept` | specid | + `totalos, totalsm, totalab, totalls, totalpo, totalwo, totalmwo, totalnwo` | counts by rate group |
| `migrateTorct_Draft` | startdate, enddate | none | rebuilds `rt_drafting` |
| `UploadExcelToSpecialDraft` | see 6.3 | int | special draft insert |
| `updatenextship` (dead), `Hr_setlga`, `performOperationForSpecialDraft` (special draft only) | | | |

## 13. Open questions for the owner (needed before building the due engine)
Q1. Does manning requirement (complement vs actual) limit who is proposed? How are `quantitysupplied/quantityremain/postingstatus` meant to work?
Q2. Exact due rule: months at current ship, sea versus shore (Department.LandSea Land/Sea/Training), by rate group and branch; which service states/exit types are excluded; is the 10/20/24 month band the real policy?
Q3. Does Close Draft close all pending batches at once (empty batch number), or one batch? Is closing one authority for all departments intended?
Q4. Upload Draft: confirm it belongs to Special Drafting; if kept in Drafting, what should an upload do to the cycle?
Q5. At Update WEF: what must happen to current ship and drafting history (new `rating_drafting` row, end date of previous)?
Q6. Meaning of OS, SM, AB, LS, PO, WO, MWO, NWO groups and who may approve (rank list).

## 14. Hand-off notes for design/build
- Read first: sections 0.3-0.5, 2.3 and 12.3; then the page you build. Procedure bodies do not exist: every rule marked UNCONFIRMED needs an owner answer (section 13) before coding; do not infer the due rule from the colour bands.
- Model to keep: Batch (code + 6-digit sequence per branch/department/rate; open -> closed with authority and date) -> proposal rows -> per-department approval -> WEF per row. Rows have a status derived from `signal` and `reportdate`; add an explicit status column in the new schema instead.
- Biggest risks: (1) due engine undefined; (2) WEF side effects on current ship/history undefined; (3) department-level approval vs batch-level close; (4) old pages write on GET and swallow errors: build explicit POSTs with transactions and visible error messages; (5) authorise every server action (old: none); (6) date parsing: use ISO dates end to end.
- New-schema gaps: manning requirement, batch, draft row, approval, authority/signal, special draft; `rating_drafting.end_date` null = current ship.

## 15. Split advice (WP7: one package or two)

Advice: split into WP7a and WP7b, 7a first.

Reasons:
- Size and risk are uneven. The cycle (proposal, review, approval, close, WEF) carries all unknown rules (due engine, approval scope, WEF side effects), all writes and the batch state machine. The other four pages only read the result or run a side import. One agent building 10 pages with an undefined engine will either stall on questions or invent rules.
- Clean seam: 7a is the ONLY writer of `drafting`, `BatchRecord`, `rating_drafting`/current ship; 7b is read-only on them (plus Upload, which writes a different table). 7b can start as soon as 7a's migration (tables) is merged, in parallel with 7a's UI work.
- The shared tables are the contract, so 7a must commit the schema first (migration for batch, draft row, approval, authority, manning requirement) and the exports/PDF service for the draft form.

Cut:

| Package | Pages | Writes | Reads |
|---|---|---|---|
| WP7a "draft cycle" | 1 Update Manning Requirement; 2 Print Draft Proposal; 3 Review/Print Draft (incl. Excel export); 4 Draft Approval; 5 Close Draft; 7 Update WEF | manning requirement, batch, draft rows, approval, authority, `rating_drafting` (current ship) | `ratings`, `ref_ship`, `ref_rate`, `ref_branch`, `ref_specialisation`, `rating_drafting` |
| WP7b "draft reports and upload" | 8 Batch/Signal Content (list, detail, Excel, PDF); 9 Rate DOD History; 10 Draft Report (and its PDF); 6 Upload Draft | only the special-draft table (Upload) | batch, draft rows, approval, `rating_drafting`, `ratings`, ref tables |

Notes on the cut:
- Page 1 (manning requirement) is independent (own table, simple CRUD): do it first in 7a as a quick deliverable, it can even go to 7b if 7a is overloaded.
- Page 6 does not belong to the cycle (it writes Special Draft). Prefer moving it to the later Special Drafting package; if it must ship now, it sits in 7b and needs the special-draft table created there.
- The draft-form PDF (`CrystalReportForDraft`) and the Excel exports are used by 8, 9 and 10 (and Review in 3). Build one shared export service in whichever package starts first (7a for Excel; 7b for the PDF), and say so in the hand-off.
- If the team prefers a single package, keep one only after Q1-Q5 are answered and the schema is fixed; otherwise the single package blocks on unknown rules.
