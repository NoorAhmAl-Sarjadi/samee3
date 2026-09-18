import { NextRequest, NextResponse } from "next/server";
import { Mushaf } from "@quran.ws/text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RIWAYA_KEYS = [
  "hafs",
  "warsh",
  "qalun",
  "douri",
  "shubah",
  "sousi",
  "bazzi",
] as const;

type RiwayaKey = (typeof RIWAYA_KEYS)[number];

const RIWAYA_DATA_URLS: Record<Exclude<RiwayaKey, "hafs">, string> = {
  warsh: "https://text.quran.ws/data/mushaf/warsh.json",
  qalun: "https://text.quran.ws/data/mushaf/qalun.json",
  douri: "https://text.quran.ws/data/mushaf/douri.json",
  shubah: "https://text.quran.ws/data/mushaf/shubah.json",
  sousi: "https://text.quran.ws/data/mushaf/sousi.json",
  bazzi: "https://text.quran.ws/data/mushaf/bazzi.json",
};

function isRiwaya(value: string): value is RiwayaKey {
  return RIWAYA_KEYS.includes(value as RiwayaKey);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const riwaya = (searchParams.get("riwaya") || "hafs").toLowerCase();
    const page = Number(searchParams.get("page") || "1");

    if (!isRiwaya(riwaya)) {
      return NextResponse.json(
        {
          error: "الرواية غير مدعومة",
          supported: RIWAYA_KEYS,
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(page) || page < 1) {
      return NextResponse.json(
        { error: "رقم الصفحة غير صحيح" },
        { status: 400 }
      );
    }

    let mushaf: Mushaf;

    // حفص موجود داخل الحزمة نفسها
    if (riwaya === "hafs") {
      mushaf = await Mushaf.hafs();
    } else {
      const url = RIWAYA_DATA_URLS[riwaya];

      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return NextResponse.json(
          {
            error: "فشل تحميل بيانات الرواية",
            riwaya,
            status: response.status,
            url,
            details: body.slice(0, 500),
          },
          { status: 502 }
        );
      }

      const json = await response.json();

      mushaf = Mushaf.fromJson(json);
    }

    const pageData = mushaf.page(page);

    if (!pageData) {
      return NextResponse.json(
        {
          error: "الصفحة غير موجودة",
          riwaya,
          page,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      riwaya,
      page,
      ayahs: pageData.ayahs.map((ayah: any) => ({
        surah: ayah.surah,
        ayah: ayah.ayah,
        globalAyah: ayah.key,
        text: ayah.text,
      })),
    });
  } catch (error) {
    console.error("QURAN API ERROR:", error);

    return NextResponse.json(
      {
        error: "تعذر تحميل بيانات المصحف حاليًا",
        details:
          error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
