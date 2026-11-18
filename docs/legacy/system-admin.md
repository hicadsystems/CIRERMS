# Legacy map: System Administration, sign-in, roles, audit

Source: old CIRERMS (`/home/user/cirems`, project folder `hpproject`). Procedure bodies are NOT available; where a page calls a procedure, only its name, parameters and what the C# implies are recorded (marked UNCONFIRMED). Paths below are relative to `hpproject/` unless they start with `HRProjectDAL/`.

No credentials, connection strings or mail passwords are reproduced here. `Web.config` contains live-looking DB, SMTP and document-server credentials in clear text (see section 9).

## 0. Summary of what the old system actually enforces

| Topic | Fact | Evidence |
|---|---|---|
| Authentication | OWIN cookie auth, login path `/Account/Login`, ASP.NET Identity 2.2.1 `UserManager<StoreUser>` | `App_Start/Startup.Auth.cs`, `Controllers/AccountController.cs: Login` |
| Authorisation | Only "is the user signed in" is enforced (global `AuthorizeAttribute`). There is NO `[Authorize(Roles=...)]` anywhere. Roles only decide which menu items are drawn. Any signed-in user can type any URL (e.g. `/Security/CreateNewUser`, `/RoleManagement/roleList`, `/Account/AuditTrail`). | `Global.asax.cs: Application_Start` (`GlobalFilters.Filters.Add(new AuthorizeAttribute())`); grep of `Controllers` and `APIController`: only commented-out `[Authorize(Roles=...)]` (`RoleManagementController.cs` lines 44, 189; `SecurityController.cs` line 29) |
| Web API | All `/api/...` controllers are outside the MVC global filter and carry `[AllowAnonymous]` on actions: usable with no sign-in at all, including `/api/Personel/getListofAudit` (the audit trail data) | `APIController/PersonelController.cs: returnAuditList`; `App_Start/WebApiConfig.cs` |
| Admin menu | The whole "System Administration" menu block (Manage Users, Manage Roles, Manage Password, Audit Trail) has its role check commented out, so every signed-in user sees it | `Views/Shared/_menu.cshtml` lines 247-262 (`@*@if (User.IsInRole("SystemAdministration")) {*@ ... @*}*@`) |
| Lockout | Not used. `FindAsync` does not count failures; `Views/Shared/Lockout.cshtml` is never returned | `AccountController.cs: Login`; no `AccessFailed`/`LockoutEnabled` use in `Controllers` |
| Session timeout | InProc session, 350 minutes; auth cookie persistent (`isPersistent: true`), OWIN default sliding expiry (14 days, library default, UNCONFIRMED no override) | `Web.config` `<sessionState mode="InProc" timeout="350" />`; `AccountController.cs: SignInAsync` |

## 1. Manage Users (Security/CreateNewUser)

### 1.1 Menu, URL, privilege
| Item | Value |
|---|---|
| Menu label | System Administration > Manage Users (`_menu.cshtml`) |
| Role needed | None enforced (menu role check commented out; no action attribute) |
| URL | `/Security/CreateNewUser` (GET form, POST create). List: `/Security/UsersList`. Edit: `/Security/EditUser/{id}`. Delete: `/Security/DeleteUser/{id}` |
| Controller | `Controllers/SecurityController.cs` |
| API actions | none (all MVC form posts) |

### 1.2 Fields on Create (`Views/Security/CreateNewUser.cshtml`, model `UserInformation` in `Models/AccountViewModels.cs`)
| Label | Input name / type | Required | Options source | Validation / stored in |
|---|---|---|---|---|
| Svc_No | `ServiceNumber`, text | Yes (`[Required]` "Official Number is Required!") | free text | becomes `AspNetUsers.UserName` and `AspNetUsers.ServiceNumber`. Identity default UserValidator is used (library default: alphanumeric user names only; UNCONFIRMED) |
| SurName | `Surname`, text | Yes (message says "First Name is Required!", wrong label) | free text | `AspNetUsers.Surname` |
| FirstName | `Lastname`, text | Yes (message says "Last Name is Required!") | free text | saved to `AspNetUsers.FirstName` AND `AspNetUsers.MiddleName` (bug, see Faults) |
| OtherName | `Othername`, text | No | free text | ignored on create |
| Rank | `Rank`, dropdown | Yes (`required`) | `TitleType` table (`titleTypeService.Get()`, text `Name`, value `TitleTypeId`) | `AspNetUsers.Rank` (int) |
| Department | `specid`, dropdown | Yes (`required`) | `iSelectService.GetSpecializationArea(null)` = `Specializationarea` table, text `sp_desc` | `AspNetUsers.specid` (int, nullable) |
| Email | `Email`, text | No (`[EmailAddress]` only if filled) | free text | `AspNetUsers.Email` |
| Role | `RolenameID`, dropdown | Yes | `RoleName` table (text `RoleName`, value `RolenameID`) | `AspNetUsers.RolenameID` (bigint, NOT NULL) |
| Phone Number | `PhoneNumber`, tel | Yes, max 12 chars, `[Phone]` | free text | `AspNetUsers.PhoneNumber`; ALSO the initial password |
| Confirm Phone Number | `ConfirmPhoneNumber`, tel | Yes, must equal Phone | free text | not stored |

### 1.3 What POST does (`SecurityController.cs: CreateNewUser`, `[Audit(AuditAction.Create)]`)
1. `ModelState.IsValid` else message "Unable to Create User Account. Kindly Contact Support".
2. `UserManager.FindByName(ServiceNumber)`; if found: error "An Employee Already Exist with the Official Number you Provided. Please Contact your Admin".
3. `UserManager.CreateAsync(new StoreUser{...}, password = PhoneNumber)`: `PhoneNumberConfirmed = true`, `IsPasswordConfirmed = false`, `EmailConfirmed` default false. The initial password is the phone number (min 6 chars from Identity default).
4. On success: reads `AspNetRolesGroup` rows where `RoleNameId = RolenameID`; for each calls procedure `updateUserRightsAdd(userId, ASPNetRolesId)` (UNCONFIRMED body: inserts `AspNetUserRoles(UserId, RoleId)` after resolving the role Id by name, mirroring `UpdatePriviledge.insertUpdate` in `Models/AppReusable.cs`).
5. `TempData["message"]` "{svc} User Account was Successfully Provisoned. Kindly Login and fill in your Correct Details." then redirect to `UsersList`.
6. A new account is forced through the password reset flow at first login (`IsPasswordConfirmed = false`, see 3.5).

### 1.4 Other actions on the same menu item
| Action | Behaviour | Evidence |
|---|---|---|
| `UsersList` (GET) | `UserManager.Users` filtered by exact `UserName == username` (box "Username"), ordered by Surname, paged 25 (`PagedList`). Columns: Surname, Othername (always empty cell), Username, Phone, Official Number, Email, Edit/Delete | `SecurityController.cs: UsersList`; `Views/Security/UsersList.cshtml` |
| `EditUser` (GET/POST, `[Audit(Edit)]`) | Loads by Id; service number read-only. POST finds by `ServiceNumber`, updates Surname, Firstname(from Lastname), Middlename(from Othername), Rank, PhoneNumber, Email, RolenameID, specid. If role changed: removes every role of the OLD role group with `UserManager.RemoveFromRole`, then adds every role of the NEW group with `updateUserRightsAdd`. Password is not touched. | `SecurityController.cs: EditUser` |
| `DeleteUser` (GET confirm, POST, `[Audit(Delete)]`) | `UserManager.DeleteAsync` (hard delete of the AspNetUsers row). POST has no `[ValidateAntiForgeryToken]`. No check that the user is the signed-in user or the last administrator. | `SecurityController.cs: DeleteUser` |
| `Upload` (GET/POST, `[Audit(Upload)]`) | Not in the menu (the menu line is commented out). Reads an .xlsx (EPPlus), row 2 down, columns 1..11 (service number, surname, first, middle, rank, phone (prefixed `+234`), email, birth date, seniority date, entry mode id, date employed) and INSERTS `Person` rows (hard-coded ExitTypeid=1, Departmentid=1, Commandid=1, branchid=1). Does not create login users (that code is commented out). Out of scope (rating import). | `SecurityController.cs: Upload` |
| `UserInRole`, `CreateRole` | Left-over scaffolding; `UserInRole.cshtml` references `User.IsInRole("Administrator")` and an action `DeleteRole` that does not exist | `Views/Security/UserInRole.cshtml` |

### 1.5 Tables / procedures
| Object | Use |
|---|---|
| `AspNetUsers` (Identity) | create/update/delete user |
| `AspNetRolesGroup`, `RoleName` | role-to-privilege groups (see section 2) |
| `AspNetUserRoles` | written by procs `updateUserRightsAdd` / `updateUserRightsRemove` and by `UserManager.RemoveFromRole` |
| `TitleType` (Rank dropdown), `Specializationarea` (Department dropdown) | dropdown sources |
| proc `updateUserRightsAdd(userId varchar, priviledge varchar)` | UNCONFIRMED: adds a user-role row for the privilege named `priviledge` |
| proc `updateUserRightsRemove(userId, priviledge)` | used by role editing, section 2.4 |

### 1.6 Faults not to copy
| Fault | Where |
|---|---|
| Initial password = phone number; no random temporary password; no forced length/complexity | `SecurityController.cs: CreateNewUser` |
| `Firstname = model.Lastname` and `Middlename = model.Lastname`: middle name copied from first name on create (Edit maps correctly) | `CreateNewUser` |
| Validation messages mislabelled: Surname says "First Name", FirstName field (bound to `Lastname`) says "Last Name" | `Models/AccountViewModels.cs: UserInformation` |
| Edit requires phone confirmation fields (`[Required]` on ConfirmPhoneNumber) although the view only shows them as plain boxes; Email not validated unless filled | `EditUser` |
| No role check on any user-admin URL; any signed-in user can create an administrator | whole controller (no attribute) |
| `catch (Exception ex) { string log = ex.InnerException.ToString(); }`: null-reference on exceptions without inner exception, error swallowed, form redisplayed with no message and without the Rank/Department lists (`ViewData["ranklist"]`, `DepartmentDropDown` not refilled) | `CreateNewUser` |
| `EditUser` rank list adds each item twice (once plain, once Selected) | `EditUser` GET |
| Delete: hard delete, GET link, POST without anti-forgery, no self-delete guard | `DeleteUser` |
| User list search is exact match on username only; "Othername" column always blank | `UsersList.cshtml` |
| Role change in `EditUser` ignores any privilege the user had that was added individually | `EditUser` |

## 2. Manage Roles (RoleManagement/roleList)

### 2.1 Menu, URL, privilege
| Item | Value |
|---|---|
| Menu label | System Administration > Manage Roles |
| Role needed | None enforced |
| URL | `/RoleManagement/roleList` (list, search by `rolename`, `page`); `/RoleManagement/createRolePriviledgegroup` (create); POST `/RoleManagement/editrole` (shows edit form, receives hidden `RolenameID`, `RoleName1`, `RoleDescription`); POST `/RoleManagement/editrolelink` (saves edit) |
| Controller | `Controllers/RoleManagementController.cs` |
| Hidden (menu line commented out) | `/RoleManagement/priviledgelist`, `addpriviledges`, `editpriviledge`, `editpriviledgePost` (maintain the privilege list itself) |

### 2.2 Concepts and tables
| Term in UI | Table | Columns | Meaning |
|---|---|---|---|
| Role | `RoleName` | `RolenameID` bigint identity, `RoleName` nvarchar(50) NOT NULL (C# property `RoleName1`), `RoleDescription` text, `status` int NOT NULL, `createdby` nvarchar(128), `createddate` datetime | a named bundle (e.g. "System Administrator"); user picks ONE role |
| Privilege ("Priviledge") | `AspNetRoles` | `Id` nvarchar(128) pk, `Name` nvarchar(256), `Discriminator` nvarchar(256) (used as the human description) | the string that `User.IsInRole("X")` tests; `Name` = X |
| Role to privilege link | `AspNetRolesGroup` | `RoleGroupId` bigint identity, `RoleNameId` bigint, `ASPNetRolesId` nvarchar(256) (holds the privilege `Name`, NOT `AspNetRoles.Id`), `markedfordelete` int | which privileges a role contains |
| User to privilege | `AspNetUserRoles` | `UserId`, `RoleId` (= `AspNetRoles.Id`) | what Identity checks at sign-in |
| User's chosen role | `AspNetUsers.RolenameID` | bigint NOT NULL | remembered so edit can swap the bundle |
| View `userInRoletoEditView` | view (body unknown) | has `Id`, `RolenameID` | users holding a role; used to push edits to users |

### 2.3 Create role (`createRolePriviledgegroup`, `[Audit(CreateRole)]`)
| Field | Type | Required | Source | Rule |
|---|---|---|---|---|
| Role Name | `RoleName1` text | Yes (`[Required]` "Please enter Role Name") | free | name "System Administrator" is refused ("You cannot Create a role with the name System Administrator") |
| Role Description | `RoleDescription` textarea | Yes (HTML `required` only) | free | stored |
| Priviledges | `Name`, multi-select (chosen.js) | Yes (none selected: "Please Select Priviledges") | all `AspNetRoles` rows, text `Discriminator`, value `Name` | one `AspNetRolesGroup` row per selected privilege |
| hidden `createdby`, `createddate` | | | `Session["usercompanyid"]` (never set) | ignored: controller sets `createdby = User.Identity.Name`, `createddate = now`, `status = 1` |

### 2.4 Edit role (`editrolelink`, `[Audit(EditRole)]`)
1. Same "System Administrator" name check (so the built-in role cannot be saved through this form).
2. Privilege list required (none: "Please Select Priviledges", redirect to list).
3. Computes set difference between existing `AspNetRolesGroup` rows and the posted list: inserts new rows, deletes removed ones with procedure `deleteRolePriviledgeAttached(roleid bigint, aspnetrole varchar)`.
4. Updates the `RoleName` row (name, description; `createdby`/`createddate` overwritten with the editor and now).
5. Starts a background thread `UpdatePriviledge.executeUserAttachRole` (`Models/AppReusable.cs`): for every user in `userInRoletoEditViews` with that `RolenameID`, runs `updateUserRightsRemove` for each removed privilege and `updateUserRightsAdd` for each added one. Fire-and-forget: failures are silent.

### 2.5 List (`roleList`)
Search box `rolename` = exact match on role name. Columns: RoleName, Description, Details (modal listing privilege descriptions), Update (posts to `editrole`). Page size from `appSettings pageSize` (25).

### 2.6 Faults not to copy
| Fault | Where |
|---|---|
| `editrole` throws `NullReferenceException` for a role with no privileges (`strPrivinrole` null, then `.Contains`) | `RoleManagementController.cs: editrole` |
| List view does `dict[n.ASPNetRolesId]`: `KeyNotFoundException` if a role links to a privilege name missing from `AspNetRoles` | `Views/RoleManagement/roleList.cshtml` |
| Redirect to a non-existent action `Create` when name is "System Administrator" (`RedirectToAction("Create","RoleManagement", View(rolename))`) | both POST actions |
| Duplicate role names not checked (no unique key on `RoleName.RoleName` in the model) | `createRolePriviledgegroup` |
| No delete role, no deactivate (`status` always 1) | whole controller |
| Raw SQL concatenation in `UpdatePriviledge.insertUpdate` and `updatePriviledgeDesc` (`"... where Name = '" + priviledge + "'"`): SQL injection | `Models/AppReusable.cs` |
| Role updates are applied by an untracked thread; no result shown | `editrolelink` |
| `ASPNetRolesId` stores the privilege name, not the id: renaming a privilege orphans links | schema + `createRolePriviledgegroup` |
| `markedfordelete` column in `AspNetRolesGroup` never read in C# | edmx only |

## 3. How sign-in and role checks work

### 3.1 Login (`Account/Login`)
| Item | Value |
|---|---|
| URL | `/Account/Login` (anonymous; `[checkMaintenance]` filter) |
| Fields | Username (service number), Password; model `UserLogin` both `[Required]` ("Username Is Required", "Password Is Required") |
| Extra link | "Reset Password" to `/Security/ResetPasswordServiceNumber` |
| Steps | `UserManager.FindAsync(username, password)`; if null: "Invalid Username or Password." (no lockout counting, no audit row). On success `SignInAsync(user, isPersistent: true)` signs out the external cookie, builds a cookie identity, signs in. |
| After success | `setLoggedinInfo` stores `Session["userInfo"]` (a `UserInformation`: AspNetuserID, ServiceNumber, Email, username). `ipersonService.getEmployeeFullInfo(user.ServiceNumber)`: sets `Session["personid"] = person.personid` or `0` if the user has no personnel record. |
| Redirect | if `returnUrl` and `IsPasswordConfirmed` redirect to it; else if `IsPasswordConfirmed` go to `Home/Index`; else (first login after provisioning) go to `/Security/ResetPasswordServiceNumber`. |
| Logout | `Account/Logout` (`[Audit(LogOut)]`): `AuthenticationManager.SignOut()`, `Session.Abandon()`, redirect to Login. Logout is a GET link. |

### 3.2 Identity tables (EF code-first, connection `DefaultConnection`, context `MyIdentityDbContext`)
| Table | Columns used (from `HicadHRProjectModel.edmx`) |
|---|---|
| `AspNetUsers` | `Id` nvarchar(128); `UserName` nvarchar(256) NOT NULL (= service number); `ServiceNumber` nvarchar(max); `Surname`; `FirstName` nvarchar(100); `MiddleName` nvarchar(100); `Rank` int (TitleTypeId); `Email` nvarchar(256); `EmailConfirmed`; `PasswordHash` nvarchar(max); `SecurityStamp`; `PhoneNumber`; `PhoneNumberConfirmed`; `TwoFactorEnabled`; `LockoutEndDateUtc`; `LockoutEnabled`; `AccessFailedCount`; `IsPasswordConfirmed` bit; `RolenameID` bigint NOT NULL; `specid` int. Custom fields come from `Infra/Identity/StoreUser.cs` |
| `AspNetRoles` | `Id`, `Name`, `Discriminator` (see 2.2) |
| `AspNetUserRoles` | `UserId`, `RoleId` (composite pk) |
| `AspNetUserClaims`, `AspNetUserLogins` | standard, unused |
| `Person.Username/Password` columns | exist (nvarchar(50)) but not read by the login; do not import |

Note two stores are used together: the Identity context (`DefaultConnection`) and the EF model context (`HicadHRProjectEntities`) which also maps the same `AspNet*` tables as entities (`AspNetUser`, `AspNetRole`, ...).

### 3.3 Password rules actually in force
| Rule | Value | Evidence |
|---|---|---|
| Controllers build `new UserManager<StoreUser>(new UserStore<StoreUser>(...))` with no custom validators, so Identity 2.2.1 library defaults apply: min length 6, no complexity, alphanumeric user names (UNCONFIRMED defaults, version from `packages.config`) | | `AccountController.cs` ctor, `SecurityController.cs` ctor |
| The stricter `ApplicationUserManager` (length 6, digit, lower, upper, non-alphanumeric; lockout 5 attempts / 5 min; two-factor providers) is defined but NOT wired up (its registration is commented out) | | `App_Start/IdentityConfig.cs`, `App_Start/Startup.Auth.cs` |
| Reset page: Password `[Required]`, length 6-100, ConfirmPassword must match | | `Models/AccountViewModels.cs: ResetPasswordViewModel` |
| Reset writes the hash with `new PasswordHasher().HashPassword(...)` directly, bypassing `PasswordValidator` | | `SecurityController.cs: ResetPassword` |
| Hash format: Identity v2 `PasswordHasher` (PBKDF2 HMAC-SHA1, 1000 iterations, base64 `0x00 + salt + subkey`); cannot be verified by bcrypt, so imported users must reset | | library default |

### 3.4 `User.IsInRole("X")` names: complete list and what each guards
Only `Views/Shared/_menu.cshtml` makes live checks (plus two stray ones noted). Role names are rows in `AspNetRoles.Name`; the seed rows are NOT in the repository (no seed script found), so these names are what the code tests.

| Privilege name | Menu items shown only with it (all in `_menu.cshtml`) | Controller actions behind them (NOT protected server side) |
|---|---|---|
| `UpdateDetails` | Ratings Management > Update My Details (`Employee/EditPersonel/{Session["personid"]}`) | `EmployeeController` |
| `NewRatings` | Ratings Management > New Ratings (`Employee/Create`) | `EmployeeController: Create` |
| `BatchCreation` | Ratings Management > Batch Upload (`Employee/ExcelUpload`) | `EmployeeController: ExcelUpload` |
| `FormerRatingsList` | Ratings Management > Former Ratings List (`Employee/FormerEmployeeList`) | |
| `CorrentRatingsList` (sic, typo is the real name) | Ratings Management > Current Ratings List (`Employee/Index`) | |
| `ViewDocument` | NOT enforced: the `IsInRole` is inside a Razor comment, so "View Document" (`Employee/GetFolderList2`) is shown to everyone. Also commented in `Views/Employee/Create.cshtml` and `EditPersonel.cshtml` (tab "View Document/Upload" always shown) | |
| `ViewConfidentialDocument` | commented out everywhere (`_menu.cshtml`, `Create.cshtml`, `EditPersonel.cshtml`, `GetFolderList.cshtml`); item "View Confidential Doc" is off | |
| `SystemAdministration` | Drafting: Update Manning Requirement (`ShipRequirement/viewrequirement`), Draft Approval, Close Draft, Upload Draft, Update WEF, Batch/Signal Content, Rate DOD History, Draft Report (all `draftings/...`); Advancement Processing: Approval, Close, Board Returns Update, Report on Promoted Rates, Upload Advanced Rates (`Advancement/...`); whole "Report" block (Ship History Report `Report/personellistbybranch`, All Personel `Report/personellistfilter`, Disposition Report `Report/PersonelReport`) | |
| `Drafting` | Drafting: Print Draft Proposal (`draftings/draftlistfilters`), Review/Print Draft (`draftings/draftreview`); Advance Draft: Advance Draft Proposal (`draftings/SpecialDraft`), Advance Draft Report (`draftings/specialdraftinglist`); Advancement Processing: Rates due for Advancement (`Advancement/advancementfilters`), Advancement Review | |
| `CharacterAssessmentEfficiency` | whole "Assessment of NAVAL Character & Efficiency" block: Recommendation and Grading (`AppraisalHistory/List`), Report on Appraisal (link goes to `Home/Index`) | |
| `DisciplinaryActions` | whole "Disciplinary Action" block: Initiate Incidence (`Decipline/index`), Pending Cases (`Decipline/List`), Concluded Cases and Disciplinary Report (both `Decipline/DesciplineHistoryList`) | |
| `Discharge` | whole "Discharge Administration" block (Process Discharge `Discharge/dischargereview`, Print Service Details, Verification Forms, Discharge Report, Upload Discharge) AND (same name reused) whole "Training Drafting" block (`TrainingDraft/...` Process, Review, Update Training History, Reports, Excel Upload) | |
| `StaticTables` | whole "Static Tables" block (the 16 live items, see `static-tables.md`) | |
| (no check) | Dashboard, "View My Details" (shown when `Session["personid"] != null`), "View Document", whole "System Administration" block, Log Out | |
| `Administrator` | stray: `Views/Security/UserInRole.cshtml` (Edit/Delete buttons) on a page that is not linked | |

Notes:
- `Session["personid"] != null` is always true after login (set to `0` when no record), so "View My Details" always shows; with `0` it opens `Employee/viewprofile/0`.
- `Startup.cs` has a commented seed for a default administrator role/user; not active. No seed of roles in `updatedscript.sql` (searched).
- All names are exact-case strings; the check is `ClaimsPrincipal.IsInRole`, using role claims added at sign-in from `AspNetUserRoles` (so changes to a user's roles take effect only at next sign-in; there is no security-stamp validation because `OnValidateIdentity` is commented out in `Startup.Auth.cs`).

### 3.5 Manage Password (`Security/ResetPasswordServiceNumber`)
| Item | Value |
|---|---|
| Menu label | System Administration > Manage Password (also the "Reset Password" link on the login page and the forced redirect after first login) |
| URL/flow | 3 anonymous pages: `/Security/ResetPasswordServiceNumber` (enter Official Number) then `/Security/VerifyCode` (enter code) then `/Security/ResetPassword` (new password + confirm) then redirect to `/Account/Login` |
| Role | none; all three actions are `[AllowAnonymous]`; it is NOT an admin function (it resets the password of whichever service number is typed, after an e-mailed code) |
| Fields | Step 1: `ServiceNumber` text, required ("Official Number is Required!"). Step 2: `Code` text, required, placeholder says "6 digit Code Sent to your Phone" (wrong: it is e-mailed). Step 3: `Password`, `ConfirmPassword` |
| Step 1 logic | `FindByNameAsync`; not found: "Invalid Official Number. Please Contact your Admin". Else code = `new Random().Next(100000, 200000)` (always 6 digits starting with 1), `Session["userToReset"] = ServiceNumber`, `Session["verificationCode"] = code`, e-mail via SMTP (`appSettings emailhost/emailaddress/emailpass`, port 587 SSL) with subject "Password Verification Code" if the user has an e-mail; SMS call is commented out. |
| Step 2 logic | string compare with `Session["verificationCode"]`; mismatch: "Invalid Verification Code"; match: redirect to ResetPassword. Nothing records that the code was verified. |
| Step 3 logic | reads `Session["userToReset"]`, sets `PasswordHash`, `IsPasswordConfirmed = true`, `UserManager.UpdateAsync`, clears the two session keys, redirects to login with "Password Resset was Successful. Please Login to Continue". |
| Audit | each POST logs `reset`, `verify`, `resetP` through `[Audit]` (and the filter records the posted form, see 4.4) |

Faults: (a) step 3 only checks that `Session["userToReset"]` exists, not that the code was verified: after step 1 anyone can open `/Security/ResetPassword` directly and set the password (account takeover with only a service number); (b) no code expiry, no attempt limit, `System.Random` (not cryptographic); (c) users with no e-mail get no code and are stuck (also first-login users created without e-mail); (d) the exception in sending mail is swallowed (`catch { string log = ex.Message; }`), the page still says "An Email Notification Was sent"; (e) password complexity bypassed (3.3); (f) the new `Password` and the code are written in clear into the audit table by the `[Audit]` filter (4.4); (g) wording "Phone" vs e-mail; (h) "Manage Password" in the admin menu does not let an administrator set another user's password.

## 4. Audit Trail (Account/AuditTrail)

### 4.1 Menu, URL, privilege
| Item | Value |
|---|---|
| Menu label | System Administration > Audit Trail |
| URL | `/Account/AuditTrail` (page), `/Account/AuditTrailFilter?fromdate=&todate=` (printable list), `/Account/DeleteAuditFile` (GET) |
| Role | none enforced (`AccountController` has class-level `[Authorize]` = signed in only) |
| Controller/API | `AccountController.cs: AuditTrail, AuditTrail2, AuditTrailFilter, DeleteAuditFile`; data API `GET /api/Personel/getListofAudit` (`APIController/PersonelController.cs: returnAuditList`, `[AllowAnonymous]`) |

### 4.2 Page elements (`Views/Account/AuditTrail.cshtml`; `AuditTrail2.cshtml` is an unreferenced near-copy)
| Element | Type | Source / behaviour |
|---|---|---|
| User ID | text `UserId` | filter, sent as `UserId` (empty becomes `"0"`) |
| Official No | text `svcno` | filter, sent as `svcno` (empty becomes `"0"`) |
| Process (first) | button | reloads the DataTable with `?UserId=..&svcno=..` |
| From Date / To Date | text, maxlength 8, placeholder "YEAR MONTH DAY(20181016)" | form GET to `AuditTrailFilter`; Process (second button, same `id="processBTN"` as the first) |
| Delete Audit File | button, GET form to `DeleteAuditFile` | see 4.5 |
| Table | DataTables server-side (`sAjaxSource`) | columns: User ID, User Affected, Action, DateTime, IP Address, Browser, URL, Data; export buttons copy/excel/pdf/csv; page lengths 10/25/50/all |

AJAX: `GET /api/Personel/getListofAudit?sEcho&iDisplayStart&iDisplayLength&UserId&svcno` returns `{aaData, iTotalRecords, iTotalDisplayRecords, status, errormessage}`; JS treats `status == "2"` as "redirect to login" (server never sends it).

Server query (`HRProjectDAL/APIImplementationRepository/IPersonReportImplementation.cs: returnAuditList`): `GetAuditTrails` (database VIEW `GetAuditTrail`, body UNCONFIRMED, columns equal to `Tbl_AuditTrail`) filtered `(UserId == "0" || x.UserId == UserId) && (svcno == "0" || x.UserIdAffected == svcno)`, ordered by `ActivityTime` desc, `Skip/Take`. Total count = `GetAuditTrails.ToList().Count()` (loads the whole table every call, and it is NOT the filtered count).

`AuditTrailFilter(fromdate, todate)` (string `yyyyMMdd`): `db.FN_getAuditTrailByDate(fromdate, todate)` = procedure `getAuditTrailByDate(fromdate nvarchar, todate nvarchar)` returning `Tbl_AuditTrail` rows (UNCONFIRMED: filters on the text column `Activitydate`); view `AuditTrailFilter.cshtml` (no layout, "Print This Page"). Columns: User ID, Action, DateTime, IP, Browser, URL, Data.

### 4.3 Tables
| Table | Columns | Used? |
|---|---|---|
| `Tbl_AuditTrail` | `AuditId` uniqueidentifier pk; `SessionID` nvarchar(50) (always "NA"); `IpAddress` nvarchar(max); `Activitydate` nvarchar(50) text `yyyyMMdd`; `ActivityTime` datetime; `Browser`; `UrlAccessed`; `UserId` (login name = service number); `Action` (name from enum `AuditAction`); `Data` (serialised request or object); `UserIdAffected` (service number of the rating changed, set only by the manual inserts) | YES, the only audit table written |
| `AuditTrail` (`Id`, `AuditTypeActionId`, `AlterationTableId`, `ChangedByPersonId`, `AffectedPersonId`, `AffectedRowId`, `NewRowCreated`, `CreatedDate`, `CreatedBy`, `IsActive`) and `AuditTypeAction` (`Id`, `Name`, `Description`, `IsActive`) | | NO. Present in the model with a foreign key but no compiled code writes or reads them. `Helper/AuditAttribute.cs` (writes `AuditTrail` with properties that do not exist) and `Helper/Auditclass.cs` are not in `HPProject.csproj`. |
| `GetAuditTrail` | view over `Tbl_AuditTrail` (UNCONFIRMED) | read by the page |

### 4.4 How rows are written (two mechanisms)
1. Attribute `[Audit(AuditAction.X)]` (`Filters/AuditAttribute.cs`, MVC `ActionFilterAttribute.OnActionExecuting`, so the row is written BEFORE the action runs, whether or not it later succeeds). Row: new Guid, `SessionID="NA"`, IP = `HTTP_X_FORWARDED_FOR` else `UserHostAddress` (`::1` shown as `127.0.0.1`), time now, `Activitydate` ignored here (not set, so `AuditTrailFilter` by date misses these rows: UNCONFIRMED, the C# does not set it), browser = `request.Browser.Type`, URL = `RawUrl`, user = signed-in name or `"Anonymous"`, `Action` = enum name, `Data` = XML of ALL form and query-string fields (`SerializeRequest`; includes passwords and codes). `UserIdAffected` is never set by the attribute. The same filter also stores `Session["IpAddress"]` and `Session["UserId"]`.
2. Manual insert of a `Tbl_AuditTrail` through `AuditServiceImpl.LogAudit` then `AuditRepoImpl.LogAudit` then `GenericRepository<Tbl_AuditTrail>.Insert` (rethrows on error): used inside actions after success, with `UserIdAffected` = rating's service number, `Activitydate` set, `IpAddress` hard-coded `"127.0.0.1"` in API and Employee code, `Data` = `JavaScriptSerializer` JSON of the posted object (`Infra/Utilities/GeneralUse.cs: returnString`).

`[Audit]` on Web API actions (`PersonelController`: `Delete` line 410, `AddNOK` 604, `EditNOK` 660, `AddSpouse` 807, `EditSpouse` 861, `DeleteSpouse` 908) uses an MVC filter class, which Web API ignores (UNCONFIRMED standard framework behaviour); those actions rely on mechanism 2 instead.

### 4.5 Actions that are logged
`[Audit]` attribute (mechanism 1), by file and enum value:
| File | Actions logged |
|---|---|
| `SecurityController.cs` | `Create` (CreateNewUser), `Edit` (EditUser), `Delete` (DeleteUser POST), `reset` / `verify` / `resetP` (password flow), `Upload` |
| `AccountController.cs` | `LogOut`, `DeleteAuditFile` (Login attribute is commented out) |
| `RoleManagementController.cs` | `AddPrev`, `EditPrev`, `CreateRole`, `EditRole` |
| `draftingsController.cs` | `DraftWEFDate`, `CloseDraft`, `AddNewDraft` (x2), `RemoveDraft` (x3), `SaveNewDraft` |
| `AdvancementController.cs` | `RemoveAdvancement`, `AddNewAdvancement`, `CloseAdvancement`, `UpdateNewAdvancement` (x2) |
| `TrainingDraftController.cs` | `TrainingDraftProposal`, `TrainingDraftWEFDate`, `UpdateNewTrainingDraft`, `RemoveTrainingDraft`, `RemoveDraft` |
| `EmployeeController.cs` | `CreateEmp` (the `EditEmp` attribute is commented out) |
| `PersonelController.cs` (API, likely inert) | `Delete`, `AddNOK`, `EditNOK`, `AddSpouse`, `EditSpouse`, `DeleteSpouse` |

Manual inserts (mechanism 2), with `UserIdAffected`:
| File | Actions |
|---|---|
| `Controllers/AccountController.cs: Login` | `Login`, written ONLY when the model state is invalid (the success and wrong-password branches return before reaching the insert), so successful logins are not logged |
| `PersonelController.cs` (API) | `AddNOK/EditNOK/DeleteNOK`, `AddSpouse/EditSpouse/DeleteSpouse`, `AddChildren/EditChildren/DeleteChildren`, `AddAdvancementHist/EditAdvancementHist/DeleteAdvancementHist`, `AddEmploymenttHist/EditEmploymenttHist/DeleteEmploymenttHist` (sic), `AddTrainingHist/EditTrainingHist/DeleteTrainingHist`, `AddEducationHist/EditEducationHist/DeleteEducationHist`, `AddLanguageHist/EditLanguageHist/DeleteLanguageHist`, `DeleteShipRequirement` |
| `DraftingAPIController.cs` | `UpdateShip`, `UpdateDraftDateShip` |
| `DischargeAPIController.cs` | `SaveNewDischarge`, `UpdateNewDischarge`, `RemoveDischarge` |
| `AdvancementController.cs` | `AdvancementProposal`, `AdvancementWEFDate`, `AdvancementReview` |
| `draftingsController.cs` | `DraftReview`, `DraftProposal` |
| `DeciplineController.cs` | `CreateDiscipline`, `EditDiscipline`, `DeleteDiscipline` |
| `EmployeeController.cs` | `Update` (x5, after the rating edit saves) |

Not logged: successful sign-in, failed sign-in, viewing a record, rating create via the form is logged only by the `CreateEmp` attribute, Static Table changes (no audit on any of the 16 static-table controllers), `RoleManagement` edit results.

Full enum `AuditAction` is in `Helper/AuditAction.cs` (about 110 members; the only ones actually emitted are those listed above).

### 4.6 Delete Audit File (hazard)
`AccountController.cs: DeleteAuditFile` (`[Audit(DeleteAuditFile)]`, GET) calls `db.DeleteTrainingDraft()` (procedure `DeleteTrainingDraft`, no parameters, body UNCONFIRMED) then redirects back. The name implies it deletes training draft data, NOT audit rows. The button label says "Delete Audit File". A GET link with no confirmation, reachable by any signed-in user. Do not carry over; if an audit purge is ever wanted it must be a separate, admin-only, confirmed, itself-logged action.

### 4.7 Faults not to copy (audit)
| Fault | Where |
|---|---|
| Passwords, reset codes and PII written in clear into `Data` | `Filters/AuditAttribute.cs: SerializeRequest` |
| Row written before the action runs (logs attempts, not outcomes) | same |
| `UserIdAffected` empty for attribute rows; the "Official No" filter only finds manual rows | |
| Count returned for paging ignores filters and loads the entire table | `returnAuditListCount` |
| Audit data API open to unauthenticated callers | `PersonelController.cs: returnAuditList` |
| Date filter takes raw `yyyyMMdd` text; no validation; the page has two buttons with the same id | `AuditTrail.cshtml` |
| IP hard-coded `127.0.0.1` in manual rows; `SessionID` always `NA` | |
| No audit for login/logout results, role/privilege changes outcome, password resets completion | |

## 5. Filters, Startup, Global.asax, Web.config
| File | Content |
|---|---|
| `Startup.cs` | OWIN `Configuration` calls `ConfigureAuth(app)`; seeding code (`createRolesandUsers`) commented out |
| `App_Start/Startup.Auth.cs` | `UseCookieAuthentication` (ApplicationCookie, LoginPath `/Account/Login`); external sign-in cookie enabled; security-stamp validation, two-factor cookies and external providers commented out |
| `App_Start/IdentityConfig.cs` | `EmailService`, `SmsService` stubs (do nothing), `ApplicationUserManager` and `ApplicationSignInManager` (unused) |
| `App_Start/FilterConfig.cs` | global `HandleErrorAttribute` |
| `Global.asax.cs` | `Application_Start`: Web API config, global filters + `new AuthorizeAttribute()`, routes, bundles, `CustomDateModelBinder` for `DateTime` (uses `DisplayFormat` string, else default binding) |
| `Filters/AuditAttribute.cs` | the audit filter (4.4) |
| `Filters/AuthorizeActionFilterAttribute.cs` | redirects to `Login/Index` unless `Session["authstatus"]` set; NOT applied to any controller; `Helper/AuthorizeActionFilterAttribute.cs` is a second copy |
| `Filters/SessionExpire.cs` | redirects to `Home/Login` unless `Session["StaffNumber"]` set; NOT applied anywhere; `Home/Login` does not exist |
| `Models/checkMaintenance.cs` | `[checkMaintenance]` on `Account/Login` GET and POST only (see 6) |
| `Web.config` | `authentication mode="None"` (cookie handled by OWIN); `FormsAuthentication` module removed; `sessionState InProc timeout=350`; `customErrors RemoteOnly` with redirects to `~/ErrorPages/*.aspx`; keys: `maintenance`, `message1`, `message2`, `pageSize` (25), batch number prefixes (`DraftindBatchPrefix` `DOD-{0}{1}{2}-`, `TrainingBatchPrefix` `DOT-{0}{1}{2}-`, `AdvanceindBatchPrefix` `DOA-{0}{1}{2}-`), SMTP settings (`emailaddress`, `emailSender`, `emailhost`, `emailpass`), document server (`InfoUserName`, `InfoPassword`, `InfoUrl2`, `InfoUrl3`). Values deliberately not copied. |

## 6. Session variables and maintenance banner
| Key | Set by | Read by | Notes |
|---|---|---|---|
| `Session["username"]` | nowhere (assignment commented out in `AccountController.cs: Login`) | `_menu.cshtml` (header name, so always blank) | dead |
| `Session["userInfo"]` (`UserInformation`) | `AccountController.cs: setLoggedinInfo` (only if null) | `AccountController.getLoggedinInfo()`, used e.g. `EmployeeController` (`ModifiedBy = getLoggedinInfo().username`), `GetLogginInformation.getLoginInformation()` | holds AspNetuserID, ServiceNumber, Email, username (the sign-in name) |
| `Session["personid"]` | `AccountController.cs: Login` (person id, or 0) | `_menu.cshtml` (View/Update My Details links) | |
| `Session["serviceno"]` | nowhere | `EmployeePersonalInfoController` lines 655, 1059 | dead; falls back to empty |
| `Session["userToReset"]`, `["verificationCode"]` | password reset step 1 | steps 2-3 | removed after success |
| `Session["maintenance_almost"]` | `checkMaintenance` | `_menu.cshtml` (JS `alert` of the text on every page that draws the menu) | |
| `Session["IpAddress"]`, `["UserId"]` | `[Audit]` filter | nothing | |
| `Session["AuthenticationTicket"]`, `["personeSvc_no"]`, `["personeSvc_no2"]`, `["personID"]` | document-server integration (`InfoRoutersController`, `EmployeeController.GetFolderList`) | same | out of scope here |
| `Session["usercompanyid"]` | nowhere | hidden fields in role views | dead |

Maintenance (`Models/checkMaintenance.cs`): runs on the login page. Compares today's date as `yyyyMMdd` integer with `appSettings["maintenance"]` (`yyyy-MM-dd`, configured 2023-10-12): equal sets `maintenance_almost = message1` ("Application package maintenance is about to expire"), greater sets `message2` ("Application package maintenance is due"), earlier sets nothing. The session value is then shown as a JavaScript alert whenever `_menu.cshtml` renders (every signed-in page, for the rest of the session). It never blocks login. This is a licence/maintenance-contract reminder by the vendor, not an application feature; do not rebuild.

## 7. Dashboard (Home/Index) for context
`HomeController.cs: Index` (no role): `noofactiveemployee = iperserv.returnCuurentPRecordCount()`, `noofinactiveemployee = iperserv.returnFormerPRecordCount()`, `noofemployee = sum`. Tiles in `Views/Home/Index.cshtml`: Members (total, Old Members = former, Current Members), Drafting (hard-coded 0), Memos/Mails (hard-coded 0), Appraisals (hard-coded 0).

## 8. Mapping to the new system (`src/db/migrations`)
| Old | New | Gap |
|---|---|---|
| `AspNetUsers` (`UserName`=service no, `ServiceNumber`, `Surname`, `FirstName`, `MiddleName`, `Email`, `PhoneNumber`, `Rank`, `specid`, `RolenameID`, `IsPasswordConfirmed`, lockout columns) | `users` (`username`, `password_hash` bcrypt, `full_name`, `role` VARCHAR(30), `service_number` unique FK to `ratings`, `is_active`, `last_login_at`, `created_by`) | no first-login-reset flag, no e-mail/phone, no rank/department, no lockout counters, no multi-privilege model |
| `RoleName` + `AspNetRoles` + `AspNetRolesGroup` + `AspNetUserRoles` (role bundles of privilege strings) | single `users.role` string | no privilege table; design decision needed: either map the 13 privilege names in 3.4 to a small role set, or add privilege tables |
| `Tbl_AuditTrail` | none | no audit table yet |
| Password reset by e-mailed code | none | no e-mail setting in new schema |

## 9. Credential exposure (do not repeat)
`Web.config` (including commented-out blocks) contains clear-text DB `sa` passwords, SMTP passwords and a document-server password; a commented block in `Controllers/SecurityController.cs: SendEmailNotification` also contains an old mail password. Rotate or discard all of them; the new system must use environment configuration.

## Hand-off notes for design/build
- Read first: sections 0, 3.4 (privilege names) and 8; decide the new role model before building any menu, because the old system only hid menu items and never enforced server side.
- Enforce server-side authorization on every route and API endpoint from day one; the old Web API and audit data were open without sign-in.
- Rebuild: user create/edit/deactivate (not hard delete), role assignment, password reset with a single-use expiring token that must be verified before the reset step, generated temporary password (not phone number), audit trail of outcomes without secrets.
- Do not rebuild: maintenance banner, "Delete Audit File", `Upload` of persons through the security controller, Memos/Mails tile, `AuditTrail`/`AuditTypeAction` tables.
- Import risk: old password hashes (Identity v2 PBKDF2-SHA1) cannot be used by bcrypt; imported users need a reset. The seed data of `AspNetRoles`, `RoleName`, `AspNetRolesGroup` is not in the repo and must be obtained from the live database or recreated from section 3.4.
- UNCONFIRMED items: procedure bodies (`updateUserRightsAdd/Remove`, `deleteRolePriviledgeAttached`, `getAuditTrailByDate`, `DeleteTrainingDraft`), view bodies (`GetAuditTrail`, `userInRoletoEditView`), Identity default validators and cookie expiry (library defaults).

## Memos and Mails
The dashboard tile labelled "Memos/Mails" (`Views/Home/Index.cshtml`, line 108) does not get a number from anywhere: the value is the literal markup `<h1>0</h1>` (line 109), and its two sub-counters are literal "." placeholders. `HomeController.cs: Index` sets only `noofactiveemployee`, `noofinactiveemployee`, `noofemployee` into `ViewData`. No layout, partial or API supplies a mail count (searched `Views`, `Controllers`, `APIController`, `Models`, JS and SQL for "memo" and "mail" counts: only `Views/Employee/EmployeeHome.cshtml` and `Views/EmployeePersonalInfo/EmployeeHome.cshtml` repeat the tile, with the literal `54.40%`, a template placeholder; those views are reached by `EmployeeHome` actions). Mail-looking badges in `Views/Shared/_headercommon.cshtml` (counts 2, 1, 5 with sample names) are static template HTML. There is no memo/mail table in the edmx. Conclusion: the tile is a non-functional placeholder; the new system should omit it or build it as a new feature.

Same for the other tiles: Drafting, Appraisals are literal `0`; only the Members tile is live.

