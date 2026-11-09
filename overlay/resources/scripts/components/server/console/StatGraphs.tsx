import React, { useEffect, useRef, useState } from 'react';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import { Line } from 'react-chartjs-2';
import { fade, useChart } from '@/components/server/console/chart';
import { bytesToString } from '@/lib/formatters';
import { CloudDownloadIcon, CloudUploadIcon } from '@heroicons/react/solid';
import ChartBlock from '@/components/server/console/ChartBlock';
import Tooltip from '@/components/elements/tooltip/Tooltip';

/** 出站（tx）、入站（rx）的線色；圖例的圖示用同一個顏色 */
const OUT = '#3cc4f5';
const IN = '#ff9f0a';

const tickNumber = (value: string | number) => (typeof value === 'string' ? parseFloat(value) : value);

/** 位元組刻度：0 只寫「0」，其餘換成易讀單位 */
const bytes = (value: number) => (value <= 0 ? '0' : bytesToString(value, 1));

/** 刻度：整數不顯示小數，其餘最多一位 */
const percent = (value: string | number) => `${+tickNumber(value).toFixed(1)}%`;

interface Latest {
    cpu: number;
    memory: number;
    rx: number;
    tx: number;
}

export default () => {
    const status = ServerContext.useStoreState((state) => state.status.value);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);
    const previous = useRef<Record<'tx' | 'rx', number>>({ tx: -1, rx: -1 });
    const [latest, setLatest] = useState<Latest | null>(null);

    const cpu = useChart('CPU', {
        sets: 1,
        options: {
            scales: { y: { suggestedMax: limits.cpu || undefined, ticks: { callback: percent } } },
        },
    });
    // 記憶體的資料單位是 MiB；刻度換算成易讀的 MiB / GiB
    const memory = useChart('Memory', {
        sets: 1,
        options: {
            scales: {
                y: {
                    suggestedMax: limits.memory || undefined,
                    ticks: { callback: (value) => bytes(tickNumber(value) * 1024 * 1024) },
                },
            },
        },
    });
    // 網路：閒置時刻度至少到 1 KiB，不會出現三個「0 Bytes」
    const network = useChart('Network', {
        sets: 2,
        options: {
            scales: {
                y: {
                    suggestedMax: 1024,
                    ticks: { callback: (value) => bytes(tickNumber(value)) },
                },
            },
        },
        callback(opts, index) {
            return {
                ...opts,
                label: !index ? 'Network Out' : 'Network In',
                borderColor: !index ? OUT : IN,
                backgroundColor: fade(!index ? OUT : IN),
            };
        },
    });

    useEffect(() => {
        if (status === 'offline') {
            cpu.clear();
            memory.clear();
            network.clear();
            setLatest(null);
        }
    }, [status]);

    useWebsocketEvent(SocketEvent.STATS, (data: string) => {
        let values: any = {};
        try {
            values = JSON.parse(data);
        } catch (e) {
            return;
        }
        const tx = previous.current.tx < 0 ? 0 : Math.max(0, values.network.tx_bytes - previous.current.tx);
        const rx = previous.current.rx < 0 ? 0 : Math.max(0, values.network.rx_bytes - previous.current.rx);

        cpu.push(values.cpu_absolute);
        memory.push(Math.floor(values.memory_bytes / 1024 / 1024));
        network.push([tx, rx]);
        setLatest({ cpu: values.cpu_absolute, memory: values.memory_bytes, rx, tx });

        previous.current = { tx: values.network.tx_bytes, rx: values.network.rx_bytes };
    });

    const none = '—';

    return (
        <>
            <ChartBlock title={'CPU Load'} value={latest ? `${latest.cpu.toFixed(1)}%` : none}>
                <Line {...cpu.props} />
            </ChartBlock>
            <ChartBlock title={'Memory'} value={latest ? bytesToString(latest.memory) : none}>
                <Line {...memory.props} />
            </ChartBlock>
            <ChartBlock
                title={'Network'}
                value={latest ? bytesToString(latest.rx + latest.tx) : none}
                legend={
                    <>
                        <Tooltip arrow content={'Inbound'}>
                            <span>
                                <CloudDownloadIcon className={'w-4 h-4'} style={{ color: IN }} />
                                {latest ? bytesToString(latest.rx) : none}
                            </span>
                        </Tooltip>
                        <Tooltip arrow content={'Outbound'}>
                            <span>
                                <CloudUploadIcon className={'w-4 h-4'} style={{ color: OUT }} />
                                {latest ? bytesToString(latest.tx) : none}
                            </span>
                        </Tooltip>
                    </>
                }
            >
                <Line {...network.props} />
            </ChartBlock>
        </>
    );
};
