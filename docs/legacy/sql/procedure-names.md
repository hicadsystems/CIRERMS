# The 84 procedure and function names in the EDMX

Source: `HRProjectDAL/Core/HicadHRProjectModel.edmx` (FunctionImport). **No body is available**: the 2017 backup holds only the three marked 'backup', and `updatedscript.sql` has no CREATE PROCEDURE/VIEW/FUNCTION. 'Called from' lists the C# files (outside the generated model) that mention the name, from a text search; commented-out calls are not filtered out.

| Name | In backup | Called from (C# files, text match) |
|---|---|---|
| ApproveDraft | no | APIImplementationRepository/IAdvancementRepoImplementation.cs, APIImplementationRepository/IDraftingRepoImplementation.cs |
| CND_Convert_Shipdata | no | - |
| CND_Update_Hist | no | - |
| CND_Upload_AdvHist | no | - |
| CND_Upload_DraftHist | no | - |
| CND_Upload_EducHist | no | - |
| CND_Upload_TrgHist | no | - |
| CND_loaddata_25K | no | - |
| CND_loaddata_26K | no | - |
| CreateBatchRec | no | APIImplementationRepository/IBatchCreationImplementation.cs |
| CreateBatchRecForDOT | no | Controllers/TrainingDraftController.cs, APIImplementationRepository/IBatchCreationImplementation.cs |
| DeleteTrainingDraft | no | Controllers/AccountController.cs |
| FN_getAuditTrailByDate | no | Models/AccountViewModels.cs |
| FN_getpersonbydept | no | Models/PersonGReport.cs |
| FindInactiveProcessbyBatchRequestName | no | - |
| FindProcessbyProcessNumber | no | - |
| Hr_setlga | no | Controllers/draftingsController.cs |
| INSERTCOURSEREGISTRATIONLEVEL | yes (not used by in-scope pages) | - |
| INSERTPERSONBENEFITS | yes (not used by in-scope pages) | - |
| InitiateProcess | no | - |
| NextOfkinCount | no | - |
| SplitString | no | - |
| SubscriptionUpdate | yes (not used by in-scope pages) | - |
| UpdateChild | no | APIImplementationRepository/IChildrenRepoImplementation.cs |
| UpdateNOK | no | APIImplementationRepository/INextofKinRepoImplementation.cs |
| UpdateSP | no | - |
| UpdateSouse | no | APIImplementationRepository/ISpouseRepoImpllementation.cs |
| UploadDraftHist | no | - |
| UploadExcelToPerson | no | Controllers/EmployeeController.cs |
| UploadExcelToSpecialDraft | no | Controllers/draftingsController.cs |
| UploadExcelToTraining1 | no | Controllers/TrainingDraftController.cs |
| UploadExcelTodischarge | no | Controllers/DischargeController.cs |
| UploadpromotionHist | no | Controllers/AdvancementController.cs |
| closeDraft | no | APIServices/IServices/IDraftingPrepServiceXX.cs, APIServices/IServices/IDraftingPrepService.cs, APIServices/IServiceImplementation/ITrainingDraftingPrepServiceImplementation.cs, APIServices/IServiceImplementation/IDraftingPrepServiceImplementation.cs, Controllers/draftingsController.cs, Controllers/draftingsControllerXX.cs, APIImplementationRepository/IDraftingRepoImplementationXXX.cs, APIImplementationRepository/IDraftingRepoImplementation.cs, APIIRepository/IDraftingRepo.cs, APIIRepository/IDraftingRepoXX.cs |
| createSpecialDraft | no | Controllers/draftingsController.cs |
| createperson | no | Controllers/EmployeeController.cs |
| deleteDisci | no | Controllers/DeciplineController.cs |
| deleteNOK | no | Views/ShipRequirement/viewrequirement.cshtml, Views/Employee/Create.cshtml, Views/Employee/EditPersonel.cshtml, Views/Employee/EditPersonelXXXX.cshtml, APIImplementationRepository/INextofKinRepoImplementation.cs |
| deleteRolePriviledgeAttached | no | Controllers/RoleManagementController.cs |
| deleteSpouse | no | APIServices/IServiceImplementation/ISpousePrepServiceImplemetation.cs, Views/Employee/Create.cshtml, Views/Employee/EditPersonel.cshtml, Views/Employee/EditPersonelXXXX.cshtml, APIImplementationRepository/ISpouseRepoImpllementation.cs, APIIRepository/ISpouseRepo.cs |
| deletechildren | no | APIImplementationRepository/IChildrenRepoImplementation.cs |
| deletedraft | no | Controllers/AdvancementController.cs, Controllers/draftingsController.cs |
| draftingstoreprocedure | no | - |
| fetchOtherRecordforSummary | no | APIImplementationRepository/IDraftingRepoImplementationXXX.cs, APIImplementationRepository/IDraftingRepoImplementation.cs |
| fetchOtherRecordforSummaryBydept | no | APIImplementationRepository/IDraftingRepoImplementation.cs |
| fetchOtherRecordforSummaryBydept2 | no | APIImplementationRepository/IAdvancementRepoImplementation.cs |
| fetchOtherRecordforSummaryDOT | no | APIImplementationRepository/IDraftingRepoImplementation.cs |
| fetchOtherRecordforSummaryForAdvance | no | APIImplementationRepository/IAdvancementRepoImplementation.cs |
| fetchPersonelDue | no | - |
| getAuditTrailByDate | no | - |
| getCurrentPersonelCount | no | APIImplementationRepository/IPersonReportImplementation.cs |
| getDraftNotUpto | no | APIImplementationRepository/IDraftingRepoImplementation.cs |
| getFormerPersonelCount | no | APIImplementationRepository/IPersonReportImplementation.cs |
| getpersonbydept | no | Controllers/ReportController.cs |
| hr_update_pers001 | no | - |
| hr_update_pers0022 | no | - |
| hr_update_persdates | no | - |
| migrateSingleAdvancement | no | APIImplementationRepository/IAdvancementRepoImplementation.cs |
| migrateSinglefromEmplHistToDraft | no | APIImplementationRepository/IDraftingRepoImplementation.cs |
| migrateTorct_Draft | no | Controllers/draftingsController.cs |
| migratefromDischarge | no | APIImplementationRepository/IDischargeRepoImplementation.cs |
| migratefromEmplHistToDraft | no | APIImplementationRepository/IDraftingRepoImplementationXXX.cs, APIImplementationRepository/IDraftingRepoImplementation.cs |
| migratefromEmplHistToDraftSingle | no | Controllers/draftingsController.cs |
| migratefromEmplHistToappt | no | APIImplementationRepository/IPersonReportImplementation.cs |
| migratefromEmplHistToappt2 | no | Controllers/ReportController.cs |
| migratefromEmplHistToappt3 | no | - |
| migratefromPromotionHistToAdvancement | no | APIImplementationRepository/IAdvancementRepoImplementation.cs |
| migratefromTrainingHisToTrainingDraft | no | Controllers/TrainingDraftController.cs, APIImplementationRepository/IDraftingRepoImplementation.cs |
| migratefromTrainingHisToTrainingDraftTex | no | Controllers/TrainingDraftController.cs |
| migratefrompersontodischargeproposal | no | APIImplementationRepository/IDischargeRepoImplementation.cs |
| performBackUpOperationAllDept | no | - |
| performOperationForSpecialDraft | no | APIImplementationRepository/IDraftingRepoImplementation.cs |
| performRestoreOperationAllDept | no | - |
| performUpdateBatchforadvancement | no | APIImplementationRepository/IAdvancementRepoImplementation.cs |
| performreportDateOperation | no | APIImplementationRepository/IDraftingRepoImplementationXXX.cs, APIImplementationRepository/IDraftingRepoImplementation.cs |
| performreportDateOperationAllDept | no | Controllers/draftingsController.cs |
| performreportDateOperationforTraining | no | - |
| performreportDateOperationforadvancement | no | APIImplementationRepository/IAdvancementRepoImplementation.cs |
| updateDisci | no | Controllers/DeciplineController.cs |
| updateUserRightsAdd | no | Controllers/SecurityController.cs, Models/AppReusable.cs |
| updateUserRightsRemove | no | Models/AppReusable.cs |
| update_changedate | no | - |
| updateconfirmdate | no | Controllers/AdvancementController.cs, APIImplementationRepository/IAdvancementRepoImplementation.cs |
| updateconfirmdatefortraining | no | Controllers/TrainingDraftController.cs |
| updatenextship | no | Controllers/draftingsController.cs |
| updateperson | no | - |
