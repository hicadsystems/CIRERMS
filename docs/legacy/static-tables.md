# Legacy map: the 16 live Static Tables

Source: old CIRERMS, `hpproject/Views/Shared/_menu.cshtml` block `@if (User.IsInRole("StaticTables"))` (lines 204-245). Items inside `@* *@` (Blood Group, Genotype, Appointment, Hospital, Ailment, Country, Qualification, Leave Type, Appraisal Period) are OFF and out of scope. Paths are relative to `hpproject/` unless they start with `HRProjectDAL/`.

Privilege for all 16: `StaticTables` (menu only; controllers carry no role attribute, so any signed-in user can open these URLs; see `system-admin.md` section 3.4).

## 0. Shared behaviour of the template pages (applies to every page unless the page says otherwise)

| Behaviour | Detail | Evidence |
|---|---|---|
| Page set | List, Create, Edit, Delete (confirm page). Create form posts to itself; Edit form posts to itself | each `Views/<X>/` folder |
| Persistence | `GenericRepository<T>` (`HRProjectDAL/Core/GenericRepository.cs`): `InsertItemAsync`, `UpdateEntityAsync` (marks a brand-new entity `Modified`, so EVERY column is overwritten, including columns the form does not post: they become NULL), `DeleteItemAsync` (hard `Remove`) | `GenericRepository.cs` lines 86-114 |
| Delete rule | None. No in-use check. If a foreign key points at the row the database raises, the controller's `catch` swallows it and then `return View()` with a null model (blank/erroring confirm page) with no message (Training is the only page that sets a "was not Successfully Deleted" message). If no FK exists in the database the row is simply removed and referencing records keep a dangling id | every `Delete(string value, int id)` POST |
| Duplicate check | Only on Create, by exact text, usually on the wrong field (see each page). None on Edit | each `CheckIf...` method |
| Required / lengths | From view-model annotations only on pages that have them; DB column lengths are shorter than some limits (insert fails with a DB error that the controller swallows and the form redisplays with no message) | `Models/*ViewModel*.cs` |
| Auditing | none of the 16 controllers writes an audit row | no `[Audit]` in these controllers |
| Lists | return all rows, unfiltered, client-side table; no active/inactive filter; no sort order column | each `List` action |
| "Export" button | each list posts to an `Export...` action that builds a PDF with Crystal Reports (`rd.Load(Server.MapPath("~/Report/<file>.rpt"))`, `SetDataSource(anonymous list)`, `ExportToStream(PortableDocFormat)`); file names listed per page | each controller |
| Dropdown usage | all lookups feed the rating/draft forms through `ISelectServiceImplementation` (`APIServices/IServiceImplementation`) with NO active filter; the "display text" column per table is given in each page below | `ISelectServiceImplementation.cs` |
| Anti-forgery | Create/Edit POSTs validate the token; Delete POSTs do not | attributes |

Page object legend: "Text col" = column used as the dropdown label elsewhere. EDMX = `HRProjectDAL/Core/HicadHRProjectModel.edmx` store entity (table) name.

## 1. Appraisal Ratings
| Item | Value |
|---|---|
| Menu label / URL | Appraisal Ratings / `AppraisalRatings/List` (Create `CreateAppraisalRating`, `Edit/{id}`, `Delete/{id}`) |
| Controller | `Controllers/AppraisalRatingsController.cs`, repository `AppraisalRatingRepository` |
| EDMX table | `Appraisalratings` (`id` int identity pk) |
| Export | none |

| Column | DB type | Page field (label/placeholder) | Input | Required | Rule |
|---|---|---|---|---|---|
| `Name` | nvarchar(5) null | "Name" | text | Yes (`[Required]` "Name is Required") | `[StringLength(5)]`; is the grade code |
| `Description` | nvarchar(50) null | "Description" | textarea | Yes ("Description is Required") | no length limit in the view model (DB 50) |

| Item | Value |
|---|---|
| Options source / parent links | none; no FK declared in the model. Used by appraisal screens (`appraisalhist.suprate/dirrate/othrate` hold 2-char codes; link to `Appraisalratings.Name` is by value, UNCONFIRMED) |
| Delete behaviour | hard delete, no check (shared) |
| Duplicate check | Create: `CheckIfStateExist(viewmodel.Description)` which tests `s.Name == Description` (wrong field: compares the NAME column with the DESCRIPTION input) |
| Faults | duplicate check on wrong field; Edit POST has no `ModelState.IsValid` and no duplicate check, so an invalid Edit (e.g. Name over 5 chars) goes to the DB and fails silently; Description limit not enforced before the DB (50); success message on Create is "Appraisal Settings was successfully Added" |
| New system | table: none yet (no `ref_appraisal_rating` in `20261116_090100_create_lookups.sql`); `lookups.js` / `GET /api/lookups`: no key. Needs a new reference table (code 5, description 50) |

## 2. Branch
| Item | Value |
|---|---|
| Menu label / URL | Branch / `Branch/List` (Create `CreateBranch`, `Edit/{id}`, `Delete/{id}`) |
| Controller | `Controllers/BranchController.cs`, repository `BranchRepository` |
| EDMX table | `branch` (`id` int identity pk) |
| Export | `ExportBranch` -> `Report/CrystalReportBranch.rpt`, fields `id`, `name` (= `busdesc`), file `branch.pdf` |

| Column | DB type | Page field | Input | Required | Rule |
|---|---|---|---|---|---|
| `busline` | nvarchar(2) null | "Branch Code" (list header "Busline Code") | text | No | none in view model |
| `busline1` | nvarchar(25) null | create form only, placeholder "B" | text | No | never saved (not copied in `Insert`) |
| `busdesc` | nvarchar(25) null | "Description" (textarea on Edit, textbox on Create) | text | No (no `[Required]`) | none; the display name in dropdowns (Text col = `busdesc`; value also `id_busline` in `GetBranchS`) |
| `createdby` nvarchar(20), `datecreated` datetime | not on the page | | | | set to NULL by every Edit (overwritten) |

| Item | Value |
|---|---|
| Parent links | none |
| Referenced by (declared FKs) | `Person.branchid`, `employmenthist.branchid`, `promotionshist.branchid` (+ `promotionshistOLD`) |
| Delete | hard delete; FK violation swallowed (blank page) |
| Faults | `CheckIfExist(busline)` actually tests `busdesc == busline` (second check wrong); `busline1` lost; Edit nulls `createdby/datecreated` and `busline1`; no required fields (blank rows can be saved); no audit |
| New system | `ref_branch(name)`: map `busdesc` to `name`; the 2-char `busline` code has no column (gap, add `code` if it is printed on drafting/advancement reports). `lookups.js`: key `branches` |

## 3. Exit Type
| Item | Value |
|---|---|
| Menu label / URL | Exit Type / `ExitType/List` (Create `CreateExitType`, `Edit/{id}`, `Delete/{id}`) |
| Controller | `Controllers/ExitTypeController.cs`, repository `ExitTypeRepository` |
| EDMX table | `Exittype` (`id` int pk) |
| Export | `ExportExitType` -> `Report/CrystalReportExitType.rpt`, fields `id`, `name` (= `Description`), `Exit Type.pdf` |

| Column | DB type | Page field | Input | Required | Rule |
|---|---|---|---|---|---|
| `Name` | nvarchar(2) null | "Name" | text | Yes ("Name is Required") | `[StringLength(2)]` (a 1-2 char CODE) |
| `Description` | nvarchar(30) null | "Description" | textarea | Yes | `[StringLength(30)]`; Text col in dropdowns |

| Item | Value |
|---|---|
| Referenced by (FK) | `Person.ExitTypeid`, `employmenthist.Exitmodeid` |
| BUSINESS MEANING OF THE CODE | The code in `Name` drives whether a rating is current: on rating edit `existPerson.IsActive = true` and keeps `dateleft/ExitReason` only when the chosen exit type `Name == "A"`; any other code sets `IsActive = false`, `dateleft = null`, `ExitReason = ""` (`Controllers/EmployeeController.cs` lines ~1770-1790 and ~2496-2515). Old current-list logic (commented out) treated codes "A", "M", "C" as serving and everything else as former (`EmployeeController.cs: Index/FormerEmployeeList`, commented). View `getFormerPersonel` returns `ExitTypeName`, `ExitReason`, `ExitDate` (body UNCONFIRMED). So the seed codes MUST be preserved on import (see `ratings.md`) |
| Delete | hard delete, no check; deleting "A" would break the current/former logic |
| Duplicate check | Create: `Name == Description` (wrong field) |
| Faults | duplicate check on wrong field; Delete confirm view shows no name; message "Item Was Successfully Deleted" without name; Edit has no `ModelState` check |
| New system | `ref_exit_type(name)`: put the full `Description` in `name`; the 1-2 char code has no column. Design needs `code` (or a flag meaning "serving") because `ratings.status` ('current'/'former') is derived from it. `lookups.js`: `exitTypes` |

## 4. Entry Mode
| Item | Value |
|---|---|
| Menu label / URL | Entry Mode / `EntryMode/List` (Create `CreateEntryMode`, `Edit/{id}`, `Delete/{id}`) |
| Controller | `Controllers/EntryModeController.cs`, repository `EntryModeRepository` |
| EDMX table | `entrymode` (`id` int pk) |
| Export | `ExportBatch` -> `Report/CrystalReportEntrymode.rpt`, fields `id`, `name` (= `entryname`), `Entrymode.pdf` |

| Column | DB type | Page field | Input | Required | Rule |
|---|---|---|---|---|---|
| `entrycode` | nvarchar(5) null | "Entry Mode Code" | text | Yes | `[StringLength(5)]` |
| `entryname` | nvarchar(50) null | "Entry Mode Name" | text | Yes | `[StringLength(20)]` in the view model (DB allows 50); Text col in dropdowns (`GetEntryMode`; `GetEntryModeS` value `id_entryname`) |
| `entrymode` | nvarchar(20) null (C# `entrymode1`) | create/edit textarea "Entry mode" | textarea | No | never saved (not copied in `Insert`); list column commented out |

| Item | Value |
|---|---|
| Referenced by (FK) | `Person.entrymodeid`; also `discharge.enterymodeid` (no FK, UNCONFIRMED) |
| Duplicate check | Create: by `entrycode` (correct). Edit: none |
| Faults | `entrymode1` field is a dead input (always NULL after every save, Edit wipes it); delete without in-use check; `entryname` limit 20 vs DB 50 |
| New system | `ref_entry_mode(name)`: use `entryname`; `entrycode` has no column (gap). `lookups.js`: `entryModes` |

## 5. Disciplinary Offence (Office)
| Item | Value |
|---|---|
| Menu label / URL | Disciplinary Offence Setup / `Office/Index` (Create `Office/Create`, `Edit/{id}`, `Delete/{id}`) |
| Controller | `Controllers/OfficeController.cs` (misnamed), repositories `OffencesRepository` + direct `db.offences` |
| EDMX table | `offences` (`id` int identity, `Name` nvarchar(50) null; entity `offence`) |
| Export | none |

| Column | DB type | Page field | Input | Required | Rule |
|---|---|---|---|---|---|
| `Name` | nvarchar(50) null | "Name" (label from model) | text | No (no annotation) | none, no duplicate check |

| Item | Value |
|---|---|
| Referenced by (FK) | `Discipline.offenceid` (the discipline cases `Controllers/DeciplineController.cs`) |
| Delete | `OffencesRepository.DeleteItemAsync`: hard delete; FK violation swallowed |
| Faults | blank and duplicate names allowed; Create/Edit bind `Bind(Include="Id,Name")`; list header uses `DisplayNameFor` ("Name"); heading texts contain "Subtitle goes here..." and Sanction list says "Saction" (typo) |
| New system | none (no discipline tables in migrations). Needs `ref_disciplinary_offence`. `lookups.js`: no key |

## 6. Disciplinary Sanction
| Item | Value |
|---|---|
| Menu label / URL | Disciplinary Sanction Setup / `Sanction/Index` (Create, `Edit/{id}`, `Delete/{id}`) |
| Controller | `Controllers/SanctionController.cs`, `SanctionRepository` + `db.sanctions` |
| EDMX table | `sanctions` (`id` int identity, `Name` nvarchar(50) null; entity `sanction`) |
| Export | none |

Same shape and faults as Offence: single column `Name`, no required, no duplicate check, referenced by `Discipline.sanctionid`, hard delete. New system: none (needs `ref_disciplinary_sanction`).

## 7. Institution
| Item | Value |
|---|---|
| Menu label / URL | Institution / `Institution/List` (Create `CreateInstitution`, `Edit/{id}`, `Delete/{id}`) |
| Controller | `Controllers/InstitutionController.cs`, `InstitutionRepository` |
| EDMX table | `Institution` (`id` int pk) |
| Export | `ExportIntstitution` -> `Report/CrystalReportForInstitution.rpt`, fields `id`, `name`, `description`, `type` |

| Column | DB type | Page field (placeholder) | Input | Required | Rule |
|---|---|---|---|---|---|
| `Name` | nvarchar(30) null | Create "Code", Edit "UNIBEN" | text | Yes ("Institution name is Required") | no length limit in VM (DB 30); short code |
| `Description` | nvarchar(100) null | "Description" / "University Of Benin" | textarea | Yes | Text col in dropdowns (`GetInstitution`) |
| `Type` | nvarchar(30) null | "Type" / "University Or Polytechnic" | text | No | free text, not a list |

| Item | Value |
|---|---|
| Referenced by (FK) | `EducationHist.InstitutionId` (NOT NULL), `Training.institutionid`, `traininghist.intstitution` |
| Duplicate check | Create: `CheckIfStateExist(Description)` which tests `Name == Description` (wrong field) |
| Faults | wrong duplicate field; Create label says "Code" while list column says "Name"; `Type` free text; success message on Edit uses `Description` |
| New system | none: `rating_training.institution` and `rating_education.institution` are free-text VARCHAR(200); no `ref_institution` table. For import, the old institution `Description` becomes that text. Needs a decision (keep free text or add `ref_institution`). `lookups.js`: no key |

## 8. Local Government (under State)
| Item | Value |
|---|---|
| Menu label / URL | Local Government / `LocalGovernmentAreas/Index` (Create, `Edit/{id}`, `Details/{id}`, `Delete/{id}`) |
| Controller | `Controllers/LocalGovernmentAreasController.cs` (scaffolded; uses `db.LocalGovernmentAreas` and `_localGovernmentService`) |
| EDMX table | `LocalGovernmentArea` (`LgaID` int pk) |
| Export | `ExportLocalGovt` -> `Report/CrystalReportLocalGovt.rpt`, fields `id`, `name`, `LGA.pdf` |

| Column | DB type | Page field | Input | Required | Rule |
|---|---|---|---|---|---|
| `Name` | nvarchar(50) NOT NULL | "Name" | text | Yes (NOT NULL; no annotation, DB error otherwise) | none |
| `Code` | nvarchar(10) NOT NULL | "Code" | text | Yes (NOT NULL) | none |
| `StateId` | int NOT NULL | Create "StateId" (dropdown `stateId` = all States, text `Name`); Edit "State Name" (dropdown, required) | select | Yes | parent link: `State.StateId` |
| `IsActive` | int null | list column "Status" (Active / Not Active) | not editable | | Create sets `1`; Edit does not post it (Bind excludes it) so Edit sets NULL |

| Item | Value |
|---|---|
| Parent link | State -> LGA (FK from the model: Person, Children, Spouse reference `LgaID`; `Hr_setlga` procedure exists) |
| Referenced by (FK) | `Person.LocalGovernmentareaId`, `Children.LocalGovernmentId`, `Spouse.LocalGovernmentId` |
| List | page size 25, paged via `PagedList`; box `lgnames` filters by exact name OR StateId text, BUT the filtered list is only used inside the `catch`, normal path returns the unfiltered `Get()`: the search does nothing. No State column in the list |
| Delete | "Delete" is a soft toggle that does not work: `DeleteConfirmed` does `if (IsActive == 1) IsActive = 0; if (IsActive == 0) IsActive = 1;`, i.e. it deactivates then immediately reactivates; an inactive row is reactivated. Net effect: nothing is ever deactivated. No in-use check |
| Used by dependent dropdown | Employee forms call `Employee/GetLgasNew?id=<stateId>` -> `LocalGovernmentArea.Where(StateId == id)` (`EmployeeController.cs` line 187), no `IsActive` filter |
| Faults | search broken; delete no-op; Edit nulls `IsActive`; Edit GET dereferences the entity before the null check, and the state list adds the selected state twice; no duplicate check; no unique (state, name) |
| New system | `ref_local_government(state_id, name)` unique (state_id, name); `code` has no column (gap); `lookups.js`: `localGovernments` and helper `filterLgas(lookups, stateId)` |

## 9. Languages
| Item | Value |
|---|---|
| Menu label / URL | Languages / `Language/List` (Create `CreateLanguage`, `Edit/{id}`, `Delete/{id}`) |
| Controller | `Controllers/LanguageController.cs`, `languageRepository` |
| EDMX table | `Languages` (`id` int identity pk; entity `Language`) |
| Export | `ExportLanguage` -> `Report/CrystalReportLanguage.rpt`, fields `id`, `name` |

| Column | DB type | Page field | Input | Required | Rule |
|---|---|---|---|---|---|
| `name` | nvarchar(20) null | "Language" (placeholder "Enter the Language") | text | No (view model `LanguagesViewModel` has no annotation) | none; Text col in `GetLanguage` |

| Item | Value |
|---|---|
| Referenced by (FK) | `LanguageSpoken.Languagesid` (rating language fluency: `CanRead`, `CanWrite`, `CanSpeak`) |
| Duplicate check | Create: tested twice, both on `name` (correct but redundant, two error texts) |
| Faults | blank name allowed; DB limit 20 chars not validated; hard delete |
| New system | `ref_language(name)`; `lookups.js`: `languages` |

## 10. Relationship
| Item | Value |
|---|---|
| Menu label / URL | Relationship / `Relationship/List` (Create `CreateRelationship`, `Edit/{id}`, `Delete/{id}`) |
| Controller | `Controllers/RelationshipController.cs`, `RelationshipRepository` |
| EDMX table | `Relationship` (`id` int identity pk). NOTE: a second, unrelated table `NextOfKinRelationship` exists (Id nvarchar(50), Name, Description, IsActive) but this page and the NOK dropdown use `Relationship` |
| Export | `ExportRelatioship` -> `Report/CrystalReportRelationship.rpt`, fields `id`, `name` (= `Description`) |

| Column | DB type | Page field | Input | Required | Rule |
|---|---|---|---|---|---|
| `Name` | nvarchar(5) null | "Name" (placeholder "Name Of Relationship") | text | Yes ("Relationship name is Required.") | `[StringLength(5)]` (a code) |
| `Description` | nvarchar(15) NOT NULL | "Description" (placeholder "Brother, Sister, etc.") | textarea | No in the view model, but NOT NULL in the DB (blank submit fails with no message) | none; Text col in dropdowns (`GetRelationship`) |

| Item | Value |
|---|---|
| Referenced by (FK) | `NextOfKin.RelationshipId` (Next of Kin tab dropdown `nextofKVM.RelationshipId`) |
| Duplicate check | Create: first `Description` (correct), then `Name` tested against `Description` column (wrong) |
| Faults | Description limit 15 not validated in the page; NOT NULL not validated; two tables with the same purpose |
| New system | closest: `ref_next_of_kin_type(name)` (use old `Description` as name, UNCONFIRMED equivalence: the new table is named "type" and the old rating NOK also carries a text column `NextofkinType`). `lookups.js`: `nextOfKinTypes` |

## 11. Staff Branch
| Item | Value |
|---|---|
| Menu label / URL | Staff Branch / `StaffBranch/List` (Create `CreateStaffBranch`, `Edit/{id}`, `Delete/{id}`) |
| Controller | `Controllers/StaffBranchController.cs`, `StaffBranchRepository` |
| EDMX table | `staffbranch` (`id` int pk) |
| Export | `ExportStaffBranch` -> `Report/CrystalReportStaffBranch.rpt`, fields `id`, `name` (= `stfbranch`) |

| Column | DB type | Page field | Input | Required | Rule |
|---|---|---|---|---|---|
| `stfbranchcode` | nvarchar(20) null | "Staff Branch Code" | text | No | none |
| `stfbranch` | nvarchar(50) null | "Description" (list "Staff Branch"); Text col in `GetStaffbranch` | text | No | none |
| `stfbranchdep` | nvarchar(20) null | "Staff Branch Department" (list "Branch Department") | text | No | free text |
| `stfbranchcdr` | nvarchar(20) null | "Staff Branch CDR" (list "Branch CDR") | text | No | free text |
| `effperiod` datetime null, `commandid` int null | not on the page | | | | `commandid` FK to `Command`; both set to NULL by every Edit (overwritten), so the command link is lost on edit |

| Item | Value |
|---|---|
| Parent link | declared FK `staffbranch.commandid -> Command.id`; the rating form reloads Staff Branch when Command changes (`personViewModel4_Commandid` change handler, `Views/Employee/Create.cshtml` lines ~130-150) |
| Referenced by (FK) | `Person.staffbranchid` |
| Duplicate check | Create: tested twice, both on `stfbranch` |
| Faults | Edit wipes `commandid` (breaks the command-to-staff-branch dependent dropdown) and `effperiod`; no required fields |
| New system | `ref_staff_branch(name)`: use `stfbranch`; code, department, cdr and command link have no columns (gap). `lookups.js`: `staffBranches` |

## 12. Specialisation Area
| Item | Value |
|---|---|
| Menu label / URL | Specialisation Area / `SpecializationArea/List` (Create `CreateSpecializationType`, `Edit/{id}`, `Delete/{id}`) |
| Controller | `Controllers/SpecializationAreaController.cs`, repository `SpecializationArea` |
| EDMX table | `Specializationarea` (`id` int pk) |
| Export | `ExportDepartment` -> `Report/CrystalReportSpecialization.rpt`, fields `id`, `name` (= `sp_code`), `spec` (= `sp_desc`) |

| Column | DB type | Page field | Input | Required | Rule |
|---|---|---|---|---|---|
| `sp_code` | nvarchar(15) null | "Specialization Area Code" (list header "Name") | text | Yes ("Specialization Code is Required") | `[StringLength(15)]` |
| `sp_desc` | nvarchar(20) null | "Description 1" (list "Description"); Text col in dropdowns | textarea | Yes | `[StringLength(20)]` |
| `sp_desc1` | nvarchar(20) null | "Description 2" | textarea | No | `[StringLength(20)]`; list column commented out |

| Item | Value |
|---|---|
| List | search box `shname`: exact match on `sp_code` (`GetByQuery(x => x.sp_code == shname ...)`); list header labels the code column "Name" |
| Referenced by (FK) | `Person.SpecialisationAreaId`, `EducationHist.SpecializationAreaId` (NOT NULL); also `AspNetUsers.specid` (system user "Department") and the drafting/advancement `specid` columns (no FK) |
| Duplicate check | Create: by `sp_code` (correct) |
| Faults | Delete confirm text "Are you sure you want to Delete?" with no name; header "Name" shows the code; descriptions limited to 20 chars; hard delete with FK users (blocked silently) |
| New system | `ref_specialisation(name)`: use `sp_desc` as `name` (the code `sp_code` has no column, gap: drafting/advancement batches key on spec code, see `GetSpecializationAreaS` value `id_sp_code`). `lookups.js`: `specialisations` |

## 13. Ships (menu "Ships", action `Ships/IndexDepartment`)
| Item | Value |
|---|---|
| Menu label / URL | Ships / `Ships/IndexDepartment` (Create/Edit both `Ships/CreateDepartment/{id?}`, Delete `Ships/Delete/{id}`) |
| Controller | `Controllers/ShipsController.cs`, repositories `DepartmentRepository`, `CommandRepository`, view models `DepartmentViewModel` (`Models/ViewModel.cs`) |
| EDMX table | `Department` (`Id` int identity pk). A "ship" is a row of table `Department` (the code calls it department everywhere, e.g. `Person.Departmentid` = the rating's current ship) |
| Export | `ExportShip` -> `Report/CrystalReportForShip.rpt`, fields `id`, `name`, `description`, `command` (= `Command.Description`), `landorsea` (= `LandSea`), `Ship.pdf` |

| Column | DB type | Page field | Input | Required | Rule |
|---|---|---|---|---|---|
| `Name` | nvarchar(50) null | "Ship Name" (placeholder "Department Name") | text | No (validation message span exists but no annotation) | none |
| `Description` | nvarchar(150) null | "Description" | textarea | No | list search box `shname` is meant to filter on it (`Contains`) |
| `commandid` | int null (FK `Command.id`) | "Command" | dropdown | No | options: `CommandRepository.Get()` text `Command.Description` (`GetPerson()`), empty option "Select command" |
| `LandSea` | nvarchar(40) null | "On Shore" (the label) | select | No | fixed options: blank, `Land`, `Sea`, `Training` |
| `IsActive` bit | not on the page | | | | set `true` on every save |
| `CreatedDate`, `CreatedBy`, `ModifiedDate`, `ModifiedBy`, `DepartmentLeader` | not on the page | | | | not set (the code updates a loaded entity, so they are preserved; never filled) |

| Item | Value |
|---|---|
| Parent link | `Command` (`Command`: `id`, `Name` nvarchar(5), `Description`, `UnitCode`; no static page for Command in the live menu, edited elsewhere or by SQL) |
| Referenced by (FK) | `Person.Departmentid`, `employmenthist.Departmentid`; and drafting tables hold ship ids (`drafting.curdeptid/newdeptid/prevdeptid`, `shiprequirement.shipcode` no FK) |
| List | page size intended 20, ordered by `commandid`; columns: ID, Name, Description, Command, On Shore, Action |
| Delete | hard delete, FK violation swallowed (blank page); no in-use check |
| Faults | paging arguments swapped (`ToPagedList(pageSize, pageIndex)`: page number 20, size 1), so the list shows a wrong slice/pages; search `shname` result is assigned to a variable that is never shown (always the unfiltered list; the filter variable is only used in the `catch`); `@d.Command.Description` crashes the list when a ship has no command; `LandSea` label "On Shore" with values Land/Sea/Training; no duplicate-name check; page-level `ModelState` has no rules; no anti-forgery on the Create POST |
| New system | `ref_ship(name)`; the command link, land/sea/training flag and description have no columns (gap; `ref_command` exists but `ref_ship` has no `command_id`). `lookups.js`: `ships` |

## 14. States
| Item | Value |
|---|---|
| Menu label / URL | States / `States/Index` (Create, `Edit/{id}`, `Details/{id}`, `Delete/{id}`) |
| Controller | `Controllers/StatesController.cs` (scaffolded, `db.States`, `_StateService`) |
| EDMX table | `State` (`StateId` int pk), parent `geozone` (`id` int, `name` nvarchar(30), `IsActive` int), `Country` |
| Export | `ExportState` -> `Report/CrystalReportState.rpt`, fields `id`, `name`, `zone` (= `geozone.name`), `States.pdf` |

| Column | DB type | Page field | Input | Required | Rule |
|---|---|---|---|---|---|
| `Name` | nvarchar(50) NOT NULL | "State Name" | text | Yes (NOT NULL; no annotation) | none |
| `Code` | nvarchar(5) NOT NULL | "State Code" | text | Yes (NOT NULL) | none |
| `geozoneid` | int null (FK `geozone.id`) | "GeoZone" | dropdown from `geozones` (text `name`) | No | parent link: geopolitical zone |
| `CountryId` | int null (FK `Country.Id`) | not on the form (posted only via `Bind`; Edit loads `ViewBag.CountryId` that no field uses) | | | NULL after Edit |
| `IsActive` | bit null | list "Status": Active / Not Active | not editable | | Create sets `true`; Edit does not post it, so it becomes NULL |

| Item | Value |
|---|---|
| Referenced by (FK) | `Person.StateId`, `Children.Stateid`, `Spouse.Stateid`, `employmenthist.Stateid`, `LocalGovernmentArea.StateId` (by column, child pages) |
| List | page size 7; box `stnames` matches name or zone id text, but (same defect as LGA) the filtered list is only used in the `catch`; the normal path returns the unfiltered `Get()` |
| Delete | same broken toggle as LGA (`IsActive` set false then true again): a state can never be deactivated, no in-use check, so rows are effectively permanent |
| Faults | search broken; delete no-op; Edit nulls `IsActive` and `CountryId`; paging shows 7 per page |
| New system | `ref_state(name)` + `ref_geo_political_zone(name)` (the zone link has no column on `ref_state`, gap: `ratings.geo_political_zone_id` is stored per rating instead); `Code` has no column. `lookups.js`: `states`, `geoPoliticalZones` |

## 15. Title
| Item | Value |
|---|---|
| Menu label / URL | Title / `Title/List` (Create `CreateTitleType`, `Edit/{id}`, `Delete/{id}`) |
| Controller | `Controllers/TitleController.cs`, `TitleTypeRepository`, view model `TitleViewModel` |
| EDMX table | `TitleType` (`TitleTypeId` int pk) |
| Export | `ExportTitle` -> `Report/CrystalReportTitle.rpt`, fields `id`, `name`, `rate` (= `Description`) |

| Column | DB type | Page field | Input | Required | Rule |
|---|---|---|---|---|---|
| `Name` | nvarchar(20) NOT NULL | "Name" | text | Yes ("Title is Required") | `[StringLength(50)]` in the view model (DB allows only 20, so 21-50 chars fail silently); Text col in `GetRate` (rating "Title" dropdown, system-user "Rank") |
| `Description` | nvarchar(50) NOT NULL | "Description" | textarea | Yes | `[StringLength(150)]` in the model (DB 50); used as the "Rate" text in some lists (`GetRateS` value `TitleTypeId_Description`) |

| Item | Value |
|---|---|
| Referenced by (FK) | `Person.TitleTypeId`, `promotionshist.rank`, `promotionshistOLD.rank`, `TrainingDrafting.titleid`; also `AspNetUsers.Rank` (no FK) |
| Duplicate check | Create: by `Name` (correct) |
| Faults | the list's Edit link goes to `Title/Edit/{id}` but `Views/Title/` has no `Edit.cshtml` (only `CreateTitleType`, `Delete`, `List`; also none in `Views/Shared`), so Edit fails (UNCONFIRMED: not run); limit mismatch 50/150 vs DB 20/50; hard delete; the page is named "Title" while the data is used as the rank (system users call it "Rank") |
| New system | `ref_title(name)`: use `Name`; `Description` has no column (gap). `lookups.js`: `titles`. Note `ref_rate` (old table `Rate`) is a different table and is NOT one of the 16 pages (no static page edits it) |

## 16. Training
| Item | Value |
|---|---|
| Menu label / URL | Training / `Training/List` (Create `CreateTraining`, `Edit/{id}`, `Delete/{id}`) |
| Controller | `Controllers/TrainingController.cs`, repositories `TrainingRepository`, `InstitutionRepository`, `QualificationRepository` (unused) |
| EDMX table | `Training` (`id` int pk, NOT marked identity in the model, so the insert sends `id = 0`; a second insert would collide, UNCONFIRMED against the live database) |
| Export | `ExportTraining` -> `Report/CrystalReportTraining.rpt`, fields `id`, `name`, `description`, `Institution` (= `Institution.Description`), `qualification` |

| Column | DB type | Page field | Input | Required | Rule |
|---|---|---|---|---|---|
| `Name` | nvarchar(10) null | "Name of Training" | text | No | none (DB 10 chars) |
| `institutionid` | int null (FK `Institution.id`) | "Select Institution" | dropdown, options `Institution` table, text `Description`, value `id` (`GetInstitution()`) | No | |
| `Qualification` | nvarchar(50) null | "Qualification" | plain text input (NOT bound to the model value) | No | on Edit the box is empty, so saving blanks the stored qualification |
| `Description` | nvarchar(60) null | "Masters in Computer Science" (placeholder) | textarea | No | list header "Description" |
| `QualificationId` | int null | not on the page (line commented out "cornelius") | | | NULL after every save |

| Item | Value |
|---|---|
| Parent link | Institution -> Training (declared FK `Training.institutionid`) |
| Referenced by (FK) | `TrainingDrafting.prevcourseid`, `traininghist.trainingid`; training draft screens read `Training` |
| List | columns Name, Description, Qualification, Institution (`@item.Institution.Description`, crashes when a course has no institution) |
| Duplicate check | Create: `CheckIfStateExist(viewModel.Description)` tests `Name == Description` (wrong field) |
| Delete | only page that reports failure ("{Description} Was not Successfully Deleted", redirect to list) but still no in-use check beforehand |
| Faults | wrong duplicate field; Edit blanks `Qualification` and `QualificationId`; list crashes on null institution; `Name` 10-char DB limit unvalidated; Create posts `Qualification` as raw input |
| New system | none: `rating_training` stores `institution`, `qualification`, `classification` as free text; no `ref_training`. Training drafting is another module (out of scope here). `lookups.js`: no key |

## 17. Mapping summary to the new schema and `public/js/core/lookups.js`

`lookups.js` (`public/js/core/lookups.js`) holds no tables itself: `getLookups()` calls `GET /api/lookups` once and caches the bundle built by `src/modules/lookups/lookups.repo.js: fetchAllLookups` from `src/db/migrations/20261116_090100_create_lookups.sql`; every `ref_*` table has only `id`, `name`, `sort_order`, `is_active` (+ audit dates, `created_by`), `UNIQUE(name)`; the two parent/child tables have `religion_id` / `state_id` and a unique key `(parent, name)`. Helpers: `filterDenominations`, `filterLgas(lookups, stateId)`.

| # | Old page / table | New table | `lookups.js` / API key | Old columns with no new column |
|---|---|---|---|---|
| 1 | Appraisal Ratings / `Appraisalratings` | none | none | all (Name code 5, Description 50) |
| 2 | Branch / `branch` | `ref_branch` | `branches` | `busline` code, `busline1` |
| 3 | Exit Type / `Exittype` | `ref_exit_type` | `exitTypes` | `Name` code (A/M/C = serving logic) |
| 4 | Entry Mode / `entrymode` | `ref_entry_mode` | `entryModes` | `entrycode`, `entrymode` |
| 5 | Disciplinary Offence / `offences` | none | none | all |
| 6 | Disciplinary Sanction / `sanctions` | none | none | all |
| 7 | Institution / `Institution` | none (free text in `rating_training.institution`, `rating_education.institution`) | none | Name code, Type |
| 8 | Local Government / `LocalGovernmentArea` | `ref_local_government` (`state_id`) | `localGovernments` | `Code`, `IsActive` int |
| 9 | Languages / `Languages` | `ref_language` | `languages` | none |
| 10 | Relationship / `Relationship` | `ref_next_of_kin_type` (UNCONFIRMED equivalence) | `nextOfKinTypes` | `Name` code |
| 11 | Staff Branch / `staffbranch` | `ref_staff_branch` | `staffBranches` | code, department, cdr, `commandid`, `effperiod` |
| 12 | Specialisation Area / `Specializationarea` | `ref_specialisation` | `specialisations` | `sp_code`, `sp_desc1` |
| 13 | Ships / `Department` | `ref_ship` | `ships` | `commandid`, `LandSea`, `Description`, `DepartmentLeader` |
| 14 | States / `State` | `ref_state` (+ `ref_geo_political_zone` from `geozone`) | `states`, `geoPoliticalZones` | `Code`, `geozoneid` link, `CountryId`, `IsActive` |
| 15 | Title / `TitleType` | `ref_title` | `titles` | `Description` |
| 16 | Training / `Training` | none | none | all |

Related old lookup tables used by the rating forms but NOT among the 16 static pages (edited only by SQL; seed needed for import): `Rate` (`rate`, `Description`) -> `ref_rate`; `Command` -> `ref_command`; `SexType` -> `ref_gender`; `MaritalStatus`; `Religion`, `religiondenomination`; `tribe`; `Homebase` -> `ref_mother_base`; `geozone`; `IdentificationType`; `ColorHair`, `ColorEye`, `Complexion`; `BloodGroup`, `Genotype`; `Disability`; `Document` (document codes, `DocCode` nvarchar(5), `Name`) -> `ref_document_category`.

## Hand-off notes for design/build
- Read first: sections 0 (shared faults) and 17 (mapping). The 16 pages are one template; build ONE generic reference-data admin (list, create, edit, deactivate) rather than 16 screens, driven by a config per table (columns, required, parent).
- Decide which old codes are business data: Exit Type code ("A" = serving), Specialisation code (batch keys), Branch `busline`, State/LGA codes, Entry Mode code. The new `ref_*` tables carry only `name`; add `code` columns before the import or those meanings are lost.
- Replace hard delete with deactivate (`is_active`) plus an in-use check (the declared FKs listed per page); never repeat the swallow-and-show-blank behaviour.
- Add real duplicate checks (the old ones test the wrong field on Appraisal Ratings, Institution, Exit Type, Branch, Relationship, Training) and enforce DB lengths in the form.
- Tables with no new equivalent: Appraisal Ratings, Disciplinary Offence, Disciplinary Sanction, Institution, Training. They belong to the Appraisal, Discipline and Training modules; build them with those modules.
- Dependent dropdowns to keep: State -> Local Government; Command -> Staff Branch (old Edit wiped the link, UNCONFIRMED whether the live data still has `staffbranch.commandid`).
- UNCONFIRMED: seed values of every table (not in the repository), whether `Title` Edit really fails (view missing), the `Relationship` = NOK type equivalence.
