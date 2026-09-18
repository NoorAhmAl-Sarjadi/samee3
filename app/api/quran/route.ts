import { NextRequest, NextResponse } from "next/server";
import { Mushaf } from "@quran.ws/text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RIWAYAT = [
  "hafs",
  "warsh",
  "qalun",
  "douri",
  "shubah",
  "sousi",
  "bazzi",
] as const;

type Riwaya = (typeof RIWAYAT)[number];

function isValidRiwaya(value: string): value is Riwaya {
  return RIWAYAT.includes(value as Riwaya);
}

const FILES: Record<Exclude<Riwaya, "hafs">, string> = {
  warsh: "data/mushaf/warsh.json",
  qalun: "data/mushaf/qalun.json",
  douri: "data/mushaf/douri.json",
  shubah: "data/mushaf/shubah.json",
  sousi: "data/mushaf/sousi.json",
  bazzi: "data/mushaf/bazzi.json",
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const riwayaParam = (
      searchParams.get("riwaya") || "hafs"
    ).toLowerCase();

    const pageParam = searchParams.get("page") || "1";
    const page = Number(pageParam);

    if (!isValidRiwaya(riwayaParam)) {
      return NextResponse.json(
        {
          error: "الرواية غير مدعومة",
          supported: RIWAYAT,
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(page) || page < 1 || page > 604) {
      return NextResponse.json(
        {
          error: "رقم الصفحة غير صحيح",
          page,
        },
        { status: 400 }
      );
    }

    const mushaf =
      riwayaParam === "hafs"
        ? await Mushaf.hafs()
        : await Mushaf.load(FILES[riwayaParam]);

    const pageData = mushaf.page(page);

    if (!pageData) {
      return NextResponse.json(
        {
          error: "الصفحة غير موجودة",
          riwaya: riwayaParam,
          page,
        },
        { status: 404 }
      );
    }

    const ayahs = pageData.ayahs.map((ayah: any) => ({
      key: ayah.key,
      surah: ayah.surah,
      ayah: ayah.ayah,
      globalAyah: ayah.key,
      text: ayah.text,
    }));

    return NextResponse.json({
      success: true,
      riwaya: riwayaParam,
      page,
      ayahs,
    });
  } catch (error) {
    console.error("QURAN API ERROR:", error);

    return NextResponse.json(
      {
        error: "تعذر تحميل بيانات المصحف حاليًا",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
