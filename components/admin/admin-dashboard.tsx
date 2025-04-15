"use client"

import { useState, useEffect } from "react"
import {
  AdminAccountView,
  listAllAccounts,
  listAllWorkspaces,
  createAccount,
  assignWorkspaceToAccount
} from "@/db/admin"
import { Tables } from "@/supabase/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccountCard } from "./account-card"

export default function AdminDashboard() {
  const [accounts, setAccounts] = useState<AdminAccountView[]>([])
  const [workspaces, setWorkspaces] = useState<Tables<"workspaces">[]>([])
  const [loading, setLoading] = useState(true)

  // New account form state
  const [newAccountName, setNewAccountName] = useState("")
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([])

  const loadData = async () => {
    try {
      const [accountsData, workspacesData] = await Promise.all([
        listAllAccounts(),
        listAllWorkspaces()
      ])
      setAccounts(accountsData)
      setWorkspaces(workspacesData)
    } catch (error) {
      console.error("Error loading admin data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateAccount = async () => {
    try {
      const account = await createAccount(newAccountName)

      // Assign selected workspaces
      await Promise.all(
        selectedWorkspaces.map(wsId =>
          assignWorkspaceToAccount(account.id, wsId)
        )
      )

      // Refresh data
      const updatedAccounts = await listAllAccounts()
      setAccounts(updatedAccounts)

      // Reset form
      setNewAccountName("")
      setSelectedWorkspaces([])
    } catch (error) {
      console.error("Error creating account:", error)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>

        <Dialog>
          <DialogTrigger asChild>
            <Button>Create Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Account Name</label>
                <Input
                  value={newAccountName}
                  onChange={e => setNewAccountName(e.target.value)}
                  placeholder="Enter account name"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Assign Workspaces</label>
                <select
                  multiple
                  className="w-full rounded border p-2"
                  value={selectedWorkspaces}
                  onChange={e => {
                    const values = Array.from(
                      e.target.selectedOptions,
                      option => option.value
                    )
                    setSelectedWorkspaces(values)
                  }}
                >
                  {workspaces.map(ws => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>

              <Button onClick={handleCreateAccount} disabled={!newAccountName}>
                Create Account
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
          <TabsTrigger value="requests">Access Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <div className="grid gap-4">
            {accounts.map(account => (
              <AccountCard
                key={account.id}
                account={account}
                availableWorkspaces={workspaces}
                onUpdate={loadData}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="workspaces">
          <div className="grid gap-4">
            {workspaces.map(workspace => (
              <Card key={workspace.id}>
                <CardHeader>
                  <CardTitle>{workspace.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Description: {workspace.description}</p>
                  {/* Add more workspace details as needed */}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="requests">
          {/* Add access request management UI */}
        </TabsContent>
      </Tabs>
    </div>
  )
}
