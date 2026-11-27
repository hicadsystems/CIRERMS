# Legacy map: data model of a Rating (a person)

Scope: ONLY the old tables behind a rating and how they map to the new schema for the later import. The old pages are not documented here. Sources: `HRProjectDAL/Core/HicadHRProjectModel.edmx` (store model: tables, columns, declared foreign keys), `hpproject/Controllers/EmployeeController.cs` and `EmployeePersonalInfoController.cs` (only to find which tables are used), `hpproject/APIController/PersonelController.cs` (child-record endpoints). New schema: `src/db/migrations/20261116_090200_create_ratings.sql` (`ratings`), `20261116_090300_create_rating_records.sql` (`rating_*`), `20261116_090100_create_lookups.sql` (`ref_*`).

> **Update (27/11/2026):** the fields below marked "NO EQUIVALENT" for next of kin, spouse, children and drafting history (all but the drafting State and Sub-Branch, which the owner left out) now have columns in the new schema (`20261120_160000_record_fields.sql`). [import-map.md](import-map.md) maps each one to its live column.

Conventions: type shows `nvarchar(30)` etc.; `?` = nullable in the store model; `#` = identity. Everything below the edmx is a read of definitions only; no data was read. Procedure and view bodies are not available, so rules about "current / former" are inferred from C# (UNCONFIRMED where stated).

## 1. Identity of a rating: keys and linking

| Fact | Detail | Evidence |
|---|---|---|
| Old primary key | `Person.PersonID` int identity. All child tables carry `PersonID` (or `personid`/`Personid`), NOT the service number | edmx `Person`, child tables |
| Business key | `Person.SVC_NO` nvarchar(10) null (the official/service number). Uniqueness is NOT a database constraint; the create code checks `db.People.Where(x => x.SVC_NO == ...)` before inserting | edmx; `EmployeeController.cs: Create` ~line 1168 |
| New key | `ratings.service_number` VARCHAR(20) is the primary key; children use it with `ON UPDATE CASCADE`. So the import must translate every child `PersonID` to the parent's `SVC_NO` and must first find and resolve duplicate, blank and differently-cased `SVC_NO` values | `20261116_090200_create_ratings.sql` |
| Workflow tables keyed by service number text | `drafting`, `draftinghistory`, `advancement`, `discharge` hold `svcno` text (not PersonID); `SpecialDraft` holds `svc_no` | edmx |
| Login link | `AspNetUsers.ServiceNumber` = `Person.SVC_NO` (`AccountController.cs: Login` uses it to find the person) | `system-admin.md` |

## 2. Current versus former, and the discharge flag

There is no single status column. What exists:

| Column / object | Meaning | Evidence |
|---|---|---|
| `Person.ExitTypeid` int (FK `Exittype.id`) | the exit type; its CODE `Exittype.Name` (1-2 chars) drives the rest. Code `A` = serving | edmx FK `FK_Person_Exittype` |
| `Person.IsActive` bit | set `true` when the chosen exit type code is `A`, otherwise `false`, on every rating edit | `EmployeeController.cs` lines ~1770-1790 and ~2496-2515 |
| `Person.dateleft` datetime, `Person.ExitReason` nvarchar(50) | kept only for code `A` in the edit code (surprising: the leaving data is blanked for non-`A`: `dateleft = null; ExitReason = ""`); filled elsewhere for discharge (UNCONFIRMED) | same |
| `Person.LeavingDate` datetime | exists, no read found (UNCONFIRMED) | edmx |
| `Person.LiveStatus` bit | set `false` on every edit; meaning unknown | `EmployeeController.cs` (several lines `existPerson.LiveStatus = false`) |
| View `getCurrentPersonel` (`PersonID`, `SVC_NO`, `FirstName`, `MiddleName`, `LastName`, `ExitTypeid`) | the "Current Ratings List" source (`IPersonReportImplementation.returnListofCurrentPersons`); body UNCONFIRMED | edmx; `HRProjectDAL/APIImplementationRepository/IPersonReportImplementation.cs` |
| View `getFormerPersonel` (`PersonID`, `SVC_NO`, names, `ExitTypeName`, `ExitReason`, `ExitDate`) | the "Former Ratings List" source; body UNCONFIRMED | same |
| Procs `getCurrentPersonelCount`, `getFormerPersonelCount` | dashboard counts (Members / Old Members / Current Members) | `HomeController.cs: Index` |
| Old commented list logic | current = exit type code in {`A`, `M`, `C`}; former = any other (the active-list code is commented out, so this is a hint not a rule) | `EmployeeController.cs: Index`, `FormerEmployeeList` (commented) |
| Table `discharge` | the discharge case: `dischargeid` bigint#, `svcno`, `lengthserviceyr` int, `personelage` int, `created`, `modified`, `postedby`, `dischargetype` int, `rate` int, `dischargereason` nvarchar(100), `status` int NOT NULL, `updatedby`, `dischargedate`, `comment` text, `deathcert` bit, `condolenceletter` bit, `evidence` bit, `swornafidavit` bit, `reengagement` bit, `reengaementdate` (sic), `reengagementperiod`, `approvedby`, `pid`, `enterymodeid`, `personelserviceyears`, `dateleft`. `status` values are not named anywhere in C# that was read (UNCONFIRMED; the Discharge module will define them) | edmx |

Mapping decision for the import (propose, confirm with the owner): `ratings.status = 'current'` when the person's exit-type code is serving (`A`, and probably `M`, `C`; confirm), else `'former'`. Cross-check the result against the old dashboard counts (current + former = Members). `ratings.exit_type_id`, `exit_date`, `exit_reason` receive `ExitTypeid`, `dateleft`, `ExitReason` (note old data may have lost them for non-`A`, see above). The `ref_exit_type` seed must therefore be built with the old codes preserved (see `static-tables.md` section 3).

## 3. Person (the main table) and mapping to `ratings`

Old table `Person` (edmx), all columns. Map column:

| Old column (type) | New `ratings` column | Notes / rule |
|---|---|---|
| `PersonID` int# | none | only for translating child rows |
| `SVC_NO` nvarchar(10)? | `service_number` | key, see section 1 |
| `FirstName` nvarchar(30)? | `first_name` | |
| `MiddleName` nvarchar(30)? | `middle_name` | |
| `LastName` nvarchar(30)? | `surname` | old "Surname" input is `LastName` (`SecurityController.cs: Upload` maps Surname to `LastName`) |
| `Rateid` int? | `rate_id` -> `ref_rate` | form dropdown "Rate" from table `Rate` (`rate`, `Description`) via `ISelectService.GetRating` |
| `TitleTypeId` int? (FK `TitleType`) | `title_id` -> `ref_title` | form dropdown "Title" from `TitleType.Name` |
| `SexId` int? | `gender_id` -> `ref_gender` | table `SexType` (`Description`) |
| `BirthDate` date? | `date_of_birth` | |
| `MaritalStatusId` int? | `marital_status_id` | table `MaritalStatus` |
| `marriedtopers` nvarchar(30)? | `married_to_military_personnel` | |
| `MaidenName` nvarchar(50)? | `maiden_name` | |
| `ReligionId` int? | `religion_id` | table `Religion` |
| `religiondenominationid` int? | `religion_denomination_id` | table `religiondenomination` |
| `tribeId` int? | `tribe_id` | table `tribe` |
| `PhotoPath` nvarchar(250)? | `passport_photo_path` | holds `~/Content/UploadPhotoPath/<file>`; the image files live under `hpproject/Content/UploadPhotoPath/` and must be copied and the path rewritten |
| `NOKFileName` nvarchar(250)? | `next_of_kin_photo_path` | same folder |
| `StateId` int? | `state_id` | |
| `LocalGovernmentareaId` int? | `local_government_id` | |
| `homeaddress` nvarchar(100)? | `home_address` | |
| `motherbaseid` int? | `mother_base_id` | table `Homebase` (`Name`, `Description`; repository `MotherbaseRepository`) |
| `Birthplace` nvarchar(30)? | `place_of_birth` | |
| `email` nvarchar(50)? | `email_address` | |
| `GSMNumber` nvarchar(15)? | `phone` | |
| `geozoneid` int? | `geo_political_zone_id` | table `geozone` |
| `DrivingLicNumber` nvarchar(20)? / `DrivingLicExpiryDate` datetime? | `driver_license_number` / `driver_license_expiry_date` | |
| `IdentificationId` int? | `identification_type_id` | table `IdentificationType` |
| `NationIdentityNumber` nvarchar(50)? | `identity_number` | only this one id number has a target; `PassportNumber`, `passportexpdate`, `bvn` have none (below) |
| `Weight` / `Height` / `Chest` nvarchar(5)? | `weight_kg` DECIMAL(5,2) / `height_m` DECIMAL(3,2) / `chest_cm` DECIMAL(5,1) | text in old data: parse, units unknown (UNCONFIRMED), reject non-numeric |
| `ColorHairid` / `ColorEyesid` / `Complexionid` int? | `hair_color_id` / `eye_color_id` / `complexion_id` | tables `ColorHair`, `ColorEye`, `Complexion` |
| `BloodGroupid` / `Genotypeid` int? | `blood_group_id` / `blood_genotype_id` | tables `BloodGroup`, `Genotype` |
| `tribalmarks` bit? | `tribal_mark` TINYINT NOT NULL default 0 | null becomes 0 |
| `DisabilityId` int? / `DisabilityComment` nvarchar(100)? | `disability_id` / `disability_comment` | table `Disability` |
| `branchid` int? (FK `branch`) | `branch_id` | |
| `Commandid` int? (FK `Command`) | `command_id` | |
| `staffbranchid` int? (FK `staffbranch`) | `staff_branch_id` | |
| `senioritydate` date? | `seniority_date` | |
| `entrymodeid` int? (FK `entrymode`) | `entry_mode_id` | |
| `dateemployed` date? | `date_employed` | the "date of joining" |
| `SpecialisationAreaId` int? (FK `Specializationarea`) | `specialisation_id` | |
| `ExitTypeid` int? | `exit_type_id` | section 2 |
| `dateleft` datetime? | `exit_date` | section 2 |
| `ExitReason` nvarchar(50)? | `exit_reason` | |
| `hubbies` nvarchar(50)? | `hobbies` | |
| `Departmentid` int? (FK `Department` = the ship) | none on `ratings`; becomes the OPEN `rating_drafting` row (`ship_id`, `end_date` NULL) | new design: current ship is not stored on `ratings` |
| `IsActive` bit? | `status` | section 2 |
| `CreatedDate`, `CreatedBy` nvarchar(150)?, `ModifiedDate`, `ModifiedBy` | `created_at`, `created_by` (INT, so old text user ids do not fit; import with NULL or via a user map) | `updated_at` is automatic |
| `NickName`, `Initials`, `Nationality`, `DisplayName`, `Username`, `Password`, `LiveStatus`, `SortId`, `roletypeid`, `countryid`, `LeavingDate` | NO EQUIVALENT | `Initials` is derived (first letters, built in `EmployeeController`), `Username`/`Password` are legacy and must NOT be imported |
| `PassportNumber`, `passportexpdate`, `FingerPrint` binary(50), `bvn`, `vDrivinglicNumber`, `vNationalIdentifyNumber`, `vPassportNumber`, `vFingerPrint`, `vbvn`, `vDrivingLicExpiryDate`, `vpassportexpdate` | NO EQUIVALENT | `v*` columns look like "verified" copies (UNCONFIRMED); biometric/BVN data: decide explicitly, default is do not import |
| `commissiontypeid`, `commissionid`, `commissiondate` | NO EQUIVALENT | lookup tables `CommissionType`, `Commision` exist |
| `NosGCBS` nvarchar(5)? | NO EQUIVALENT on `ratings` | per-promotion GCB number belongs to the advancement row (`gcbno`) |
| `reengagementdate` | NO EQUIVALENT | re-engagement is also on `discharge` |
| `MedicalCondition` int?, `MedicalConDate`, `Punishment` int?, `PunishmentDate` | NO EQUIVALENT | not referenced by the rating pages found; lookup `Ailment`, `treatmentgroup`; UNCONFIRMED use |
| `sub_specialisationid` int?, `officeaddress` nvarchar(100)?, `FileName` text, `PassportPhoto` varbinary(max), `NOKPassportPhoto` varbinary(max) | NO EQUIVALENT | binary photo columns are not written by the live code (they are commented), photos are on disk (see `PhotoPath`) |

Lookup tables the Person row points at (all already modelled as `ref_*`, but their seed data is not in the repo): `Rate`, `TitleType`, `SexType`, `MaritalStatus`, `Religion`, `religiondenomination`, `tribe`, `State`, `LocalGovernmentArea`, `Homebase`, `geozone`, `IdentificationType`, `ColorHair`, `ColorEye`, `Complexion`, `BloodGroup`, `Genotype`, `Disability`, `branch`, `Command`, `staffbranch`, `entrymode`, `Exittype`, `Specializationarea`, `Department` (ships).

Required on the old create page (view model `PersonViewModel2`, `Models/ViewModel.cs`): service number, first name, last name, birth date, gender, marital status. Everything else optional. New `ratings` requires `surname`, `first_name`, `service_number` only.

## 4. Child tables and mapping

All child rows link by `PersonID`. The old rating page has these tabs: Ratings Details, Next of Kin, Spouse, Children, Advancement, Drafting, Training, Education, Language Fluency, View Document/Upload (`Views/Employee/Create.cshtml`), each served by `api/Personel/...` endpoints (`PersonelController.cs`).

### 4.1 Next of kin: `NextOfKin` -> `rating_next_of_kin`
| Old column | Type | New column | Note |
|---|---|---|---|
| `Id` | int# | `id` | not preserved |
| `PersonID` | int | `service_number` | via Person |
| `FirstName` | nvarchar(20)? | `first_name` | NOT NULL in new: default blank rows must be skipped or filled |
| `LastName` | nvarchar(50)? | `last_name` | NOT NULL in new |
| `MobileNumber` | nvarchar(50)? | `mobile_number` | |
| `RelationshipId` | int? (FK `Relationship`) | `next_of_kin_type_id` | table `Relationship` (`Name` code, `Description` text) |
| `FullAddress`, `HomeNumber`, `EmailAddress`, `PlaceOfWork`, `NextofkinType` nvarchar | | NO EQUIVALENT | |
| `IsActive` bit? | | status flag | page sets `true` on create/update (`EmployeeController.cs` ~3903-3928); import only active rows, UNCONFIRMED whether inactive rows exist |
| `CreatedDate/By`, `ModifiedDate/By` | | `created_at`/`created_by` | |
Procs: `NextOfkinCount`, `deleteNOK`, `UpdateNOK`; view `getNextofkin` (list).

### 4.2 Spouse: `Spouse` -> `rating_spouse`
| Old column | New column | Note |
|---|---|---|
| `id#`, `PersonID` | `id`, `service_number` | |
| `spname` nvarchar(50)? | `name` (NOT NULL) | |
| `spphone` nvarchar(20)? | `phone_number` | |
| `spemail` nvarchar(50)? | `email_address` | |
| `spstreet`, `sptown`, `sppobox`, `LocalGovernmentId` (FK LGA), `Stateid` (FK State) | NO EQUIVALENT | address data would be lost |
| `spactive` bit? | status flag | import active only (UNCONFIRMED) |
| `createdby` int?, `datecreated`, `Modifydate`, `ModifyBy` | audit | |
Procs `deleteSpouse`, `UpdateSouse`; view `getSpouse`.

### 4.3 Children: `Children` -> `rating_children`
| Old column | New column | Note |
|---|---|---|
| `id#`, `personid` | `id`, `service_number` | |
| `chname` nvarchar(50)? | `name` (NOT NULL) | |
| `chphone` nvarchar(20)? | `phone_number` | |
| `chemail` nvarchar(50)? | `email_address` | |
| `dateofbirth` datetime?, `Sextypeid`, `chschool`, `occupation`, `officeaddress`, `chstreet`, `chtown`, `chpobox`, `LocalGovernmentId`, `Stateid` | NO EQUIVALENT | child date of birth and sex are lost |
| `chactive` bit? | status flag | import active only (UNCONFIRMED) |
Procs `deletechildren`, `UpdateChild`; view `getChildren`.

### 4.4 Advancement (promotion) history: `promotionshist` -> `rating_advancement`
Old Advancement tab fields: Rank Code, Rate, Decoration/Award, Authority, GCBNO, Start/End date.
| Old column | Type | New column | Note |
|---|---|---|---|
| `id#`, `PersonID` | | `id`, `service_number` | |
| `fromdate`, `todate` | datetime? | `start_date`, `end_date` | |
| `rateid` | int? (no FK; table `Rate`) | `rate_id` (NOT NULL in new) | rows without a rate cannot be imported as is |
| `decoration` | nvarchar(50)? | `decoration` | |
| `signal` | nvarchar(50)? | `authority` | label "Authority" on the page |
| `NosGCBS` | nvarchar(50)? | `gcbno` | label "GCBNO" |
| `rank` | int? (FK `TitleType`) | NO EQUIVALENT | the "Rank Code" |
| `branchid`, `departmentid` | int? | NO EQUIVALENT | |
| `createdby`, `datecreated` | | audit | |
Related legacy: `promotionshistOLD` (older copy, same shape), view `getPromotionhist`. Not rating history but the advancement WORKFLOW (proposal, batch, approval): table `advancement` (`advanceid`, `batchnumber`, `svcno`, ...) belongs to the Advancement module, not to this import.

### 4.5 Drafting (employment) history: `employmenthist` -> `rating_drafting`
Old Drafting tab fields: Rate, Start Date, End Date, Branch, Ship, Authority, Command, Staff Branch, State, Decoration/Award, Remarks.
| Old column | Type | New column | Note |
|---|---|---|---|
| `id#`, `PersonID` | | `id`, `service_number` | |
| `Departmentid` | int? (FK `Department`) | `ship_id` (NOT NULL in new) | "Ship"; rows without a ship cannot be imported as is |
| `rateid` | int? | `rate_id` | |
| `fromdate`, `todate` | datetime? | `start_date`, `end_date` | an open row (`todate` null) is the current ship |
| `remarks` | nvarchar(150)? | `remarks` | |
| `signal` | nvarchar(30)? | NO EQUIVALENT | "Authority" (draft signal reference) is lost unless a column is added |
| `branchid`, `command`, `staffbranchid`, `Stateid`, `decoration`, `Exitmodeid`, `apptno`, `TitleTypeid`, `pre_appt`, `Appointmentid`, `nextship`, `fultureship` | | NO EQUIVALENT | `nextship`/`fultureship` are drafting-plan fields |
| `createdby`, `datecreated` | | audit | |
Related legacy: view `getEmploymenthist`; `employmenthistNew`, `py_emplhistory`, `tempemplhist`, `TEMP_TEN_*` are working copies (ignore); procs `migratefromEmplHistToDraft*` show that employment history was the source for the drafting workflow table `drafting` / `draftinghist` (`draftinghistory`) which hold closed and in-flight drafts by `svcno` text (Drafting module, not this import). For the CURRENT ship of a rating use `Person.Departmentid` (section 3) and, if present, the open `employmenthist` row; reconcile the two (UNCONFIRMED which is authoritative, check on a sample before the load).

### 4.6 Training history: `traininghist` -> `rating_training`
Old Training tab: Training/Classification (dropdown), Institution (dropdown), Qualification (text), From, To.
| Old column | Type | New column | Note |
|---|---|---|---|
| `id#`, `PersonID` | | `id`, `service_number` | |
| `intstitution` (sic) | int? (FK `Institution`) | `institution` VARCHAR(200) NOT NULL | resolve to `Institution.Description` text |
| `Qualification` | nvarchar(50)? | `qualification` | |
| `trainingid` | int? (FK `Training`) | `classification` | resolve to `Training.Description` (UNCONFIRMED that "Classification" = the course; the tab label is "Training/Classification") |
| `fromdate`, `todate` | datetime? | `start_date`, `end_date` | |
| `createdby` int?, `datecreated` | | audit | |
View `getTraining`. Old upload tables `tbl_Trainingupload`, `tbl_Training_Dump` belong to the training-draft module.

### 4.7 Education history: `EducationHist` -> `rating_education`
| Old column | Type | New column | Note |
|---|---|---|---|
| `id#`, `PersonID` | | `id`, `service_number` | |
| `InstitutionId` | int NOT NULL (FK `Institution`) | `institution` VARCHAR(200) NOT NULL | resolve to text |
| `StartDate`, `EndDate` | datetime NOT NULL | `start_date`, `end_date` | |
| `Qualification` | nvarchar(50)? | `qualification` | |
| `SpecializationAreaId` | int NOT NULL (FK `Specializationarea`) | `classification`? | UNCONFIRMED mapping (no better target; the new `classification` column has no old counterpart named so) |
| `CreatedDate/By`, `ModifiedDate/By` (int) | | audit | |
View `getEducation`.

### 4.8 Languages: `LanguageSpoken` -> `rating_language`
| Old column | Type | New column | Note |
|---|---|---|---|
| `id#`, `PersonID` (FK Person) | | `id`, `service_number` | |
| `Languagesid` | int? (FK `Languages`) | `language_id` NOT NULL | skip rows with null |
| `CanRead`, `CanWrite`, `CanSpeak` | nvarchar(5)? | `can_read`, `can_write`, `can_speak` TINYINT | form values are `Yes` / `No` (blank possible): `Yes` -> 1, else 0 |
New has `UNIQUE(service_number, language_id)`: merge duplicates. View `getLanguage`.

### 4.9 Documents
| Old | Detail | New |
|---|---|---|
| `PersonDocument` | `id#`, `Personid`, `DocCode` nvarchar(5), `DocPath` nvarchar(250), `Description` nvarchar(150) | `rating_documents` (`category_id` -> `ref_document_category`, `original_name`, `stored_name`, `mime_type`, `size_bytes`) |
| `Document` | `id#`, `DocCode` nvarchar(5) pk, `Name` nvarchar(50): document types | `ref_document_category` (`code`, `name`) |
| Real storage | The pages store and read documents in an external document-management server (InfoRouter web service, folders `/CONFIDENTIAL/NN<service number minus first 3 chars>/` and the `RATINGSDOC` / `NN_CONFIDENTIAL` shares named in `Web.config appSettings InfoUrl2/InfoUrl3`), not in `PersonDocument`; `PersonDocumentController.cs` is separate. Whether `PersonDocument` has rows is UNCONFIRMED | files cannot be imported from the database; they must be exported from the document server by service number folder (outside this repo) |

### 4.10 Appraisal history: `appraisalhist` -> NO EQUIVALENT yet
| Old column | Type |
|---|---|
| `id#`, `personid` | int |
| `period` | nvarchar(6)? |
| `selfcomment` nvarchar(150), `selfdate`, `selfcreatedby` | self assessment |
| `supcomment`, `suprate` nvarchar(2), `supdate`, `subcreatedby` | supervisor |
| `dircomment`, `dirrate` nvarchar(2), `dirdate`, `dircreatedby` | director |
| `othcomment`, `othrate` nvarchar(2), `othdate`, `othcreatedby` | other |
| `overallgrade` | nvarchar(15)? |
The `*rate` columns hold the 1-2 char codes from table `Appraisalratings` (`Name`) (UNCONFIRMED link by value). The new schema has no appraisal tables: nothing to import into until the Appraisal module exists. Related: `AppraisalHistoryController` (menu role `CharacterAssessmentEfficiency`), commented `AppraisalPeriod`.

### 4.11 Discipline: `Discipline` -> NO EQUIVALENT yet
| Column | Type |
|---|---|
| `id#`, `PersonID` | int |
| `IncidentDate` date NOT NULL, `WhatHappen` nvarchar(250) NOT NULL, `ReportedBy` nvarchar(150) NOT NULL | the incident |
| `Decission` nvarchar(250) NOT NULL (sic), `DecissionDate` date NOT NULL, `Authority` nvarchar(150) NOT NULL | the decision (empty string = still pending) |
| `offenceid` int? (FK `offences`), `sanctionid` int? (FK `sanctions`) | lookups (static tables 5 and 6) |
| `dactive` bit? | row active flag |
| `modifiedby`, `modifieddate` | |
Status rule from code: pending cases = `Decission == "" && dactive == true`; concluded = `Decission != "" && dactive == true` (`Controllers/DeciplineController.cs` lines ~62 and ~215). No new tables exist.

### 4.12 Other tables near a person (found in the edmx, no use found in the rating pages; do not import without a decision)
`EmergencyContact`, `PermanentAddress`, `ResidentialAddress`, `PreviousEmplhist`, `ProfessionalQualification`, `MedicalHist` (+ `Ailment`, `Hospital`, `treatmentgroup`), `decoration`, `Benefit`, `Renumeration`, `SalaryBank`, `SocialMedia`, `HMOProvider`, `PensionProvider`, `LeaveApplication` (+ `LeaveComment`, `LeaveStatus`, `LeaveType`), `Appointments`, `SelectionTest(+Hist)`, `serviceno*` (import staging), `tbl_Person`, `tbl_Person_dump`, `HR_employeesMB`, `CND_25K`, `CND_conversion_table` (migration staging from older systems), `BatchRecord`, `BatchRecordHistory`, `DOTBatchRecord`, `SortList`, `shiprequirement`. Many are leftovers from an HR template (`Hr_`, `Benefit`, `Renumeration`) or staging copies.

## 5. Summary: old versus new coverage

| Area | Old table(s) | New table | Coverage |
|---|---|---|---|
| Personal, contact, health, official | `Person` | `ratings` | most columns map (section 3); no equivalent for nickname, display name, nationality, passport number/expiry, BVN, fingerprint, commission, medical/punishment ints, sub-specialisation |
| Current ship | `Person.Departmentid` (+ open `employmenthist`) | open `rating_drafting` row | needs derivation |
| Status current/former | `Person.IsActive`, `ExitTypeid` (+ code), `getCurrentPersonel`/`getFormerPersonel` views | `ratings.status` | derive; confirm rule |
| Next of kin | `NextOfKin` | `rating_next_of_kin` | name, phone, type only |
| Spouse | `Spouse` | `rating_spouse` | name, phone, e-mail only |
| Children | `Children` | `rating_children` | name, phone, e-mail only |
| Advancement history | `promotionshist` | `rating_advancement` | rank code and branch/department lost |
| Drafting history | `employmenthist` | `rating_drafting` | authority (`signal`), branch, command, staff branch, state, next ship lost |
| Training | `traininghist` | `rating_training` | text lookups |
| Education | `EducationHist` | `rating_education` | classification mapping unclear |
| Languages | `LanguageSpoken` | `rating_language` | full |
| Documents | `PersonDocument`, `Document` + external document server | `rating_documents`, `ref_document_category` | files external |
| Appraisal | `appraisalhist` | none | no equivalent yet |
| Discipline | `Discipline` | none | no equivalent yet |
| Discharge | `discharge` (+ exit fields on `Person`) | none (only `ratings.exit_*`) | no equivalent yet |

## Hand-off notes for design/build
- Read first: sections 1 (key translation), 2 (current/former), 3 (Person map). The two biggest import risks are (a) `SVC_NO` quality (null, duplicate, case, length 10 vs 20) because the new primary key is the service number, and (b) the current/former rule, which lives in exit-type CODES that are not in the repository.
- Obtain from the live database before building the importer: seed rows of `Exittype`, `Rate`, `TitleType`, `Command`, `Department`, `Specializationarea`, `branch`, `staffbranch`, `entrymode`, `Document` and the person views' bodies (`getCurrentPersonel`, `getFormerPersonel`); none are in this repository.
- Decide which "no equivalent" data to keep: spouse/children/next-of-kin addresses and child dates of birth, drafting authority (`signal`), promotion rank code, passport/BVN/commission data. If any is required, add columns before importing; otherwise record the loss explicitly.
- NOT-NULL mismatches to handle in the loader: new `rating_advancement.rate_id`, `rating_drafting.ship_id`, `rating_training.institution`, `rating_education.institution`, `rating_language.language_id`, `rating_next_of_kin.first_name/last_name` and `rating_spouse.name`/`rating_children.name` reject the NULLs that the old nullable columns allow; produce an exceptions report instead of dropping rows silently.
- Photos are files on the old web server (`Content/UploadPhotoPath`); documents are in the external document server; both need a separate transfer.
- UNCONFIRMED items: view and procedure bodies, meaning of `Person.LiveStatus`/`LeavingDate`, `discharge.status` values, `PersonDocument` usage, units of height/weight/chest text, whether `EducationHist.SpecializationAreaId` is the new `classification`.
