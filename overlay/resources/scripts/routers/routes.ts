import React, { lazy } from 'react';
import ServerConsole from '@/components/server/console/ServerConsoleContainer';
import DatabasesContainer from '@/components/server/databases/DatabasesContainer';
import ScheduleContainer from '@/components/server/schedules/ScheduleContainer';
import UsersContainer from '@/components/server/users/UsersContainer';
import BackupContainer from '@/components/server/backups/BackupContainer';
import NetworkContainer from '@/components/server/network/NetworkContainer';
import StartupContainer from '@/components/server/startup/StartupContainer';
import FileManagerContainer from '@/components/server/files/FileManagerContainer';
import SettingsContainer from '@/components/server/settings/SettingsContainer';
import AccountOverviewContainer from '@/components/dashboard/AccountOverviewContainer';
import AccountApiContainer from '@/components/dashboard/AccountApiContainer';
import AccountSSHContainer from '@/components/dashboard/ssh/AccountSSHContainer';
import ActivityLogContainer from '@/components/dashboard/activity/ActivityLogContainer';
import ServerActivityLogContainer from '@/components/server/ServerActivityLogContainer';
import navigation from '@/routers/navigation-routes';

// Each of the router files is already code split out appropriately — so
// all of the items above will only be loaded in when that router is loaded.
//
// These specific lazy loaded routes are to avoid loading in heavy screens
// for the server dashboard when they're only needed for specific instances.
const FileEditContainer = lazy(() => import('@/components/server/files/FileEditContainer'));
const ScheduleEditContainer = lazy(() => import('@/components/server/schedules/ScheduleEditContainer'));

interface RouteDefinition {
    path: string;
    // If undefined is passed this route is still rendered into the router itself
    // but no navigation link is displayed in the sub-navigation menu.
    name: string | undefined;
    component: React.ComponentType;
    exact?: boolean;
}

interface ServerRouteDefinition extends RouteDefinition {
    permission: string | string[] | null;
}

interface Routes {
    // All of the routes available under "/account"
    account: RouteDefinition[];
    // All of the routes available under "/server/:id"
    server: ServerRouteDefinition[];
}

const accountComponents: Record<string, React.ComponentType> = {
    '/': AccountOverviewContainer,
    '/api': AccountApiContainer,
    '/ssh': AccountSSHContainer,
    '/activity': ActivityLogContainer,
};

const serverComponents: Record<string, React.ComponentType> = {
    '/': ServerConsole,
    '/files': FileManagerContainer,
    '/files/:action(edit|new)': FileEditContainer,
    '/databases': DatabasesContainer,
    '/schedules': ScheduleContainer,
    '/schedules/:id': ScheduleEditContainer,
    '/users': UsersContainer,
    '/backups': BackupContainer,
    '/network': NetworkContainer,
    '/startup': StartupContainer,
    '/settings': SettingsContainer,
    '/activity': ServerActivityLogContainer,
};

export default {
    account: navigation.account.map((route) => ({ ...route, component: accountComponents[route.path] })),
    server: navigation.server.map((route) => ({ ...route, component: serverComponents[route.path] })),
} as Routes;
