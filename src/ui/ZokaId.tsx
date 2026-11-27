import { useEffect, useState } from "react";
import { ZOKA_ID_BACKGROUND, ZOKA_ID_PALETTE, ZOKA_ID_SIDE, zokaId, type ZokaId } from "../lib/zoka-id";

// The Zoka ID of an address: the mosaic and the code that ZKAPriv, ZSilent and
// ZokaScan show for the same address (docs/ZOKA-ID.md of the node repository).

export function useZokaId(short: string | undefined): ZokaId | null {
  const [id, setId] = useState<ZokaId | null>(null);
  useEffect(() => {
    let live = true;
    setId(null);
    if (short) void zokaId(short).then((value) => live && setId(value));
    return () => {
      live = false;
    };
  }, [short]);
  return id;
}

const CELL = 10;
const GAP = 1.4;
const PAD = 3;
const SIDE = PAD * 2 + ZOKA_ID_SIDE * CELL + (ZOKA_ID_SIDE - 1) * GAP;

export function ZokaIdMosaic({ cells, size = 40 }: { cells: number[] | null; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${SIDE} ${SIDE}`}
      role="img"
      aria-label={cells ? "Zoka ID mosaic" : "Zoka ID unavailable"}
      className="zoka-id-mosaic"
    >
      <rect width={SIDE} height={SIDE} rx={6} fill={ZOKA_ID_BACKGROUND} />
      {Array.from({ length: ZOKA_ID_SIDE * ZOKA_ID_SIDE }, (_, i) => (
        <rect
          key={i}
          x={PAD + (i % ZOKA_ID_SIDE) * (CELL + GAP)}
          y={PAD + Math.floor(i / ZOKA_ID_SIDE) * (CELL + GAP)}
          width={CELL}
          height={CELL}
          fill={cells ? ZOKA_ID_PALETTE[cells[i] ?? 0] : "#26262b"}
        />
      ))}
    </svg>
  );
}

export function ZokaIdRow({ short, label = "Zoka ID", size = 40 }: { short: string | undefined; label?: string; size?: number }) {
  const id = useZokaId(short);
  return (
    <div className="zoka-id">
      <ZokaIdMosaic cells={id?.cells ?? null} size={size} />
      <span>
        {label && <span className="label">{label}</span>}
        <span className="zoka-id-code">{id?.code ?? "—"}</span>
      </span>
    </div>
  );
}
