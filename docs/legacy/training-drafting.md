# Legacy map: Training Drafting (5 pages)

Source root: `/home/user/cirems/hpproject` (EF model: `HRProjectDAL/Core/HicadHRProjectModel.edmx`). Paths below are relative to `hpproject` unless they start with `HRProjectDAL`.
"UNCONFIRMED" = inferred, because stored-procedure and view bodies are not available anywhere.

## 0. Group overview

Menu group "Training Drafting" (`Views/Shared/_menu.cshtml`, lines ~189-199), guarded by `User.IsInRole("Discharge")` (the same role as the "Discharge Administration" group just above it). All five items need role `Discharge`.

| Menu label | Route | Action |
|---|---|---|
| Process Training Draft | `/TrainingDraft/TrainingDraftiningProcess` | `TrainingDraftController.TrainingDraftiningProcess` |
| Training Review | `/TrainingDraft/Trainingreview` | `TrainingDraftController.Trainingreview` |
| Update Training History | `/TrainingDraft/trainingdraftenddate` | `TrainingDraftController.trainingdraftenddate` |
| Reports | `/TrainingDraft/summaryreport` | `TrainingDraftController.summaryreport` |
| Excel Upload | `/TrainingDraft/ExcelUpload` | `TrainingDraftController.ExcelUpload` |

- Role is enforced ONLY by the menu. `TrainingDraftController` and `TrainingDraftingAPIController` carry no `[Authorize]` or role attribute (grep). Every API action used here is `[AllowAnonymous]`. FilterConfig only registers `HandleErrorAttribute`. Whether anything else (Web.config forms auth) blocks anonymous callers is UNCONFIRMED.
- "Training draft" = a batch ("DOT" batch) of ratings proposed to attend one training course in a given month and year. It is a separate flow from the ship/posting draft (DOD batches, `draftingsController`). It reuses the same controller helpers and API names.
- Hidden helper actions (no menu item, reached by redirect or link): `Traininglistfilters`, `TrainingProcess`, `trainingdraftingreport`, `traininglistexecute`, `DeleteConfirmed`, `updateDateTraininghist`, `UploadExcel`, `Download`, `Traingfilters`. Dead code is listed in section 8.

### Workflow and states (end to end)

| Step | Page / action | What happens | State written |
|---|---|---|---|
| 1 | Process Training Draft | Pick Training + Month + Year. `CreateBatchRecForDOT` creates the batch header. | `DOTBatchRecord` row, `status = 0` (OPEN) |
| 2 | (auto-redirect) `Traininglistfilters` | Pick Branch + Department + Rate and press ADD. `migratefromTrainingHisToTrainingDraftTex` fills the batch with matching ratings. | `TrainingDrafting` rows for the batch |
| 3 | Training Review | Choose an OPEN batch, review rows, add one rating by Official Number (`migratefromTrainingHisToTrainingDraft`), or remove a row. | `TrainingDrafting` insert/delete |
| 4 | Update Training History | Choose an OPEN batch, enter Start Date and End Date, Save. `updateconfirmdatefortraining` stamps the whole batch. | `TrainingDrafting.attenddate/closedate`; training history (see below) |
| 5 | Reports | List batches, open one, print the PDF. | read only |
| (side) | Excel Upload | Bulk-load completed training records for ratings. | `tbl_Trainingupload` and training history via `UploadExcelToTraining1` |

- Batch status: `DOTBatchRecord.status` 0 = OPEN, 1 = CLOSED (label mapping in `Views/TrainingDraft/summaryreport.cshtml`; `getAllOpenBatchDOT` in `HRProjectDAL/APIImplementationRepository/IBatchCreationImplementation.cs` selects `status == 0`).
- NOTHING in this module closes a DOT batch. `AuditAction.CloseTrainingDraft`, `AddNewTrainingDraft`, `SaveNewTrainingDraft` and `TrainingDraftReview` exist in `Helper/AuditAction.cs` but are used by no action. The only closer found is `closeDraft` (username, btchno, signalcode, dateclosed), used by the ship-draft flow (`draftingsController` line ~338). Whether it also closes DOT batches is UNCONFIRMED (it takes a signal code, which DOT batches do not have). `DOTBatchRecord` has the columns `batchclosedate`, `batchcloseby`, `reopencount` and `signalCode`. Open question for design: who closes a DOT batch?
- Batch number format: `"DOT-" + year + "/0" + monthId + "/" + trainingId`, e.g. `DOT-2026/03/12` (`TrainingDraftController.TrainingDraftiningProcess`, line ~100). For months 10-12 this yields `/010/`, `/011/`, `/012/` (fault). `batchrequestname` is the literal `"DOT"`. `batchcode` is the literal `"DOT-"`. `initiatedby` is the logged-in user's AspNetUser id (`new AccountController().getLoggedinInfo().AspNetuserID`).

### How it feeds a rating's Training history

- Old table `traininghist` (id, PersonID, fromdate, todate, intstitution, trainingid, Qualification, createdby, datecreated). The rating profile reads it through view `getTraining` (adds Institution and Training names), via `HRProjectDAL/APIImplementationRepository/ITrainingRepoImplementation.cs` `getPersonelTraining` and `APIController/PersonelController.cs getPersonelTraining`. The profile CRUD for single records is `Controllers/TrainingController.cs` / `TrainingHistoryController.cs` (not part of this group).
- Step 2 and step 3 procs read `traininghist` to find each rating's LAST course (`prevcourseid`, `prvcoursefromdate`, `prvcoursetodate`). The proc name `migratefromTrainingHisToTrainingDraft` says "from training history to training draft". UNCONFIRMED: it copies the latest history row into `TrainingDrafting.prev*` columns and sets `trainid` = the target course.
- Step 4 `updateconfirmdatefortraining(startdate, todate, batchno)` is the only write that confirms attendance. UNCONFIRMED but strongly implied: it sets `TrainingDrafting.attenddate/closedate` for every row of the batch and inserts one `traininghist` row per rating (fromdate=start, todate=end, trainingid=`trainid`, institution, qualification). Reason: the draft row carries exactly the history columns (`attenddate`, `closedate`, `institutionid`, `trainid`, `qualification`). A similar proc, `performreportDateOperationforTraining(startdate, todate, batchno, svcno)`, is defined but never called from C#.
- Excel Upload writes history directly: `UploadExcelToTraining1` (UNCONFIRMED body) takes name, title, sex, svcno, presentship, DOJ, authority, institution, training, qualification, WEF, closedate, User. It returns an int (<= 0 means duplicate) and the C# counts rows in `tbl_Trainingupload`, so it writes there at least.
- New schema mapping (`src/db/migrations/20261116_090300_create_rating_records.sql`, table `rating_training`): `institution` (VARCHAR name), `qualification`, `classification`, `start_date`, `end_date`, `service_number` FK to `ratings`. It has NO training-course reference, NO batch and NO draft table.
  - Old `traininghist.fromdate/todate` map to `start_date/end_date`; `Qualification` maps to `qualification`; the institution name maps to `institution`.
  - The course (`traininghist.trainingid`, table `Training`) has no home. Probably `classification` or a new `ref_training` column. DECISION NEEDED.
  - Batch tables (`DOTBatchRecord`, `TrainingDrafting`) have no equivalent yet.

### Tables and procs used by the group

| Object | Kind | Columns / parameters | Used by |
|---|---|---|---|
| `DOTBatchRecord` | table | id (bigint identity), batchrequestname, status (int), batchnumber, batchcode, initiatedby, batchinitiateddate, batchclosedate, batchcloseby, reopencount, signalCode, created, modified, Month (nvarchar), Year (nvarchar), newtraining (nvarchar 50, course name), trainingid (int) | all pages |
| `batchSummaryViewDOT` | view | same columns as above, `initiatedby` nvarchar(256) (probably resolved to a user name; UNCONFIRMED) | Reports |
| `TrainingDrafting` | table | trainingid (bigint identity; row key, NOT the course id), personid, batchnumber, svcno, firstname, middlename, lastname, prevcourseid, prvcoursefromdate, prvcoursetodate, attenddate, closedate, rateid, titleid, lenghtofservice, institutionid, trainid (course id), qualification, currentTraining | review, update |
| `TrainingProposal` | view (read-only, no PK) | batchnumber, svcno, firstname, middlename, lastname, prevcourseid, prvcoursefromdate, prvcoursetodate, rateid, titleid, lenghtofservice, titlename, ratename, prevtrainingname, trainingid (draft row id), currentTraining | all lists, PDF |
| `tbl_Trainingupload` | table | id (identity), svcno, lastname, title, sex, present_ship, doj, signal, institution, training, qualification, attenddate, closedate | upload |
| `traininghist`, `getTraining` | table, view | see above | profile |
| `Month`, `Training`, `Rate`, `branch`, specialization area (`GetSpecializationArea`), `Person`, `Departments`, `Institutions`, `TitleTypes`, `Trainings` | lookups | | dropdowns and upload checks |

| Proc | Parameters as called | Called from | Implied behaviour (UNCONFIRMED) |
|---|---|---|---|
| `CreateBatchRecForDOT` | batchnumber, batchrequestname="DOT", initiatedby, batchcode="DOT-", month (id as text), year, training (name), trainingid | `TrainingDraftiningProcess` | Inserts `DOTBatchRecord` (status 0) unless an open batch already exists for that number. No duplicate guard is visible in C#. |
| `migratefromTrainingHisToTrainingDraftTex` | batchnumber, branchID, departmentID (the specialization drop-down), rankid, training | `Traininglistfilters` | Bulk-adds eligible ratings of that branch/department/rate to `TrainingDrafting` for the batch. The eligibility rule is NOT visible (no length-of-service or last-course threshold in C#). Value 0 ("All") probably means no filter. |
| `migratefromTrainingHisToTrainingDraft` | batchnumber, svcno, training (course id) | `TrainingProcess` | Adds one rating by Official Number. |
| `updateconfirmdatefortraining` | startdate, todate, batchno | `updateDateTraininghist` | See "feeds history" above. Returns Collection(String) (ignored). |
| `fetchOtherRecordforSummaryDOT` | batchno | `fetchBatchRecordForReportDOT` | Returns totalforbatch, totalposted, totalnotposted (ints). Read into `BatchRecordSummaryDOT` but the Reports grid does not display them. |
| `UploadExcelToTraining1` | see Excel Upload | `PostExcelData` | |
| `DeleteTrainingDraft` | none | only `AccountController.DeleteAuditFile` (line ~231) | Unrelated: the "delete audit file" action calls this training-draft proc. UNCONFIRMED what it deletes. Flag for the audit module. |

Shared helpers: `APIServices/IServiceImplementation/ISelectServiceImplementation.cs` (`GetTraining` gives value `"{id}_{Description}"`; `GetMonth` and `GetRating` give value id; `GetDOTBatch` gives open batches, value = batchnumber); `IDraftingPrepServiceImplementation.returnListofProposedTrainingDraftCloseD`.

Session state (all pages): `Session["batn"]`, `["training"]`, `["Stitleheader"]`, `["STrainingName"]`, `["TrainingId"]`, `["batchNumber"]`. Redirects and hidden fields depend on them (see faults).

---

## 1. Process Training Draft

| Item | Value |
|---|---|
| Menu | Training Drafting > Process Training Draft |
| URL | `GET /TrainingDraft/TrainingDraftiningProcess?STraining&SMonthDropDown&SYearDropDown` |
| Role | `Discharge` |
| Audit | `[Audit(AuditAction.TrainingDraftProposal)]` |
| View | `Views/TrainingDraft/TrainingDraftiningProcess.cshtml` |
| API calls | none (the commented-out DataTables block that called `DraftingAPI/getListofDraftPagedSearch` is dead) |

### Fields

| Label | Name | Type | Required | Options |
|---|---|---|---|---|
| Training | STraining | select | yes (HTML `required`, but "--Select Training" and "All" both have value `0_...` so required never fails) | table `Training`, value `id_Description` |
| Months | SMonthDropDown | select | yes (same weakness) | table `Month` (id, description) plus "--Select month" and "All" (id 0) |
| Years | SYearDropDown | select | yes | static: current year -1, current year, current year +1 |
| Search | submit | button | | |

The grid under the form (Official No, Surname, Middle Name, Last Name, Rate, Title, LOS, Last Course) is always empty here: the controller builds an empty list and then redirects.

### Behaviour (`TrainingDraftiningProcess`)

1. Runs only if STraining and SMonthDropDown are non-empty. Year is NOT checked.
2. Course id = text before the first `_` of STraining; course name = text after it.
3. Builds `batchnumber` (see overview). Stores session values `batn`, `training`, `Stitleheader` (`year / 0month`), `STrainingName`.
4. Calls `db.CreateBatchRecForDOT(...)`. Any `SystemException` is swallowed (status/errormessage variables are never shown).
5. ALWAYS redirects to `Traininglistfilters` (even after an error). With no parameters it just returns the form.

### Step 2 form: `Traininglistfilters` (`Views/TrainingDraft/Traininglistfilters.cshtml`)

| Label | Name | Type | Options | Notes |
|---|---|---|---|---|
| (hidden) training | STraining | text | `Session["training"]` | course id |
| Branch | SBranchId | select | `GetBranch` (table `branch`, text `busdesc`, value id) + "--Select Branch"/"All" (0) | required |
| Department | SSpecilization | select | `GetSpecializationArea` | required; label says Department, variable says Specialization, proc param is `departmentID` |
| Rate | SRankDropDown | select | `GetRating` (table `Rate`) + "--Select Rate"/"All" (0) | required |
| (hidden) batchnumber | batchnumber | text | `Session["batn"]` | |
| ADD | submit | button | | |

Action: runs only when batch, branch, specialization and rank are all non-empty (a "0" string counts as non-empty). It calls `db.migratefromTrainingHisToTrainingDraftTex(batch, branch, spec, rank, training)`, swallows errors, then redirects to `Trainingreview` WITHOUT the batch number (the user lands on an empty review page and must re-pick the batch).

---

## 2. Training Review

| Item | Value |
|---|---|
| Menu | Training Drafting > Training Review |
| URL | `GET /TrainingDraft/Trainingreview?batchNumber&STraining&page` |
| Role | `Discharge` |
| Audit | none on this action (`AuditAction.TrainingDraftReview` exists but is unused) |
| View | `Views/TrainingDraft/Trainingreview.cshtml` |
| Related actions | `GET /TrainingDraft/TrainingProcess?batchNumber&svcno&TrainingId` (add rating); `POST /TrainingDraft/DeleteConfirmed` (id, batchNumber; remove row) `[Audit(RemoveTrainingDraft)]` |
| API calls | none live. The trailing DataTables script uses `Url.Action("#","#")` and `api/Personel/getListofCurrentPersonelP`, selecting `#table1`, which does not exist: dead copy-paste code. |

### Fields

| Label | Name | Type | Required | Source | Action |
|---|---|---|---|---|---|
| Official Number | svcno | text | yes | free text | form GET `TrainingProcess` |
| (hidden) training | TrainingId | text | | `Session["TrainingId"]` | same form |
| (hidden) Batch Number | batchnumber | text | | `Session["batn"]` | same form |
| Add Rate | submit | button | | | adds one rating to the batch |
| Batch Number | batchNumber | select | yes | `GetDOTBatch`: open DOT batches (status 0), newest first, plus "--Select Batch" (id 0) | form GET `Trainingreview` |
| Process >> | submit | button | | | loads the batch |
| Training | label | | | `Session["STrainingName"]`, shown only if the model is non-null | |

Grid columns (from `TrainingProposal`): Official No (svcno), Surname (firstname), Middle Name, Last Name, Rate (ratename), Title (titlename), LOS (lenghtofservice), Last Course (prevtrainingname), Action. The Action column holds a "Remove Rate" button with a JS confirm.

### Behaviour

- `Trainingreview`: `returnListofProposedTrainingDraftCloseD` loads `DOTBatchRecord` by number (`getBatchDOT`) and all `TrainingProposal` rows of that batch (no paging, page size 200000000). If the list is non-empty it sets the session training name and id from the batch header. Errors are swallowed (`"1002"` message "Draft Must be Closed before you can review" is copy-pasted from the ship draft and never shown).
- `TrainingProcess`: calls `db.migratefromTrainingHisToTrainingDraft(batchNumber, svcno, int.Parse(TrainingId))`. Errors are swallowed. Redirects to `Trainingreview?batchNumber=` (it replaces `%3A` with `:`).
- `DeleteConfirmed`: `db.TrainingDraftings.Find(id)`, `Remove`, `SaveChanges`. `id` is the TrainingDrafting row id (`f.trainingid`). It is a hard delete. There is no check that the batch is still open, and errors are swallowed.

---

## 3. Update Training History

| Item | Value |
|---|---|
| Menu | Training Drafting > Update Training History |
| URL | `GET /TrainingDraft/trainingdraftenddate?batchNumber` |
| Role | `Discharge` |
| Audit | `[Audit(TrainingDraftWEFDate)]` on view; `[Audit(UpdateNewTrainingDraft)]` on save |
| View | `Views/TrainingDraft/trainingdraftenddate.cshtml` |
| Save | `POST /TrainingDraft/updateDateTraininghist` (batchno, fromdate, todate) |
| API calls | none live (same dead DataTables block as Review) |

### Fields

| Label | Name | Type | Required | Source |
|---|---|---|---|---|
| Batch Number | batchNumber | select | yes | `GetDOTBatch` (open batches) |
| Process >> | submit | button | | loads the batch grid |
| Training | label | | | `Session["STrainingName"]` |
| (hidden) Batch Number | batchno | text | | `Session["batn"]` (NOT the dropdown value) |
| Start Date | fromdate | text, datepicker `dd/mm/yyyy`, maxlength 10 | no HTML required | |
| End Date | todate | text, datepicker | no HTML required | |
| Save | submit | button | | |

Grid: same columns as Review plus a "Remove Rate" button posting to `TrainingDraft/RemoveConfirmed`. That action DOES NOT EXIST (see faults).

### Behaviour

- `trainingdraftenddate`: same loader as Review. `Session["batn"]` is set only when the list has at least one row.
- `updateDateTraininghist(batchno, DateTime fromdate, DateTime todate)`: the null checks are meaningless on non-nullable `DateTime`. It calls `db.updateconfirmdatefortraining(fromdate, todate, batchno)` for the WHOLE batch (one date pair for all ratings). It redirects to `Traingfilters` with no parameters, so there is no success message. Errors return a JSON `RResponse{status:"0", errorcode:"500"}`.
- No rule checks `fromdate <= todate`, nor that dates are not in the future.

---

## 4. Reports (Draft Summary Report)

| Item | Value |
|---|---|
| Menu | Training Drafting > Reports |
| URL | `GET /TrainingDraft/summaryreport` |
| Role | `Discharge` |
| View | `Views/TrainingDraft/summaryreport.cshtml` (batch list) and `trainingdraftingreport.cshtml` (batch detail + PDF button) |
| Controller | `summaryreport()`, `trainingdraftingreport(string batchno)`, `traininglistexecute(draftingSummarysearch)` |

### Ajax calls

| Page | URL | Verb | Payload (DataTables adds sEcho, iDisplayStart, iDisplayLength) | Fills |
|---|---|---|---|---|
| summaryreport | `/api/DraftingAPI/getSummaryReportDOT` (`APIController/DraftingAPIController.cs summaryReportBatchandDOT`) | GET | month, year, trainingid, batchno | table `#table1`: newtraining (link to detail), batchnumber, Month, Year, status (1 = green CLOSED, 0 = amber OPEN), initiatedby, batchinitiateddate |
| trainingdraftingreport | `/api/DraftingAPI/getDraftingReportbyBatchDOT` (`summaryReportBatchandSignalFullDOT`) | GET | batchno | table: svcno, firstname, middlename, lastname, ratename, titlename, prevtrainingname |

### Fields on `summaryreport`

| Label | Name | Type | Required | Options |
|---|---|---|---|---|
| Training | STraining | select | yes | `GetTraining` |
| Months | SMonthDropDown | select | yes | `GetMonth` |
| Years | SYearDropDown | select | yes | static: current year -1, current year, current year +1 |
| Search | submit (GET `summaryreport`) | button | | |

The controller also fills `ViewData["BatchRecordOpen"]`, which the view never uses.

### Rules

- `fetchBatchRecordForReportDOT` (`HRProjectDAL/APIImplementationRepository/IDraftingRepoImplementation.cs`): reads `batchSummaryViewDOT` filtered ONLY by batchnumber (`"0"` = all), ordered by id, with Skip/Take. It calls `fetchOtherRecordforSummaryDOT` per row.
- `fetchBatchRecordForReportCountDOT`: the count DOES filter by prefix `DOT-`, training name, year (StartsWith) and month (EndsWith). The page list and the count therefore disagree whenever a filter is used.
- In practice the filters do nothing: `search()` in the view reads `#trainingid` and `#batchnoid`, which do not exist (they belong to the detail page), so the form is submitted as a normal GET and the table reloads with `month=year=trainingid=batchno=0`. The Training/Month/Year drop-downs are therefore decorative. Build a working filter in the new system.
- Detail page: `fetchBatchRecordForReportFullDOT` takes the first matching batch and returns its `TrainingProposal` rows (paged) plus batch summary.

### Printout

| Item | Detail |
|---|---|
| Trigger | "Generate PDF" button on `trainingdraftingreport` (POST `TrainingDraft/traininglistexecute`, hidden `batchnumber`, `training`) |
| Report file | `RDLCReport/CrystalReportforTrainingCourse.rpt` (loaded in `traininglistexecute` via `Server.MapPath("~//RDLCReport//CrystalReportforTrainingCourse.rpt")`) |
| Data source | `rrr.SetDataSource(List<TrainingReportView>)`. Class in `HRProjectDAL/APIModel/DraftingReportView.cs`. |
| Fields supplied | batchnumber, svcno, firstname (= first + middle + last concatenated with NO spaces), prevtrainingname, prvcoursefromdate, prvcoursetodate, ratename, titlename, currentTraining. Fields on the .rpt layout itself are UNCONFIRMED (binary; strings could not be read). |
| Output | PDF stream, file name "Training draft Report.pdf" |
| Row source | `fetchBatchRecordForReportFullDOTCR`: all `TrainingProposal` rows of the first batch matching `batchnumber` (no paging) |
| Not used here | `RDLCReport/CrystalReportForTraining.rpt` is loaded only by `EmployeeController` (line ~3802, the rating's own training printout). `TrainingDataSet.xsd` is unused. |

---

## 5. Excel Upload

| Item | Value |
|---|---|
| Menu | Training Drafting > Excel Upload |
| URL | `GET /TrainingDraft/ExcelUpload`; `POST /TrainingDraft/UploadExcel`; sample `GET /TrainingDraft/Download?filename=traininexcel.xlsx` |
| Role | `Discharge` |
| View | `Views/TrainingDraft/ExcelUpload.cshtml` (title "Upload Training") |
| Ajax | none (plain multipart form). JS only blocks submit when no file is chosen (SweetAlert "Please select file"). |

### Fields

| Label | Name | Type | Required | Validation |
|---|---|---|---|---|
| (file) | FileUpload | file input | yes (JS check) | server: content type `application/vnd.ms-excel` or `...spreadsheetml.sheet`, name ends `.xlsx` |
| Upload File | submit | button | | |
| Download Sample File | link | | | serves `App_Data/UploadFormat/traininexcel.xlsx` |

Page notes shown to the user: "Duplicate record will not be Uploaded." and "All dates must be in a correct date format".

### Template `App_Data/UploadFormat/traininexcel.xlsx`

Sheet name `Sheet1` (the code reads `"Sheet1"`). Header row (headers only; no data read):

`trainingid | svcno | lastname | title | sex | present_ship | doj | signal | institution | training | qualification | attenddate | closedate`

LinqToExcel maps columns to class `tbl_Trainingupload` by name. That class has `id`, not `trainingid`, so the first column probably does not bind (UNCONFIRMED) and error text shows "Line 0".

### Import (`UploadExcel`)

1. Reject if no file; reject if content type is not Excel ("Only Excel file format is allowed"); reject if the name does not end in `.xlsx` ("This file is not valid format").
2. Save to `App_Data/UploadFormat/<original file name>` (overwrites).
3. Pass 1, per row with non-null `svcno` (stops at the FIRST failure and returns the page with a message):

| Check | Lookup | Message |
|---|---|---|
| svcno exists | `People.SVC_NO` | "Line {id}{svcno} ) Official Number is not Valid" |
| present_ship exists | `Departments.Description == present_ship` | "Line {id} {ship} Present Ship does not Exist" |
| institution exists | `Institutions.Description` | "... Drafted to Ship does not Exist" (wrong label) |
| title exists | `TitleTypes.Name == title` | "... Rate does not Exist" |
| training exists | `Trainings.Description` | "... Rate does not Exist" (wrong label) |

4. Pass 2, per row with non-null `svcno`: `Convert.ToDateTime` on `attenddate`, `closedate`, `doj`, then `db.UploadExcelToTraining1(lastname, title, sex, svcno, present_ship, doj, signal (as "authority"), institution, training, qualification, attenddate, closedate, User.Identity.Name)`. A result <= 0 prints "Hello User, Found some duplicate Official Number" and continues. Any positive result sets the message "Successful upload records" and `trainl` = row count of the whole `tbl_Trainingupload` table + " Rows was added".
5. A row with null `svcno` in pass 2 returns "Some fields are null, Please check your excel sheet" (after earlier rows were already inserted).
6. Writes: `tbl_Trainingupload` (UNCONFIRMED) and training history (UNCONFIRMED; see overview). Duplicate rule is inside the proc (UNCONFIRMED); likely svcno + training + dates.

---

## 8. Faults of the old module that must NOT be copied

| # | Fault | Where |
|---|---|---|
| 1 | No server-side authorization: role only hides menu items; API actions are `[AllowAnonymous]`. | `TrainingDraftController`, `TrainingDraftingAPIController` |
| 2 | Every proc error is swallowed (empty catch or unused `status`/`errormessage`); the user never sees a failure, and the process page still redirects. | `TrainingDraftiningProcess`, `Traininglistfilters`, `TrainingProcess`, `DeleteConfirmed` |
| 3 | Month is formatted `"0" + month`, so Oct-Dec batch numbers become `/010/`..`/012/`; the title header is wrong too. | `TrainingDraftiningProcess` line ~100 |
| 4 | "--Select" and "All" options have valid-looking values (`0_All`, id 0), so a batch for training id 0 or month 0 can be created; `required` is defeated. Year is never checked. | `GetTraining`, `GetMonth`, process page |
| 5 | Workflow state kept in Session (`batn`, `TrainingId`, `STrainingName`): Review's "Add Rate" and Update's date Save use the SESSION batch, not the batch picked in the drop-down. After choosing a different batch (especially one with 0 rows, where the session is not refreshed) dates or ratings land on the wrong batch. | `Trainingreview`, `trainingdraftenddate`, hidden fields in both views |
| 6 | After ADD in step 2 the redirect drops the batch number, so the Review page shows nothing. | `Traininglistfilters` |
| 7 | `Session["STrainingName"].ToString()` throws if the session is empty. | `Trainingreview.cshtml`, `trainingdraftenddate.cshtml` |
| 8 | "Remove Rate" on Update Training History posts to `TrainingDraft/RemoveConfirmed`, which does not exist (404). | `trainingdraftenddate.cshtml` |
| 9 | One date pair applied to the whole batch with no check that start <= end, and no per-rating attendance. `DateTime` binding with the `dd/mm/yyyy` datepicker depends on server culture (day > 12 can fail). No confirmation message after save. | `updateDateTraininghist` |
| 10 | Nothing closes a DOT batch, and no state guard stops add/remove/date-update after the fact. | whole module |
| 11 | Summary-report filters broken (JS reads non-existent inputs); list ignores training/month/year while the count honours them. | `summaryreport.cshtml`, `fetchBatchRecordForReportDOT` vs `...CountDOT` |
| 12 | PDF: casts nullable `prvcoursefromdate`/`prvcoursetodate` to `DateTime`, which throws for a rating with no previous course (a first-time trainee); name fields are concatenated without spaces. | `traininglistexecute` |
| 13 | Upload: wrong messages (institution says "Drafted to Ship", training says "Rate"); the line number printed is the unbound `id` (likely 0); the file is saved under the client-supplied name into App_Data (overwrite, no path sanitising); content type is client-controlled; the success count is the whole table; validation stops at the first bad row, but inserts are not transactional and can half-apply; empty date cells throw in `Convert.ToDateTime`; `sex` is never validated; name lookups use free-text Description. | `UploadExcel` |
| 14 | Dead or misleading code: `Traingfilters` dereferences a null `DOTbtchRecord` when a batch is passed; `uploadfromexcel` redirects to a missing `SpecialDraft` action; `Trainingproposal` page (its comment says "move to discharge") and the `Remove`/`Delete` views are orphaned; `trainingdraftingreport` page is only reachable by the Reports link. | `TrainingDraftController` |
| 15 | `AccountController.DeleteAuditFile` calls the training proc `DeleteTrainingDraft`. | `Controllers/AccountController.cs` line ~231 |

---

## Hand-off notes for design/build

- Read first: sections 0 (workflow and "feeds history"), then the proc table. Everything in the stored procs is inferred. Before building, ask the domain owner:
  1. What makes a rating eligible for a course (length of service, time since last course, branch/department/rate)? This rule lives only in `migratefromTrainingHisToTrainingDraftTex`.
  2. Does Save in "Update Training History" create `rating_training` rows? (We assume yes.) Per rating or per batch dates?
  3. Who closes a batch, and can a closed batch be reopened (`reopencount` exists)?
- Build as a single guided flow: create batch (course, month, year; unique key), pick the selection filters, review/add/remove rows, enter dates, confirm (this writes `rating_training`), close. Keep the state in the DB, not in session.
- Map to `rating_training` (see overview). Decide where the course (`Training` lookup) lives; the old upload and drafts reference it by name.
- Replace free-text name lookups in the upload with an id-based template; validate all rows first, then insert in one transaction, and return a per-row error list.
- Role `Discharge` is shared with the Discharge module; consider a separate permission for training.
- Risks: PDF layout (.rpt fields unreadable; rebuild from `TrainingReportView` plus the on-screen columns); privacy of the uploaded names/service numbers.
