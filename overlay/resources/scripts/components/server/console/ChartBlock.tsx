import React from 'react';
import classNames from 'classnames';
import styles from '@/components/server/console/style.module.css';

/**
 * 控制台的圖表卡片（iOS 健康 App 的排版）：
 * 左上小標題、下面是目前數值（大字），右上是圖例；圖表內縮在卡片圓角裡面，線條不會碰到邊。
 */
interface ChartBlockProps {
    title: string;
    /** 目前數值，例如「12.4%」；沒有資料時傳「—」 */
    value?: React.ReactNode;
    legend?: React.ReactNode;
    children: React.ReactNode;
}

export default ({ title, value, legend, children }: ChartBlockProps) => (
    <div className={classNames(styles.chart_container, 'group')}>
        <div className={styles.chart_header}>
            <div className={'min-w-0'}>
                <h3 className={styles.chart_title}>{title}</h3>
                {value !== undefined && <p className={styles.chart_value}>{value}</p>}
            </div>
            {legend && <div className={styles.chart_legend}>{legend}</div>}
        </div>
        <div className={styles.chart_body}>{children}</div>
    </div>
);
