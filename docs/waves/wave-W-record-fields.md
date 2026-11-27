# Wave W: the record's fields to the live system's

> **Done and merged (W1 on 27/11/2026). Do not start this again.**

The owner (27/11/2026), before the real records are imported: "For the NOK, spouse and children, we need to expand our
form fields to be similar with legacy; for drafting, add branch, authority, command and state, in fact only leave out
sub-branch." Then: "Leave state alone. The ship fields need adjustment: the type is land, sea, training, and the
table should picture the command."

The live database's schema (sent 27/11/2026, kept out of this repository) gives the live columns listed below. Read
`docs/waves/README.md` first; its rules bind you.

## W1 `record-fields`

- **Branch:** `record-fields` · **Needs merged first:** everything on master · **AI session:** Sonnet 5.5, effort
  high · **Size:** M · **Migration block:** `16` (`20261120_16####_`) · **Seed:** `017_record_fields.sql`

### Read first
- `README.md`: Ratings Management and Static Tables.
- `CONVENTIONS.md`.
- `src/db/migrations/20261116_090300_create_rating_records.sql` and every later migration that alters these tables.
- The record's tabs: `public/js/sections/rating-record.js`, `rating-children.js`, `rating-fields.js` and their
  siblings.
- `src/modules/ratings/` and `src/modules/tables/`.
- The printouts that show these tabs: Print Dossier (`personnel-dossier`) and Personnel Details.
- `docs/legacy/ratings.md` (the old forms) and `docs/legacy/static-tables.md` (Ships).

### Build
Each new field is added in five places:
- its column (one migration);
- the tab's Add and Edit dialogs (a sheet on a phone), with errors under the fields;
- the row's View Details dialog;
- the dossier printout;
- the audit trail (every change, field by field).

Use the house look throughout: label and value rows, dates dd/mm/yyyy, dropdowns from the static tables, and the
wide-table rule (the tab's list keeps its key columns; a row opens the full record).

1. **Next of Kin** (live `NextOfKin`). It has First Name, Last Name, Mobile Number and Next of Kin Type (Main or
   Alternate) already. Add:
   - **Full Address** (required);
   - **Relationship** (required, from Static Tables, Relationship);
   - **Home Number**;
   - **Email Address** (required);
   - **Place of Work**.

   Keep the required marks the live form has: First Name, Last Name, Full Address, Relationship, Mobile Number,
   Email Address. If Relationship already exists, keep it.
2. **Spouse** (live `Spouse`). It has the name, phone and e-mail. Add:
   - **Street**;
   - **Town**;
   - **State** (Static Tables, States);
   - **Local Government** (filtered by the chosen State, as the rating form's own State and LGA are);
   - **P.O. Box**.

   Only Full Name is required.
3. **Children** (live `Children`). It has the name, phone and e-mail. Add the same address fields as Spouse (Street,
   Town, State, Local Government, P.O. Box), then:
   - **Sex**;
   - **Date of Birth** (not in the future);
   - **School**;
   - **Office Address**;
   - **Occupation**.

   Only Full Name is required. A child's age may show in the list.
4. **Drafting** (a posting in the record's Drafting tab; live `employmenthist`). It has Ship, Rate, Start Date, End
   Date and Remarks. Add:
   - **Branch** (Static Tables, Branch);
   - **Authority** (the signal, free text; live `signal`);
   - **Command** (Static Tables, Command);
   - **Decoration/Award** (free text);
   - **Status** (the live posting's exit mode, from Static Tables, Exit Type: Active by default).

   **No State and no Sub-Branch** (the owner). The **Command** behaves this way:
   - the Add and Edit dialogs prefill it from the chosen ship's Command when the ship is picked, and the person can
     change it;
   - a posting CIRERMS makes itself (a draft or special draft reaching its WEF, `postings.move`) takes the new
     ship's Command, its Branch from the rating, and its Authority from the batch's authority or signal.

   Check that Drafting, Special Drafting and Reports (Ship History, Nominal Roll, Manning State) still read postings
   as before.
5. **Ships** (Static Tables, Ships). Its type today reads Ship, Base, Training. It becomes **Sea, Land, Training**,
   the live system's own words:
   - the stored values move with the migration, Ship to Sea and Base to Land;
   - the list, the Add and Edit dialogs, the Ships filter wherever a screen filters by type, the reports and the
     printouts all read the new words;
   - the Ships **list shows the Command** as a column, beside Type and Status;
   - Description stays in the dialog.
6. **The demo seed** (`017_record_fields.sql`): fill the new fields for the demo ratings that have next of kin,
   spouses, children and postings, with invented values: addresses, invented e-mails on `cirerms.example`, phone
   numbers in the 080 range. A rating's next of kin all have a Relationship.
7. **Docs and the user guide.** Update the README and CONVENTIONS parts on the record and Static Tables, and the
   user guide chapters that list these dialogs' fields (Ratings Management and Static Tables). Retake their pictures
   with `npm run guide:shots -- --chapter ratings` and `--chapter static-tables` on a fresh database, and look at
   them.
8. **For the later import:** write `docs/legacy/import-map.md`, a short table mapping each new field to its live
   column. It holds column names only: never a record, never SQL from the live script.
   - Next of Kin: `FirstName`, `LastName`, `RelationshipId`, `FullAddress`, `MobileNumber`, `HomeNumber`,
     `EmailAddress`, `PlaceOfWork`, `NextofkinType`.
   - Spouse: `spname`, `spstreet`, `sptown`, `LocalGovernmentId`, `Stateid`, `spphone`, `spemail`, `sppobox`.
   - Children: `chname`, `chstreet`, `chtown`, `LocalGovernmentId`, `Stateid`, `chphone`, `chemail`, `chpobox`,
     `Sextypeid`, `dateofbirth`, `chschool`, `officeaddress`, `occupation`.
   - Postings (`employmenthist`): `branchid`, `signal`, `command`, `decoration`, `Exitmodeid`, `rateid`,
     `fromdate`, `todate`, `Departmentid` (the ship), `remarks`.
   - Ships (`Department`): `Name`, `Description`, `commandid`, `LandSea`.

### Check
- On a fresh database, run these walkthroughs: static-tables, access, demo, drafting, special-drafting, reports and
  discharge. Each must pass in under 5 minutes; fix the expectations the changes legitimately move.
- Look at each changed dialog and tab at 1440 light and 390 dark, with no browser errors and nothing scrolling
  sideways.
- Print a dossier for a rating with next of kin, spouse, children and postings, and read it.

### Report
One `send_message` to the administrator session, then stop.
