import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  AdminAccountView,
  assignWorkspaceToAccount,
  removeWorkspaceFromAccount,
  listAllUsers,
  addAccountMember,
  removeAccountMember
} from "@/db/admin"
import { Tables } from "@/supabase/types"

interface UserProfile {
  id: string
  user_id: string
  display_name: string
  username: string
}

interface AccountCardProps {
  account: AdminAccountView
  availableWorkspaces: Tables<"workspaces">[]
  onUpdate: () => void
}

export function AccountCard({
  account,
  availableWorkspaces,
  onUpdate
}: AccountCardProps) {
  const [selectedWorkspace, setSelectedWorkspace] = useState("")
  const [selectedUserId, setSelectedUserId] = useState("")
  const [newMemberRole, setNewMemberRole] = useState<"admin" | "member">(
    "member"
  )
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([])

  // Load available users
  useEffect(() => {
    const loadUsers = async () => {
      const users = await listAllUsers()
      setAvailableUsers(users)
    }
    loadUsers()
  }, [])

  const handleAddWorkspace = async () => {
    if (!selectedWorkspace) return
    await assignWorkspaceToAccount(account.id, selectedWorkspace)
    setSelectedWorkspace("")
    onUpdate()
  }

  const handleRemoveWorkspace = async (workspaceId: string) => {
    await removeWorkspaceFromAccount(account.id, workspaceId)
    onUpdate()
  }

  const handleAddMember = async () => {
    if (!selectedUserId) return
    await addAccountMember(account.id, selectedUserId, newMemberRole)
    setSelectedUserId("")
    setNewMemberRole("member")
    onUpdate()
  }

  const handleRemoveMember = async (accountId: string, userId: string) => {
    try {
      await removeAccountMember(accountId, userId)
      onUpdate()
    } catch (error) {
      console.error("Error removing member:", error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{account.name}</CardTitle>
        <CardDescription>
          Created: {new Date(account.created_at).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Workspaces Section */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Workspaces</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Add Workspace
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Workspace to Account</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <select
                      className="w-full rounded border p-2"
                      value={selectedWorkspace}
                      onChange={e => setSelectedWorkspace(e.target.value)}
                    >
                      <option value="">Select a workspace...</option>
                      {availableWorkspaces
                        .filter(
                          ws =>
                            !account.workspaces.some(
                              aw => aw.workspace.id === ws.id
                            )
                        )
                        .map(ws => (
                          <option key={ws.id} value={ws.id}>
                            {ws.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      onClick={handleAddWorkspace}
                      disabled={!selectedWorkspace}
                    >
                      Add Workspace
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <ul className="space-y-2">
              {account.workspaces.map(ws => (
                <li
                  key={ws.workspace.id}
                  className="flex items-center justify-between"
                >
                  <span>{ws.workspace.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveWorkspace(ws.workspace.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          {/* Updated Members Section */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Members</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Member to Account</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <select
                      className="w-full rounded border p-2"
                      value={selectedUserId}
                      onChange={e => setSelectedUserId(e.target.value)}
                    >
                      <option value="">Select a user...</option>
                      {availableUsers
                        .filter(
                          user =>
                            !account.members.some(
                              member => member.user.user_id === user.user_id
                            )
                        )
                        .map(user => (
                          <option key={user.id} value={user.user_id}>
                            {user.display_name || user.username}
                          </option>
                        ))}
                    </select>
                    <select
                      className="w-full rounded border p-2"
                      value={newMemberRole}
                      onChange={e =>
                        setNewMemberRole(e.target.value as "admin" | "member")
                      }
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button
                      onClick={handleAddMember}
                      disabled={!selectedUserId}
                    >
                      Add Member
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <ul className="space-y-2">
              {account.members.map(member => (
                <li
                  key={member.user.id}
                  className="flex items-center justify-between"
                >
                  <span>
                    {member.user.display_name} ({member.role})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleRemoveMember(account.id, member.user.user_id)
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
