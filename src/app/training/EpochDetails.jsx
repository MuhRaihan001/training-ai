"use client";

import { accuracyOf } from "@/utils/insight";
import { fmtPercent, fmtPrecise, focusRing } from "./ui";

export default function EpochDetails({ history }) {
    const hasVal = history.length > 0 && history.every((h) => Number.isFinite(h.val_loss));
    const hasAcc = history.some((h) => Number.isFinite(accuracyOf(h)));
    const hasValAcc = history.some((h) => Number.isFinite(accuracyOf(h, true)));

    let best = -1;
    if (hasVal) {
        best = 0;
        history.forEach((h, i) => {
            if (h.val_loss < history[best].val_loss) best = i;
        });
    }

    const th = "whitespace-nowrap px-3 py-2 font-medium text-stone-900";
    const td = "whitespace-nowrap px-3 py-1";

    return (
        <section aria-labelledby="epochs-title">
            <details>
                <summary
                    id="epochs-title"
                    className={"cursor-pointer rounded-sm border-b border-stone-200 pb-2 text-sm font-semibold text-stone-900 " + focusRing}
                >
                    Epoch details <span className="font-normal text-stone-500">({history.length} epochs)</span>
                </summary>

                <div
                    role="region"
                    tabIndex={0}
                    aria-label="Per-epoch metrics"
                    className="mt-3 max-h-72 overflow-auto rounded-md border border-stone-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"
                >
                    <table className="w-full text-left font-mono text-xs tabular-nums">
                        <thead className="sticky top-0 bg-stone-100">
                            <tr>
                                <th scope="col" className={th}>Epoch</th>
                                <th scope="col" className={th}>Train loss</th>
                                {hasVal && <th scope="col" className={th}>Val. loss</th>}
                                {hasAcc && <th scope="col" className={th}>Train acc.</th>}
                                {hasValAcc && <th scope="col" className={th}>Val. acc.</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                            {history.map((h, i) => (
                                <tr key={h.epoch ?? i}>
                                    <th scope="row" className={td + " font-normal text-stone-900"}>
                                        {h.epoch ?? i + 1}
                                        {i === best && (
                                            <span className="ml-2 rounded-sm border border-stone-300 bg-stone-100 px-1 py-px font-sans text-[10px] text-stone-700">
                                                best val.
                                            </span>
                                        )}
                                    </th>
                                    <td className={td}>{fmtPrecise(h.loss)}</td>
                                    {hasVal && <td className={td}>{fmtPrecise(h.val_loss)}</td>}
                                    {hasAcc && <td className={td}>{fmtPercent(accuracyOf(h)) ?? "-"}</td>}
                                    {hasValAcc && <td className={td}>{fmtPercent(accuracyOf(h, true)) ?? "-"}</td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </section>
    );
}
