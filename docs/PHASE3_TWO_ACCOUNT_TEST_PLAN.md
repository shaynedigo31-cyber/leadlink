# LEADLINK — Two-Account End-to-End Security & Functional QA Test Plan

- **Target Supabase Reference**: `nbsmikpzkjmsfkozajhx`
- **Application URL**: `http://localhost:5173/` (or GitHub Pages deploy)
- **Prerequisites**:
  - Migration `0002_phase3_organization_security.sql` applied in Supabase SQL Editor.
  - Forward Migration `0004_activity_invitations_notifications.sql` applied for persistent activity logs, invitations, and notifications.

---

## 1. Test Setup & Roles

| Account Identifier | Role In Test | Auth Credentials / Account Type |
|---|---|---|
| **Account A** (`user_a@leadlink.test`) | Organization Founder & Initial Owner | Authenticated User |
| **Account B** (`user_b@leadlink.test`) | Applicant, New Member & Successor Owner | Authenticated User |
| **Platform Admin** (`admin@leadlink.test`) | Platform Administrator | Authenticated User with `profiles.is_platform_admin = true` |

---

## 2. Step-by-Step Test Sequence

### Step 1: Account A Registers & Creates Organization
1. Log in as **Account A**.
2. Navigate to `/dashboard`.
3. Under "Register an organization", enter:
   - Name: `Robotics Society`
   - Description: `Student organization for autonomous robotics projects.`
4. Click **Create organization**.
5. **Expected Result**:
   - Organization is created in status `pending`.
   - Account A is automatically assigned the `Founder` position and system `Owner` role.
   - Dashboard shows "Awaiting approval".

---

### Step 2: Self-Approval Prevention Check
1. While logged in as **Account A**, attempt to approve the organization (e.g., via browser console / SQL query: `supabase.rpc('set_organization_status', { p_org: orgId, p_status: 'approved' })`).
2. **Expected Result**:
   - Request fails with: `'Only platform administrators can change organization status'` (if standard user) or `'Organization creators and managers cannot approve their own organization'` (if platform admin).

---

### Step 3: Platform Admin Approves Organization
1. Log in as **Platform Admin**.
2. Navigate to `/dashboard`.
3. Locate `Robotics Society` under **Platform Administration: Organization Approvals**.
4. Click **Approve**.
5. **Expected Result**:
   - Organization status changes to `approved`.
   - `Robotics Society` moves out of the pending review queue.

---

### Step 4: Account B Discovers & Requests to Join
1. Log in as **Account B** in a private/incognito window.
2. Navigate to `/discover`.
3. Locate `Robotics Society` in the list (or use search bar).
4. Click **Request to join**.
5. **Expected Result**:
   - Success alert: `"Membership request submitted successfully!"`
   - Badge updates to `Request Pending`.
   - Navigating to `/my-requests` lists `Robotics Society` with status `Pending Review`.

---

### Step 5: Account B Request Cancellation & Re-application
1. On `/my-requests`, click **Cancel request**.
2. **Expected Result**:
   - Request row is deleted.
3. Return to `/discover` and click **Request to join** again.
4. **Expected Result**:
   - Re-application is accepted without errors.

---

### Step 6: Account A Approves Account B
1. Switch back to **Account A**.
2. Navigate to `/org/<orgId>/members`.
3. Switch to the **Pending Requests** tab.
4. Locate **Account B**'s request.
5. In the "Assign role" dropdown, choose `Officer` (or `Member`).
6. Click **Approve**.
7. **Expected Result**:
   - Success alert: `"Member request approved successfully."`
   - Account B appears under **Active Members** with their assigned role.

---

### Step 7: Unauthorized Privilege Escalation Test (Account B)
1. Switch to **Account B**.
2. Open Developer Console and run:
   ```javascript
   await supabase.rpc('assign_org_member_role', {
     p_member: '<Account_B_member_id>',
     p_role: '<Owner_role_id>'
   })
   ```
3. **Expected Result**:
   - Database throws error: `'You cannot change your own role'` or `'Ownership changes must use the ownership transfer operation'`.

---

### Step 8: Custom Role Creation & Privilege Boundary
1. Switch to **Account A** (Owner).
2. Navigate to `/org/<orgId>/settings`.
3. Under **Roles & Permissions**, click **New Custom Role**.
4. Name: `Lead Developer`.
5. Check permissions: `events.manage`, `projects.manage`.
6. Click **Create Role**.
7. Under **Members & Access**, assign `Lead Developer` to **Account B**.
8. **Expected Result**:
   - Account B's role updates successfully.

---

### Step 9: Organization Structure & Officer Appointment via RPC
1. As **Account A**, navigate to `/org/<orgId>/officers`.
2. Locate **Account B** in the Position Assignment table.
3. Click **Edit Title**.
4. Set:
   - Committee: `Programs & Events`
   - Title: `Technical Director`
5. Click **Save Position**.
6. **Expected Result**:
   - Executed via `set_org_member_position` RPC.
   - Account B appears in the Executive & Appointed Officers grid as `Programs & Events - Technical Director`.
   - Direct database table update is NOT performed; permissions are strictly enforced.

---

### Step 10: Persistent Organization Invitation Lifecycle
1. As **Account A**, on `/org/<orgId>/members`, click **Invite Member**.
2. Enter email `invitee@leadlink.test` and select role `Member`.
3. Click **Send Invitation**.
4. **Expected Result**:
   - `create_organization_invitation` RPC records a pending invitation.
   - An event `Invitation Issued` is inserted into `public.activity_logs`.
5. Log in as `invitee@leadlink.test` and navigate to `/invitations`.
6. Click **Accept Invitation**.
7. **Expected Result**:
   - `respond_to_invitation` RPC atomically creates an active membership.
   - Invitation status updates to `accepted`.

---

### Step 11: Activity Log Persistence & Audit Trail
1. As **Account A**, navigate to `/org/<orgId>/activity`.
2. Observe audit trail records querying `public.activity_logs`.
3. Test filter tabs: `all`, `membership`, `role`, `ownership`, `governance`.
4. **Expected Result**:
   - Real database records are displayed with exact timestamps and actor names.
   - Immutability check: Attempting direct client `INSERT` or `DELETE` on `activity_logs` is rejected with `permission denied`.

---

### Step 12: Atomic Ownership Transfer & Final Owner Invariant
1. As **Account A**, on `/org/<orgId>/members`, click **Transfer Ownership**.
2. Select **Account B** from the active members list.
3. Click **Confirm Ownership Transfer**.
4. **Expected Result**:
   - `transfer_organization_ownership` RPC executes atomically.
   - Account B is elevated to `Owner` (`*`).
   - Account A is demoted to `Administrator`.
5. Switch to **Account B** and attempt to leave:
   - Operation fails: `'Transfer ownership before leaving as the final active Owner'`.
