# Answers to PLAN section 9 (and what stays open)

## 1. Where does "Memos and Mails" come from?
Nowhere. The tile (`hpproject/Views/Home/Index.cshtml`, "Memos/Mails") shows the literal markup `0`; `HomeController.cs: Index` sets only the three member counts. No table, procedure, API or partial supplies a memo or mail count (the mail badges in `Views/Shared/_headercommon.cshtml` are static template HTML). Drafting and Appraisals tiles are also literal 0; only Members (current, former, total) is live. Leave the tile at 0 or drop it. Detail: `system-admin.md`, last section.

## 2. Which Crystal reports do the in-scope pages still load, and for which page?
Full inventory (all 22 `.rpt` in `RDLCReport` plus the ones in `Report/`, with loader file and method) is in `reports.md` section 5. Loaded by live in-scope pages:

| Module | Page | Report |
|---|---|---|
| Drafting | Update Manning Requirement | `CrystalReportShipRequirement` |
| Drafting | Review/Print Draft | `CrystalReportForDraftForm` |
| Drafting | Draft Report, Rate DOD History, Batch/Signal Content, approval and close lists | `CrystalReportForDraft` |
| Advancement | Advancement Review | `CrystalReportForAdvancementForm` |
| Advancement | Report on Promoted Rates (list and batch detail) | `CrystalReportAdvancementSummary`, `CrystalReportAdvancement` |
| Training Drafting | Reports | `CrystalReportforTrainingCourse` |
| Disciplinary | Pending Cases / Concluded Cases (= Disciplinary Report) | `Report/CrystalReportForPenddingDiscipline`, `Report/CrystalReportForDiscipline` |
| Discharge | Verification Forms | `CrystalReportForReengagementF`, `CrystalReportForReleaseRoutine`, `CrystalReportForServiceDetails` |
| Discharge | Print Service Details | `Report/EmployeeMaster` |
| Discharge | Discharge Report | `Report/CrystalReportForDischargeRats` |
| Reports | All Personel | `RatingsReport` |
| Reports | Disposition Report | `Report/CrystalReportForDispostion` and `...Disposition2` (all-all) |
| Reports | Ship History | none (Excel) |
| Static Tables | each list page's export | 12 list reports in `Report/`; Local Government's file is missing (its export fails) |

Never loaded by a live page: 6 of the 22 in `RDLCReport` (`CrystalReport1`, `CrystalReportForDraftReview`, `CrystalReportForMasterReport`, `CrystalReportMasterReportForAdvancemet`, `OfficerReport`, `SummaryForDraftReport`, the last only from a file that is not compiled). The `.rpt` files are compressed binaries: their layouts cannot be read here, only the C# field lists and the `.xsd` datasets beside them. Design each printout from those field lists.

## 3. Does advancement eligibility read appraisal grades?
No. No advancement C# file, view or procedure name/parameter touches `appraisalhist`, `Appraisalratings` or any grade. The due list comes from the SQL view `V_advance` and procedure `migratefromPromotionHistToAdvancement`, whose bodies are not available anywhere, so a hidden join cannot be excluded, but nothing points to one. The demo needs no appraisal seed for advancement. Evidence: `advancement.md`, section "Appraisal dependency".

## 4. Should Drafting be one package or two?
Two. Cut: **WP7a "draft cycle"**: Update Manning Requirement, Print Draft Proposal, Review/Print Draft, Draft Approval, Close Draft, Update WEF (the only writers of batch, draft rows, current ship and drafting history; it creates the tables first). **WP7b "reports and upload"**: Batch/Signal Content, Rate DOD History, Draft Report (read-only on 7a's tables), with Upload Draft: the old upload writes the Special Draft table, not the draft cycle, so it is better moved to the later Special Drafting package (or kept in 7b with that table created there). Manning Requirement is independent CRUD and may go first or to 7b if 7a is heavy. Reasons and detail: `drafting.md` section 15.

## 5. Things that could not be confirmed (apply to every module)
- **No procedure or view body exists in anything we have.** The 2017 backup is a different, older schema (77 tables, no views, 3 unrelated procedures); `updatedscript.sql` has no CREATE PROCEDURE/VIEW/FUNCTION. Every "who is due" rule (draft, advancement, training) lives in those bodies and is marked UNCONFIRMED in the module files; only the colour bands (draft duration 10-20 green, 21-24 amber, over 24 red; advancement months in rate 48-50 green, 51-54 amber, over 54 red) and what the C# passes and reads are known. The owner must supply the rules or the live database definitions (read inside a container, logic written in words) before D1/WP7/WP8 fix them.
- Where the new rate is applied to a rating on advancement close is not visible in the C# (`advancement.md` hand-off).
- The `.rpt` field layouts (binary).
- The old system has no server-side role check on most pages (menu only) and its APIs are anonymous; role names per menu item are in `system-admin.md`.
