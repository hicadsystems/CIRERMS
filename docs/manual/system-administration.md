---
title: System Administration
summary: Manage accounts, roles and their privileges, reset passwords, read the Audit Trail and set the due rules.
order: 120
module: admin
---

System Administration is for the people who look after who may use CIRERMS and what they may do. It has five pages: **Manage Users**, **Manage Roles**, **Manage Password**, **Audit Trail** and **Settings**.

Every person has one **account**. The account belongs to a rating, and its user name is the rating's Official Number. Every account has one **role**. A role is a set of **privileges**. A privilege is one action (**View**, **Add**, **Edit**, **Delete** or **Approve**) on one screen. The server checks the privileges on every request, and the screens hide what a person may not use.

## Manage Users {#admin-users screen=admin.users}

The page lists the accounts with the user name, the name, the role and the status. Search by name or number, and filter by role and by active state.

![Manage Users](shot:admin-users-list)

### Add an account {#admin-add-account needs="admin.users add"}

1. Open [Manage Users](#admin/users).
2. Press **Add Account**.
3. Find the **Rating**. Type the Official Number or name. Ratings that already have an account are not listed. The Official Number becomes the user name.
4. Choose the **Role**.
5. Choose the **Specialisation** if the person should see only one department's batches and approvals. It is optional.
6. Type the **Phone** and **E-mail** if you have them. They are optional.
7. Press **Add Account**.
8. Read the one-time password. It is shown once. Give it to the person.

The person chooses their own password at the first sign-in.

> **Important:** The one-time password is shown only once and is kept nowhere. Write it down only to give it to the person, and never share it by any other way.

![The Add Account dialog](shot:admin-add-account-dialog)

### Edit an account {#admin-edit-account needs="admin.users edit"}

1. Press the account in the list.
2. Press **Edit**.
3. Change the **Role**, the **Specialisation**, the phone or the e-mail.
4. Press **Save**.

### Deactivate or reactivate an account {#admin-deactivate-account needs="admin.users edit"}

1. Press the account.
2. Press **Deactivate**. The dialog says the person's sessions end now and they cannot sign in until the account is reactivated.
3. Press **Deactivate** again to confirm.
4. To bring the account back, press the account and press **Reactivate**, then confirm.

Nothing is deleted. A rating who is discharged has the account turned off by the system.

### Reset a password from the account {#admin-reset-from-account needs="admin.users edit"}

1. Press the account.
2. Press **Reset Password**.
3. Press **Reset Password** again to confirm. A one-time password is made and shown once.

## Manage Roles {#admin-roles screen=admin.roles}

The page lists the roles with their description, the number of users and the access. The **Administrator** role holds every privilege and is shown as **Full Access**.

![Manage Roles](shot:admin-roles-list)

### Read a role {#admin-read-role needs="admin.roles view"}

1. Open [Manage Roles](#admin/roles).
2. Press a role. The privilege grid opens. Every module's screens are grouped under the module, with only the actions each screen has.
3. A pressed button is a privilege the role holds.

### Add a role {#admin-add-role needs="admin.roles add"}

1. Press **Add Role**.
2. Type the **Role Name**. A **Description** is optional.
3. Press the privileges the role needs. Press **Select All** at a module to take all of its privileges.
4. Press **Add Role**.

### Change or delete a role {#admin-edit-role needs="admin.roles edit"}

1. Press the role.
2. Press privileges to turn them on or off. **Clear** turns off a module's.
3. Press **Save**.
4. {needs="admin.roles delete"} To remove a role no one uses, press **Delete** and confirm.

> **Tip:** Give a role only what its people need. A person who may not open a screen never sees its menu, tab or buttons, and the server refuses the request.

## Manage Password {#admin-password screen=admin.password}

Use this page when someone cannot sign in because they forgot their password. It finds the account without opening Manage Users.

![Manage Password](shot:admin-password-page)

### Reset a password {#admin-reset-password needs="admin.password edit"}

1. Open [Manage Password](#admin/password).
2. Find the **Rating**. Only ratings that have an account are listed.
3. Press the **Reset Password** button and confirm.
4. Read the one-time password. It is shown once.
5. Give it to the person.

A one-time password is made and kept nowhere. The person's sessions end now. At the next sign-in they choose their own password before anything else opens.

## Audit Trail {#admin-audit screen=admin.audit}

The Audit Trail records every action and every saved change: who, when, what, which table and record, and what changed field by field. It also records every sign in, sign out, lock and unlock. It lists the newest first, 25 to a page.

![The Audit Trail](shot:admin-audit-page)

### Search the Audit Trail {#admin-search-audit needs="admin.audit view"}

1. Open [Audit Trail](#admin/audit).
2. Choose an **Action** or a **Table**.
3. Type a user name in **Performed By**, or find an **Official No**.
4. Type dates in **From** and **To**, as dd/mm/yyyy.
5. Press **Search**. Press **Reset** to clear the filters.
6. Press a row to see the entry: who, the time, the table and record, the address, and **What Changed** with the **Before** and **After** of each field.

## Settings {#admin-settings screen=admin.settings}

Settings holds the numbers behind the due rules. There is one card for **Drafting**, **Advancement** and **Discharge**. They are stand-in rules until the real ones are confirmed. A change applies at once, everywhere the rule is used, and the Audit Trail keeps it.

![Settings](shot:admin-settings-page)

### Change a rule {#admin-change-setting needs="admin.settings edit"}

1. Open [Settings](#admin/settings).
2. Read **What this means now** on the card.
3. Press **Edit** on the card.
4. Change the numbers.
5. Press **Save**.

| Card | The numbers |
|---|---|
| **Drafting** | Due after (months on a ship), shown green up to, shown amber up to. Above the amber limit the pill is red |
| **Advancement** | Due after (months in the current rate), shown green up to, shown amber up to |
| **Discharge** | Due at age, due after (years of service), and three thresholds each for the age pill and the service pill |

If the dialog refuses a number, read the line under the field. For example, the amber limit must be higher than the green limit.

```shot admin-users-list
open: #admin/users
as: admin
crop: #app-main
height: 640
marks:
  1: button "Add Account" | Add an account
```

```shot admin-add-account-dialog
open: #admin/users
as: admin
do:
  - click: button "Add Account"
  - wait: button "Add Account"
crop: modal
```

```shot admin-roles-list
open: #admin/roles
as: admin
crop: #app-main
height: 640
marks:
  1: button "Add Role" | Add a role
```

```shot admin-password-page
open: #admin/password
as: admin
crop: #app-main
height: 520
```

```shot admin-audit-page
open: #admin/audit
as: admin
crop: #app-main
height: 700
marks:
  1: button "Search" | Apply the filters
  2: button "Reset" | Clear the filters
```

```shot admin-settings-page
open: #admin/settings
as: admin
crop: #app-main
height: 700
```
