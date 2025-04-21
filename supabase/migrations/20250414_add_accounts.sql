-- Add system role to profiles
ALTER TABLE profiles 
ADD COLUMN system_role TEXT CHECK (system_role IN ('admin', 'user')) DEFAULT 'user';

-- Add full_name column to profiles if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Add email column to profiles if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill email from auth.users
UPDATE profiles
SET email = auth.users.email
FROM auth.users
WHERE profiles.user_id = auth.users.id
AND profiles.email IS NULL;

-- Accounts table
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL CHECK (char_length(name) <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- Account members junction table
CREATE TABLE account_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, user_id)
);

-- Account workspaces junction table
CREATE TABLE account_workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, workspace_id)
);

-- Enable RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_workspaces ENABLE ROW LEVEL SECURITY;

-- Account access policies
CREATE POLICY "Users can view accounts they are members of"
    ON accounts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM account_members 
            WHERE account_members.account_id = accounts.id 
            AND account_members.user_id = auth.uid()
        )
    );

-- Drop existing policies
DROP POLICY IF EXISTS "System admins can view all accounts" ON accounts;
DROP POLICY IF EXISTS "System admins can view all" ON account_members;
DROP POLICY IF EXISTS "View own memberships" ON account_members;
DROP POLICY IF EXISTS "Members can view their account members" ON account_members;

-- Simple admin policy for accounts
CREATE POLICY "System admins can view all accounts"
    ON accounts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.system_role = 'admin'
        )
    );

-- First, drop all existing policies for account_members
DROP POLICY IF EXISTS "System admins can view all members" ON account_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON account_members;
DROP POLICY IF EXISTS "Account admins can manage members" ON account_members;

-- Create simpler policies
CREATE POLICY "System admins can view all"
    ON account_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.system_role = 'admin'
        )
    );

CREATE POLICY "View own memberships"
    ON account_members FOR SELECT
    USING (user_id = auth.uid());

-- No recursive checks in these policies
CREATE POLICY "Members can view their account members"
    ON account_members FOR SELECT
    USING (
        account_id IN (
            SELECT account_id FROM account_members
            WHERE user_id = auth.uid()
        )
    );


-- First, drop all existing profile policies
DROP POLICY IF EXISTS "System admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create one simple policy
CREATE POLICY "Basic profile access"
    ON profiles FOR SELECT
    USING (
        auth.uid() = user_id OR
        (SELECT system_role FROM profiles WHERE user_id = auth.uid()) = 'admin'
    );

-- Account workspace access policies
CREATE POLICY "Users can view workspaces in their accounts"
    ON account_workspaces FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM account_members
            WHERE account_members.account_id = account_workspaces.account_id 
            AND account_members.user_id = auth.uid()
        )
    );

CREATE POLICY "System admins can manage workspace access"
    ON account_workspaces
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.system_role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.system_role = 'admin'
        )
    );

-- Allow admins to create accounts
CREATE POLICY "System admins can create accounts"
    ON accounts FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.system_role = 'admin'
        )
    );

-- Allow admins to create workspace assignments
CREATE POLICY "System admins can assign workspaces"
    ON account_workspaces FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.system_role = 'admin'
        )
    );    

-- Allow system admins to manage account members
CREATE POLICY "System admins can manage account members"
    ON account_members
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.system_role = 'admin'
        )
    );

-- Update triggers
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Optional: Workspace access request tracking
CREATE TABLE workspace_access_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    UNIQUE(account_id, workspace_id)
);

-- Access request policies
ALTER TABLE workspace_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their account's requests"
    ON workspace_access_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM account_members
            WHERE account_members.account_id = workspace_access_requests.account_id 
            AND account_members.user_id = auth.uid()
            AND account_members.role IN ('owner', 'admin')
        )
        OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.system_role = 'admin'
        )
    );

CREATE POLICY "System admins can manage access requests"
    ON workspace_access_requests
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.system_role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.system_role = 'admin'
        )
    );

-- Add foreign key for account_members
ALTER TABLE account_members
ADD CONSTRAINT account_members_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(user_id); 