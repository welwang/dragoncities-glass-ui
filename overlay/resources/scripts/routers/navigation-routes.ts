interface NavigationRoute {
    path: string;
    name: string | undefined;
    exact?: boolean;
    permission?: string | string[] | null;
}

const navigation: { account: NavigationRoute[]; server: NavigationRoute[] } = {
    account: [
        { path: '/', name: 'Account', exact: true },
        { path: '/api', name: 'API Credentials' },
        { path: '/ssh', name: 'SSH Keys' },
        { path: '/activity', name: 'Activity' },
    ],
    server: [
        { path: '/', name: 'Console', permission: null, exact: true },
        { path: '/files', name: 'Files', permission: 'file.*' },
        { path: '/files/:action(edit|new)', name: undefined, permission: 'file.*' },
        { path: '/databases', name: 'Databases', permission: 'database.*' },
        { path: '/schedules', name: 'Schedules', permission: 'schedule.*' },
        { path: '/schedules/:id', name: undefined, permission: 'schedule.*' },
        { path: '/users', name: 'Users', permission: 'user.*' },
        { path: '/backups', name: 'Backups', permission: 'backup.*' },
        { path: '/network', name: 'Network', permission: 'allocation.*' },
        { path: '/startup', name: 'Startup', permission: 'startup.*' },
        { path: '/settings', name: 'Settings', permission: ['settings.*', 'file.sftp'] },
        { path: '/activity', name: 'Activity', permission: 'activity.*' },
    ],
};

export default navigation;
