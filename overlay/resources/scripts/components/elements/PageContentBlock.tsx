import React, { useEffect } from 'react';
import ContentContainer from '@/components/elements/ContentContainer';
import tw from 'twin.macro';
import FlashMessageRender from '@/components/FlashMessageRender';
import { panelBrand } from '@/system-theme/panel-brand';

export interface PageContentBlockProps {
    title?: string;
    className?: string;
    showFlashKey?: string;
}

const PageContentBlock: React.FC<PageContentBlockProps> = ({ title, showFlashKey, className, children }) => {
    useEffect(() => {
        document.title = title ? `${title} | ${panelBrand.name}` : panelBrand.name;
    }, [title]);

    return (
            <>
                <ContentContainer css={tw`my-4 sm:my-10`} className={className ? `sys-page ${className}` : 'sys-page'}>
                    {showFlashKey && <FlashMessageRender byKey={showFlashKey} css={tw`mb-4`} />}
                    {children}
                </ContentContainer>
                <ContentContainer css={tw`mb-4`}>
                    <p css={tw`text-center text-neutral-500 text-xs`}>
                        <a
                            rel={'noopener nofollow noreferrer'}
                            href={'https://pterodactyl.io'}
                            target={'_blank'}
                            css={tw`no-underline text-neutral-500 hover:text-neutral-300`}
                        >
                            Pterodactyl&reg;
                        </a>
                        &nbsp;&copy; 2015 - {new Date().getFullYear()}
                    </p>
                </ContentContainer>
            </>
    );
};

export default PageContentBlock;
