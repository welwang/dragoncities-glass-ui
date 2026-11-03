import React from 'react';
import { Route } from 'react-router';
import { SwitchTransition } from 'react-transition-group';
import Fade from '@/components/elements/Fade';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

const TransitionStack = styled.div`
    ${tw`relative grid`};
    & > div {
        grid-area: 1 / 1;
        min-width: 0;
    }
    & > div:not(:last-child) {
        pointer-events: none;
    }
`;

const TransitionRouter: React.FC = ({ children }) => {
    return (
        <Route
            render={({ location }) => (
                <TransitionStack>
                <SwitchTransition mode={'in-out'}>
                    <Fade
                        timeout={150}
                        key={location.pathname + location.search}
                        in
                        appear={false}
                        unmountOnExit
                        onEnter={(node: HTMLElement) => {
                            const wrapper = node.parentElement!;
                            wrapper.removeAttribute('inert');
                            Array.from(wrapper.parentElement!.children).forEach((sibling) => {
                                if (sibling !== wrapper) sibling.setAttribute('inert', '');
                            });
                        }}
                    >
                        <section>{children}</section>
                    </Fade>
                </SwitchTransition>
                </TransitionStack>
            )}
        />
    );
};

export default TransitionRouter;
