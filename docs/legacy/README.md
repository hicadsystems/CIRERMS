# Map of the old system (WP0)

Reference for later sessions, so nobody re-reads the old code from scratch. Old code: `hicadsystems/cirems` (project `hpproject`, last commit 21/12/2022). Documentation only; nothing here is app code.

## How the old system is built
ASP.NET MVC 5, Entity Framework 6 (database-first), SQL Server, Crystal Reports, DataTables and jQuery in the views. Layers:

| Layer | Where | Notes |
|---|---|---|
| Menu | `hpproject/Views/Shared/_menu.cshtml` | Items inside `@* *@` are switched off (out of scope). Each group sits in `User.IsInRole("...")`; that role name is the privilege (see `system-admin.md`) |
| MVC controllers | `hpproject/Controllers` (route `{controller}/{action}/{id}`, default `Account/Login`) | Pages, form posts, PDF/Excel downloads. Most business logic is here; most pages have **no server-side role check** |
| Views | `hpproject/Views/<Controller>/<action>.cshtml` | Each holds its own `<script>`: the AJAX calls |
| Web API | `hpproject/APIController` (route `api/{controller}/{action}/{id}`) | Called by the page scripts through `@Url.Action("x","api/XxxAPI")`; mostly `[AllowAnonymous]` |
| Services | `hpproject/APIServices/IServices` and `IServiceImplementation` | Thin wrappers (one pair per area) |
| Repositories | `HRProjectDAL/APIImplementationRepository` | LINQ over the EF context, calls to procedures and views |
| Model | `HRProjectDAL/Core/HicadHRProjectModel.edmx` (+ generated `*.cs`) | 319 entity sets (tables and views), 84 procedure/function imports |
| Reports | `hpproject/RDLCReport/*.rpt`, `hpproject/Report/*.rpt` (+ `ReportOLD`) | Loaded with `ReportDocument.Load` in controllers |
| Upload templates | `hpproject/App_Data/UploadFormat/*.xlsx` | Read with EPPlus/OLEDB in the controllers |
| Dead code | `draftingsControllerXX.cs`, `IDraftingRepoImplementationXXX.cs`, `IDraftingPrepServiceXX.cs`, `ReportOLD/`, `EmployeeMasterXX` | Not in the project file or no caller; ignore |

## How to trace a page
1. **Menu item** in `_menu.cshtml`: `Url.Action(action, controller)` gives the URL and the role.
2. **Controller action** `Controllers/<Controller>Controller.cs`: GET renders the view and loads dropdowns; POST actions save, export or print.
3. **View** `Views/<Controller>/<action>.cshtml`: read its `<script>` for the AJAX calls (`url:` or `@Url.Action("name","api/XxxAPI")`), the DataTables columns and the field list.
4. **API action** in `APIController/XxxAPIController.cs` (verb is chosen by the attribute or action name; `[ActionName]` renames).
5. **Service** `APIServices/IServiceImplementation/...` then **repository** `HRProjectDAL/APIImplementationRepository/...`.
6. **Procedure or view**: the repository calls an EF function import (listed in `sql/procedure-names.md`, with the pages that use it) or reads a view entity from the edmx. Procedure and view **bodies are not available** (below).
7. **Printout**: search the controller for `ReportDocument` / `.Load(`; the inventory is in `reports.md`.

## Files
| File | Content |
|---|---|
| `ratings.md` | Data model of a rating (old tables) and its mapping to our migrations, for the later import |
| `drafting.md` | Drafting, 10 pages, with split advice for WP7 |
| `training-drafting.md` | Training Drafting, 5 pages |
| `advancement.md` | Advancement Processing, 7 pages, appraisal dependency |
| `disciplinary.md` | Disciplinary Action, 4 menu items |
| `discharge.md` | Discharge Administration, 5 pages |
| `static-tables.md` | The 16 live static tables |
| `reports.md` | Report menu (3 pages) and the Crystal report inventory |
| `system-admin.md` | Users, roles, privileges, password reset, audit trail, sign-in and role checks, Memos and Mails |
| `open-questions.md` | Answers to PLAN section 9 |
| `sql/tables.md` | Tables and columns of the 2017 backup (definitions only) |
| `sql/procedure-names.md` | The 84 procedure/function names: called from, page, module file |

## Backup versus code (read this)
- `hpproject/DatabaseFile/HicadHRProject_20170401.bak` holds 4 backup sets; the last (04/05/2017) was restored in a throwaway SQL Server 2022 container and read through `INFORMATION_SCHEMA`/`sys` only: no table was ever selected from. It has **77 tables** (the EDMX has 319 entity sets, 174 tables per the plan), **no views**, and **3 procedures** (`INSERTCOURSEREGISTRATIONLEVEL`, `INSERTPERSONBENEFITS`, `SubscriptionUpdate`) that no in-scope page calls. Its tables come from an older schema (e.g. `Person`, `Appraisalratings`, leave, medical) lacking tables the 2022 code needs (batches, drafting, advancement, discharge, discipline). Table definitions are in `sql/tables.md`.
- `hpproject/App_Data/updatedscript.sql` has no CREATE PROCEDURE/VIEW/FUNCTION.
- So **no procedure, function or view body is available anywhere**, including the views the pages read (e.g. `V_advance`). The module files say, per procedure, its parameters as called, the result columns the C# reads and what it appears to do, all marked UNCONFIRMED. Where the code and 2017 differ, the code wins.
- Per the administrator's decision the project keeps **no** `.sql` copies of procedures, functions or views; the new app uses service code with plain parameterised SQL. The restored database, container, image and backup copy were deleted (the file inside the cloned old repo is that repo's own).
- Privacy: no record from the backup was read or written anywhere.

## Cross-cutting faults of the old system (details per module)
Clear-text database and mail passwords in `Web.config` and in a commented block (never copy; rotate); most API actions anonymous and most pages without a server-side role check; search pages that create or change data on GET; labels that do not match their fields; duplicated filter logic between screen and print.
