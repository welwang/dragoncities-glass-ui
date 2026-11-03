import React from 'react';
import { NavLink, useLocation, useRouteMatch } from 'react-router-dom';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { ServerContext } from '@/state/server';
import NavigationBar from '@/components/NavigationBar';
import SubNavigation from '@/components/elements/SubNavigation';
import Can from '@/components/elements/Can';
import routes from '@/routers/navigation-routes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

export default () => {
    const location = useLocation();
    const match = useRouteMatch<{ id: string }>('/server/:id');
    const user = useStoreState((state: ApplicationStore) => state.user.data);
    const server = ServerContext.useStoreState((state) => state.server.data);
    const status = ServerContext.useStoreState((state) => state.status.value);
    if (!user || location.pathname.startsWith('/auth')) return null;

    let tabs: React.ReactNode = null;
    if (match && server) {
        tabs = (
            <SubNavigation>
                <div>
                    {routes.server.filter((route) => !!route.name).map((route) => {
                        const link = (
                            <NavLink to={`${match.url}/${route.path}`.replace(/\/+$/, '').replace(/\/\//g, '/')} exact={route.exact}>
                                {route.name}
                            </NavLink>
                        );
                        return route.permission ? (
                            <Can key={route.path} action={route.permission} matchAny>{link}</Can>
                        ) : <React.Fragment key={route.path}>{link}</React.Fragment>;
                    })}
                    {user.rootAdmin && (
                        <a href={`/admin/servers/view/${server.internalId}`} target={'_blank'} rel={'noreferrer'} aria-label={'Manage server'}>
                            <FontAwesomeIcon icon={faExternalLinkAlt} />
                        </a>
                    )}
                </div>
            </SubNavigation>
        );
    } else if (location.pathname.startsWith('/account')) {
        tabs = (
            <SubNavigation>
                <div>
                    {routes.account.filter((route) => !!route.name).map(({ path, name, exact = false }) => (
                        <NavLink key={path} to={`/account/${path}`.replace('//', '/')} exact={exact}>{name}</NavLink>
                    ))}
                </div>
            </SubNavigation>
        );
    }

    return (
        <NavigationBar server={match && server ? { name: server.name, node: server.node, status } : undefined}>
            {tabs}
        </NavigationBar>
    );
};
