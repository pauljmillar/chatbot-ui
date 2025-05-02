import { ContentType } from "@/types"
import { isAdmin } from "@/db/admin"
import {
  IconAdjustmentsHorizontal,
  IconBolt,
  IconBooks,
  IconFile,
  IconMessage,
  IconPencil,
  IconRobotFace,
  IconSparkles
} from "@tabler/icons-react"
import { FC, useEffect, useState } from "react"
import { TabsList } from "../ui/tabs"
import { WithTooltip } from "../ui/with-tooltip"
import { ProfileSettings } from "../utility/profile-settings"
import { SidebarSwitchItem } from "./sidebar-switch-item"
import { supabase } from "@/lib/supabase/browser-client"

export const SIDEBAR_ICON_SIZE = 28

interface SidebarSwitcherProps {
  onContentTypeChange: (contentType: ContentType) => void
}

export const SidebarSwitcher: FC<SidebarSwitcherProps> = ({
  onContentTypeChange
}) => {
  const [isUserAdmin, setIsUserAdmin] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (user) {
        const adminStatus = await isAdmin(user.id)
        setIsUserAdmin(adminStatus)
      }
    }
    checkAdmin()
  }, [])

  return (
    <div className="flex flex-col justify-between border-r-2 pb-5">
      <TabsList className="bg-background grid h-[440px] grid-rows-7">
        <SidebarSwitchItem
          icon={<IconMessage size={SIDEBAR_ICON_SIZE} />}
          contentType="chats"
          onContentTypeChange={onContentTypeChange}
        />

        {isUserAdmin && (
          <SidebarSwitchItem
            icon={<IconAdjustmentsHorizontal size={SIDEBAR_ICON_SIZE} />}
            contentType="presets"
            onContentTypeChange={onContentTypeChange}
          />
        )}

        <SidebarSwitchItem
          icon={<IconPencil size={SIDEBAR_ICON_SIZE} />}
          contentType="prompts"
          onContentTypeChange={onContentTypeChange}
        />

        <SidebarSwitchItem
          icon={<IconFile size={SIDEBAR_ICON_SIZE} />}
          contentType="files"
          onContentTypeChange={onContentTypeChange}
        />

        {isUserAdmin && (
          <SidebarSwitchItem
            icon={<IconBooks size={SIDEBAR_ICON_SIZE} />}
            contentType="collections"
            onContentTypeChange={onContentTypeChange}
          />
        )}

        {isUserAdmin && (
          <SidebarSwitchItem
            icon={<IconRobotFace size={SIDEBAR_ICON_SIZE} />}
            contentType="assistants"
            onContentTypeChange={onContentTypeChange}
          />
        )}

        {isUserAdmin && (
          <SidebarSwitchItem
            icon={<IconBolt size={SIDEBAR_ICON_SIZE} />}
            contentType="tools"
            onContentTypeChange={onContentTypeChange}
          />
        )}

        {isUserAdmin && (
          <SidebarSwitchItem
            icon={<IconSparkles size={SIDEBAR_ICON_SIZE} />}
            contentType="models"
            onContentTypeChange={onContentTypeChange}
          />
        )}
      </TabsList>

      <div className="flex flex-col items-center space-y-4">
        {/* TODO */}
        {/* <WithTooltip display={<div>Import</div>} trigger={<Import />} /> */}

        {/* TODO */}
        {/* <Alerts /> */}

        <WithTooltip
          display={<div>Profile Settings</div>}
          trigger={<ProfileSettings />}
        />
      </div>
    </div>
  )
}
