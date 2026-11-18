# The 84 procedure and function names in the EDMX

Source: `HRProjectDAL/Core/HicadHRProjectModel.edmx` (FunctionImport). **No body is available**: the 2017 backup holds only three unrelated procedures (not copied: the project keeps no procedure, function or view definitions), and `updatedscript.sql` has no CREATE PROCEDURE/VIEW/FUNCTION. What each in-scope procedure appears to do is written in words in the module files named in the last column (marked UNCONFIRMED). 'Called from' lists the C# files (outside the generated model) that mention the name, from a text search; commented-out calls are not filtered out.

| Name | In backup | Called from (C# files, text match) | Page(s) that use it | Module file(s) |
|---|---|---|---|---|
| ApproveDraft | no | APIImplementationRepository/IAdvancementRepoImplementation.cs, APIImplementationRepository/IDraftingRepoImplementation.cs | drafting: 4.1 Entry points; 4.4 What Approve writes; 12.1 Tables written<br>advancement: 0.3 Procedures called (names, params as called; bo; 3.3 Detail page and the approve action (`Advanceme | drafting.md, advancement.md |
| CND_Convert_Shipdata | no | - | none of the in-scope pages (not described) | - |
| CND_Update_Hist | no | - | none of the in-scope pages (not described) | - |
| CND_Upload_AdvHist | no | - | none of the in-scope pages (not described) | - |
| CND_Upload_DraftHist | no | - | none of the in-scope pages (not described) | - |
| CND_Upload_EducHist | no | - | none of the in-scope pages (not described) | - |
| CND_Upload_TrgHist | no | - | none of the in-scope pages (not described) | - |
| CND_loaddata_25K | no | - | none of the in-scope pages (not described) | - |
| CND_loaddata_26K | no | - | none of the in-scope pages (not described) | - |
| CreateBatchRec | no | APIImplementationRepository/IBatchCreationImplementation.cs | drafting: 2.3 What a search does (it is a write); 12.1 Tables written; 12.3 Procedures (bodies unavailable; "as called" f<br>advancement: 0.3 Procedures called (names, params as called; bo; 1.3 Behaviour of Search (this is the core of the m | drafting.md, advancement.md |
| CreateBatchRecForDOT | no | Controllers/TrainingDraftController.cs, APIImplementationRepository/IBatchCreationImplementation.cs | training-drafting: Workflow and states (end to end); Tables and procs used by the group; Behaviour (`TrainingDraftiningProcess`) | training-drafting.md |
| DeleteTrainingDraft | no | Controllers/AccountController.cs | training-drafting: Tables and procs used by the group; 8. Faults of the old module that must NOT be copie<br>system-admin: 4.6 Delete Audit File (hazard); Hand-off notes for design/build | training-drafting.md, system-admin.md |
| FN_getAuditTrailByDate | no | Models/AccountViewModels.cs | system-admin: 4.2 Page elements (`Views/Account/AuditTrail.cshtm | system-admin.md |
| FN_getpersonbydept | no | Models/PersonGReport.cs | reports: 3. Disposition Report  (`/Report/PersonelReport`) | reports.md |
| FindInactiveProcessbyBatchRequestName | no | - | none of the in-scope pages (not described) | - |
| FindProcessbyProcessNumber | no | - | none of the in-scope pages (not described) | - |
| Hr_setlga | no | Controllers/draftingsController.cs | drafting: 12.3 Procedures (bodies unavailable; "as called" f<br>static-tables: 8. Local Government (under State) | drafting.md, static-tables.md |
| INSERTCOURSEREGISTRATIONLEVEL | yes (not used by in-scope pages) | - | none of the in-scope pages (not described) | - |
| INSERTPERSONBENEFITS | yes (not used by in-scope pages) | - | none of the in-scope pages (not described) | - |
| InitiateProcess | no | - | none of the in-scope pages (not described) | - |
| NextOfkinCount | no | - | none of the in-scope pages (not described) | - |
| SplitString | no | - | advancement: Appraisal dependency | advancement.md |
| SubscriptionUpdate | yes (not used by in-scope pages) | - | none of the in-scope pages (not described) | - |
| UpdateChild | no | APIImplementationRepository/IChildrenRepoImplementation.cs | none of the in-scope pages (not described) | - |
| UpdateNOK | no | APIImplementationRepository/INextofKinRepoImplementation.cs | none of the in-scope pages (not described) | - |
| UpdateSP | no | - | none of the in-scope pages (not described) | - |
| UpdateSouse | no | APIImplementationRepository/ISpouseRepoImpllementation.cs | none of the in-scope pages (not described) | - |
| UploadDraftHist | no | - | none of the in-scope pages (not described) | - |
| UploadExcelToPerson | no | Controllers/EmployeeController.cs | none of the in-scope pages (not described) | - |
| UploadExcelToSpecialDraft | no | Controllers/draftingsController.cs | drafting: 6.3 What the import does (`draftingsController.Upl; 12.1 Tables written; 12.3 Procedures (bodies unavailable; "as called" f | drafting.md |
| UploadExcelToTraining1 | no | Controllers/TrainingDraftController.cs | training-drafting: Workflow and states (end to end); How it feeds a rating's Training history; Tables and procs used by the group | training-drafting.md |
| UploadExcelTodischarge | no | Controllers/DischargeController.cs | discharge: 5. Upload Discharge  (`/Discharge/ExcelUpload`); 8. Hand-off notes for design/build | discharge.md |
| UploadpromotionHist | no | Controllers/AdvancementController.cs | advancement: 0.2 Data objects used across the module (`EDMX`); 0.3 Procedures called (names, params as called; bo; 7.3 Import, step by step (`AC.UploadExcel`) | advancement.md |
| closeDraft | no | APIServices/IServices/IDraftingPrepServiceXX.cs, APIServices/IServices/IDraftingPrepService.cs, APIServices/IServiceImplementation/ITrainingDraftingPrepServiceImplementation.cs, APIServices/IServiceImplementation/IDraftingPrepServiceImplementation.cs, Controllers/draftingsController.cs, Controllers/draftingsControllerXX.cs, APIImplementationRepository/IDraftingRepoImplementationXXX.cs, APIImplementationRepository/IDraftingRepoImplementation.cs, APIIRepository/IDraftingRepo.cs, APIIRepository/IDraftingRepoXX.cs | drafting: 5.3 What it writes; 12.1 Tables written; 12.3 Procedures (bodies unavailable; "as called" f<br>training-drafting: Workflow and states (end to end)<br>advancement: 0.3 Procedures called (names, params as called; bo | drafting.md, training-drafting.md, advancement.md |
| createSpecialDraft | no | Controllers/draftingsController.cs | none of the in-scope pages (not described) | - |
| createperson | no | Controllers/EmployeeController.cs | none of the in-scope pages (not described) | - |
| deleteDisci | no | Controllers/DeciplineController.cs | disciplinary: Data model; Delete (reachable only by typing the URL); Hand-off notes for design/build | disciplinary.md |
| deleteNOK | no | Views/ShipRequirement/viewrequirement.cshtml, Views/Employee/Create.cshtml, Views/Employee/EditPersonel.cshtml, Views/Employee/EditPersonelXXXX.cshtml, APIImplementationRepository/INextofKinRepoImplementation.cs | none of the in-scope pages (not described) | - |
| deleteRolePriviledgeAttached | no | Controllers/RoleManagementController.cs | system-admin: 2.4 Edit role (`editrolelink`, `[Audit(EditRole)]`; Hand-off notes for design/build | system-admin.md |
| deleteSpouse | no | APIServices/IServiceImplementation/ISpousePrepServiceImplemetation.cs, Views/Employee/Create.cshtml, Views/Employee/EditPersonel.cshtml, Views/Employee/EditPersonelXXXX.cshtml, APIImplementationRepository/ISpouseRepoImpllementation.cs, APIIRepository/ISpouseRepo.cs | none of the in-scope pages (not described) | - |
| deletechildren | no | APIImplementationRepository/IChildrenRepoImplementation.cs | none of the in-scope pages (not described) | - |
| deletedraft | no | Controllers/AdvancementController.cs, Controllers/draftingsController.cs | drafting: 3.3 What each button writes; 12.1 Tables written; 12.3 Procedures (bodies unavailable; "as called" f<br>advancement: 0.3 Procedures called (names, params as called; bo; 2.2 Fields and buttons | drafting.md, advancement.md |
| draftingstoreprocedure | no | - | none of the in-scope pages (not described) | - |
| fetchOtherRecordforSummary | no | APIImplementationRepository/IDraftingRepoImplementationXXX.cs, APIImplementationRepository/IDraftingRepoImplementation.cs | drafting: 0.4 How the pages chain (the real workflow); 8.2 List page; 12.3 Procedures (bodies unavailable; "as called" f | drafting.md |
| fetchOtherRecordforSummaryBydept | no | APIImplementationRepository/IDraftingRepoImplementation.cs | drafting: 4.2 List (page 4) and what each column is; 12.3 Procedures (bodies unavailable; "as called" f | drafting.md |
| fetchOtherRecordforSummaryBydept2 | no | APIImplementationRepository/IAdvancementRepoImplementation.cs | advancement: 0.3 Procedures called (names, params as called; bo; 3.2 What the list shows (`REPO.fetchsummaryByDept2 | advancement.md |
| fetchOtherRecordforSummaryDOT | no | APIImplementationRepository/IDraftingRepoImplementation.cs | training-drafting: Tables and procs used by the group; Rules | training-drafting.md |
| fetchOtherRecordforSummaryForAdvance | no | APIImplementationRepository/IAdvancementRepoImplementation.cs | advancement: 0.3 Procedures called (names, params as called; bo; 5.3 What it writes; 6.3 Grid and filter rules (`REPO.fetchBatchRecordF | advancement.md |
| fetchPersonelDue | no | - | advancement: 0.3 Procedures called (names, params as called; bo | advancement.md |
| getAuditTrailByDate | no | - | system-admin: 4.2 Page elements (`Views/Account/AuditTrail.cshtm; Hand-off notes for design/build | system-admin.md |
| getCurrentPersonelCount | no | APIImplementationRepository/IPersonReportImplementation.cs | none of the in-scope pages (not described) | - |
| getDraftNotUpto | no | APIImplementationRepository/IDraftingRepoImplementation.cs | drafting: 3.5 Add Personnel search rules; 12.3 Procedures (bodies unavailable; "as called" f | drafting.md |
| getFormerPersonelCount | no | APIImplementationRepository/IPersonReportImplementation.cs | none of the in-scope pages (not described) | - |
| getpersonbydept | no | Controllers/ReportController.cs | reports: 3. Disposition Report  (`/Report/PersonelReport`); 6. Hand-off notes for design/build | reports.md |
| hr_update_pers001 | no | - | none of the in-scope pages (not described) | - |
| hr_update_pers0022 | no | - | none of the in-scope pages (not described) | - |
| hr_update_persdates | no | - | none of the in-scope pages (not described) | - |
| migrateSingleAdvancement | no | APIImplementationRepository/IAdvancementRepoImplementation.cs | advancement: 0.3 Procedures called (names, params as called; bo; 2.3 Add Personnel (`AC.addnewAdvance`, `REPO.addRe; Appraisal dependency | advancement.md |
| migrateSinglefromEmplHistToDraft | no | APIImplementationRepository/IDraftingRepoImplementation.cs | drafting: 3.3 What each button writes; 12.1 Tables written; 12.3 Procedures (bodies unavailable; "as called" f | drafting.md |
| migrateTorct_Draft | no | Controllers/draftingsController.cs | drafting: 10.1 Entry points; 10.2 Faults not to copy; 12.1 Tables written | drafting.md |
| migratefromDischarge | no | APIImplementationRepository/IDischargeRepoImplementation.cs | discharge: 0.1 The discharge lifecycle in one table; 1.3 The proposal page (`/Discharge/dischargepropos; 1.6 Procedures and tables for this page | discharge.md |
| migratefromEmplHistToDraft | no | APIImplementationRepository/IDraftingRepoImplementationXXX.cs, APIImplementationRepository/IDraftingRepoImplementation.cs | drafting: 1.5 Does the requirement drive "who is due"?; 2.3 What a search does (it is a write); 12.1 Tables written | drafting.md |
| migratefromEmplHistToDraftSingle | no | Controllers/draftingsController.cs | none of the in-scope pages (not described) | - |
| migratefromEmplHistToappt | no | APIImplementationRepository/IPersonReportImplementation.cs | reports: 1. Ship History Report  (`/Report/personellistbybr | reports.md |
| migratefromEmplHistToappt2 | no | Controllers/ReportController.cs | reports: 1. Ship History Report  (`/Report/personellistbybr; 6. Hand-off notes for design/build | reports.md |
| migratefromEmplHistToappt3 | no | - | none of the in-scope pages (not described) | - |
| migratefromPromotionHistToAdvancement | no | APIImplementationRepository/IAdvancementRepoImplementation.cs | advancement: 0.3 Procedures called (names, params as called; bo; 1.3 Behaviour of Search (this is the core of the m; Appraisal dependency | advancement.md |
| migratefromTrainingHisToTrainingDraft | no | Controllers/TrainingDraftController.cs, APIImplementationRepository/IDraftingRepoImplementation.cs | training-drafting: Workflow and states (end to end); How it feeds a rating's Training history; Tables and procs used by the group | training-drafting.md |
| migratefromTrainingHisToTrainingDraftTex | no | Controllers/TrainingDraftController.cs | training-drafting: Workflow and states (end to end); Tables and procs used by the group; Step 2 form: `Traininglistfilters` (`Views/Trainin | training-drafting.md |
| migratefrompersontodischargeproposal | no | APIImplementationRepository/IDischargeRepoImplementation.cs | discharge: 0.1 The discharge lifecycle in one table; 1.4 Batch dropdown ("Search"); 1.6 Procedures and tables for this page | discharge.md |
| performBackUpOperationAllDept | no | - | none of the in-scope pages (not described) | - |
| performOperationForSpecialDraft | no | APIImplementationRepository/IDraftingRepoImplementation.cs | drafting: 12.3 Procedures (bodies unavailable; "as called" f | drafting.md |
| performRestoreOperationAllDept | no | - | advancement: 0.3 Procedures called (names, params as called; bo | advancement.md |
| performUpdateBatchforadvancement | no | APIImplementationRepository/IAdvancementRepoImplementation.cs | advancement: 0.3 Procedures called (names, params as called; bo; 4.3 What close does | advancement.md |
| performreportDateOperation | no | APIImplementationRepository/IDraftingRepoImplementationXXX.cs, APIImplementationRepository/IDraftingRepoImplementation.cs | drafting: 7.1 Entry points; 12.1 Tables written; 12.3 Procedures (bodies unavailable; "as called" f | drafting.md |
| performreportDateOperationAllDept | no | Controllers/draftingsController.cs | drafting: 7.1 Entry points; 7.4 Faults not to copy; 12.3 Procedures (bodies unavailable; "as called" f | drafting.md |
| performreportDateOperationforTraining | no | - | training-drafting: How it feeds a rating's Training history | training-drafting.md |
| performreportDateOperationforadvancement | no | APIImplementationRepository/IAdvancementRepoImplementation.cs | advancement: 0.3 Procedures called (names, params as called; bo; 5.3 What it writes; Hand-off notes for design/build | advancement.md |
| updateDisci | no | Controllers/DeciplineController.cs | disciplinary: Data model; Edit (sanction and decision) - `GET/POST /Deciplin; Hand-off notes for design/build | disciplinary.md |
| updateUserRightsAdd | no | Controllers/SecurityController.cs, Models/AppReusable.cs | system-admin: 1.3 What POST does (`SecurityController.cs: Create; 1.4 Other actions on the same menu item; 1.5 Tables / procedures | system-admin.md |
| updateUserRightsRemove | no | Models/AppReusable.cs | system-admin: 1.5 Tables / procedures; 2.4 Edit role (`editrolelink`, `[Audit(EditRole)]` | system-admin.md |
| update_changedate | no | - | none of the in-scope pages (not described) | - |
| updateconfirmdate | no | Controllers/AdvancementController.cs, APIImplementationRepository/IAdvancementRepoImplementation.cs | advancement: 0.3 Procedures called (names, params as called; bo; 5.2 Fields; 5.3 What it writes | advancement.md |
| updateconfirmdatefortraining | no | Controllers/TrainingDraftController.cs | training-drafting: Workflow and states (end to end); How it feeds a rating's Training history; Tables and procs used by the group | training-drafting.md |
| updatenextship | no | Controllers/draftingsController.cs | drafting: 3.1 Entry points; 12.3 Procedures (bodies unavailable; "as called" f | drafting.md |
| updateperson | no | - | none of the in-scope pages (not described) | - |
