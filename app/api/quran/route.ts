import { NextRequest, NextResponse } from "next/server";
import { Mushaf } from "@quran.ws/text";
import { promises as fs } from "fs";
import path from "path";

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const riwaya = (searchParams.get("riwaya") || "hafs").toLowerCase();
    const page = Number(searchParams.get("page") || "1");

    if (!isValidRiwaya(riwaya)) {
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

    let mushaf: Mushaf;

    /**
     * حفص موجود بشكل مدمج داخل الحزمة
     */
    if (riwaya === "hafs") {
      mushaf = await Mushaf.hafs();
    } else {
      /**
       * الروايات الأخرى موجودة داخل الحزمة نفسها:
       * node_modules/@quran.ws/text/data/mushaf/*.json
       */
      const filePath = path.join(
        process.cwd(),
        "node_modules",
        "@quran.ws",
        "text",
        "data",
        "mushaf",
        `${riwaya}.json`
      );

      let fileContent: string;

      try {
        fileContent = await fs.readFile(filePath, "utf8");
      } catch (fileError) {
        console.error("RIWAYA FILE ERROR:", fileError);

        return NextResponse.json(
          {
            error: "ملف الرواية غير موجود داخل الحزمة",
            riwaya,
            expectedFile: filePath,
          },
          { status: 500 }
        );
      }

      let jsonData: unknown;

      try {
        jsonData = JSON.parse(fileContent);
      } catch (jsonError) {
        console.error("RIWAYA JSON ERROR:", jsonError);

        return NextResponse.json(
          {
            error: "ملف الرواية موجود لكن JSON غير صالح",
            riwaya,
          },
          { status: 500 }
        );
      }

      mushaf = Mushaf.fromJson(jsonData);
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

    const ayahs = pageData.ayahs.map((ayah: any) => ({
      key: ayah.key,
      surah: ayah.surah,
      ayah: ayah.ayah,
      globalAyah: ayah.key,
      text: ayah.text,
    }));

    return NextResponse.json({
      success: true,
      riwaya,
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
