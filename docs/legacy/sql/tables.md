# Tables in the 2017 backup (definitions only)

Source: `HicadHRProject_20170401.bak`, backup set 4 (the last of 4 sets, taken 04/05/2017), restored in a throwaway SQL Server 2022 container and read through `INFORMATION_SCHEMA` only. 78 user tables (77 listed; `sysdiagrams` and `__MigrationHistory` are tool tables, the latter is listed). No record was read.

**Warning: this backup is not the schema the 2022 code uses.** It has 77 tables against the 174 of the EDMX, no views, and only 3 non-boilerplate procedures (`procedures/`), none used by an in-scope page. See `../README.md` section 'Backup versus code'.


## __MigrationHistory

| Column | Type | Null |
|---|---|---|
| MigrationId | nvarchar(150) | NO |
| ContextKey | nvarchar(300) | NO |
| Model | varbinary(-1) | NO |
| ProductVersion | nvarchar(32) | NO |

## Appointments

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| personid | int | YES |
| apptcode | nvarchar(5) | YES |
| Description | nvarchar(50) | YES |
| appointcdr | nvarchar(20) | YES |
| appointdeputy | nvarchar(20) | YES |

## appraisalhist

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| personid | int | NO |
| period | nvarchar(6) | YES |
| selfcomment | nvarchar(150) | YES |
| selfdate | datetime | YES |
| selfcreatedby | nvarchar(20) | YES |
| supcomment | nvarchar(150) | YES |
| suprate | nvarchar(2) | YES |
| supdate | datetime | YES |
| subcreatedby | nvarchar(20) | YES |
| dircomment | nvarchar(150) | YES |
| dirrate | nvarchar(2) | YES |
| dirdate | datetime | YES |
| dircreatedby | nvarchar(20) | YES |
| othcomment | nvarchar(150) | YES |
| othrate | nvarchar(2) | YES |
| othdate | datetime | YES |
| othcreatedby | nvarchar(20) | YES |
| overallgrade | nvarchar(15) | YES |

## Appraisalratings

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| Name | nvarchar(5) | YES |
| Description | nvarchar(50) | YES |

## AspNetRoles

| Column | Type | Null |
|---|---|---|
| Id | nvarchar(128) | NO |
| Name | nvarchar(256) | NO |
| Discriminator | nvarchar(128) | NO |

## AspNetUserClaims

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| UserId | nvarchar(128) | NO |
| ClaimType | nvarchar(-1) | YES |
| ClaimValue | nvarchar(-1) | YES |

## AspNetUserLogins

| Column | Type | Null |
|---|---|---|
| LoginProvider | nvarchar(128) | NO |
| ProviderKey | nvarchar(128) | NO |
| UserId | nvarchar(128) | NO |

## AspNetUserRoles

| Column | Type | Null |
|---|---|---|
| UserId | nvarchar(128) | NO |
| RoleId | nvarchar(128) | NO |

## AspNetUsers

| Column | Type | Null |
|---|---|---|
| Id | nvarchar(128) | NO |
| ServiceNumber | nvarchar(-1) | YES |
| Name | nvarchar(-1) | YES |
| Email | nvarchar(256) | YES |
| EmailConfirmed | bit | NO |
| PasswordHash | nvarchar(-1) | YES |
| SecurityStamp | nvarchar(-1) | YES |
| PhoneNumber | nvarchar(-1) | YES |
| PhoneNumberConfirmed | bit | NO |
| TwoFactorEnabled | bit | NO |
| LockoutEndDateUtc | datetime | YES |
| LockoutEnabled | bit | NO |
| AccessFailedCount | int | NO |
| UserName | nvarchar(256) | NO |

## AuditTrail

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| AuditTypeActionId | int | NO |
| AlterationTableId | int | NO |
| ChangedByPersonId | int | NO |
| AffectedPersonId | int | NO |
| AffectedRowId | int | NO |
| NewRowCreated | bit | YES |
| CreatedDate | datetime | NO |
| CreatedBy | int | YES |
| IsActive | bit | YES |

## AuditTypeAction

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(500) | NO |
| Description | nvarchar(500) | YES |
| IsActive | bit | NO |

## Benefit

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| PersonId | int | NO |
| PensionProviderId | int | NO |
| HMOProviderId | int | NO |
| Pension | decimal | NO |
| PensionPin | nvarchar(500) | NO |
| EmployerContribution | decimal | YES |
| EmployeeContribution | decimal | YES |
| Benevolence | bit | NO |
| NSITF | bit | NO |
| GroupLife | bit | NO |
| ThirteenthMonth | bit | NO |
| Bonus | bit | NO |
| EmployeeTrustFunds | bit | NO |
| CarLoan | bit | NO |
| IsActive | bit | NO |
| CreatedDate | datetime | NO |
| CreatedBy | int | NO |
| ModifiedDate | datetime | YES |
| ModifiedBy | int | YES |

## BloodGroup

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| Name | nvarchar(5) | YES |
| Description | nvarchar(30) | YES |
| CreatedBy | nvarchar(30) | YES |
| DateCreated | nvarchar(50) | YES |

## branch

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| busline | nvarchar(2) | YES |
| busline1 | nvarchar(25) | YES |
| busdesc | nvarchar(25) | YES |
| createdby | nvarchar(20) | YES |
| datecreated | datetime | YES |

## Children

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| personid | int | NO |
| chname | nvarchar(50) | YES |
| chstreet | nvarchar(50) | YES |
| chtown | nvarchar(20) | YES |
| LocalGovernmentId | int | YES |
| Stateid | int | YES |
| chphone | nvarchar(20) | YES |
| chemail | nvarchar(50) | YES |
| chpobox | nvarchar(40) | YES |
| relationshipid | int | NO |
| chactive | bit | YES |
| dateofbirth | datetime | YES |
| chschool | nvarchar(30) | YES |
| createdby | int | YES |
| datecreated | datetime | YES |
| modifiedby | nvarchar(20) | YES |
| datemodified | datetime | YES |

## ColorEye

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(50) | YES |
| Description | nvarchar(50) | YES |
| IsActive | bit | YES |

## ColorHair

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(500) | YES |
| Description | nvarchar(50) | YES |
| IsActive | bit | YES |

## Command

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| Name | nvarchar(5) | YES |
| Description | nvarchar(50) | YES |

## Commision

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(50) | YES |
| Description | nvarchar(50) | YES |
| IsActive | bit | NO |

## CommissionType

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(50) | YES |
| Description | nvarchar(50) | YES |
| IsActive | bit | YES |

## Complexion

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(50) | YES |
| Description | nvarchar(50) | YES |
| IsActive | bit | YES |

## Country

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | varchar(500) | NO |
| IsActive | int | NO |
| countrycode | nvarchar(3) | YES |

## decoration

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| Name | nvarchar(5) | YES |
| Description | nvarchar(50) | YES |

## Department

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | text(2147483647) | NO |
| Description | text(2147483647) | YES |
| CreatedDate | datetime | YES |
| CreatedBy | varchar(50) | YES |
| ModifiedDate | datetime | YES |
| ModifiedBy | varchar(50) | YES |
| IsActive | bit | YES |
| DepartmentLeader | nvarchar(10) | YES |

## Disability

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(50) | NO |
| Description | nvarchar(50) | YES |

## EducationHist

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| PersonId | int | NO |
| InstitutionId | int | NO |
| StartDate | datetime | NO |
| EndDate | datetime | NO |
| QualificationId | int | NO |
| CreatedDate | datetime | NO |
| CreatedBy | int | YES |
| ModifiedDate | datetime | YES |
| ModifiedBy | int | YES |
| SpecializationAreaId | int | NO |

## EmergencyContact

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| PersonId | int | NO |
| FirstName | nvarchar(500) | NO |
| LastName | nvarchar(500) | NO |
| RelationshipId | int | NO |
| ContactNumber | nvarchar(500) | NO |
| FullAddress | nvarchar(500) | NO |
| EmailAddress | nvarchar(500) | YES |
| IsActive | bit | NO |
| CreatedDate | datetime | NO |
| CreatedBy | int | NO |
| ModifiedDate | datetime | YES |
| ModifiedBy | int | YES |

## employmenthist

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| apptno | int | NO |
| TitleTypeid | int | NO |
| fromdate | datetime | YES |
| todate | datetime | YES |
| staffbranchid | int | NO |
| branchid | int | NO |
| command | int | YES |
| Departmentid | int | YES |
| pre_appt | nvarchar(50) | YES |
| countryid | int | NO |
| Stateid | int | NO |
| decoration | nvarchar(50) | YES |
| Appointmentid | int | NO |
| Exitmodeid | int | NO |
| signal | nvarchar(30) | YES |
| createdby | nvarchar(20) | YES |
| datecreated | datetime | YES |
| personid | int | NO |

## EmploymentStatus

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | varchar(100) | NO |
| Description | nvarchar(500) | YES |
| IsActive | bit | YES |

## entrymode

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| entrymode | nvarchar(20) | YES |
| entryname | nvarchar(50) | YES |
| entrycode | nvarchar(5) | YES |

## Exittype

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| Name | nvarchar(2) | YES |
| Description | nvarchar(30) | YES |

## Genotype

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| Name | nvarchar(5) | YES |
| Description | nvarchar(30) | YES |
| CreatedBy | nvarchar(30) | YES |
| DateCreated | nvarchar(20) | YES |

## geozone

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| name | nvarchar(30) | YES |

## HMOProvider

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(500) | NO |
| Description | nvarchar(500) | YES |
| IsActive | bit | NO |
| CreatedDate | datetime | NO |
| CreatedBy | int | NO |
| ModifiedDate | datetime | NO |
| ModifiedBy | int | NO |

## Homebase

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(500) | NO |
| Description | nvarchar(50) | YES |

## Hospital

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| hoscode | nvarchar(5) | YES |
| hosname | nvarchar(50) | YES |
| hosaddress | nvarchar(50) | YES |
| hostown | nvarchar(20) | YES |
| hoscountry | nvarchar(20) | YES |
| hosdirector | nvarchar(30) | YES |
| hosphone | nvarchar(20) | YES |
| hosemail | nvarchar(40) | YES |

## IdentificationType

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(500) | NO |
| Description | nvarchar(500) | YES |
| IsActive | bit | YES |

## Institution

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| Name | nvarchar(5) | YES |
| Description | nvarchar(50) | YES |
| Type | nvarchar(30) | YES |

## LeaveApplication

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| PersonId | int | NO |
| ManagerId | int | NO |
| LeaveTypeId | int | NO |
| LeaveStatusId | int | NO |
| StartDate | datetime | NO |
| EndDate | datetime | NO |
| NumberOfDay | int | NO |
| IsActive | bit | NO |
| Comment | nvarchar(500) | YES |
| CreatedDate | datetime | NO |
| CreatedBy | int | YES |
| ModifiedDate | datetime | YES |
| ModifiedBy | int | YES |

## LeaveComment

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| LeaveApplicationID | int | NO |
| EmployeeID | int | NO |
| ManagerId | int | YES |
| Comment | nvarchar(500) | YES |
| CreatedDate | datetime | NO |
| CreatedBy | int | YES |

## LeaveStatus

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(500) | NO |
| Description | nvarchar(500) | YES |
| IsActive | bit | YES |

## LeaveType

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(5) | NO |
| Description | nvarchar(50) | YES |
| IsActive | bit | YES |
| HQNumberOfDays | int | NO |
| RetailNumberOfDays | int | NO |

## LocalGovernmentArea

| Column | Type | Null |
|---|---|---|
| LgaID | int | NO |
| Name | nvarchar(500) | NO |
| Code | nvarchar(50) | NO |
| StateId | int | NO |

## LookUpTable

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(500) | NO |
| Description | nvarchar(500) | YES |
| IsActive | bit | YES |

## MaritalStatus

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(2) | NO |
| Description | nvarchar(20) | YES |
| IsActive | bit | YES |

## MedicalHist

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| fromdate | datetime | YES |
| todate | datetime | YES |
| hospitalid | int | YES |
| treatment | nvarchar(100) | YES |
| treatmentgroupid | int | NO |
| doctorname | nvarchar(30) | YES |
| createdby | nvarchar(20) | YES |
| datecreated | datetime | YES |
| anysugery | bit | YES |
| personid | int | NO |

## NextOfKin

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| PersonID | int | NO |
| FirstName | nvarchar(500) | YES |
| LastName | nvarchar(500) | YES |
| RelationshipId | int | YES |
| FullAddress | nvarchar(500) | YES |
| MobileNumber | nvarchar(50) | YES |
| HomeNumber | nvarchar(50) | YES |
| EmailAddress | nvarchar(50) | YES |
| PlaceOfWork | nvarchar(500) | YES |
| IsActive | bit | YES |
| CreatedDate | datetime | YES |
| CreatedBy | int | YES |
| ModifiedDate | datetime | YES |
| ModifiedBy | int | YES |

## NextOfKinRelationship

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(500) | NO |
| Description | nvarchar(500) | YES |
| IsActive | bit | NO |

## officelocation

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| Name | nvarchar(30) | YES |
| Homebaseid | int | YES |

## PensionProvider

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(500) | NO |
| Description | nvarchar(500) | YES |

## PermanentAddress

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| PersonID | int | NO |
| Address1 | nvarchar(500) | NO |
| Address2 | nvarchar(500) | YES |
| City | nvarchar(500) | NO |
| State | nvarchar(500) | NO |
| CountryID | int | YES |
| HomeTelephone | nvarchar(500) | YES |
| MobileTelephone | nvarchar(500) | NO |
| WorkTelephone | nvarchar(500) | YES |
| WorkEmail | nvarchar(500) | YES |
| PersonalEmail | nvarchar(500) | YES |
| IsActive | bit | NO |
| CreatedDate | datetime | YES |
| CreatedBy | int | YES |
| ModifiedDate | datetime | YES |
| ModifiedBy | int | YES |

## Person

| Column | Type | Null |
|---|---|---|
| PersonID | int | NO |
| SVC_NO | nvarchar(10) | YES |
| FirstName | nvarchar(30) | YES |
| MiddleName | nvarchar(30) | YES |
| LastName | nvarchar(30) | YES |
| Commandid | int | YES |
| branchid | int | YES |
| staffbranchid | int | YES |
| Departmentid | int | YES |
| BirthDate | datetime | YES |
| NickName | nvarchar(30) | YES |
| Initials | nvarchar(10) | YES |
| MaidenName | nvarchar(50) | YES |
| Nationality | nvarchar(30) | YES |
| SexId | int | YES |
| MaritalStatusId | int | YES |
| marriedtopers | nvarchar(30) | YES |
| PhotoPath | nvarchar(255) | YES |
| FileName | text(2147483647) | YES |
| DisplayName | nvarchar(100) | YES |
| Username | nvarchar(50) | YES |
| Password | nvarchar(50) | YES |
| DisabilityId | int | YES |
| DisabilityComment | nvarchar(500) | YES |
| CreatedDate | datetime | YES |
| CreatedBy | int | YES |
| ModifiedDate | datetime | YES |
| ModifiedBy | int | YES |
| LiveStatus | bit | YES |
| IdentificationId | int | YES |
| countryid | int | YES |
| LocalGovernmentareaId | int | YES |
| geozoneid | int | YES |
| DrivingLicExpiryDate | datetime | YES |
| DrivingLicNumber | nvarchar(20) | YES |
| NationIdentityNumber | nvarchar(50) | YES |
| PassportNumber | nvarchar(50) | YES |
| passportexpdate | datetime | YES |
| FingerPrint | binary(50) | YES |
| bvn | nvarchar(20) | YES |
| vDrivinglicNumber | nvarchar(50) | YES |
| vNationalIdentifyNumber | nvarchar(50) | YES |
| vPassportNumber | nvarchar(50) | YES |
| vFingerPrint | nvarchar(50) | YES |
| vbvn | nvarchar(20) | YES |
| vDrivingLicExpiryDate | datetime | YES |
| vpassportexpdate | datetime | YES |
| TitleTypeId | int | YES |
| ReligionId | int | YES |
| LeavingDate | datetime | YES |
| GSMNumber | nvarchar(15) | YES |
| tribeId | int | NO |
| tribalmarks | bit | YES |
| homeaddress | nvarchar(100) | YES |
| officeaddress | nvarchar(100) | YES |
| officelocationid | int | YES |
| Birthplace | nvarchar(30) | YES |
| email | nvarchar(50) | YES |
| religiondenominationid | int | YES |
| BloodGroupid | int | YES |
| Genotypeid | int | YES |
| entrymodeid | int | YES |
| Height | nvarchar(5) | YES |
| Weight | nvarchar(5) | YES |
| Chest | nvarchar(5) | YES |
| NosGCBS | nvarchar(5) | YES |
| ColorHairid | int | YES |
| ColorEyesid | int | YES |
| Complexionid | int | YES |
| commissiontypeid | int | YES |
| commissionid | int | YES |
| commissiondate | datetime | YES |
| dateemployed | datetime | YES |
| senioritydate | datetime | YES |
| dateleft | datetime | YES |
| ExitReason | nvarchar(50) | YES |
| ExitTypeid | int | YES |
| IsActive | bit | YES |
| roletypeid | nvarchar(500) | YES |
| StateId | int | YES |

## PreviousEmplhist

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| PersonID | int | NO |
| Company | nvarchar(500) | NO |
| JobTitle | nvarchar(500) | NO |
| StartDate | datetime | NO |
| EndDate | datetime | NO |
| IsActive | bit | NO |
| CreatedDate | datetime | YES |
| CreatedBy | int | YES |
| ModifiedDate | datetime | YES |
| ModifiedBy | int | YES |

## ProfessionalQualification

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| PersonId | int | NO |
| Qualification | nvarchar(500) | NO |
| Institution | nvarchar(500) | NO |
| StartDate | datetime | NO |
| EndDate | datetime | NO |
| IsActive | bit | NO |
| CreatedDate | datetime | NO |
| CreatedBy | int | NO |
| ModifiedDate | datetime | YES |
| ModifiedBy | int | YES |
| CertificateNumber | nvarchar(500) | YES |

## promotionshist

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| personid | int | YES |
| fromdate | datetime | YES |
| todate | datetime | YES |
| rankcode | nvarchar(5) | YES |
| rank | nvarchar(20) | YES |
| decoration | nvarchar(50) | YES |
| signal | nvarchar(50) | YES |
| createdby | nvarchar(20) | YES |
| datecreated | datetime | YES |

## Qualification

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| qualcode | nvarchar(10) | NO |
| Desciption | nvarchar(50) | NO |
| qualtype | nvarchar(5) | NO |
| qualtypedec | nvarchar(50) | YES |
| CreatedDate | datetime | YES |
| CreatedBy | int | YES |
| ModifiedDate | datetime | YES |
| ModifiedBy | nchar(10) | YES |

## Relationship

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| Name | nvarchar(5) | YES |
| Description | nvarchar(15) | NO |

## Religion

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(500) | NO |
| Description | nvarchar(500) | YES |
| IsActive | bit | YES |

## religiondenomination

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| Name | nvarchar(500) | YES |
| Description | nvarchar(500) | YES |

## Renumeration

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| PersonId | int | NO |
| Salary | decimal | NO |
| BankName | nvarchar(500) | NO |
| BankAccount | nvarchar(500) | NO |
| IsActive | bit | YES |
| CreatedDate | datetime | YES |
| ModifiedDate | datetime | YES |
| CreatedBy | int | YES |
| ModifiedBy | int | YES |
| Supplementary | decimal | YES |

## ReportingMethod

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(500) | NO |
| Description | nvarchar(50) | YES |
| IsActive | bit | YES |

## ReportTo

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| PersonID | int | NO |
| SurpervisorID | int | NO |
| ReportingMethodID | int | NO |

## ResidentialAddress

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| PersonID | int | NO |
| Address1 | nvarchar(500) | NO |
| Address2 | nvarchar(500) | YES |
| City | nvarchar(500) | YES |
| State | nvarchar(500) | YES |
| CountryId | int | YES |
| IsActive | bit | YES |
| CreatedDate | datetime | YES |
| CreatedBy | int | YES |
| ModifiedDate | datetime | YES |
| ModifiedBy | int | YES |

## SalaryBank

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(500) | NO |
| Description | nvarchar(500) | NO |
| IsActive | bit | YES |

## SelectionTest

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| Name | nvarchar(2) | YES |
| Description | nvarchar(30) | YES |

## SelectionTestHist

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| Personid | int | NO |
| SelectionTestid | int | NO |
| Result | nvarchar(30) | YES |

## SexType

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| Name | nvarchar(2) | NO |
| Description | nchar(20) | YES |

## SocialMedia

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| PersonID | int | YES |
| Type | nvarchar(500) | YES |
| Handle | nvarchar(500) | YES |
| Link | nvarchar(500) | YES |
| IsActive | bit | YES |

## Specializationarea

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| sp_code | nvarchar(15) | YES |
| sp_desc | nvarchar(20) | YES |
| sp_desc1 | nvarchar(20) | YES |

## Spouse

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| personid | int | YES |
| spname | nvarchar(50) | YES |
| spstreet | nvarchar(50) | YES |
| sptown | nvarchar(20) | YES |
| LocalGovernmentId | int | YES |
| Stateid | int | YES |
| spphone | nvarchar(20) | YES |
| spemail | nvarchar(50) | YES |
| sppobox | nvarchar(40) | YES |
| sprelationship | nvarchar(20) | YES |
| spactive | bit | YES |
| createdby | int | YES |
| datecreated | datetime | YES |

## staffbranch

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| stfbranchcode | nvarchar(20) | YES |
| stfbranch | nvarchar(50) | YES |
| stfbranchcdr | nvarchar(20) | YES |
| stfbranchdep | nvarchar(20) | YES |
| effperiod | datetime | YES |

## State

| Column | Type | Null |
|---|---|---|
| StateId | int | NO |
| Name | nvarchar(50) | NO |
| Code | nvarchar(5) | NO |
| geozoneid | int | YES |
| CountryId | int | YES |
| IsActive | bit | YES |

## TitleType

| Column | Type | Null |
|---|---|---|
| TitleTypeId | int | NO |
| Name | nvarchar(500) | NO |
| Description | nvarchar(500) | NO |

## Training

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| Name | nvarchar(10) | YES |
| Description | nvarchar(60) | YES |
| Qualification | nvarchar(30) | NO |
| institutionid | int | NO |

## traininghist

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| personid | int | YES |
| fromdate | datetime | YES |
| todate | datetime | YES |
| intstitution | nvarchar(50) | YES |
| trainingid | int | NO |
| Qualification | nvarchar(30) | YES |
| createdby | int | YES |
| datecreated | datetime | YES |

## treatmentgroup

| Column | Type | Null |
|---|---|---|
| id | int | NO |
| name | nvarchar(30) | YES |
| description | nvarchar(50) | YES |

## tribe

| Column | Type | Null |
|---|---|---|
| Id | int | NO |
| name | nvarchar(20) | YES |

## Foreign keys

| Table | Constraint | References |
|---|---|---|
| appraisalhist | FK_appraisalhist_appraisalhistperson | Person |
| AspNetUserClaims | FK_dbo.AspNetUserClaims_dbo.AspNetUsers_UserId | AspNetUsers |
| AspNetUserLogins | FK_dbo.AspNetUserLogins_dbo.AspNetUsers_UserId | AspNetUsers |
| AspNetUserRoles | FK_dbo.AspNetUserRoles_dbo.AspNetRoles_RoleId | AspNetRoles |
| AspNetUserRoles | FK_dbo.AspNetUserRoles_dbo.AspNetUsers_UserId | AspNetUsers |
| AuditTrail | FK_AuditTrail_AuditTrailActionType | AuditTypeAction |
| AuditTrail | FK_AuditTrail_AuditTraillookUpTable | LookUpTable |
| AuditTrail | FK_AuditTrail_AuditTrailPerson | Person |
| AuditTrail | FK_AuditTrail_AuditTrailAffectedPerson | Person |
| Benefit | FK_Benefit_BenefitPerson | Person |
| Benefit | FK_Benefit_BenefitPensionProvider | PensionProvider |
| Benefit | FK_Benefit_HMOProvider | HMOProvider |
| Children | FK_Children_ChildrenPerson | Person |
| EducationHist | FK_EducationHist_EducationHistInstitution | Institution |
| EducationHist | FK_EducationHist_EducationHist1Qualification | Qualification |
| EducationHist | FK_EducationHist_EducationHistSpecializationArea | Specializationarea |
| EducationHist | FK_EducationHist_EducationHistPerson | Person |
| EmergencyContact | FK_EmergencyContact_EmergencyContactPerson | Person |
| employmenthist | FK_employmenthist_employmenthistPerson | Person |
| employmenthist | FK_employmenthist_employmenthistTitle | TitleType |
| employmenthist | FK_employmenthist_employmenthistBranch | branch |
| employmenthist | FK_employmenthist_employmenthistStaffBranch | staffbranch |
| employmenthist | FK_employmenthist_employmenthistCommand | Command |
| employmenthist | FK_employmenthist_employmenthistDepartment | Department |
| employmenthist | FK_employmenthist_employmenthistCountry | Country |
| employmenthist | FK_employmenthist_employmenthistState | State |
| employmenthist | FK_employmenthist_employmenthistExitMode | entrymode |
| LeaveApplication | FK_LeaverApplication_LeaverApplicationType | LeaveType |
| LeaveApplication | FK_LeaverApplication_LeaverApplication | Person |
| LeaveApplication | FK_LeaverApplication_LeaverApplicationPersonManager | Person |
| LeaveApplication | FK_LeaverApplication_LeaverApplicationStatu | LeaveStatus |
| LeaveComment | FK_LeaveComment_LeaveApplication | LeaveApplication |
| LeaveComment | FK_LeaveComment_LeaveCommentPerson | Person |
| MedicalHist | FK_MedicalHist_MedicalHistPerson | Person |
| NextOfKin | FK_NextOfKin_Person | Person |
| NextOfKin | FK_NextOfKin_Relationship | NextOfKinRelationship |
| PermanentAddress | FK_PermanentAddress_PermanentAddressPerson | Person |
| PermanentAddress | FK_PermanentAddress_PermanentAddressCountry | Country |
| Person | FK_Person_PersonExitType | Exittype |
| Person | FK_Person_PersonState | State |
| Person | FK_Person_PersonSexType | SexType |
| Person | FK_Person_PersonMaritalStatus | MaritalStatus |
| Person | FK_Person_PersonTitleType | TitleType |
| Person | FK_Person_PersonDisability | Person |
| Person | FK_Person_PersonIdentificationType | IdentificationType |
| Person | FK_Person_PersonReligion | Religion |
| Person | FK_Person_PersonLocalGovernment | LocalGovernmentArea |
| Person | FK_Person_staffbranch | staffbranch |
| Person | FK_Person_branch | branch |
| PreviousEmplhist | FK_WorkExperience_WorkExperiencePerson | Person |
| ProfessionalQualification | FK_ProfessionalQualification_ProfessionalQualification | Person |
| promotionshist | FK_promotionshist_promotionshistPerson | Person |
| Renumeration | FK_Renumeration_RenumerationPerson | Person |
| ReportTo | FK_ReportTo_Person | Person |
| ResidentialAddress | FK_ResidentialAddress_Person | Person |
| ResidentialAddress | FK_ResidentialAddress_ResidentialCountry | Country |
| SelectionTestHist | FK_SelectionTestHist_SelectionTestHistPerson | SelectionTestHist |
| SelectionTestHist | FK_SelectionTestHist_SelectionTestHist1SelectionTest | SelectionTestHist |
| SexType | FK_SexType_SexTypePerson | SexType |
| SocialMedia | FK_SocialMedia_SocialMediaPerson | Person |
| Spouse | FK_Spouse_SpousePerson | Person |
| State | FK_State_geozone | geozone |
| State | FK_State_StateCountry | Country |
| traininghist | FK_traininghist_training | Training |
| traininghist | FK_traininghist_TrainingPerson | Person |
| tribe | FK_hr_tribe_Person | Person |
