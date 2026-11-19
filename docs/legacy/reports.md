# Legacy map: Report menu and Crystal report inventory

Source tree: `/home/user/cirems/hpproject` (paths relative to it unless prefixed `HRProjectDAL/`). Procedure/view bodies are not available; anything about them is inferred and marked UNCONFIRMED. The `.rpt` files are compressed OLE binaries: field names, labels and parameters inside them cannot be read with `strings` (checked). "Fields" in the inventory are therefore taken from (a) the C# list passed to `SetDataSource` and (b) the design-time dataset schemas `RDLCReport/*.xsd`, which are matched to an rpt by name only (UNCONFIRMED).

## 0. Report menu

`Views/Shared/_menu.cshtml`: block `@if (User.IsInRole("SystemAdministration"))`, group "Report". Only these three items are live:

| Menu label | URL | Role | Action (`Controllers/ReportController.cs`) | View | Output |
|---|---|---|---|---|---|
| Ship History Report | `/Report/personellistbybranch` | SystemAdministration | `personellistbybranch` (GET), `personellistbybranch2` (POST) | `personellistbybranch.cshtml` (heading "Officers Report") | Excel download |
| All Personel | `/Report/personellistfilter` | SystemAdministration | `personellistfilter` (GET), `personellistexecute` (POST) | `personellistfilter.cshtml` (heading "Ratings Report") | on-screen grid + PDF |
| Disposition Report | `/Report/PersonelReport` | SystemAdministration | `PersonelReport` (GET), `ExporttoDisposition` (POST) | `PersonelReport.cshtml` | PDF |

Orphan pages in `Views/Report` with no live menu link and not counted: `Index`, `IndexAllPersonel` (uses partial `_OfficerReportListAll`, prints profile via `Report/EmployeeMaster`), `IndexBranch`, `IndexCommand`, `IndexReport`, `personellistbrdept`, `personellistfilter1`, `PersonelDisposition` (action only). Role enforcement is menu-only (global login `AuthorizeAttribute`; no role attribute on the controller).

Only "All Personel" uses a Web API (`api/Personel/getListofPersonelPagedSearch2`, `APIController/PersonelController.cs`, `[AllowAnonymous]`). Ship History and Disposition are plain MVC posts.

## 1. Ship History Report  (`/Report/personellistbybranch`)

Real content: a "Ten Drafting History" Excel for one specialisation (labels do not match: menu says Ship History, heading says Officers Report, button says "Download Ten Appt", file is "Ten Drafting History for {year}.xlsx").

| Item | Detail |
|---|---|
| Fields | One select "Department" bound to `SpecialisationId`, options `GetSpecilisation` = table `Specializationarea` (`sp_desc`) preceded by "--Select specialization" (id 0) and "All" (id 0); not required |
| Button | "Download Ten Appt" submits POST `Report/personellistbybranch2` (multipart form) |
| Server | `ReportController.personellistbybranch2(IndexViewModel model)`: raw `SqlConnection` (`db.Database.Connection.ConnectionString`), Dapper `conn.Query<Get10DraftHistory>("migratefromEmplHistToappt2", {@specid = model.SpecialisationId}, commandType: StoredProcedure, commandTimeout: 4000)`, then EPPlus `ExcelPackage` sheet "Sheet2" via `LoadFromCollection(result, true)` (header row = property names), returned as `File(stream, xlsx, "Ten Drafting History for " + DateTime.Now.Year + ".xlsx")` |
| Procedure `migratefromEmplHistToappt2(specid int)` | Name suggests "migrate employment history to appointments" (ten most recent drafts per rating for the specialisation). Body UNCONFIRMED. Result columns (complex type `migratefromEmplHistToappt2_Result`, mapped to entity `Get10DraftHistory`): sn, Rate, Initial, Name, Svc_no, Batch, Pre_Ship, Command, DraftAs, draftdate, duration, Draft1..Draft10, senioritydate, Branch, Department, DOB, DateOfJoining, Enlisted_Date, Gender, State, Geozone, PhoneNumber, Qualification, LGA, Expr1 |
| Excel columns | exactly the `Get10DraftHistory` properties above (all strings except `sn`, `Expr1`) |
| Commented-out earlier design | grid over `api/Personel/getListofPersonelPagedSearchbranch?specid=` (`returnListofPersonsbranch` calls proc `migratefromEmplHistToappt(specID)` then reads view `GetTenAPPT`, ordered `rankid desc, senioritydate, Svc_no desc, branchid`); columns Rank, Rank Code, Initials, Name, Service No, Course, Present Ship, Command, Present Appt, Appt Date, Duration, Appointment1-10, Seniority Date, Branch, Specialisation, Date of Birth, Date of Cedet Training, Date of Commission, Gender, State, Geo Zone, Phone, Qualification, LGA. OFF |
| Rules | Which 10 drafts, ordering and the meaning of "All" (id 0) are inside the proc: UNCONFIRMED |

Faults: label mismatch (menu/heading/button/file); no validation (default option value 0 = All could run the proc for everyone with a 4000 s timeout); proc named "migrate" so possible write side effect on a download click, UNCONFIRMED; placeholders "--Select specialization" and "All" share id 0; Dapper bypasses the EF context (own connection, no audit).

## 2. All Personel  (`/Report/personellistfilter`)

### 2.1 Fields (`Views/Report/personellistfilter.cshtml`, model `IndexViewModel`)

| Label | Control | Options source | Grid param | PDF field |
|---|---|---|---|---|
| Command | select `CommandId` | table `Command` (Description), "--Select Command"/"All" id 0 | `commandid` | `CommandId` |
| Ship | select `DepartmentId` | table `Department` (Name) | `departmentid` | `DepartmentId` |
| Staff Branch | select `StaffBranchDropDown` (bound to an IEnumerable property; posted value arrives as int) | table `staffbranch` (`stfbranch`); placeholder text wrongly "--Select Command" | `staffbranchid` | `StaffBranchDropDown` |
| Branch | select `BranchId` | table `branch` (`busdesc`) | `branchid` | `BranchId` |
| Specialisation | select `SpecialisationId` | table `Specializationarea` | `specialisationid` | `SpecialisationId` |
| Sub-Branch | select `SubspecialisationId` | table `sub_specialisation` (`description`) | `subspecializationid` | NOT sent to PDF |
| Rank | select `RankDropDown` | table `TitleType` (Name) | `rateid` | `RankDropDown` |
| AK | select `entrymodeid` | table `entrymode` (`entryname`; AK = batch/entry mode); placeholder wrongly "--Select Rank" | `entrymodeid` | not sent |
| Status | select `StatusDropDown` | table `Exittype` (Description) | `statusid` | `StatusDropDown` |
| Geozone | select `GeozoneId` | table `geozone` | `GeozoneId` | not sent |
| State | select `StateId` | table `State` | `StateId` | not sent |
| Local Goverment | select `LocalGovernmentareaId` | table `LocalGovernmentArea` (all LGAs; cascade broken) | `LocalGovernmentareaId` | not sent |
| Sort By | select `SortId` | table `SortList` (Id, Name; rows not in repo), "--Select--" 0 | `sortby` | `SortId` |
| Radio Rank Range / Course range | `status1` = Rank / Course | | toggles 4 selects | |
| Rank From / To | `RankDropDown1`, `RankDropDown2` | table `Rate` (Description) | `TitleTypeID1`, `TitleTypeID` -> `rank1`,`rank2` | not sent |
| Course From / To | `entrymodeid1`, `entrymodeid2` | table `entrymode` | same names | not sent |

All selects optional; 0 = no filter. Buttons: "Process" (type button, reloads grid), "Generate PDF" (submit, POST `Report/personellistexecute`).

### 2.2 Grid call

`GET api/Personel/getListofPersonelPagedSearch2?departmentid&commandid&branchid&specialisationid&staffbranchid&subspecializationid&rateid&entrymodeid&entrymodeid1&entrymodeid2&GeozoneId&LocalGovernmentareaId&StateId&TitleTypeID1&TitleTypeID&statusid&sortby` (+ DataTables `sEcho, iDisplayStart, iDisplayLength`; every int mandatory). `PersonelController.getListofPersonelPagedSearch2` -> `IPersonService.returnFilteredReport` -> `IPersonReportImplementation.returnListofPersonsLimited` (LINQ over `Person`, `Skip/Take`); totals from `returnRecordCount`. Response `GenericList<PersonReportView>`.

Filters (each 0 = ignore): `Departmentid, Commandid, branchid, SpecialisationAreaId, StateId, geozoneid, LocalGovernmentareaId, sub_specialisationid, staffbranchid, TitleTypeId, entrymodeid, ExitTypeid`. `sortby` (`HRProjectDAL/APIModel/APIModelEmployeeSearch.cs: SortEnum`: ServiceNumber=1, DateOfBirth=2, Branch=3, Ship=4, spec=5, entry=6, Rank=7, state=8, geo=9, localgovt=10):

| sortby | Order by | Difference |
|---|---|---|
| 1 | `SVC_NO` | rank test `TitleTypeId >= rank` (others `==`) |
| 2 | `BirthDate` | |
| 3 | `branchid` | |
| 4 | `Departmentid` | |
| 5 | `SpecialisationAreaId` | |
| 6 | `entrymodeid` | entry filter becomes range `entrymodeid1..entrymodeid2` |
| 7 | `TitleTypeId` | rank filter becomes `Rateid between rank1 and rank2` (Rate table, not TitleType) |
| 8/9/10 | `StateId` / `geozoneid` / `LocalGovernmentareaId` | |
| other | none and no `Skip` (only `Take`) | paging breaks |

No restriction to current ratings: Status 0 returns current AND former.

Row mapping (`IPersonServiceImplementation.returnFilteredReport`): svcno, lastname, `firstname` = `Person.Initials`, middlename, dateofbirth, telephone = `GSMNumber`, department = `Department.Description`, branch = `branch.busdesc`, command = `Command.Description`, staffbranch, specialisation = `sp_desc`, stateName, localgovernmentName, geozoneName, entrymodename, sexname, subspecialisation, rank = `TitleType.Description`, senioritydate, datejoined = `dateemployed`, appointmentdate = `commissiondate`.

Grid columns: Service No, Rank, Surname, Initials, Command, Branch, Staff Branch, Ship, AK, Telephone, Date of Birth, Specialisation, Sub-Branch, Seniority Date, Date Joined, State, LGA, Geo Zone.

### 2.3 PDF

`ReportController.personellistexecute(PersonelReportSearch)` (DepartmentId, CommandId, BranchId, SpecialisationId, SortId, StaffBranchDropDown, RankDropDown, StatusDropDown) -> `ipersonService.returnFiltered` -> `IPersonReportImplementation.returnListofPersons` (no paging; state/geo/LGA/subbranch fields exist in `APIModelEmployeeSearch` but the controller never fills them) -> `~//RDLCReport//RatingsReport.rpt` via `ReportDocument.Load` -> PDF "Personel.pdf". `returnFiltered` mapping differs from the grid: `firstname = FirstName`, `department = Department.Name`, `rank = TitleType.Name`, no state/LGA/geo/entry. Probable dataset `RDLCReport/reportRDLC.xsd` table `Personel`: personid, svcno, firstname, middlename, lastname, command, branch, staffbranch, department, telephone, dateofbirth, senioritydate, specialisation, rank, entrymodename, stateName, localgovernmentName, geozoneName, datejoined, sexname (UNCONFIRMED match).

### 2.4 Other AJAX on the page

Cascades: `POST Report/GetShipNew`, `Report/GetSpecializationArea`, `Report/GetStaffNew` (fill `#DepartmentId`, `#SpecialisationId`, `#StaffBranchDropDown`) and `POST Report/GetLgasNew` (exists: LGAs of the state with "--Select LGA"/"All"). The first three do not exist in `ReportController` (only `GetStaffNew`, in `EmployeeController`), so 404 and "An error occurred."

### 2.5 Faults (do not copy)

| ID | Where | Fault |
|---|---|---|
| R1 | grid vs PDF | Two repository methods and two DTO mappings; PDF ignores State, Geozone, LGA, Sub-Branch, Entry mode and both ranges, so the same filter gives different lists |
| R2 | `IPersonReportImplementation.returnListofPersons*` | Staff branch test is `person.staffbranchid == searchcriteria.branchid` (branch id) in every variant |
| R3 | same | Rank `>=` for sort 1 but `==` otherwise; sort 7 switches table (Rate vs TitleType) |
| R4 | `returnRecordCount` | Total ignores state, geozone, LGA, sub-branch, entry mode and has only 3 sort variants; `.ToList().Count` loads everything |
| R5 | `returnFiltered`, `returnFilteredReport` | `ppV.branch = pp.branch != null ? ... : pp.branch.busdesc` throws NullReference for a rating with no branch (whole report fails) |
| R6 | grid | "Initials" column shows `firstname` which is `Initials` in one mapping and `FirstName` in the other |
| R7 | `personellistfilter.cshtml` | `if (("#SortId").val() == 7)` is a JS error (string has no `.val`) inside `$(window).load`, probably stops the grid initialising (UNCONFIRMED) |
| R8 | cascades | `GetShipNew`, `GetSpecializationArea`, `GetStaffNew` missing on `ReportController` (404) |
| R9 | labels | "--Select Command" on Staff Branch, "--Select Rank" on AK; "Ship" for `Department`; "AK" for batch |
| R10 | API | `[AllowAnonymous]`: whole personnel list readable without login |
| R11 | sort | SortList rows not in repo; default branch unordered with no `Skip` |

## 3. Disposition Report  (`/Report/PersonelReport`)

| Item | Detail |
|---|---|
| Page | heading "Disposition Report"; commented-out table would list Surname, Rate, Sex, SVC NO, Ship, WEF, Remarks |
| GET `PersonelReport(Specializationareaid, Motherbaseid)` | loads dropdowns, then ALWAYS calls `db.getpersonbydept(Convert.ToInt32(Specializationareaid), Convert.ToInt32(Motherbaseid))` (null = 0,0; exceptions swallowed) and reads all of `PersonDisp` into a model the view does not use |
| Fields | "Area Office" select `Motherbaseid`: `GetMotherbase` = table `Homebase` (Description), first options "--Select Rate" (sic) and "All", both id 0; "Trade" select `Specializationareaid`: `GetSpecializationArea` = `Specializationarea.sp_desc`, first options "--Select Branch" and "All" id 0. Both `required` but 0 is non-empty so any option submits |
| Button | "Print Report" submits POST `Report/ExporttoDisposition` |
| Procedure `getpersonbydept(specid int?, Motherbase int?)` | function import (no result set). Rewrites the shared table `PersonDisp` for the filter; C# then reads that table. Also `FN_getpersonbydept` (returns `PersonDisp`, used by `personellistbrdept`/`personRat`). Body UNCONFIRMED; implied = current ratings of that specialisation/area office with latest ship and effective date |
| Table `PersonDisp` columns | id, PersonID, SVC_NO, lastname, firstname, middlename, titlename, sp_desc, BirthDate, senioritydate, shipName, effdate, motherbaseid, motherbasename, specid, sex |
| `ExporttoDisposition` | runs `getpersonbydept` again; loads `~/Report/CrystalReportForDisposition2.rpt` when BOTH ids are 0, else `~/Report/CrystalReportForDispostion.rpt` (sic; both in folder `Report/`, not RDLCReport); `SetDataSource(db.PersonDisps.Select(...))` with SVC_NO, lastname, firstname, `middlename = p.motherbasename`, titlename, sp_desc, shipName, `effdate = (DateTime)p.effdate`, sex; PDF "Disposition Report.pdf" |
| Faults | `PersonDisp` is one shared table rewritten per request (two users printing at once corrupt each other); `middlename` filled with area office; `(DateTime)effdate` throws on null; required dropdowns never block; "--Select Rate" label on an area-office list; GET runs a data-changing proc on every page load; swallowed exceptions; the 0,0 case prints a different layout (Disposition2); `CrystalReportForDisposition3.rpt` never loaded |

## 4. Mapping to the new schema

`/home/user/cirerms/src/db/migrations`: `ratings` (service_number PK, rate_id, title_id, branch_id, command_id, staff_branch_id, specialisation_id, entry_mode_id, exit_type_id, state_id, local_government_id, geo_political_zone_id, mother_base_id, status), `rating_drafting` (ship_id, start_date, end_date; open row = current ship), `rating_advancement`. No sub_specialisation, Department(ship) or SortList on `ratings`: ship = `rating_drafting.ship_id` -> `ref_ship`; mother base = `ref_mother_base`. Ship History can be a direct query on `rating_drafting` (latest 10 per rating by `start_date` desc); Disposition = current ratings with their open `rating_drafting` row filtered by `specialisation_id` and `mother_base_id`. (Column and table names here were written from a read of the migrations by the mapping pass; check them against the migrations before building.)

## 5. Crystal report inventory

### 5.1 The 79 files of `hpproject/RDLCReport`

22 `.rpt` + 57 non-rpt files (14 dataset schemas x 4 files + `reportRDLC.cs`).

Search done: `ReportDocument`, `.Load(`, `.rpt`, `RDLCReport`, `ReportClass`, `CrystalReportViewer` over Controllers, APIController, Views, Helper, Infra, APIServices, Models, Filters, App_Start, Report, HRProjectDAL. No `ReportClass`/viewer/.aspx use; no loads in APIController, Helper, Infra, HRProjectDAL. Every load is `ReportDocument.Load(Path.Combine(Server.MapPath(...)))` in a controller. `Controllers/draftingsControllerXX.cs` is NOT in `HPProject.csproj` (only `draftingsController.cs`), so loads there are dead.

In scope = reached from a page with a live (uncommented) menu item in `_menu.cshtml`. "Profile" = Ratings Management profile/edit pages: out of scope.

| # | rpt (RDLCReport) | Loaded by (file:method) | Page / menu item | In scope | Fields / parameters |
|---|---|---|---|---|---|
| 1 | `CrystalReport1.rpt` | never loaded | none | unused | unknown |
| 2 | `CrystalReportAdvancement.rpt` | `Controllers/AdvancementController.cs: advtexecute` | `Advancement/AdvancePersonelReport` (link from "Report on Promoted Rates"); `AdvancementreportByDept.cshtml` has no inbound link | yes (Advancement) | `AdvancementReportView`: batchnumber, advanceid, svcno, LOS, Age, FirstName, MiddleName, LastName, PersonID, branchid, Duration, newrate, DateAdvanced, TitleTypeId, ratename, busdesc, departmentname, Signal, newratename; schema `DataForAdvancement.xsd` (batchnumber, svcno, FirstName, ratename, newratename, DateAdvanced) |
| 3 | `CrystalReportAdvancementSummary.rpt` | `AdvancementController.cs: Advancelistexecute` | "Report on Promoted Rates" (`summaryreportforadvancement`) | yes (Advancement) | `BatchRecordSummaryCR`: totalforbatch, totalposted, totalnotposted, deptname, rankname, batchrequestname, status, batchnumber, signalCode, initiatedby, totalos/sm/ab/ls/po/wo/mwo/nwo; schema `SummaryForAdvancement.xsd` is empty (UNCONFIRMED) |
| 4 | `CrystalReportForAdvancement.rpt` | `Controllers/EmployeeController.cs: advancementlistexecute` | Employee profile pages (`Create`, `viewprofile`, `EditPersonel`, `EditPersonelXXXX`) | no (profile) | `advancementlist`; schema `DataForPromotionhis.xsd` (personid, fromdate, todate, rate, svcno, personname) |
| 5 | `CrystalReportForAdvancementForm.rpt` | `AdvancementController.cs: advtexecuteR` | "Advancement Review" (`advancementreview`) | yes (Advancement) | `AdvancementReportView` (as #2) |
| 6 | `CrystalReportForDraft.rpt` | `Controllers/draftingsController.cs: draftlistexecuteALL2`, `draftlistexecute`, `draftlistexecuteRSP`, `draftlistexecuteP` (no view calls it) | "Draft Report" (`draftingreportList`); "Rate DOD History" (`draftingreportindividual`); "Batch/Signal Content" -> `draftingreport`; `draftingreportByDept` (from "Draft Approval" and "Close Draft"); "Advance Draft Report" (`specialdraftinglist`) | yes (Drafting, Advance Draft) | `DraftingReportView`: batchnumber, draftingid, svcno, FirstName, MiddleName, LastName, PersonID, branchid, fromdate, commandname, busdesc, staffbranchname, departmentname, newdepartmentName, statename, exittypename, reportdate, DOJ, ratename, request, SexName, Authority, formershipname, lastshipname, recordno; schema `DataForDraft.xsd`; parameters = `draftingSummarysearch` (signalcode, batchno, name, oldship, newship, officialno) |
| 7 | `CrystalReportForDraftForm.rpt` | `draftingsController.cs: draftlistexecuteR`, `sdraftlistexecuteRs` | "Review/Print Draft" (`draftreview`); "Advance Draft Proposal" (`SpecialDraft`) | yes (Drafting, Advance Draft) | `DraftingReportView`; schema `DataSetForDraftingForm.xsd` (batchnumber, svcno, FirstName, departmentname, newdepartmentName, reportdate, ratename, noofmonths, SexName) |
| 8 | `CrystalReportForDraftReview.rpt` | never loaded | none | unused | probably `DataEmploymentHist.xsd` table `DraftingReview` (UNCONFIRMED) |
| 9 | `CrystalReportForDraftingHist.rpt` | `EmployeeController.cs: draftlistexecute` | Employee profile pages | no (profile) | `drafthist`; schema `DataEmploymentHist.xsd` table `DraftingHist` (personid, fromdate, todate, departmentname, svcno, personname) |
| 10 | `CrystalReportForEducation.rpt` | `EmployeeController.cs: educationlistexecute` | Employee profile pages | no (profile) | `eduhist`; schema `DataSetEducation.xsd` |
| 11 | `CrystalReportForMasterReport.rpt` | never loaded | none | unused | unknown |
| 12 | `CrystalReportForReengagementF.rpt` | `Controllers/DischargeController.cs: dischargeexecuteR`; `dischargeexecute` (dead, no UI) | Discharge > Verification Forms | yes (Discharge) | `DischargeReportView`: only FirstName, svcno, rate populated; schema `DataSetForEngagementForm.xsd` (svcno, FirstName, rate, lengthserviceyr, rengagementdateP, lenghtofservicebylastR, dateemployed); parameter svcno |
| 13 | `CrystalReportForReleaseRoutine.rpt` | `DischargeController.cs: dischargeexecuteRT` | Discharge > Verification Forms (Retirement Routine) | yes (Discharge) | as #12 |
| 14 | `CrystalReportForServiceDetails.rpt` | `DischargeController.cs: dischargeexecuteEn` | Discharge > Verification Forms (Engagement Form; NOT Print Service Details) | yes (Discharge) | as #12 |
| 15 | `CrystalReportForTraining.rpt` | `EmployeeController.cs: traininglistexecute` | Employee profile pages | no (profile) | `tranhist`; schema `DataTraining.xsd` |
| 16 | `CrystalReportMainMasterReport.rpt` | `Controllers/ReportController.cs: EmployeeMaster(int id)`; `EmployeeController.cs: EmployeeMasterXX` (no view calls it) | `Report/IndexAllPersonel` via partial `_OfficerReportListAll` "Print Profile": no live menu link | no (orphan) | table `AdvanceMentHists` from `advancementlist` (svcno, fromdate, rate, todate) |
| 17 | `CrystalReportMasterReportForAdvancemet.rpt` | never loaded | none | unused | unknown |
| 18 | `CrystalReportShipRequirement.rpt` | `Controllers/ShipRequirementController.cs: ShipRequirementlistexecute`, `ShipRequirementlistexecutebydept` | "Update Manning Requirement" (`viewrequirement`; role SystemAdministration); `shiprequirementbydept.cshtml` has no link | yes (Drafting) | view `shiprequirementreport` (sn, shipcode, shipname, shipdesc, ratename, rank, specialization, speccode, quantity); schema `DataSetForShipRequriement.xsd` (shipname, ratename, quantity, specialization) |
| 19 | `CrystalReportforTrainingCourse.rpt` | `Controllers/TrainingDraftController.cs: traininglistexecute` | `TrainingDraft/trainingdraftingreport` (from Training Drafting > Reports) | yes (Training Drafting) | `TrainingReportView` (batchnumber, svcno, firstname, middlename, lastname, prvcoursefromdate, prvcoursetodate, ratename, titlename, prevtrainingname, trainingid, currentTraining, lenghtofservice); schema `TrainingDataSet.xsd` |
| 20 | `OfficerReport.rpt` | never loaded | none | unused | unknown |
| 21 | `RatingsReport.rpt` | `ReportController.cs: personellistexecute` | Report > All Personel ("Generate PDF") | yes (Report) | `PersonReportView` list (section 2.3); schema `reportRDLC.xsd`; parameters = the 8 search fields |
| 22 | `SummaryForDraftReport.rpt` | `Controllers/draftingsControllerXX.cs: summaryreportexecute` (file not compiled) | none | unused (dead code) | schema `SummaryRDL.xsd` (signalCode, deptname, rankname, batchnumber, status, totalforbatch, totalposted, totalnotposted, initiatedby, batchinitiateddate, batchcloseby, batchclosedate, branch) |

The 57 non-rpt files are design-time only; `grep -w` of every dataset name finds no reference in Controllers/APIController/Helper/Infra/APIServices/Models/Report.

| Dataset (4 files: .xsd, .xsc, .xss, .Designer.cs) | Tables | Probable rpt (UNCONFIRMED) |
|---|---|---|
| DataEmploymentHist | DraftingHist, DraftingReview | #9, #8 |
| DataForAdvancement | Advancement | #2 |
| DataForDraft | Draft | #6 |
| DataForPromotionhis | AdvancementHists | #4, #16 |
| DataSetEducation | Education | #10 |
| DataSetForDraftingForm | DraftAdvanceForm | #7 |
| DataSetForEngagementForm | DataTableForEngagement | #12-#14 |
| DataSetForShipRequriement | ShipReqirement | #18 |
| DataTraining | Training | #15 |
| DischargeDataSet | DischargeDate | `Report/CrystalReportForDischargeRats.rpt` |
| SummaryForAdvancement | (empty) | #3 |
| SummaryRDL | Summaryfordrfting | #22 |
| TrainingDataSet | TrainingDraft | #19 |
| reportRDLC (+ reportRDLC.cs) | Personel | #21 |

### 5.2 Reports loaded from OTHER folders (not in the 79)

| rpt (folder `Report/`) | Loaded by (file:method) | Page / menu | In scope | Notes |
|---|---|---|---|---|
| `CrystalReportForDischargeRats.rpt` | `DischargeController.cs: dischargerateexecute` | Discharge Report > Print Report | yes (Discharge) | FirstName, svcno, rate, lengthserviceyr, dateemployed |
| `EmployeeMaster.rpt` | `EmployeeController.cs: EmployeeMaster(pid)` | Discharge > Print Service Details; Current Ratings List (`Employee/Index`) | yes (Discharge; also ratings list) | `Person` (SVC_NO, LastName, FirstName, MiddleName, BirthDate, GSMNumber), `AdvanceMent` (fromdate, rate, todate) |
| `CrystalReportForDisposition2.rpt` | `ReportController.cs: ExporttoDisposition` (both ids 0) | Report > Disposition Report | yes (Report) | fields in section 3 |
| `CrystalReportForDispostion.rpt` | `ExporttoDisposition` (any filter) | same | yes (Report) | same |
| `CrystalReportForDisposition3.rpt` | never loaded | none | unused | |
| `OfficersList.rpt` | `ReportController.cs: ExportToDepartment` | `Report/Index*`, no menu link | no (orphan) | SVC_NO, LastName, FirstName, MiddleName, GSMNumber, Departmentid |
| `PersonelByCommand.rpt` | `ReportController.cs: ExportToCommand` | `Report/IndexCommand`, no menu link | no (orphan) | same with CommandId |
| `CrystalReportForDiscipline.rpt` | `Controllers/DeciplineController.cs: ExportDiscipline` | Disciplinary Action > Concluded Cases / Disciplinary Report (`_LayoutAllDescipline`) | yes (Disciplinary) | |
| `CrystalReportForPenddingDiscipline.rpt` | `DeciplineController.cs: ExportPenddingDiscipline` | Pending Cases (`_LayoutDesciplineComment`) | yes (Disciplinary) | |
| Static Tables exports (12): `CrystalReportBranch`, `CrystalReportEntrymode`, `CrystalReportExitType`, `CrystalReportForInstitution`, `CrystalReportLanguage`, `CrystalReportRelationship`, `CrystalReportSpecialization`, `CrystalReportStaffBranch`, `CrystalReportForShip`, `CrystalReportState`, `CrystalReportTitle`, `CrystalReportTraining` | `ExportBranch`, `ExportBatch`, `ExportExitType`, `ExportIntstitution`, `ExportLanguage`, `ExportRelatioship`, `ExportDepartment`, `ExportStaffBranch`, `ExportShip`, `ExportState`, `ExportTitle`, `ExportTraining` in the matching controllers (Branch, EntryMode, ExitType, Institution, Language, Relationship, SpecializationArea, StaffBranch, Ships, States, Title, Training) | each lookup `List` page (menu Static Tables, role StaticTables) | yes (Static Tables) | plain list PDFs |
| `CrystalReportLocalGovt.rpt` | `LocalGovernmentAreasController.cs: ExportLocalGovt`; `draftingsController.cs: draftlistexecuteALL` (no view) | Static Tables > Local Government | yes but BROKEN | file exists only in `ReportOLD/`, not `Report/`: the load throws |

Never loaded by anything: `Report/CrystalReportForDisposition3.rpt`, `Report/PersonelByBranch.rpt`, `Report/PersonelProfile.rpt`, `Report/EmployeeMasterN.rpt`, `Report/employeemasterreport.rpt`, `Report/CrystalReport1.rpt`, and all of `ReportOLD/`.

### 5.3 Which Crystal reports do the in-scope pages still load

- Discharge Administration: `CrystalReportForReengagementF` (Re-engagement Verification), `CrystalReportForReleaseRoutine` (Retirement Routine), `CrystalReportForServiceDetails` (Engagement Form), `Report/CrystalReportForDischargeRats` (Discharge Report), `Report/EmployeeMaster` (Print Service Details).
- Report menu: `RatingsReport` (All Personel PDF), `Report/CrystalReportForDisposition2` and `Report/CrystalReportForDispostion` (Disposition). Ship History is Excel, no rpt.
- Drafting and Advance Draft: `CrystalReportForDraft`, `CrystalReportForDraftForm`, `CrystalReportShipRequirement`.
- Advancement Processing: `CrystalReportAdvancement`, `CrystalReportAdvancementSummary`, `CrystalReportForAdvancementForm`.
- Training Drafting: `CrystalReportforTrainingCourse`.
- Disciplinary Action: `Report/CrystalReportForDiscipline`, `Report/CrystalReportForPenddingDiscipline`.
- Static Tables: 12 `Report/` list exports; Local Government's is missing.
- Out of scope (profile): `CrystalReportForDraftingHist`, `CrystalReportForAdvancement`, `CrystalReportForEducation`, `CrystalReportForTraining`.
- Unused/orphan in RDLCReport: `CrystalReport1`, `CrystalReportForDraftReview`, `CrystalReportForMasterReport`, `CrystalReportMasterReportForAdvancemet`, `OfficerReport`, `SummaryForDraftReport`; `CrystalReportMainMasterReport` only from orphan pages.

Net: of the 22 rpt in RDLCReport, 11 are loaded by live in-scope pages (rows 2, 3, 5, 6, 7, 12, 13, 14, 18, 19, 21), 4 only by profile pages, 1 only by orphan pages (16), 6 never loaded by live code.

## 6. Hand-off notes for design/build

1. Read first: section 5 (which rpt still matter) and section 2 (the only real data report).
2. Crystal rpt layouts cannot be decoded here; redesign each printout from its field list. The `.xsd` schemas are the only readable column definitions.
3. Rewrite from scratch: `migratefromEmplHistToappt2` (ten drafts per rating), `getpersonbydept` (writes shared table `PersonDisp`), view `shiprequirementreport`; use direct queries on `rating_drafting` and `ratings`.
4. Risks: grid/PDF filter logic duplicated and inconsistent (unify into one query used by screen, PDF, Excel); define "Status" via `ratings.status`; SortList rows not in repo (code expects 1..10 as in `SortEnum`); the old data API was anonymous.
5. Keep out: orphan pages (`Report/Index*`, `personellistbrdept`, `personellistfilter1`), the 6 unused rpt, `ReportOLD`, `draftingsControllerXX.cs`.
