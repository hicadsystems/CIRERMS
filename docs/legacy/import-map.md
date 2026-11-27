# Import map: the record's new fields to the live system's columns

For the later import of the real records (27/11/2026). It names columns only: it holds no record and none of the live
database's script. The old tables and the fields CIRERMS already held are in [ratings.md](ratings.md) and
[static-tables.md](static-tables.md); this page covers what the record-fields change (`20261120_160000_record_fields.sql`)
added, so a loader can fill every field.

Every row is read by its rating (the old person's key becomes the rating's official number, as ratings.md section 1
says), and every Static Tables value is found by its code or name before the row is written. A value that has no match
goes to the exceptions report, never silently dropped.

## Next of Kin: live `NextOfKin` to `rating_next_of_kin`

| CIRERMS field | Column | Live column | Notes |
|---|---|---|---|
| First Name | `first_name` | `FirstName` | required |
| Last Name | `last_name` | `LastName` | required |
| Relationship | `next_of_kin_type_id` | `RelationshipId` | Static Tables, Relationship (`ref_next_of_kin_type`) |
| Full Address | `full_address` | `FullAddress` | required |
| Mobile Number | `mobile_number` | `MobileNumber` | required |
| Home Number | `home_number` | `HomeNumber` | |
| Email Address | `email_address` | `EmailAddress` | required |
| Place of Work | `place_of_work` | `PlaceOfWork` | |
| Next of Kin Type | `kin_type` | `NextofkinType` | Main or Alternate |

## Spouse: live `Spouse` to `rating_spouse`

| CIRERMS field | Column | Live column | Notes |
|---|---|---|---|
| Full Name | `name` | `spname` | required |
| Phone Number | `phone_number` | `spphone` | |
| Email Address | `email_address` | `spemail` | |
| Street | `street` | `spstreet` | |
| Town | `town` | `sptown` | |
| State | `state_id` | `Stateid` | Static Tables, States |
| Local Government | `local_government_id` | `LocalGovernmentId` | must belong to the State |
| P.O. Box | `po_box` | `sppobox` | |

## Children: live `Children` to `rating_children`

| CIRERMS field | Column | Live column | Notes |
|---|---|---|---|
| Full Name | `name` | `chname` | required |
| Phone Number | `phone_number` | `chphone` | |
| Email Address | `email_address` | `chemail` | |
| Street | `street` | `chstreet` | |
| Town | `town` | `chtown` | |
| State | `state_id` | `Stateid` | Static Tables, States |
| Local Government | `local_government_id` | `LocalGovernmentId` | must belong to the State |
| P.O. Box | `po_box` | `chpobox` | |
| Sex | `gender_id` | `Sextypeid` | the Gender list (`ref_gender`) |
| Date of Birth | `date_of_birth` | `dateofbirth` | a date, not in the future |
| School | `school` | `chschool` | |
| Office Address | `office_address` | `officeaddress` | |
| Occupation | `occupation` | `occupation` | |

## Postings: live `employmenthist` to `rating_drafting`

| CIRERMS field | Column | Live column | Notes |
|---|---|---|---|
| Branch | `branch_id` | `branchid` | Static Tables, Branch |
| Authority | `authority` | `signal` | free text, the signal |
| Command | `command_id` | `command` | Static Tables, Command |
| Decoration/Award | `decoration` | `decoration` | free text |
| Status | `exit_type_id` | `Exitmodeid` | Static Tables, Exit Type; the row named Active when empty |
| Rate at Posting | `rate_id` | `rateid` | |
| From | `start_date` | `fromdate` | |
| To | `end_date` | `todate` | empty for the current posting |
| Ship or Unit | `ship_id` | `Departmentid` | Static Tables, Ships |
| Remarks | `remarks` | `remarks` | |

The live posting's State and Sub-Branch are not kept (the owner's decision, 27/11/2026).

## Ships: live `Department` to `ref_ship`

| CIRERMS field | Column | Live column | Notes |
|---|---|---|---|
| Ship | `name` | `Name` | |
| Description | `description` | `Description` | |
| Command | `command_id` | `commandid` | Static Tables, Command |
| Type | `type` | `LandSea` | Sea, Land or Training |
