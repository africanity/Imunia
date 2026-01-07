import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { useState } from "react";

export function LotLegend() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/50 mb-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-blue-100/50 transition rounded-xl"
      >
        <div className="flex items-center gap-2 flex-1">
          <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <h4 className="text-xs font-semibold text-blue-900">Qu&apos;est-ce qu&apos;un lot ?</h4>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-blue-600 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-blue-600 flex-shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-2 pt-1">
          <p className="text-xs text-blue-800 leading-relaxed">
            Un <strong>lot</strong> représente un ensemble de doses d&apos;un vaccin avec une même date
            d&apos;expiration. Chaque stock peut contenir plusieurs lots, chacun ayant sa propre date
            d&apos;expiration. Les lots permettent de gérer efficacement la traçabilité et le suivi des
            vaccins, notamment pour identifier les doses expirées et optimiser la distribution selon les
            dates d&apos;expiration.
          </p>
        </div>
      )}
    </div>
  );
}
