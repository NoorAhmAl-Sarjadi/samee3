#!/usr/bin/env python3
"""Validate an owner's signed release APK and publish it to the website's download card.

This script copies local files only. It does not push Git, deploy Vercel, or install an app.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
EXPECTED_CERTIFICATE = "e828d46ddaf544e98c5f592373f6d1b4451cfe3ed1f19415043f19b12b598582"


def run(*args):
    result = subprocess.run([str(arg) for arg in args], check=True, capture_output=True, text=True)
    return result.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path, help="Signed release APK, not a debug APK")
    parser.add_argument("--sdk", type=Path, default=os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT"))
    parser.add_argument("--certificate-sha256", default=EXPECTED_CERTIFICATE, help="Expected owner's certificate, never a keystore/password")
    args = parser.parse_args()
    apk = args.apk.resolve()
    if not args.sdk:
        parser.error("Set ANDROID_HOME or pass --sdk to your Android SDK folder.")
    tools = args.sdk / "build-tools" / "35.0.0"
    suffix = ".bat" if os.name == "nt" else ""
    signature = run(tools / ("apksigner" + suffix), "verify", "--verbose", "--print-certs", apk)
    match = re.search(r"Signer #1 certificate SHA-256 digest: ([0-9a-fA-F]+)", signature)
    expected = args.certificate_sha256.replace(":", "").lower()
    if not match or not re.fullmatch(r"[0-9a-f]{64}", expected) or match.group(1).lower() != expected:
        raise SystemExit("APK certificate does not match the existing SAMEE3 app. Download not enabled.")
    badging = run(tools / ("aapt.exe" if os.name == "nt" else "aapt"), "dump", "badging", apk)
    package = re.search(r"package: name='([^']+)' versionCode='([0-9]+)' versionName='([^']+)'", badging)
    if not package or package.group(1) != "app.samee3.quran" or "application-debuggable" in badging:
        raise SystemExit("Expected a non-debuggable app.samee3.quran release APK.")
    with zipfile.ZipFile(apk) as archive:
        if archive.testzip() is not None:
            raise SystemExit("APK is corrupt.")
        required = ["assets/android-bridge.js", "assets/reminders.json", "assets/adhan-catalog.json", "assets/adhan/ali-mulla.mp3", "assets/adhan/makkah-fajr.mp3"]
        required += [f"assets/content/{reading}.json" for reading in ["hafs", "warsh", "qalun", "douri", "shubah", "sousi", "bazzi"]]
        for name in required:
            if name not in archive.namelist():
                raise SystemExit(f"APK is missing {name}")
    version_code = int(package.group(2))
    version_name = package.group(3)
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:[.-][a-zA-Z0-9]+)?", version_name):
        raise SystemExit("Unsafe versionName.")
    gradle = (ROOT / "native/android/app/build.gradle").read_text()
    if str(version_code) != re.search(r"versionCode\s+([0-9]+)", gradle).group(1) or version_name != re.search(r"versionName\s+'([^']+)'", gradle).group(1):
        raise SystemExit("Build the current source version before publishing its download.")
    destination = ROOT / "public/android"
    destination.mkdir(parents=True, exist_ok=True)
    filename = f"Samee3-{version_name}.apk"
    target = destination / filename
    content = apk.read_bytes()
    digest = hashlib.sha256(content).hexdigest()
    manifest_path = destination / "release.json"
    previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    if previous.get("available") and int(previous.get("versionCode", 0)) > version_code:
        raise SystemExit("Refusing to replace a newer release with an older version.")
    # Publish bytes first. The card becomes available only after every validation passes.
    with tempfile.NamedTemporaryFile(dir=destination, suffix=".part", delete=False) as stream:
        stream.write(content)
        temporary = Path(stream.name)
    temporary.replace(target)
    manifest = {
        "available": True, "versionCode": version_code, "versionName": version_name, "minSdk": 26,
        "apkPath": f"/android/{filename}", "sha256": digest, "bytes": len(content), "certificateSha256": expected,
        "notes": ["تصميم سميع الأساسي مع قارئ محلي دون إنترنت", "تذكيرات القرآن والأذكار والحديث وتنبيهات الصلاة", "فحص تحديثات الموقع وإصدارات أندرويد"],
    }
    temp_manifest = destination / "release.json.part"
    temp_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    temp_manifest.replace(manifest_path)
    print(json.dumps({"apk": str(target.relative_to(ROOT)), "manifest": str(manifest_path.relative_to(ROOT)), "versionCode": version_code, "sha256": digest}, ensure_ascii=False))


if __name__ == "__main__":
    main()
