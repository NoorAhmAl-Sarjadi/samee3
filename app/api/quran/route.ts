let jsonData: object;

try {
  jsonData = JSON.parse(fileContent) as object;
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
