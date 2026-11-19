# Legacy map: Advancement Processing (old CIRERMS)

Scope: the 7 pages under the menu group "Advancement Processing" plus the helper pages they link to. Old code root: `/home/user/cirems` (project folder `hpproject`, DAL `HRProjectDAL`). Paths below are relative to those.
"UNCONFIRMED" = inferred; stored procedure and view bodies are not available anywhere (brief, KEY FACT).

Abbreviations: `AC` = `hpproject/Controllers/AdvancementController.cs`; `API` = `hpproject/APIController/AdvancementAPIController.cs`; `SVC` = `hpproject/APIServices/IServiceImplementation/IAdvancementPrepServiceImplementation.cs`; `REPO` = `HRProjectDAL/APIImplementationRepository/IAdvancementRepoImplementation.cs`; `BATCH` = `HRProjectDAL/APIImplementationRepository/IBatchCreationImplementation.cs`; `EDMX` = `HRProjectDAL/Core/HicadHRProjectModel.edmx`; `SEL` = `hpproject/APIServices/IServiceImplementation/ISelectServiceImplementation.cs`.

## 0. Overview and shared mechanics

### 0.1 Menu and privileges (`Views/Shared/_menu.cshtml` lines 130-145)

| Menu label | URL (MVC) | `IsInRole` | Live in menu? |
|---|---|---|---|
| Rates due for Advancement | `/Advancement/advancementfilters` | `Drafting` | yes |
| Advancement Review | `/Advancement/advancementreview` | `Drafting` | yes |
| Approval | `/Advancement/Advancementapproval` | `SystemAdministration` | yes (the whole group is live; see 0.1a) |
| Close | `/Advancement/closeadvancement` | `SystemAdministration` | yes |
| Board Returns Update | `/Advancement/advancementenddate` | `SystemAdministration` | yes |
| Report on Promoted Rates | `/Advancement/summaryreportforadvancement` | `SystemAdministration` | yes |
| Upload Advanced Rates | `/Advancement/ExcelUpload` | `SystemAdministration` | yes |

0.1a Brief says Approval and Close are "in the code but not in the live menu". What the code shows: all seven `<li>` lines in `_menu.cshtml` 134-143 are NOT inside `@* *@`, so they ARE rendered for the right role. What the owner means is probably that in the deployed system they were not in use. Reachability today: both pages are reachable from the menu for `SystemAdministration`; the real approval action is NOT on the Approval page itself but on a second page `AdvancementreportByDept` (section 4). Treat Approval and Close as in scope as the owner decided.

Server side: `AdvancementController` has no `[Authorize]`/role attribute (grep in `AC`), `App_Start/FilterConfig.cs` only adds `HandleErrorAttribute`, and every API action is `[AllowAnonymous]`. So the role is enforced only by hiding menu items (UNCONFIRMED whether anything else, such as a base class or web.config, protects it). Do not copy: enforce the role on every action.

### 0.2 Data objects used across the module (`EDMX`)

| Object | Kind | Columns (as defined) | Role |
|---|---|---|---|
| `advancement` | table | `advanceid` (PK identity), `batchnumber` nvarchar(25), `svcno` nvarchar(15), `Shipid`, `CurrentRateid` int, `Age`, `LOS`, `Duration` int, `Proposedby`, `ProposedDate`, `AdvancedBy`, `DateAdvanced` datetime, `Signal` nvarchar(50), `senioritydate` date, `newrate` int, `newrateA` int, `specid` int, `approveby` nvarchar(150), `approverank` nvarchar(50), `approvedate` date, `draftofficer` nvarchar(50), `draftperiod` nvarchar(50), `approvalAppointment` nvarchar(50), `deploymentvice`, `remark` | the advancement proposal row, one per person per batch |
| `BatchRecord` | table | `id`, `batchrequestname`, `status` int (0 open, 1 closed), `batchnumber`, `batchcode`, `initiatedby`, `batchinitiateddate`, `batchclosedate`, `batchcloseby`, `reopencount`, `signalCode` nvarchar(20), `dept_rank` nvarchar(50), `specid`, `approveby`, `approvedate`, `approverank`, `draftofficer`, `draftperiod`, `approvalappointment` | batch header, shared with drafting |
| `promotionshist` | table | `id`, `PersonID`, `fromdate`, `todate`, `rank`, `decoration`, `signal`, `createdby`, `datecreated`, `NosGCBS`, `branchid`, `departmentid`, `rateid` | rate history per person (one row per rate held). Source of "time in rate". New equivalent: `rating_advancement` (`src/db/migrations/20261116_090300_create_rating_records.sql`: `service_number,start_date,end_date,rate_id,decoration,authority,gcbno`) |
| `tbl_advancementUpload` | table (keyless in EDMX) | `id, Name, svcno, fromdate, oldrate, newrate, sex, decoration, signal, ship, doj, createdby, datecreated, Remark, AuditId, SessionID, IpAddress` | staging/audit of uploaded rows (written by proc `UploadpromotionHist`, UNCONFIRMED) |
| `V_advance` | SQL view | `PersonID, TitleTypeId, Rateid, branchid, busdesc, departmentname, Name, ratename, noofmonthsspent, personfname/mname/lname, serviceno, fromdate, departmentid, specialization` | candidates "due" for advancement, read by `REPO.returnListofProposedAdvance` |
| `retrieveAdvancementProposalADVANCETB` | SQL view | `batchnumber, advanceid, svcno, LOS, Age, FirstName, MiddleName, LastName, PersonID, branchid, Duration, newrate, DateAdvanced, TitleTypeId, specialization, rate, Rateid, ratename, ratenameC, senioritydate, busdesc, staffbranchname, departmentname, statename, exittypename, exittypedesc` | rows of `advancement` joined to person data, for the review grids |
| `retrieveAdvanceNotUpTo` | SQL view | `id, rank, rateid, branchid, fromdate, todate, decoration, signal, createdby, PersonID, busdesc, departmentname, Name, ratename, appntmentname, noofmonthsspent, personfname/mname/lname, serviceno, departmentid` | people NOT yet up to the required time in rate (name inferred), used by "Add Personnel" |
| `retrieveAdvanceToAddUpPerson` | SQL view | `PersonID, TitleTypeId, Rateid, branchid, busdesc, departmentname, ratename, Name, noofmonthsspent, names, serviceno, fromdate, departmentid, apptno, pre_appt, decoration` | second lookup for "Add Personnel" (UNCONFIRMED meaning) |
| `AdvanceReport` | SQL view | `batchnumber, advanceid, svcno, LOS, Age, names, PersonID, branchid, Duration, newrate, newrateA, DateAdvanced, Rateid, ratename, senioritydate, busdesc, departmentname, Signal, rate, SexName, Initials, dateemployed, draftperiod, specid, specialisation, approveby, approverank, approvedate, draftofficer, approvalAppointment, deploymentvice, remark` | report view over `advancement`. `rate` = old rate name, `ratename` = new rate name (per `AC.advtexecute`: `newratename = getS.ratename; ratename = getS.rate`) |
| `batchSummaryView` | SQL view | `BatchRecord` columns plus `initiatedby/batchcloseby` user names | batch list for report |
| `getPromotionhist` | SQL view | promotion history with names, rate name, ship | person-profile history (outside this module) |

Lookups: `Rate` (`id`, `rate1` = rate name; `SEL.GetRating`), `branch` (`id`, `busline` code, `busdesc` name), `Specializationarea` (`id`, `sp_code`, `sp_desc`; the "Department" on these pages), `TitleType` (`SEL.GetRate`, NOT the rate table; see faults), `AspNetUsers` (`UserName`, `RolenameID`, `specid`). New equivalents: `ref_rate`, `ref_branch`, `ref_specialisation`, `ratings.rate_id/seniority_date/date_employed/branch_id/specialisation_id`.

### 0.3 Procedures called (names, params as called; bodies UNCONFIRMED)

| Procedure | Called from | Parameters as called | Result C# reads | Implied behaviour (UNCONFIRMED) |
|---|---|---|---|---|
| `CreateBatchRec` | `BATCH.createBatch` via `SVC.returnListofProposedAdvanceLimitedD` | batchnumber, batchrequestname, initiatedby, batchcode, deptrank (`branch_spec_rate` ids), specid, draftofficer, draftperiod | int | inserts `BatchRecord` row, status 0 |
| `migratefromPromotionHistToAdvancement` | `REPO.moveProposalDatatoAdvance` | batchnumber, branchID, departmentID (=spec id), rankid, user, period | none | copies the due people for that branch/department/rate into `advancement` with this batch number, `draftperiod`, `Proposedby`, `Age`, `LOS`, `Duration`, `senioritydate`, `CurrentRateid` |
| `migrateSingleAdvancement` (Dapper, `commandTimeout 2000`) | `REPO.addRecordToAdvance` | `@batchnumber, @personelsvcno, @departmentID (=specid), @rankid (=CurrentRateid), @user, @period` | none | same as above for one person |
| `deletedraft` | `AC.ClearAdvancement` | `batchno` | none | deletes the batch's draft rows (shared with drafting; whether it also deletes the `BatchRecord` is unknown) |
| `ApproveDraft` | `REPO.updateAdvanceByApproval` | rank, name, departid (=specid), draftingOfficer (receives the appointment text), period (`DOA`+month+year) | none | writes `approverank/approveby/approvalAppointment/approvedate` on the dept's rows of that period |
| `performUpdateBatchforadvancement` | `REPO.closeAdvance` | closedate, batchno (receives `DOA<m><yyyy>`), signalno, username | `string` ("1" = ok; anything else = "signal used before") | refuses a reused signal; sets batch status 1, `batchclosedate`, `batchcloseby`, `signalCode`, and `advancement.Signal` |
| `performreportDateOperationforadvancement` | `REPO.updateAdvanceDate` | startdate, batchno, svcno, signal | string | sets `advancement.DateAdvanced` for one person (and possibly posts the new rate; see 5.3) |
| `updateconfirmdate` | `REPO.updateAdvanceDateA`, `AC.updateDateAdvancementA` | batchnumber, startdate | string | sets `DateAdvanced` for the whole batch |
| `fetchOtherRecordforSummaryForAdvance` | `REPO.fetchBatchRecordForReport(CR)` | batchno | `totalforbatch, totalposted, totalnotposted` | counts rows of a batch, posted = date advanced entered (UNCONFIRMED) |
| `fetchOtherRecordforSummaryBydept2` | `REPO.fetchsummaryByDept2` | specid, type (always 2) | `totalforbatch, totalposted, totalnotposted, totalos, totalsm, totalab, totalls, totalpo, totalwo, totalmwo, totalnwo` | per-department counts by (new) rate group; meaning of `type` unknown |
| `UploadpromotionHist` | `AC.PostExcelData` | name, oldrate, newrate, sex, svcno, presentship, authority, WEF, decoration, User, Remarks | int rows affected | inserts a history row; returns <=0 when the official number was already loaded |

Procedures in the model that look relevant but are NOT called by this module's code: `fetchPersonelDue(ranktitle)` (returns `Int32` collection; no caller in C#), `performRestoreOperationAllDept(spec, period)`, `closeDraft`. Possibly where "due" logic lives; bodies unknown.

### 0.4 Batch numbering and status columns

| Item | Rule | Evidence |
|---|---|---|
| Batch code | `"DOA-" + branch.busline + Specializationarea.sp_code + Rate.rate1 + "-"` (config `AdvanceindBatchPrefix = "DOA-{0}{1}{2}-"`) | `Web.config` line 41; `SVC.returnListofProposedAdvanceLimitedD` |
| Batch number | batch code + 6-digit counter. Counter = 000001 if no closed batch with that code, else (number after the code in latest closed batch) + 1 | same method, `returnLatestClosedBatch` |
| Batch type | `BatchRecord.batchrequestname = "DOA Advancement for Department and Rate"`; `dept_rank = branchId_specId_rateId` | same method |
| `BatchRecord.status` | 0 = open (editable), 1 = closed (a signal/authority was added) | `BATCH.verifyOpenBatch`, `getAllOpenBatch` (status 0), `getAllOpenBatchWithSignal` (status 1 and `signalCode != null`); `summaryreportforadvancement.cshtml`: 1 "CLOSED", 0 "OPEN" |
| Period | `"DOA" + month + year`, no zero padding (e.g. `DOA112026`); stored in `BatchRecord.draftperiod`, `advancement.draftperiod` | `AC.advancementfilters`, `AC.closeAdvancement`, exports |
| Pending (not yet advanced) | `advancement.DateAdvanced == null && advancement.Signal == null` | `REPO.fetchsummaryByDept2` |

Record life cycle (all in the DB, no explicit status column on `advancement`):

| Step | Page | Writes |
|---|---|---|
| 1 propose | Rates due (search) | `BatchRecord` (status 0) + `advancement` rows (`batchnumber, svcno, CurrentRateid, Duration, ... draftperiod, Proposedby`) |
| 2 review | Advancement Review | `advancement.newrate`; add/remove rows |
| 3 approve | `AdvancementreportByDept` (from Approval) | `advancement.approve*` fields |
| 4 close | Close | `BatchRecord.status=1, signalCode, batchclosedate, batchcloseby`; `advancement.Signal` |
| 5 board returns | Board Returns Update | `advancement.DateAdvanced` (date of advancement / WEF) |
| 6 report | Report on Promoted Rates | read only |
| alt | Upload Advanced Rates | history rows loaded outside the batch flow |

Page order in practice: Board Returns only lists batches that are already closed with a signal, so close comes before the board date; Approval/Close have no check of each other (no code requires approval before closing).

### 0.5 Drop-down sources and ids (`SEL`, `BATCH`)

| Drop-down | Method | Items | Value format |
|---|---|---|---|
| Branch (filters) | `GetBranchS` | `branch`, with `--Select Branch` and `All` inserted (both id 0) | `id_busline` |
| Department (filters) | `GetSpecializationAreaS(user.specid)` | `Specializationarea`; user with `AspNetUsers.RolenameID == 7` sees all (code forces specid 7); others see only their own `specid`; placeholders `--Select Department`, `All` | `id_sp_code` |
| Rate (filters) | `GetRatingS` | `Rate` with `--Select Rate`, `All` | `id_rate1` |
| Rate (review rows, enddate) | `GetRating` | `Rate`, placeholders id 0 | `id` |
| Open batches (review) | `GetDOABatch` -> `getAllOpenBatch("DOA")` | `BatchRecord` where `batchcode StartsWith "DOA"` and status 0, newest first | `batchnumber:dept_rank` |
| Closed batches with signal (board returns) | `GetDOABatchOpenBatchWithSignal` -> `getAllOpenBatchWithSignal("DOA")` | status 1, `signalCode != null` | `batchnumber:dept_rank` |
| Branch (summary) | `GetBranch` | `branch` | `id` |
| Rate (summary) | `GetRate` | `TitleType` (`Name`, `TitleTypeId`), NOT `Rate` (fault) | `TitleTypeId` |

## 1. Rates due for Advancement

### 1.1 Page
| Item | Value |
|---|---|
| Label / URL / role | Rates due for Advancement / `GET /Advancement/advancementfilters?SBranchId=&SSpecilization=&SRankDropDown=&page=` / `Drafting` |
| Action | `AC.advancementfilters(string SBranchId, string SRankDropDown, string SSpecilization, int? page)`; view `Views/Advancement/advancementfilters.cshtml`, model `IPagedList<retrieveAdvancementProposalADVANCETB>`; page size 25 (`pageSize = 25`) but the pager markup is commented out, so only the first 25 rows show (fault) |
| API | none used (a DataTables script bound to non-existent ids `#procewssBTN`, `#table1`; it would call `GET api/AdvancementAPI/getListofAdvancementtPagedSearch`, which returns an empty list; dead code) |
| Audit | `AuditAction.AdvancementProposal` written on every call, `Data = GeneralUse.returnString(emp)` (whole list dumped into audit) |

### 1.2 Fields
| Label | Control / name | Required | Options | Validation |
|---|---|---|---|---|
| Branch | select `SBranchId` | `required` attr (placeholder value `0_` passes it) | `GetBranchS` | none server side |
| Department | select `SSpecilization` | `required` attr | `GetSpecializationAreaS` (limited to the user's department unless `RolenameID == 7`) | `SSpecilization.Substring(...)` throws if null |
| Rate | select `SRankDropDown` | `required` attr | `GetRatingS` | none |
| button "Double Click Here To Search" | submit GET | | | label wrong: one click is enough |

### 1.3 Behaviour of Search (this is the core of the module)
Search both reads and creates data. In `SVC.returnListofProposedAdvanceLimitedD`:
1. Build batch code from branch `busline`, department `sp_code`, rate `rate1` (0.4).
2. `verifyOpenBatch(batchcode)`: a batch with that code and status 0.
3. If an open batch exists: list `retrieveAdvancementProposalADVANCETB` filtered by rate (0 = all), branch (0 = all), department (0 = all) and that `batchnumber` (`REPO.returnListofProposedAdvanceD`).
4. If none: take latest closed batch of that code, new number = last + 1 (6 digits); count the candidates `V_advance` where `Rateid == rate` (0 = all) and `branchid == branch` and (department == 0 or `specialization == dept`) (`REPO.returnListofProposedAdvance`). Only if that count is greater than 1 (`> 1`, so exactly one candidate creates nothing, fault): `CreateBatchRec`, then `migratefromPromotionHistToAdvancement(batchnumber, branch, dept, rate, user, "DOA"+m+yyyy)`, then list the new rows (`returnListofProposedAdvanceLimitedD`: when `spec > 0` filter only by department and batch, otherwise by rate/branch/department/batch ordered by `batchnumber`).
5. Any exception becomes `SystemException` with text from `appSettings["erroraccessingpersonelreport"]`; the controller swallows it and returns an empty grid.

### 1.4 Grid columns (view; label vs actual field)
| Header | Bound to | Note |
|---|---|---|
| Official No | `svcno` | |
| Surname | `FirstName` | label wrong (first name shown as "Surname") |
| Middle Name | `MiddleName` | |
| Last Name | `LastName` | |
| Current Ship | `departmentname` | label wrong: it is the department, not a ship |
| Age (YRS) | `Age` | |
| LOS (YRS) | `LOS` (length of service) | |
| Current Rate | `ratename` | enddate page uses `ratenameC` for "Current Rate"; which of the two is the current rate is UNCONFIRMED |
| Duration (MONTHS) | `Duration` coloured | months at current rate |
| New Rate | empty cell | no data shown |

Colour bands for Duration (`advancementfilters.cshtml`, `advancementreview.cshtml`, `advancementenddate.cshtml`; identical):
| Duration (months) | Label |
|---|---|
| < 48 | no badge (blank) |
| 48 to 50 | green `label-success` |
| 51 to 54 | amber `label-warning` |
| > 54 | red `label-danger` |
Unused DataTables code in the same views uses 18-20 / 21-24 / >24 (copied from drafting); ignore.

### 1.5 Eligibility: who is due and why (exact status of the evidence)
| Criterion asked | Finding | Evidence |
|---|---|---|
| Current rate | Selected on the page; candidates are people whose current rate equals the selected rate (`Rateid == rank`, 0 = all) | `REPO.returnListofProposedAdvance` |
| Branch and department | candidates filtered by `branchid` and `specialization`; officer's department fixed by `AspNetUsers.specid` | same; `AC.advancementfilters` |
| Time in rate | `V_advance.noofmonthsspent` (months since `fromdate`, the start of the current rate, most likely `promotionshist.fromdate`); `advancement.Duration` copies it. Display bands start at 48 months (4 years); the actual cut-off applied inside `V_advance` is UNCONFIRMED (48 is the likely value because nothing below 48 is coloured) | views, `V_advance` columns |
| Not-yet-due people can be added by hand | yes: `retrieveAdvanceNotUpTo` ("not up to") feeds "Add Personnel" on the review page, so `V_advance` is stricter than the manual add | `API.getListInfoToAdd` |
| Qualifications, exams, board result, vacancy, rank-specific rules | NOT FOUND. No column, parameter, table or LINQ condition for any of them in the `V_advance`, `retrieve*` or `AdvanceReport` column lists, in the procedure parameters, or in the C#. If the views/procedures apply them, they do it invisibly (UNCONFIRMED). The only "reason" field (Outstanding / Special Requests / Others on the review form) is not saved |
| Appraisal grades | NOT used in C#; see "Appraisal dependency" |
| Next rate | Not computed anywhere in C#. The reviewer picks any `Rate` from the drop-down per person; no rule limits it to the next rate up |

Design consequence: the due-list rule must be re-specified with the owner (time in current rate in months, rate, branch, department); do not assume anything else was enforced.

### 1.6 Faults not to copy
| Fault | Where |
|---|---|
| GET request creates batches and copies rows (side effects on search, double click re-run) | `AC.advancementfilters`, `SVC.returnListofProposedAdvanceLimitedD` |
| `Count > 1` instead of `>= 1` | `SVC.returnListofProposedAdvanceLimitedD` |
| placeholders "--Select ..." selectable and `required` does not stop them; null department crashes | `advancementfilters.cshtml`, `AC.advancementfilters` |
| pager removed, only 25 rows | `advancementfilters.cshtml` |
| wrong column labels (Surname/Current Ship), "Double Click" label | same |
| batch counter derived from the latest CLOSED batch only, risk of duplicates if two users search at once | `SVC` |
| whole result written to audit trail | `AC.advancementfilters` (`Data = GeneralUse.returnString(emp)`) |
| no server-side role check | 0.1 |

## 2. Advancement Review

### 2.1 Page
| Item | Value |
|---|---|
| Label / URL / role | Advancement Review / `GET /Advancement/advancementreview?batchNumber=<batchnumber>:<dept_rank>&page=` / `Drafting` |
| Actions | `AC.advancementreview` (GET); `AC.addnewAdvance` (POST, `AuditAction.AddNewAdvancement`); `AC.removefromadvance` (POST, `RemoveAdvancement`); `AC.ClearAdvancement` (no `[HttpPost]`, called by POST form); `AC.DownloadExcel1(int specid)` (POST) |
| API (all `[AllowAnonymous]`, Web API route `api/{controller}/{action}/{id}`) | `GET api/AdvancementAPI/getListofServiceNoToAdd?serviceno=&deptrank=`; `GET api/AdvancementAPI/getListofToAdd?personelname=&deptrank=` (UI box commented out); `POST api/AdvancementAPI/updateNewRate` (form body `svcno='V1'`, `valueu=JSON`) |
| Audit | `AdvancementReview` |

### 2.2 Fields and buttons
| Label | Control | Required | Options / source | Behaviour |
|---|---|---|---|---|
| Batch Number | select `batchNumber` (GET form) | `required` | open DOA batches (0.5) | loads batch; `batchNumber.Substring(0, IndexOf(":"))` = batch; placeholder crashes |
| Process >> | submit | | | `returnListofProposedAdvanceD`: reads the batch (`getBatch`), then `retrieveAdvancementProposalADVANCETB` by batch; sets `ViewBag.closeadvance` when rows exist |
| Clear Draft | POST form to `ClearAdvancement` (`batchnoid`, `queryStringpath2`) | | | `db.deletedraft(batchno)`; no confirm dialog, errors swallowed |
| Export To Excel | POST `DownloadExcel1` (`specid`) | | | see 2.5 |
| Official Number | text `searchValue` + "Search" button | no | | AJAX `getListofServiceNoToAdd`; fills read-only fields: Official No, Rate, From Date, Duration at Current Rate |
| Reason | select `requesttype`: Outstanding / Special Requests / Others | no | static | bound to `AddNewDraft.requesttype` but never read or stored (fault) |
| AddRecord | submit POST `addnewAdvance` | | | adds the person to this batch (see 2.3) |
| per row: New Rate | select (id = svcno), value preset from `newrate` | `required` attr but saved by AJAX | `GetRating` | records `{svcno, value, btchno}` into a JS array |
| per row: Save New Rate | button | | | `POST api/AdvancementAPI/updateNewRate` with ALL pending changes; on `errorcode == "200"` alert "Updated Successfully" and reload |
| per row: Remove Rate | POST `removefromadvance` (`removeadvanceid`, `queryStringpath2`) | | confirm dialog | `REPO.removeUser`: hard delete of the `advancement` row by `advanceid` |
Grid columns: Official No, Surname (`FirstName`), Middle Name, Last Name, Seniority Date, Age, LOS, Current Rate (`ratename`), Duration (colour bands as 1.4), New Rate, Save, Delete.

### 2.3 Add Personnel (`AC.addnewAdvance`, `REPO.addRecordToAdvance`)
| Step | Detail |
|---|---|
| Lookup by official number | `SVC.suggestPersonelAdvanceBySVCNO`: parse `dept_rank` after ":"; calls `retrieveAdvanceNotUpTo` filtered ONLY by `serviceno` (branch/rate ignored). If null: `suggestPersonelAdvanceBySVCNOP` on `retrieveAdvanceToAddUpPerson` by service no + branch + rate |
| Posted values | `batchnumber` (hidden), `officialnumber`, `fromdate`, `noofmonthsAdd`, `rate` (text), `requesttype` |
| Mapping to `advancement` | `batchnumber`, `svcno`, `senioritydate = fromdate` (this is the start of the current rate, not the seniority date), `Duration = noofmonthsAdd`, `DateAdvanced = now` (not used by the proc), `draftofficer = User.Identity.Name`, `draftperiod = "DOD"+m+yyyy`, `specid = addnewadvance.specid`, `CurrentRateid` only if `currentdepth` posted |
| Write | proc `migrateSingleAdvancement(batchnumber, svcno, specid, CurrentRateid, user, period)` |
Faults (all verified in code):
| Fault | Where |
|---|---|
| `currentdepth` is never posted, so `CurrentRateid` is never set; the form posts `currentrat`, the model has `currentrate` | `AC.addnewAdvance`, `advancementreview.cshtml` |
| `specid` not posted (hidden field commented out and wrongly named `ViewBag.spcid`), so department 0 goes to the proc | `advancementreview.cshtml` |
| period is `DOD...` (drafting's prefix) instead of `DOA...`, so added rows fall outside the `DOA` period used by close, approval and exports | `AC.addnewAdvance` |
| JSON returns `Rateid` but JS reads `rateid`/`data.rateid` (undefined) | `advancementreview.cshtml`, `API.getListofServiceNoToAdd` |
| name search needs `Count > 1` so one match is dropped | `API.getListInfoToAdd` |
| `SVC.suggestPersonelAdvanceByName/ByNameP/BySVCNOP` parse `"spec_rank"` as a single int (rank = text after first `_`, which still contains `spec_`), throwing `FormatException`; only `SVC.suggestPersonelAdvanceBySVCNO` strips the second `_` | `SVC` |
| no check that the person is not already in another open batch or this batch | `AC.addnewAdvance` |

### 2.4 Save New Rate (`API.Update` -> `REPO.updateNewRateHistory`)
Input `valueu` = JSON list of `{svcno, value, btchno}`. For each: find `advancement` with `batchnumber == btchno && svcno == svcno`, set `newrate = int(value)`, update. Faults: placeholder id 0 can be saved as new rate; no check that the new rate is higher or valid; `btchno` is cut from the URL text before `%3A` in JS; row buttons all send the whole array; the forms post to a non-existent action `savenewship` (blocked by `preventDefault`).

### 2.5 Excel exports from this area
| Action | Filter | Columns (row 4 header; row 3 = date) |
|---|---|---|
| `AC.DownloadExcel1(specid)` | `AdvanceReport` where `draftperiod == "DOA"+month+year` and `specid`, ordered by `specid`, `newrateA` | Name (LastName + Initials), Service No, Sex, Current Ship (`departmentname`), Department (`specialisation`), Rate (`rate`), New Rate (`ratename`), Seniority Date, DOJ (`dateemployed`), Authority (`Signal`), WEF Date (`DateAdvanced`) |
| `AC.DownloadExcel2()` | same for all departments of the current period | same columns |
| `AC.DownloadExcel(batchno)` | `AdvanceReport` by batch (no caller found) | Name, Rate, Service No, Sex, Current Ship, DOJ, New Rate, Authority, WEF Date |
Faults: filter is the CURRENT month (period) so earlier months cannot be exported; date text format `"{0:dd mm yyyy}"` uses minutes for the month; header `attachment: filename=` uses a colon so the file name is ignored; `Response.End()` followed by `return View()`; "Current Ship" is really the department; `newrateA` meaning unknown.

### 2.6 Dead or unused
`AdvancementController.advtexecuteR` (PDF "Advancement Form" via `CrystalReportForAdvancementForm.rpt`) has no UI (button commented out in `advancementreview.cshtml`); `Advancement/Index`, `draftlistfilter`, `advancementlistfilter`, `AdvancePersonelReportP` are unreferenced pages.

## 3. Approval (and its detail page)

### 3.1 Page
| Item | Value |
|---|---|
| Label / URL / role | Approval / `GET /Advancement/Advancementapproval` / `SystemAdministration` |
| Action | `AC.Advancementapproval()` returns the view, no logic |
| API | `GET api/AdvancementAPI/getSummaryReportByDept?sEcho&iDisplayStart&iDisplayLength&deptid&rateid&signalcode&batchno` (`API.SummaryReportByDept`; all params "0" on load) -> `REPO.fetchsummaryByDept2` |
| Grid | Department (`specname`, link to detail page `GET /Advancement/advancementreportByDept?specid=`), Total Department, Total OS/SM/AB/LS/PO/WO/MWO/NWO, Approve By, Rank, Office (`approvalappointment`), Approve Date |
| No inputs | The page has no buttons; approving is done on the detail page |

### 3.2 What the list shows (`REPO.fetchsummaryByDept2`)
| Case | Rows |
|---|---|
| Logged-in user's `AspNetUsers.specid > 0` | the first `advancement` row where `DateAdvanced == null && Signal == null && specid == user.specid`; one department |
| otherwise (admin) | one row per `specid` among `advancement` rows with `DateAdvanced == null && Signal == null && batchnumber.Substring(0,3) == "DOA"` |
Per department: `fetchOtherRecordforSummaryBydept2(specid, 2)` supplies the totals; approval details come from that first row (`approveby, approverank, approvedate, approvalAppointment`); `specname = Specializationarea.sp_desc`. `User.Identity.Name` on an `[AllowAnonymous]` API: an anonymous call yields a null user and a crash.

### 3.3 Detail page and the approve action (`AdvancementreportByDept`)
| Item | Value |
|---|---|
| URL | `GET /Advancement/AdvancementreportByDept?specid=`; action `AC.AdvancementreportByDept(string specid)` (loads `GetDepartment`, unused) |
| Grid | `GET api/AdvancementAPI/getAdvancementReportbyDept?sEcho&iDisplayStart&iDisplayLength&specid` -> `REPO.fetchBatchRecordForReportFullByDept`: `AdvanceReport` where `specid` matches (0 = all), ordered by `Rateid` desc then `senioritydate` desc. NOT limited to the current period or to open/pending rows |
| Columns | Name, Old Rate (`rate`), Proposed Rate (`ratename`), Service No, Sex, Current Ship (`departmentname`), Seniority, DOJ, Authority (`Signal`), WEF Date (`DateAdvanced`), Vice/deployment (`deploymentvice`), Remark (`remark`) |
| Buttons | Approve (opens modal), Export To Excel (`DownloadExcel1`), Export To Excel All Dept (`DownloadExcel2`) |
| Modal fields | rank select (hard-coded: S/LT, LT, LTCDR, CDR, CAPT, CDRE, R/ADM, ADM), Name (text), Appointment (text); no required checks |
| Save | `POST api/AdvancementAPI/updateAdvanceApprove`, JSON `{specid, approverank, approverby, draftofficer}` where `draftofficer` carries the Appointment text; `API.UpdateApprove` -> `REPO.updateAdvanceByApproval` -> `ApproveDraft(approverank, approverby, specid, draftofficer, "DOA"+m+yyyy)` |
| Writes | UNCONFIRMED: `advancement.approverank, approveby, approvalAppointment, approvedate` for the department's rows in the period |
Rule: approval is per department (specid) per month, by free text name/rank/appointment, not by a user account; it does not change any rate or date. Nothing checks that approval happened before Close.
Faults: success handler does `alert("CustomerId: " + r.CustomerId.toString())` (undefined -> script error, copy of another page); the approval API returns no data; the page's `search()` calls `api/DraftingAPI/getDraftingReportbyDept` with undefined fields (dead); no confirmation; re-approving silently overwrites; view heading says "Advancement Report By Department" on the Approval page and "Advancement Summary Report" on the detail page.

## 4. Close

### 4.1 Page
| Item | Value |
|---|---|
| Label / URL / role | Close / `GET /Advancement/closeadvancement` / `SystemAdministration` |
| Actions | `AC.closeadvancement()` (GET view); `AC.closeAdvancement(CloseDraft)` (POST, `AuditAction.CloseAdvancement`). The form posts to `closeadvancement` (same name, different case); it works because the POST overload has `[HttpPost]` |
| API | `GET api/AdvancementAPI/getSummaryReportByDept2` (same data as 3.2, user based) |
| Also | "Export To Excel All Dept" (`DownloadExcel2`); same department grid as Approval with links to the detail page |

### 4.2 Fields
| Label | Control / name | Required | Validation |
|---|---|---|---|
| Authority | text `signalno` | `required` | none client side; server requires uniqueness (proc) |
| Close Date | text `closedate` with datepicker `dd/mm/yyyy` | `required` | parsed by `Utils.returnDateTime`: `ParseExact("MM/dd/yyyy HH:mm")`, so a picker value like 25/11/2026 throws |
| hidden `batchno` | `@ViewBag.batchNumberSS` (null on this page) | | ignored: the server overwrites `batchno` with `"DOA"+month+year` |
| Close button | confirm dialog "...cannot make any modification after this action" | | |

### 4.3 What close does
`AC.closeAdvancement` sets `closeby = User.Identity.Name`, `batchno = "DOA"+Month+Year` (current month/year, no padding), then `SVC.closeAdvance` -> `REPO.closeAdvance` -> `performUpdateBatchforadvancement(closedate, batchno, signalno, username)`.
| Outcome | Message |
|---|---|
| proc returns "1" | "Advancement Closed Successfully; Signal Number Added" |
| anything else | "Signal Number Used Before, Please Use a unique Signal Number" |
| exception | "Advancemnt Closed Failed; Please contact the Administrator" |
Effects (UNCONFIRMED, inferred from readers): closes (status 1) the DOA batches of the period, stamps `batchclosedate/batchcloseby`, stores the Authority text as `BatchRecord.signalCode` and `advancement.Signal`, which removes those rows from the pending list (`Signal == null`) and makes the batches appear in Board Returns Update (`status == 1 && signalCode != null`). Close writes NO new rate and NO date of advancement in any C# visible code; the date of advancement is set later (section 5).
Faults: closes every batch of the month at once, not the one the user was reviewing; the `batchno` field is misleading; date format mismatch; the Close page is under the generic title "Close Advancement Report" with breadcrumb "Advancement Summary Report"; no check that every row has a `newrate` or that the department was approved; no re-open (`reopencount` exists but no UI); typo messages.

## 5. Board Returns Update

### 5.1 Page
| Item | Value |
|---|---|
| Label / URL / role | Board Returns Update (page heading "Returns From Advancement Board") / `GET /Advancement/advancementenddate?batchNumber=<batchnumber>:<dept_rank>&page=` / `SystemAdministration` |
| Actions | `AC.advancementenddate` (GET, audit `AdvancementWEFDate`); `AC.updateDateAdvancementA(batchno, fromdate)` (POST, `UpdateNewAdvancement`); `AC.updateDateAdvancement(fromdate, batchno)` (POST, no caller found) |
| API | `POST api/AdvancementAPI/updateAdvanceDate` (form `svcno='V1'`, `valueu` = JSON list `{svcno, value = date text, btchno}`); `POST api/AdvancementAPI/updateAdvanceDateA` (declared in JS, no button uses class `save-new-shipA`) |

### 5.2 Fields
| Label | Control | Required | Source |
|---|---|---|---|
| Batch Number | select `batchNumber` | `required` | closed batches with a signal (0.5) |
| Process >> | GET submit | | loads `returnListofProposedAdvanceD` for the batch (`btchRecord.signalCode` stored in `ViewBag.signalno`) |
| Update Advancement Batch: Date | text `fromdate`, max 10 chars | no `required` | hidden `batchno` |
| Save (batch) | POST `updateDateAdvancementA` | | `db.updateconfirmdate(batchno, fromdate)` for the whole batch, then redirect to the referrer; no validation, errors return JSON text |
| per row: New Rate | select, read-only, disabled | | shows `newrate` |
| per row: Board Approval Date | text with datepicker `dd/mm/yyyy`, shown only when `newrate != null`, value preset from `DateAdvanced` | | |
| per row: Save Date | button (enabled after a date change) | | `POST updateAdvanceDate` for all pending rows |
Grid columns: Official No, Surname (`FirstName`), Middle Name, Last Name, Current Ship (`departmentname`), Age, LOS, Current Rate (`ratenameC`), Duration (bands as 1.4), New Rate, Board Approval Date, Action.

### 5.3 What it writes
Per row: `performreportDateOperationforadvancement(Convert.ToDateTime(value), btchno, svcno, signalno)`; `signalno` is not sent by the JS, so the signal param is null. Batch: `updateconfirmdate(batchnumber, startdate)`.
This is the only place the date of advancement (`advancement.DateAdvanced`, shown as WEF Date / "Date Advanced" in reports) is entered, after the board returns. Whether these procedures also insert the new `promotionshist` row (new rate, `fromdate = date`, close the old row's `todate`) and update the person's current rate is UNCONFIRMED: there is no C# that does it, so it must be inside these procedures or in the upload procedure. `fetchOtherRecordforSummaryForAdvance` returns `totalposted/totalnotposted`, which suggests a "posted" notion tied to this step.
Faults: dates parsed with the server culture (`Convert.ToDateTime`) although the picker emits `dd/mm/yyyy`; `DateTime fromdate != null` checks are always true; missing `newrate` rows cannot get a date; batch date overwrites every row with no per-row exclusion for rejected people (the summary page text mentions "Personel Rejected", but there is no reject flag in `advancement`); `Save` per row posts all rows; `savenewship` form posts to the drafting controller; page lists "Current Rate" from a different field than the review page; unused JS for `save-new-shipA`.

## 6. Report on Promoted Rates

### 6.1 Page
| Item | Value |
|---|---|
| Label / URL / role | Report on Promoted Rates (heading "Advancement Summary Report") / `GET /Advancement/summaryreportforadvancement` / `SystemAdministration` |
| Actions | `AC.summaryreportforadvancement` (loads `GetBranch`, `GetRate`); `AC.Advancelistexecute(draftingSummarysearch)` (POST, PDF) |
| API | `GET api/AdvancementAPI/getSummaryReportForAdvancement?sEcho&iDisplayStart&iDisplayLength&deptid&rateid&signalcode&batchno` -> `REPO.fetchBatchRecordForReport` + `fetchBatchRecordForReportCount` |

### 6.2 Fields
| Label | Control / name | Required | Source | Used by grid | Used by PDF form |
|---|---|---|---|---|---|
| Branch | select `branch` (id `branchid`) | `required` | `branch` | yes, as `deptid` | bound to `branch` |
| Rate | select `rate` (id `rateid`) | `required` | `TitleType` (wrong table) | yes, as `rateid` | NOT bound (model property is `rank`) |
| Signal Code | text `signalcode` | no | | yes | yes |
| Batch No | text `batchno` | no | | yes | NOT bound (model property is `batchnumber`) |
| Process | button | | | reloads grid | |
| Generate PDF | submit POST `Advancelistexecute` | | | | |

### 6.3 Grid and filter rules (`REPO.fetchBatchRecordForReport`)
Source `batchSummaryView` where `batchnumber StartsWith "DOA-"` (open and closed) and signal filter (`"0"` = any) and batch filter (`"0"` = any) and `dept_rank StartsWith(deptid)` and rank filter `dept_rank EndsWith(deptid)` (uses the branch value, not the rank: fault). Ordered by `id`, paged. For each batch `fetchOtherRecordforSummaryForAdvance` fills totals (not displayed, columns commented out). Department name: first segment of `dept_rank` (a BRANCH id) looked up in `Department` (wrong table); rank name: `rankRepo` by `rankid` that is always 0 (blank).
| Column | Field | Note |
|---|---|---|
| Signal Code | `signalCode`, link to `AdvancePersonelReport?batchno=` | open batches have no signal so no link |
| Branch | `deptname` | wrongly resolved, see above |
| Rank | `rankname` | always blank |
| Batch Number | `batchnumber` | |
| Status | `status` | 1 = CLOSED (green), 0 = OPEN (amber) |
| Initiated By / Date Initiated / Closed By / Date Closed | `initiatedby, batchinitiateddate, batchcloseby, batchclosedate` | |
Faults: `StartsWith("1")` matches branches 10, 11, ...; `dept_rank.Substring(0, IndexOf("_"))` throws without `_`; `GenericList` totals always 0 for `getSummaryReportByDept`; the count method counts `BatchRecord` rows, not the view.

### 6.4 Printouts (loaded `ReportDocument.Load` in this module)
| Output | Trigger | .rpt (path `RDLCReport/`) | Data | Fields |
|---|---|---|---|---|
| "Batch Summary Report For Advancementt.pdf" | Generate PDF on this page (`AC.Advancelistexecute`) | `CrystalReportAdvancementSummary.rpt` | `List<BatchRecordSummaryCR>` | `totalforbatch, batchnumber, deptname, rankname, signalCode` (typed dataset `SummaryForAdvancement.xsd` defines none) |
| "Advancement Report.pdf" | Generate PDF on `AdvancePersonelReport` (`AC.advtexecute`) | `CrystalReportAdvancement.rpt` | `List<AdvancementReportView>` | `batchnumber, svcno, FirstName, ratename (old), newratename (new), DateAdvanced` (`DataForAdvancement.xsd`); only first name printed; null `DateAdvanced` printed as TODAY (fault) |
| "Advancement Form.pdf" | no UI (`AC.advtexecuteR`) | `CrystalReportForAdvancementForm.rpt` | same list | same |
Not loaded by this module: `CrystalReportForAdvancement.rpt` (used by `EmployeeController.cs` line 3708, personal promotion history, `DataForPromotionhis.xsd`) and `CrystalReportMasterReportForAdvancemet.rpt` (no `Load` found).

### 6.5 Batch detail page `AdvancePersonelReport` (linked from the grid, not in menu)
`GET /Advancement/AdvancePersonelReport?batchno=`; `AC.AdvancePersonelReport(batchno)` fills the hidden filter dropdowns with `GetRate`. Grid via `GET api/AdvancementAPI/getAdvancementReportbyBatch?sEcho&iDisplayStart&iDisplayLength&signalcode&batchno&firsttime&name&oldrate&newsrate&officialno` -> `REPO.fetchBatchRecordForReportFull`: first batch of the batch search, then `AdvanceReport` rows of that batch filtered by official no (exact), name (`LastName FirstName MiddleName` contains), old rate (`Rateid`) and new rate (`newrate`), ordered by `advanceid`. Columns: BatchNumber, Official No, Full Name, Old Rate, New Rate, Date Advanced. The PDF button posts the filters to `advtexecute`; hidden dropdowns `rate`/`newrate` are not bound (model: `oldrate/newsrate`). `AdvancePersonelReportP.cshtml` is an unreferenced variant whose form field names (`batchno`, `personelname`) do not match the model.

## 7. Upload Advanced Rates

### 7.1 Page
| Item | Value |
|---|---|
| Label / URL / role | Upload Advanced Rates (heading "Upload Advancement") / `GET /Advancement/ExcelUpload` / `SystemAdministration` |
| Actions | `AC.ExcelUpload` (GET); `AC.UploadExcel(tbl_advancementUpload, HttpPostedFileBase FileUpload)` (POST); `AC.Download(filename)` (sample file) |
| Fields | file input `FileUpload` (client check: not empty), "Upload File" submit, "Download Sample File" link. Notes on page: duplicates are not uploaded; all dates must be correct |

### 7.2 Template `App_Data/UploadFormat/adva.xlsx`
Sheets `Sheet1`, `Sheet2`, `Sheet3`; header row (Sheet1): `id | Name | svcno | fromdate | oldrate | newrate | sex | decoration | signal | ship | doj | Remark`. The code reads `Sheet1` only (hard-coded), mapped by header to `tbl_advancementUpload` (`LinqToExcel`). `Download` always returns `adva.xlsx` whatever the name.

### 7.3 Import, step by step (`AC.UploadExcel`)
| # | Step | Detail |
|---|---|---|
| 1 | file present | else "Please choose Excel file" |
| 2 | content type | `application/vnd.ms-excel` or `...spreadsheetml.sheet`, else "Only Excel file format is allowed" |
| 3 | extension | `.xlsx`, else "This file is not valid format" |
| 4 | save | `SaveAs(Server.MapPath("~/App_Data/UploadFormat/") + original filename)`: overwrites a file of the same name (including the template) and trusts the client file name |
| 5 | validation pass (all rows with `svcno != null`) | person exists (`People.SVC_NO == svcno`), "present ship" exists (`Departments.Description == ship`), new rate exists (`Rates.rate1 == newrate`), old rate exists (`Rates.rate1 == oldrate`); first failure stops everything with "Line <id> ... not valid / does not Exist" |
| 6 | load pass | for each row: `WEFDate = Convert.ToDateTime(fromdate)`; `UploadpromotionHist(name, oldrate, newrate, sex, svcno, ship, signal (authority), WEFDate, decoration, user, Remark)`; result <= 0 -> message "Found some duplicate Official Number", continue; else counter message |
| 7 | row without `svcno` in the second pass | stop with "Some fields are null" (earlier rows are already saved: partial import) |
`doj` is not passed to the procedure. The success text counts ALL rows ever in `tbl_advancementUpload`, not rows added now. What the procedure writes is UNCONFIRMED (history row in `promotionshist` plus staging row in `tbl_advancementUpload`; `AuditId, SessionID, IpAddress` exist on that table).
Faults: stops at the first bad row but validates only existence, never that new rate is above old or equals the person's current rate; duplicate rule is hidden in the proc (official number only, so a second promotion of one person is refused as "duplicate", UNCONFIRMED); `Convert.ToDateTime(null)` throws on an empty date; server-culture date parsing; line number uses the `id` column instead of the sheet row; sheet name fixed; no transaction; the upload folder is also the template folder; the ship is validated against the department table by free text.

## 8. Cross-cutting faults and rules for the new build
| Topic | Old behaviour | Where |
|---|---|---|
| Hidden business rule | due-list and promotion posting live in SQL views/procedures whose text is not in the repo | 0.3 |
| Wrong lookups | "Rate" in summary uses `TitleType`; "Branch" name uses `Department` | `SEL.GetRate`, `REPO.fetchBatchRecordForReport` |
| Period logic | "current month" string `DOA<m><yyyy>` drives approval, close, exports | `AC`, `REPO` |
| Whole-month close | close affects all batches of the period | `AC.closeAdvancement` |
| Date formats | picker `dd/mm/yyyy` vs `MM/dd/yyyy` and culture parse | `Utils.returnDateTime`, `Convert.ToDateTime` |
| Security | anonymous API, no server role check, whole lists in audit | 0.1, 1.1 |
| Audit | `AuditAction`: AdvancementProposal, AdvancementReview, AdvancementWEFDate, AddNewAdvancement, RemoveAdvancement, CloseAdvancement, UpdateNewAdvancement (`Helper/AuditAction.cs`). No audit on `updateNewRate`, `updateAdvanceDate`, `updateAdvanceApprove`, `ClearAdvancement`, upload | `AC`, `API` |

## Appraisal dependency
Answer: NO. Advancement eligibility, proposal, review, approval, close, board return, report and upload do not read appraisal grades or appraisal tables, in any C# file or in any procedure name or parameter of this module.

Evidence:
| Check | Result |
|---|---|
| `grep -i apprais` over the whole old repo | matches only appraisal pages and their models: `Controllers/AppraisalPeriodController.cs`, `AppraisalRatingsController.cs`, `AppraisalHistoryController.cs`, `EmployeeController.cs` (profile page, `_appraisalHistoryService`, `AppraisalHistoryViewModel`), `EmployeePersonalInfoController.cs`, `Models/AppraisalHistoryVM.cs`, `AppraisalRatingViewModel.cs`, `Models/ViewModel.cs`, `HRProjectDAL/Core/appraisalhist.cs`, `Appraisalrating.cs`, `Person.cs` (navigation `appraisalhists`), `UnitOfWork.cs`, and views under `Views/Appraisal*`, `Views/Home/Index.cshtml`. No hit in `AdvancementController.cs`, `AdvancementAPIController.cs`, `IAdvancementPrepServiceImplementation.cs`, `IAdvancementRepoImplementation.cs`, `IAdvancement.cs`, `ISelectServiceImplementation.cs` or any `Views/Advancement/*.cshtml` |
| EDMX appraisal objects | tables `appraisalhist` (`id, personid, period, selfcomment, selfdate, selfcreatedby, supcomment, suprate, supdate, subcreatedby, dircomment, dirrate, dirdate, dircreatedby, othcomment, othrate, othdate, othcreatedby, overallgrade`) and `Appraisalratings` (`id, Name, Description`), linked only to `Person` (`FK_appraisalhist_appraisalhistperson`). No view of the advancement module (`V_advance`, `retrieveAdvancementProposalADVANCETB`, `retrieveAdvanceNotUpTo`, `retrieveAdvanceToAddUpPerson`, `AdvanceReport`) exposes `overallgrade`, `suprate`, `dirrate`, `othrate` or any grade column |
| Procedure and parameter names | no procedure called in this module (0.3) has a parameter or result named appraisal, grade, rating grade, efficiency or character; the only parameter named `Character` belongs to `SplitString(Input, Character)` (a separator), unrelated. The EDMX has no other grade/efficiency/character field outside `appraisalhist.overallgrade` and `gradelevel/gradetype` (a training-side table, not referenced here) |
| Residual risk | the bodies of the three views and the procedures `migratefromPromotionHistToAdvancement` and `migrateSingleAdvancement` are unavailable. A hidden join to `appraisalhist` inside them cannot be excluded by code, but nothing in their column lists, parameters or the C# uses it (UNCONFIRMED but unlikely). The new build should not add an appraisal condition unless the owner asks |

## Hand-off notes for design/build
1. Read first: this file sections 0.2-0.4 and 1.3-1.5 (the due-list), then 4 and 5 (what close and board return write), then `REPO` and `SVC` files above.
2. Owner decisions needed before building: (a) exact due rule (time in current rate in months, the real threshold: 48 is only suggested by the colour bands; branch/department scoping; what "manual add" of not-yet-due people means), (b) where the new rate is actually applied to the person and who posts it (no C# does it; it must be in `performreportDateOperationforadvancement`, `updateconfirmdate` or `UploadpromotionHist`), (c) whether qualifications, exams, vacancies or appraisal grades should be rules (none are enforced in what we can see), (d) whether close should be per batch and require approval and complete new rates, (e) whether rejected candidates need a flag.
3. New schema mapping: person `ratings` (`rate_id`, `seniority_date`, `date_employed`, `branch_id`, `specialisation_id`); history `rating_advancement` (`start_date` = date of advancement, `end_date`, `rate_id`, `authority` = signal, `decoration`, `gcbno`). No tables yet for the batch/proposal (`BatchRecord`, `advancement`); these must be designed (batch with status open/approved/closed, signal unique, per-person proposal rows with old rate, new rate, months in rate, board date, approval name/rank/appointment).
4. Keep: department-restricted officers, per-department approval summary by rate group (OS, SM, AB, LS, PO, WO, MWO, NWO), unique authority/signal per closure, board-return date step after close, exports with authority and WEF date, report by batch with signal.
5. Do not copy the faults listed in sections 1.6, 2.3-2.5, 3.3, 4.3, 5.3, 6.3, 7.3 and 8. Highest risk: search-creates-batch on GET, wrong period prefix `DOD` on manual add, close-all-batches-for-the-month, wrong lookup tables in the summary page, anonymous API.
6. Printouts to recreate: batch summary PDF (signal, branch, rank, batch, total), personnel advancement PDF (batch, official no, name, old rate, new rate, date advanced), Excel export (11 columns in 2.5).
